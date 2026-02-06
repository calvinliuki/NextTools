import { NextRequest, NextResponse } from 'next/server';
import { getOrCreateDatabaseConnection } from '@/lib/databaseCache';

export async function POST(request: NextRequest) {
  try {
    const { 
      connectionId, 
      tabId, 
      dbName, 
      tableName, 
      row,  // 要插入的新行数据
      schema 
    } = await request.json();

    if (!connectionId || !dbName || !tableName || !row) {
      return NextResponse.json(
        { code: 400, message: 'Missing required parameters: connectionId, dbName, tableName, row' },
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

    // 获取表的所有列信息，包括 nullable 和默认值信息
    interface ColumnInfo {
      name: string;
      nullable: boolean;
      hasDefault: boolean;
      isAutoIncrement: boolean;
    }
    let columnInfos: ColumnInfo[] = [];
    
    console.log(`开始获取表 ${tableName} 的列信息，数据库: ${dbName}, 模式: ${schema}`);
    
    if (dbType === 'mysql') {
      const columnsResult = await executeQuery(`
        SELECT COLUMN_NAME, IS_NULLABLE, COLUMN_DEFAULT, EXTRA
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = '${escapeString(dbName)}' AND TABLE_NAME = '${escapeString(tableName)}'
        ORDER BY ORDINAL_POSITION
      `);
      columnInfos = columnsResult.rows.map((row: any) => ({
        name: row.COLUMN_NAME,
        nullable: row.IS_NULLABLE === 'YES',
        hasDefault: row.COLUMN_DEFAULT !== null,
        isAutoIncrement: row.EXTRA?.includes('auto_increment') || false
      }));
    } else if (dbType === 'postgresql') {
      const schemaName = schema || 'public';
      console.log(`PostgreSQL查询列信息，模式: ${schemaName}, 表: ${tableName}`);
      const columnsResult = await executeQuery(`
        SELECT 
          c.column_name,
          c.is_nullable,
          c.column_default,
          CASE WHEN c.column_default LIKE 'nextval%' THEN true ELSE false END as is_serial
        FROM information_schema.columns c
        WHERE c.table_schema = '${schemaName}' AND c.table_name = '${escapeString(tableName)}'
        ORDER BY c.ordinal_position
      `);
      columnInfos = columnsResult.rows.map((row: any) => ({
        name: row.column_name,
        nullable: row.is_nullable === 'YES',
        hasDefault: row.column_default !== null,
        isAutoIncrement: row.is_serial === true || row.column_default?.includes('nextval')
      }));
      console.log(`PostgreSQL获取到的列信息:`, columnInfos);
    } else if (dbType === 'sqlite') {
      const columnsResult = await executeQuery(`PRAGMA table_info("${tableName}")`);
      columnInfos = columnsResult.rows.map((row: any) => ({
        name: row.name,
        nullable: row.notnull === 0,
        hasDefault: row.dflt_value !== null,
        isAutoIncrement: row.pk === 1 // SQLite 的 INTEGER PRIMARY KEY 自动成为 ROWID 别名
      }));
    }

    // 构建INSERT语句的列和值
    console.log(`要插入的行数据:`, row);
    console.log(`表中存在的列信息:`, columnInfos);
    
    const insertColumns: string[] = [];
    const insertValues: string[] = [];
    
    for (const [key, value] of Object.entries(row)) {
      const colInfo = columnInfos.find(c => c.name === key);
      console.log(`处理列 ${key}: 值="${value}", 类型="${typeof value}", 列信息:`, colInfo);
      
      // 检查列是否存在
      if (!colInfo) {
        console.log(`跳过列（不在表中）: ${key}`);
        continue;
      }
      
      // 如果值为 null
      if (value === null || value === undefined) {
        // 如果列有自增或默认值，跳过该列，让数据库自动处理
        if (colInfo.isAutoIncrement || colInfo.hasDefault) {
          console.log(`跳过列（值为空且有自增/默认值）: ${key}`);
          continue;
        }
        // 如果列可以为空，则插入 NULL
        if (colInfo.nullable) {
          insertColumns.push(quoteIdentifier(key, dbType));
          insertValues.push('NULL');
          console.log(`添加列（可为空）: ${key} = NULL`);
          continue;
        }
        // 如果列不可为空且没有默认值，跳过（让数据库报错或使用其他机制）
        console.log(`跳过列（值为空且不可为空无默认值）: ${key}`);
        continue;
      }
      
      // 值不为空，正常添加
      insertColumns.push(quoteIdentifier(key, dbType));
      const escapedValue = escapeValue(value, dbType);
      insertValues.push(escapedValue);
      console.log(`添加列: ${key} = ${escapedValue}`);
    }

    // 如果没有任何列要插入，返回错误
    if (insertColumns.length === 0) {
      return NextResponse.json(
        { code: 400, message: '没有有效的数据可插入，请至少填写一个字段' },
        { status: 400 }
      );
    }

    // 构建完整的INSERT语句
    let insertQuery = '';
    if (dbType === 'mysql') {
      insertQuery = `INSERT INTO \`${dbName}\`.\`${tableName}\` (${insertColumns.join(', ')}) VALUES (${insertValues.join(', ')})`;
    } else if (dbType === 'postgresql') {
      const schemaName = schema || 'public';
      insertQuery = `INSERT INTO "${schemaName}"."${tableName}" (${insertColumns.join(', ')}) VALUES (${insertValues.join(', ')})`;
    } else if (dbType === 'sqlite') {
      insertQuery = `INSERT INTO "${tableName}" (${insertColumns.join(', ')}) VALUES (${insertValues.join(', ')})`;
    }

    console.log(`执行插入查询: ${insertQuery}`);
    
    // 执行插入
    console.log(`执行插入操作前检查:`, {
      insertQuery,
      dbType,
      connection: !!connection
    });
    
    const queryResult = await executeQuery(insertQuery);
    console.log(`插入操作结果:`, queryResult);

    return NextResponse.json({
      code: 200,
      message: 'Row inserted successfully',
      affectedRows: queryResult.affectedRows || queryResult.rowCount || 1
    });
  } catch (error: any) {
    console.error('Error inserting row:', error);
    return NextResponse.json(
      { code: 500, message: `Failed to insert row: ${error.message}` },
      { status: 500 }
    );
  }
}

// 辅助函数：根据数据库类型引用标识符
function quoteIdentifier(identifier: string, dbType: string): string {
  if (dbType === 'mysql') {
    return `\`${identifier}\``;
  } else if (dbType === 'postgresql' || dbType === 'sqlite') {
    return `"${identifier}"`;
  }
  return identifier;
}

// 转义字符串值以防止SQL注入
function escapeString(str: string): string {
  return str.replace(/'/g, "''");
}

// 根据值类型和数据库类型转义值
function escapeValue(value: any, dbType: string): string {
  if (value === null || value === undefined) {
    return 'NULL';
  }
  
  if (typeof value === 'string') {
    if (dbType === 'postgresql') {
      // PostgreSQL 使用两个单引号转义
      return `'${value.replace(/'/g, "''")}'`;
    } else if (dbType === 'mysql') {
      // MySQL 使用反斜杠转义，但在SQL语句中使用两个单引号更安全
      return `'${value.replace(/'/g, "''")}'`;
    } else if (dbType === 'sqlite') {
      // SQLite 使用两个单引号转义
      return `'${value.replace(/'/g, "''")}'`;
    }
  } else if (typeof value === 'number') {
    return value.toString();
  } else if (typeof value === 'boolean') {
    if (dbType === 'postgresql') {
      return value ? 'TRUE' : 'FALSE';
    } else {
      return value ? '1' : '0';
    }
  }
  
  // 默认情况下转为字符串
  return `'${String(value).replace(/'/g, "''")}'`;
}