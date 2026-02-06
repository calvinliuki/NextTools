import { NextRequest, NextResponse } from 'next/server';
import { getOrCreateDatabaseConnection } from '@/lib/databaseCache';

export async function POST(request: NextRequest) {
  try {
    const { connectionId, tabId, dbName, tableName, schema } = await request.json();

    if (!connectionId || !dbName || !tableName) {
      return NextResponse.json(
        { code: 400, message: 'Missing required parameters: connectionId, dbName, tableName' },
        { status: 400 }
      );
    }

    const connection = await getOrCreateDatabaseConnection(connectionId, tabId, dbName);
    if (!connection) {
      return NextResponse.json(
        { code: 404, message: 'Database connection not found' },
        { status: 404 }
      );
    }

    const { type: dbType, executeQuery } = connection;
    let indices: any[] = [];

    if (dbType === 'mysql') {
      // 获取表的所有索引信息
      const result = await executeQuery(`
        SELECT 
          INDEX_NAME,
          COLUMN_NAME,
          SEQ_IN_INDEX,
          COLLATION,
          CARDINALITY,
          NULLABLE,
          NON_UNIQUE,
          INDEX_TYPE
        FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = '${dbName}' AND TABLE_NAME = '${tableName}'
        ORDER BY INDEX_NAME, SEQ_IN_INDEX
      `);

      // 将结果分组为索引对象
      const indexMap: Map<string, any> = new Map();
      
      result.rows.forEach((row: any) => {
        const indexName = row.INDEX_NAME;
        
        if (!indexMap.has(indexName)) {
          indexMap.set(indexName, {
            name: indexName,
            columns: [],
            unique: row.NON_UNIQUE === 0,
            primary: indexName === 'PRIMARY',
            indexType: 'NORMAL', // NORMAL/UNIQUE/PRIMARY/FULLTEXT
            method: row.INDEX_TYPE || 'BTREE'
          });
        }
        
        const index = indexMap.get(indexName);
        // 根据 INDEX_TYPE 或其他标记判断索引类型
        if (index.primary) {
          index.indexType = 'PRIMARY';
        } else if (row.INDEX_TYPE === 'FULLTEXT') {
          index.indexType = 'FULLTEXT';
        } else if (index.unique) {
          index.indexType = 'UNIQUE';
        } else {
          index.indexType = 'NORMAL';
        }
        
        index.columns.push({
          name: row.COLUMN_NAME,
          seqInIndex: row.SEQ_IN_INDEX,
          collation: row.COLLATION,
          order: row.SEQ_IN_INDEX === 1 ? 'ASC' : 'ASC'
        });
      });

      indices = Array.from(indexMap.values());
    } else if (dbType === 'postgresql') {
      // PostgreSQL 索引查询 - 获取详细信息
      const schemaName = schema || 'public';
      
      // 先查询表的OID和索引基本信息
      const tableOidResult = await executeQuery(`
        SELECT oid FROM pg_class 
        WHERE relname = '${tableName}' 
        AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = '${schemaName}')
      `);
      
      if (!tableOidResult.rows || tableOidResult.rows.length === 0) {
        indices = [];
      } else {
        const tableOid = tableOidResult.rows[0].oid;
        
        // 检查 PostgreSQL 版本以确定是否有 indisconcurrent 字段
        let result: any;
        try {
          // 先尝试使用包含 indisconcurrent 的查询 (PostgreSQL 11+)
          result = await executeQuery(`
            SELECT
              i.relname as index_name,
              ix.indisprimary as is_primary,
              ix.indisunique as is_unique,
              ix.indisconcurrent as is_concurrent,
              a.amname as index_method,
              obj_description(i.oid, 'pg_class') as comment,
              pg_get_indexdef(i.oid) as index_definition
            FROM
              pg_index ix
              JOIN pg_class i ON i.oid = ix.indexrelid
              JOIN pg_am a ON a.oid = i.relam
            WHERE
              ix.indrelid = ${tableOid}
            ORDER BY i.relname
          `);
        } catch (err: any) {
          // 如果字段不存在，使用不包含 indisconcurrent 的查询 (PostgreSQL 10 及更早版本)
          if (err.code === '42703') {
            result = await executeQuery(`
              SELECT
                i.relname as index_name,
                ix.indisprimary as is_primary,
                ix.indisunique as is_unique,
                false as is_concurrent,
                a.amname as index_method,
                obj_description(i.oid, 'pg_class') as comment,
                pg_get_indexdef(i.oid) as index_definition
              FROM
                pg_index ix
                JOIN pg_class i ON i.oid = ix.indexrelid
                JOIN pg_am a ON a.oid = i.relam
              WHERE
                ix.indrelid = ${tableOid}
              ORDER BY i.relname
            `);
          } else {
            throw err;
          }
        }

        const indexMap: Map<string, any> = new Map();
        
        result.rows.forEach((row: any) => {
          const indexName = row.index_name;
          
          if (!indexMap.has(indexName)) {
            indexMap.set(indexName, {
              name: indexName,
              columns: [],
              unique: row.is_unique || false,
              primary: row.is_primary || false,
              method: row.index_method || 'BTREE',
              concurrent: row.is_concurrent || false,
              comment: row.comment || ''
            });
          }
        });

        // 获取每个索引的列信息和 COLLATE
        for (const [indexName, indexObj] of indexMap) {
          try {
            const colResult = await executeQuery(`
              SELECT
                a.attname as column_name,
                a.attnum as column_pos,
                CASE 
                  WHEN o.opcname IS NOT NULL THEN o.opcname
                  ELSE 'default'
                END as opclass,
                CASE 
                  WHEN ix.indoption[a.attnum-1]::int & 1 = 1 THEN 'DESC'
                  ELSE 'ASC'
                END as order_direction
              FROM
                pg_index ix
                JOIN pg_class i ON i.oid = ix.indexrelid
                JOIN pg_class t ON t.oid = ix.indrelid
                JOIN pg_attribute a ON a.attrelid = t.oid
                LEFT JOIN pg_opclass o ON o.oid = ix.indclass[a.attnum-1]
              WHERE
                t.relname = '${tableName}'
                AND t.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = '${schemaName}')
                AND i.relname = '${indexName}'
                AND a.attnum = ANY(ix.indkey)
              ORDER BY a.attnum
            `);
            
            indexObj.columns = colResult.rows.map((row: any) => ({
              name: row.column_name,
              seqInIndex: row.column_pos,
              order: row.order_direction,
              opclass: row.opclass
            }));
          } catch (colErr: any) {
            // 如果获取列信息失败，尝试简化版本（只获取列名）
            console.warn(`Failed to get detailed column info for index ${indexName}, trying simplified query:`, colErr.message);
            try {
              const simplifiedResult = await executeQuery(`
                SELECT
                  a.attname as column_name,
                  a.attnum as column_pos,
                  'ASC' as order_direction
                FROM
                  pg_index ix
                  JOIN pg_class i ON i.oid = ix.indexrelid
                  JOIN pg_class t ON t.oid = ix.indrelid
                  JOIN pg_attribute a ON a.attrelid = t.oid
                WHERE
                  t.relname = '${tableName}'
                  AND t.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = '${schemaName}')
                  AND i.relname = '${indexName}'
                  AND a.attnum = ANY(ix.indkey)
                ORDER BY a.attnum
              `);
              
              indexObj.columns = simplifiedResult.rows.map((row: any) => ({
                name: row.column_name,
                seqInIndex: row.column_pos,
                order: 'ASC',
                opclass: 'default'
              }));
            } catch (err) {
              console.error(`Failed to get column info for index ${indexName}:`, err);
              indexObj.columns = [];
            }
          }
        }

        indices = Array.from(indexMap.values());
      }
    } else if (dbType === 'sqlite') {
      // SQLite 索引查询
      const result = await executeQuery(`
        PRAGMA index_list("${tableName}")
      `);

      for (const indexInfo of result.rows) {
        const indexName = indexInfo.name;
        
        // 获取索引中的列
        const columnResult = await executeQuery(`
          PRAGMA index_info("${indexName}")
        `);
        
        indices.push({
          name: indexName,
          columns: columnResult.rows.map((row: any) => ({
            name: row.name,
            seqInIndex: row.seqno + 1,
            collation: null
          })),
          unique: indexInfo.unique === 1,
          primary: false,
          type: 'BTREE'
        });
      }
    }

    return NextResponse.json({
      code: 200,
      message: 'Success',
      data: {
        tableName,
        dbName,
        indices
      }
    });
  } catch (error: any) {
    console.error('Error getting table indices:', error);
    return NextResponse.json(
      { code: 500, message: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
