import { NextRequest, NextResponse } from 'next/server';
import { getOrCreateDatabaseConnection } from '@/lib/databaseCache';

export async function POST(request: NextRequest) {
  try {
    const { 
      connectionId, 
      tabId, 
      dbName, 
      tableName, 
      row,  // 要删除的行数据（用于构建WHERE条件）
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

    // 获取表结构以确定主键和唯一键
    let primaryKeys: string[] = [];
    let uniqueKeys: string[] = [];

    if (dbType === 'mysql') {
      // 获取主键信息
      const pkResult = await executeQuery(`
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
        WHERE TABLE_SCHEMA = '${escapeString(dbName)}' AND TABLE_NAME = '${escapeString(tableName)}' AND CONSTRAINT_NAME = 'PRIMARY'
        ORDER BY ORDINAL_POSITION
      `);
      
      primaryKeys = pkResult.rows.map((row: any) => row.COLUMN_NAME);

      // 获取唯一约束信息
      const ukResult = await executeQuery(`
        SELECT DISTINCT k.COLUMN_NAME
        FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE k
        JOIN INFORMATION_SCHEMA.TABLE_CONSTRAINTS c ON k.CONSTRAINT_NAME = c.CONSTRAINT_NAME
        WHERE k.TABLE_SCHEMA = '${escapeString(dbName)}' AND k.TABLE_NAME = '${escapeString(tableName)}' AND c.CONSTRAINT_TYPE = 'UNIQUE'
      `);
      
      uniqueKeys = ukResult.rows.map((row: any) => row.COLUMN_NAME);
    } else if (dbType === 'postgresql') {
      const schemaName = schema || 'public';
      // 获取主键信息
      const pkResult = await executeQuery(`
        SELECT a.attname
        FROM pg_index i
        JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
        WHERE i.indrelid = '"${schemaName}"."${tableName}"'::regclass AND i.indisprimary
        ORDER BY a.attnum
      `);
      
      primaryKeys = pkResult.rows.map((row: any) => row.attname);

      // 获取唯一约束信息
      const ukResult = await executeQuery(`
        SELECT a.attname
        FROM pg_index i
        JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
        WHERE i.indrelid = '"${schemaName}"."${tableName}"'::regclass AND i.indisunique AND NOT i.indisprimary
      `);
      
      uniqueKeys = ukResult.rows.map((row: any) => row.attname);
    } else if (dbType === 'sqlite') {
      // 获取主键信息
      const pkResult = await executeQuery(`PRAGMA table_info("${tableName}")`);
      primaryKeys = pkResult.rows
        .filter((row: any) => row.pk === 1)
        .map((row: any) => row.name);

      // SQLite 不直接支持唯一约束的查询，我们需要使用另一种方式
      const indexesResult = await executeQuery(`PRAGMA index_list("${tableName}")`);
      const uniqueIndexes = indexesResult.rows.filter((row: any) => row.unique === 1);
      
      for (const index of uniqueIndexes) {
        const indexInfoResult = await executeQuery(`PRAGMA index_info("${index.name}")`);
        uniqueKeys.push(...indexInfoResult.rows.map((row: any) => row.name));
      }
    }

    // 确定WHERE子句的列 - 优先使用主键，其次唯一键，最后使用所有列
    let whereColumns: string[] = [];
    
    if (primaryKeys.length > 0) {
      whereColumns = primaryKeys;
    } else if (uniqueKeys.length > 0) {
      whereColumns = uniqueKeys;
    } else {
      // 如果没有主键或唯一键，使用所有列
      whereColumns = Object.keys(row);
    }

    // 构建WHERE条件
    const whereConditions = [];

    for (const col of whereColumns) {
      if (row[col] === null || row[col] === undefined) {
        whereConditions.push(`${quoteIdentifier(col, dbType)} IS NULL`);
      } else {
        const escapedValue = escapeValue(row[col], dbType);
        whereConditions.push(`${quoteIdentifier(col, dbType)} = ${escapedValue}`);
      }
    }

    // 构建完整的DELETE语句
    const whereClause = whereConditions.join(' AND ');

    let deleteQuery = '';
    if (dbType === 'mysql') {
      deleteQuery = `DELETE FROM \`${dbName}\`.\`${tableName}\` WHERE ${whereClause}`;
    } else if (dbType === 'postgresql') {
      const schemaName = schema || 'public';
      deleteQuery = `DELETE FROM "${schemaName}"."${tableName}" WHERE ${whereClause}`;
    } else if (dbType === 'sqlite') {
      deleteQuery = `DELETE FROM "${tableName}" WHERE ${whereClause}`;
    }

    // 执行删除
    const queryResult = await executeQuery(deleteQuery);

    return NextResponse.json({
      code: 200,
      message: 'Row deleted successfully',
      affectedRows: queryResult.affectedRows || queryResult.rowCount || 1
    });
  } catch (error: any) {
    console.error('Error deleting row:', error);
    return NextResponse.json(
      { code: 500, message: `Failed to delete row: ${error.message}` },
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