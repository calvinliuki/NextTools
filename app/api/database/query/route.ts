import { NextRequest, NextResponse } from 'next/server';
import { getOrCreateDatabaseConnection } from '@/lib/databaseCache';

export async function POST(request: NextRequest) {
  try {
    const { connectionId, tabId, query, dbName, schema } = await request.json();

    if (!connectionId || !query) {
      return NextResponse.json(
        { code: 400, message: 'Missing required parameters: connectionId, query' },
        { status: 400 }
      );
    }

    // 获取数据库连接（PostgreSQL需要指定dbName来获取正确的连接）
    const connection = await getOrCreateDatabaseConnection(connectionId, tabId, dbName);
    if (!connection) {
      return NextResponse.json(
        { code: 404, message: '无法建立数据库连接' },
        { status: 404 }
      );
    }

    // 如果是PostgreSQL且指定了schema，需要在执行前设置search_path或修改SQL语句
    let finalQuery = query;
    if (connection.type === 'postgresql' && schema) {
      // 在PostgreSQL中，如果SQL语句没有明确指定schema，设置search_path
      // 这样表名不带schema前缀时会在指定的schema中查找
      if (!query.includes('.') && !query.toLowerCase().includes('set search_path')) {
        finalQuery = `SET search_path TO "${schema}"; ${query}`;
      }
    }

    // 执行 SQL 查询
    const result = await connection.executeQuery(finalQuery);
    const rows = result.rows || [];
    const columns = result.columns || [];
    
    return NextResponse.json({
      code: 200,
      message: 'Query executed successfully',
      data: {
        rows,
        columns,
        currentDb: result.currentDb,
        affectedRows: result.changes
      }
    });
  } catch (error: any) {
    console.error('Error executing query:', error);
    return NextResponse.json(
      { code: 500, message: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}