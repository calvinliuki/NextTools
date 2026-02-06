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

    const { type: dbType } = connection;
    let deleteTableSQL = '';

    if (dbType === 'mysql') {
      deleteTableSQL = `DROP TABLE \`${dbName}\`.\`${tableName}\`;`;
    } else if (dbType === 'postgresql') {
      const schemaName = schema || 'public';
      deleteTableSQL = `DROP TABLE "${schemaName}"."${tableName}";`;
    } else if (dbType === 'sqlite') {
      deleteTableSQL = `DROP TABLE "${tableName}";`;
    } else {
      return NextResponse.json(
        { code: 400, message: `Unsupported database type: ${dbType}` },
        { status: 400 }
      );
    }

    try {
      // 执行删除表的SQL
      await connection.executeQuery(deleteTableSQL);

      return NextResponse.json({
        code: 200,
        message: 'Table deleted successfully'
      });
    } catch (queryError: any) {
      console.error('Error executing drop table SQL:', queryError);
      return NextResponse.json(
        { 
          code: 500, 
          message: `Failed to delete table: ${queryError.message}` 
        },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('Error deleting table:', error);
    return NextResponse.json(
      { code: 500, message: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}