import { NextRequest, NextResponse } from 'next/server';
import { getOrCreateDatabaseConnection } from '@/lib/databaseCache';

export async function POST(request: NextRequest) {
  try {
    const { connectionId, tabId, dbName, charset, collate, encoding } = await request.json();

    if (!connectionId || !dbName) {
      return NextResponse.json(
        { code: 400, message: 'Missing parameters' },
        { status: 400 }
      );
    }

    const connection = await getOrCreateDatabaseConnection(connectionId, tabId);
    if (!connection) {
      return NextResponse.json(
        { code: 404, message: 'Database connection not found' },
        { status: 404 }
      );
    }

    const type = connection.type;
    let sql = '';

    if (type === 'mysql') {
      const charSetPart = charset ? ` CHARACTER SET ${charset}` : ' CHARACTER SET utf8mb4';
      const collatePart = collate ? ` COLLATE ${collate}` : ' COLLATE utf8mb4_unicode_ci';
      sql = `CREATE DATABASE \`${dbName}\`${charSetPart}${collatePart}`;
    } else if (type === 'postgresql') {
      const encodingPart = encoding ? ` ENCODING '${encoding}'` : " ENCODING 'UTF8'";
      sql = `CREATE DATABASE "${dbName}"${encodingPart}`;
    } else {
      return NextResponse.json(
        { code: 400, message: `Unsupported database type for creating database: ${type}` },
        { status: 400 }
      );
    }

    try {
      await connection.executeQuery(sql);
      return NextResponse.json({
        code: 200,
        message: 'Database created successfully'
      });
    } catch (queryError: any) {
      console.error('Error executing create database SQL:', queryError);
      return NextResponse.json(
        { code: 500, message: queryError.message || 'Failed to create database' },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('Error creating database:', error);
    return NextResponse.json(
      { code: 500, message: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
