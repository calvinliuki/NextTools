import { NextRequest, NextResponse } from 'next/server';
import { getOrCreateDatabaseConnection } from '@/lib/databaseCache';

// 定义数据库类型映射函数
function mapDbTypeToUnifiedType(dbType: string, dbEngine: 'mysql' | 'postgresql' | 'sqlite'): string {
  if (!dbType) return 'unknown';
  
  const typeLower = dbType.toLowerCase();
  
  // 数值类型
  if (/(int|tinyint|smallint|mediumint|bigint|integer)/.test(typeLower)) {
    return 'integer';
  }
  if (/(float|double|real|decimal|numeric|number|money|smallmoney)/.test(typeLower)) {
    return 'float';
  }
  if (/(bool|bit|boolean)/.test(typeLower)) {
    return 'boolean';
  }
  if (/(datetime|timestamp|time|date|interval)/.test(typeLower)) {
    return 'datetime';
  }
  if (/(text|longtext|mediumtext|tinytext|ntext|clob|xml|json)/.test(typeLower)) {
    return 'text';
  }
  if (/(varchar|nvarchar|char|nchar|bpchar|string|character varying|character)/.test(typeLower)) {
    return 'string';
  }
  if (/(blob|binary|varbinary|image|bytea)/.test(typeLower)) {
    return 'binary';
  }
  
  return 'unknown';
}

export async function POST(request: NextRequest) {
  try {
    const startTime = Date.now(); // 记录开始时间
    const { connectionId, tabId, dbName, tableName, schema, page = 1, limit = 50 } = await request.json();

    if (!connectionId || !dbName || !tableName) {
      return NextResponse.json(
        { code: 400, message: 'Missing required parameters: connectionId, dbName, tableName' },
        { status: 400 }
      );
    }

    // 获取数据库连接
    const connection = await getOrCreateDatabaseConnection(connectionId, tabId, dbName);
    if (!connection) {
      return NextResponse.json(
        { code: 404, message: '无法建立数据库连接' },
        { status: 404 }
      );
    }

    const { type } = connection;
    // 确保 page 和 limit 是有效的数字
    const pageNum = parseInt(page as any) || 1;
    const limitNum = parseInt(limit as any) || 20;
    const offset = (pageNum - 1) * limitNum;

    // 构建分页查询语句 (不查询总条数，以提高性能)
    let query = '';
    if (type === 'mysql') {
      query = `SELECT * FROM \`${dbName}\`.\`${tableName}\` LIMIT ${limitNum} OFFSET ${offset}`;
    } else if (type === 'postgresql') {
      // PostgreSQL 必须使用 "schema"."table" 格式，通常 schema 是从前端传过来的，默认为 public
      const schemaName = schema || 'public';
      query = `SELECT * FROM "${schemaName}"."${tableName}" LIMIT ${limitNum} OFFSET ${offset}`;
    } else if (type === 'sqlite') {
      query = `SELECT * FROM \`${tableName}\` LIMIT ${limitNum} OFFSET ${offset}`;
    } else {
      return NextResponse.json(
        { code: 400, message: `不支持的分页查询数据库类型: ${type}` },
        { status: 400 }
      );
    }

    // 执行查询
    const result = await connection.executeQuery(query);
    const rows = result.rows || [];
    
    // 提取字段信息
    interface ColumnInfo {
      name: string;
      type: string;           // 原始数据库类型
      unifiedType: string;    // 统一后的类型
      isPrimaryKey: boolean;
      nullable: boolean;
      defaultValue: string | null;
    }
    
    let columns: ColumnInfo[] = [];
    
    // 尝试获取详细的列信息
    try {
      if (type === 'mysql') {
        const schemaResult = await connection.executeQuery(`SHOW COLUMNS FROM \`${dbName}\`.\`${tableName}\``);
        columns = schemaResult.rows.map((row: any) => ({
          name: row.Field || row.field,
          type: row.Type || row.type,
          unifiedType: mapDbTypeToUnifiedType(row.Type || row.type, 'mysql'),
          isPrimaryKey: (row.Key || row.key) === 'PRI',
          nullable: (row.Null || row.null) === 'YES',
          defaultValue: row.Default || row.default || null
        }));
      } else if (type === 'postgresql') {
        const schemaName = schema || 'public';
        const schemaResult = await connection.executeQuery(`
          SELECT 
            c.column_name,
            c.data_type,
            c.is_nullable,
            c.column_default,
            CASE WHEN pk.constraint_type = 'PRIMARY KEY' THEN true ELSE false END AS is_primary_key
          FROM information_schema.columns c
          LEFT JOIN (
            SELECT kcu.column_name, tc.constraint_type
            FROM information_schema.key_column_usage kcu
            JOIN information_schema.table_constraints tc 
              ON kcu.constraint_name = tc.constraint_name
            WHERE tc.constraint_type = 'PRIMARY KEY'
              AND kcu.table_name = '${tableName}'
              AND kcu.table_schema = '${schemaName}'
          ) pk ON c.column_name = pk.column_name
          WHERE c.table_schema = '${schemaName}' AND c.table_name = '${tableName}'
          ORDER BY c.ordinal_position
        `);
        columns = schemaResult.rows.map((row: any) => ({
          name: row.column_name || row.COLUMN_NAME,
          type: row.data_type || row.DATA_TYPE,
          unifiedType: mapDbTypeToUnifiedType(row.data_type || row.DATA_TYPE, 'postgresql'),
          isPrimaryKey: Boolean(row.is_primary_key || row.IS_PRIMARY_KEY),
          nullable: (row.is_nullable || row.IS_NULLABLE) === 'YES',
          defaultValue: row.column_default || row.COLUMN_DEFAULT || null
        }));
      } else if (type === 'sqlite') {
        const schemaResult = await connection.executeQuery(`PRAGMA table_info(\`${tableName}\`)`);
        columns = schemaResult.rows.map((row: any) => ({
          name: row.name || row.NAME,
          type: row.type || row.TYPE,
          unifiedType: mapDbTypeToUnifiedType(row.type || row.TYPE, 'sqlite'),
          isPrimaryKey: Boolean(row.pk || row.PK),
          nullable: !Boolean(row.notnull || row.NOTNULL),
          defaultValue: row.dflt_value || row.DFLT_VALUE || null
        }));
      }
    } catch (e) {
      console.warn('获取详细表结构失败，回退到基础列名获取:', e);
      
      // 如果获取详细信息失败，回退到简单的列名获取方式
      if (rows.length > 0) {
        columns = Object.keys(rows[0]).map(name => ({
          name,
          type: 'unknown',
          unifiedType: 'unknown',
          isPrimaryKey: false,
          nullable: true,
          defaultValue: null
        }));
      } else {
        try {
          if (type === 'mysql') {
            const schemaResult = await connection.executeQuery(`SHOW COLUMNS FROM \`${dbName}\`.\`${tableName}\``);
            columns = schemaResult.rows.map((row: any) => ({
              name: row.Field || row.field,
              type: 'unknown',
              unifiedType: 'unknown',
              isPrimaryKey: (row.Key || row.key) === 'PRI',
              nullable: (row.Null || row.null) === 'YES',
              defaultValue: row.Default || row.default || null
            }));
          } else if (type === 'postgresql') {
            const schemaResult = await connection.executeQuery(`SELECT c.column_name FROM information_schema.columns c WHERE c.table_schema = '${dbName}' AND c.table_name = '${tableName}'`);
            columns = schemaResult.rows.map((row: any) => ({
              name: row.column_name || row.COLUMN_NAME,
              type: 'unknown',
              unifiedType: 'unknown',
              isPrimaryKey: false,
              nullable: true,
              defaultValue: null
            }));
          } else if (type === 'sqlite') {
            const schemaResult = await connection.executeQuery(`PRAGMA table_info(\`${tableName}\`)`);
            columns = schemaResult.rows.map((row: any) => ({
              name: row.name || row.NAME,
              type: 'unknown',
              unifiedType: 'unknown',
              isPrimaryKey: Boolean(row.pk || row.PK),
              nullable: !Boolean(row.notnull || row.NOTNULL),
              defaultValue: row.dflt_value || row.DFLT_VALUE || null
            }));
          }
        } catch (fallbackError) {
          console.warn('回退获取列信息也失败:', fallbackError);
          columns = [];
        }
      }
    }

    const executionTime = Date.now() - startTime; // 计算耗时

    return NextResponse.json({
      code: 200,
      message: 'Success',
      data: {
        tableName,
        dbName,
        rows,
        columns,
        executionTime // 添加耗时信息
      }
    });
  } catch (error: any) {
    console.error('Error getting table data:', error);
    return NextResponse.json(
      { code: 500, message: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}