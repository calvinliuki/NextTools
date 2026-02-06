import { NextRequest, NextResponse } from 'next/server';
import { getOrCreateDatabaseConnection } from '@/lib/databaseCache';

export async function POST(request: NextRequest) {
  try {
    const { connectionId, tabId, dbName, tableName, schema, operations } = await request.json();

    if (!connectionId || !dbName || !tableName || !operations) {
      return NextResponse.json(
        { code: 400, message: 'Missing required parameters' },
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

    // 执行索引操作
    const results: any = {
      created: [],
      modified: [],
      deleted: [],
      errors: []
    };

    // 处理删除的索引
    for (const indexName of operations.deleted || []) {
      try {
        if (indexName === 'PRIMARY') {
          // 主键不允许删除
          results.errors.push(`主键索引 ${indexName} 不允许删除`);
          continue;
        }

        if (dbType === 'mysql') {
          await executeQuery(`ALTER TABLE \`${dbName}\`.\`${tableName}\` DROP INDEX \`${indexName}\``);
        } else if (dbType === 'postgresql') {
          await executeQuery(`DROP INDEX IF EXISTS ${indexName}`);
        } else if (dbType === 'sqlite') {
          await executeQuery(`DROP INDEX IF EXISTS ${indexName}`);
        }
        results.deleted.push(indexName);
      } catch (error: any) {
        results.errors.push(`删除索引 ${indexName} 失败: ${error.message}`);
      }
    }

    // 处理创建的索引
    for (const index of operations.created || []) {
      try {
        let sql = '';
        const columns = index.columns.map((col: any) => `\`${col.name}\` ${col.order || 'ASC'}`).join(', ');

        if (dbType === 'mysql') {
          if (index.indexType === 'FULLTEXT') {
            sql = `ALTER TABLE \`${dbName}\`.\`${tableName}\` ADD FULLTEXT KEY \`${index.name}\` (${index.columns.map((col: any) => `\`${col.name}\``).join(', ')})`;
          } else if (index.indexType === 'UNIQUE' || index.unique) {
            sql = `ALTER TABLE \`${dbName}\`.\`${tableName}\` ADD UNIQUE KEY \`${index.name}\` (${columns})`;
          } else {
            sql = `ALTER TABLE \`${dbName}\`.\`${tableName}\` ADD INDEX \`${index.name}\` (${columns})`;
          }
          await executeQuery(sql);
          
          // MySQL 索引本身不支持注释，但记录到日志供参考
          if (index.comment) {
            console.log(`Index ${index.name} comment (MySQL does not support index comments natively): ${index.comment}`);
          }
        } else if (dbType === 'postgresql') {
          const schemaName = schema || 'public';
          if (index.indexType === 'UNIQUE' || index.unique) {
            sql = `CREATE UNIQUE INDEX ${index.name} ON ${schemaName}."${tableName}" (${index.columns.map((col: any) => `"${col.name}" ${col.order || 'ASC'}`).join(', ')})`;
          } else {
            sql = `CREATE INDEX ${index.name} ON ${schemaName}."${tableName}" (${index.columns.map((col: any) => `"${col.name}" ${col.order || 'ASC'}`).join(', ')})`;
          }
          await executeQuery(sql);
        } else if (dbType === 'sqlite') {
          if (index.indexType === 'UNIQUE' || index.unique) {
            sql = `CREATE UNIQUE INDEX ${index.name} ON "${tableName}" (${index.columns.map((col: any) => `"${col.name}" ${col.order || 'ASC'}`).join(', ')})`;
          } else {
            sql = `CREATE INDEX ${index.name} ON "${tableName}" (${index.columns.map((col: any) => `"${col.name}" ${col.order || 'ASC'}`).join(', ')})`;
          }
          await executeQuery(sql);
        }
        
        // 为 PostgreSQL 创建后设置注释
        if (dbType === 'postgresql' && index.comment) {
          const schemaName = schema || 'public';
          try {
            const commentSql = `COMMENT ON INDEX ${index.name} IS '${index.comment.replace(/'/g, "''")}'`;
            await executeQuery(commentSql);
          } catch (commentErr: any) {
            console.warn(`Failed to set comment for index ${index.name}: ${commentErr.message}`);
          }
        }
        
        results.created.push(index.name);
      } catch (error: any) {
        results.errors.push(`创建索引 ${index.name} 失败: ${error.message}`);
      }
    }

    // 处理修改的索引（删除旧索引，创建新索引）
    for (const index of operations.modified || []) {
      try {
        if (index.originalName && index.originalName !== index.name) {
          // 索引名改变，先删除旧索引
          if (dbType === 'mysql') {
            await executeQuery(`ALTER TABLE \`${dbName}\`.\`${tableName}\` DROP INDEX \`${index.originalName}\``);
          } else if (dbType === 'postgresql') {
            await executeQuery(`DROP INDEX IF EXISTS ${index.originalName}`);
          } else if (dbType === 'sqlite') {
            await executeQuery(`DROP INDEX IF EXISTS ${index.originalName}`);
          }
        } else {
          // 字段或其他属性改变，删除旧索引
          if (dbType === 'mysql') {
            await executeQuery(`ALTER TABLE \`${dbName}\`.\`${tableName}\` DROP INDEX \`${index.name}\``);
          } else if (dbType === 'postgresql') {
            await executeQuery(`DROP INDEX IF EXISTS ${index.name}`);
          } else if (dbType === 'sqlite') {
            await executeQuery(`DROP INDEX IF EXISTS ${index.name}`);
          }
        }

        // 创建新索引
        let sql = '';
        const columns = index.columns.map((col: any) => `\`${col.name}\` ${col.order || 'ASC'}`).join(', ');

        if (dbType === 'mysql') {
          if (index.indexType === 'FULLTEXT') {
            sql = `ALTER TABLE \`${dbName}\`.\`${tableName}\` ADD FULLTEXT KEY \`${index.name}\` (${index.columns.map((col: any) => `\`${col.name}\``).join(', ')})`;
          } else if (index.indexType === 'UNIQUE' || index.unique) {
            sql = `ALTER TABLE \`${dbName}\`.\`${tableName}\` ADD UNIQUE KEY \`${index.name}\` (${columns})`;
          } else {
            sql = `ALTER TABLE \`${dbName}\`.\`${tableName}\` ADD INDEX \`${index.name}\` (${columns})`;
          }
          await executeQuery(sql);
          
          // MySQL 索引本身不支持注释，但记录到日志供参考
          if (index.comment) {
            console.log(`Index ${index.name} comment (MySQL does not support index comments natively): ${index.comment}`);
          }
        } else if (dbType === 'postgresql') {
          const schemaName = schema || 'public';
          if (index.indexType === 'UNIQUE' || index.unique) {
            sql = `CREATE UNIQUE INDEX ${index.name} ON ${schemaName}."${tableName}" (${index.columns.map((col: any) => `"${col.name}" ${col.order || 'ASC'}`).join(', ')})`;
          } else {
            sql = `CREATE INDEX ${index.name} ON ${schemaName}."${tableName}" (${index.columns.map((col: any) => `"${col.name}" ${col.order || 'ASC'}`).join(', ')})`;
          }
          await executeQuery(sql);
        } else if (dbType === 'sqlite') {
          if (index.indexType === 'UNIQUE' || index.unique) {
            sql = `CREATE UNIQUE INDEX ${index.name} ON "${tableName}" (${index.columns.map((col: any) => `"${col.name}" ${col.order || 'ASC'}`).join(', ')})`;
          } else {
            sql = `CREATE INDEX ${index.name} ON "${tableName}" (${index.columns.map((col: any) => `"${col.name}" ${col.order || 'ASC'}`).join(', ')})`;
          }
          await executeQuery(sql);
        }
        
        // 为 PostgreSQL 修改后设置注释
        if (dbType === 'postgresql' && index.comment) {
          try {
            const commentSql = `COMMENT ON INDEX ${index.name} IS '${index.comment.replace(/'/g, "''")}'`;
            await executeQuery(commentSql);
          } catch (commentErr: any) {
            console.warn(`Failed to set comment for index ${index.name}: ${commentErr.message}`);
          }
        }
        
        results.modified.push(index.name);
      } catch (error: any) {
        results.errors.push(`修改索引 ${index.name} 失败: ${error.message}`);
      }
    }

    return NextResponse.json({
      code: 200,
      message: 'Index operations completed',
      data: results
    });
  } catch (error: any) {
    console.error('Error updating indices:', error);
    return NextResponse.json(
      { code: 500, message: `Failed to update indices: ${error?.message || 'Unknown error'}` },
      { status: 500 }
    );
  }
}
