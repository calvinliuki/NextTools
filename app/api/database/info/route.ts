import { NextRequest } from 'next/server';
import { getConnectionById } from '@/lib/db';

interface DatabaseInfo {
  name: string;
  schema: string;
  tables: string[];
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const connectionId = searchParams.get('connectionId');

    if (!connectionId) {
      return Response.json(
        { code: 400, message: 'Missing connectionId parameter' },
        { status: 400 }
      );
    }

    // 获取数据库连接配置
    const connection = getConnectionById(connectionId);
    if (!connection) {
      return Response.json(
        { code: 404, message: 'Database connection not found' },
        { status: 404 }
      );
    }

    // 根据数据库类型执行不同的查询来获取数据库信息
    let query = '';
    switch (connection.databaseType) {
      case 'mysql':
        query = 'SHOW DATABASES;';
        break;
      case 'postgresql':
        query = `
          SELECT datname AS name 
          FROM pg_database 
          WHERE NOT datistemplate AND datname <> 'postgres'
          ORDER BY datname;
        `;
        break;
      case 'sqlite':
        // SQLite 没有数据库的概念，只有一个文件
        return Response.json({
          code: 200,
          message: 'Success',
          data: {
            databases: [{
              name: connection.name,
              schema: 'main',
              tables: [] // 将在单独的API中获取
            }]
          }
        });
      case 'oracle':
        query = 'SELECT DISTINCT owner FROM all_tables ORDER BY owner;';
        break;
      default:
        return Response.json(
          { code: 400, message: 'Unsupported database type' },
          { status: 400 }
        );
    }

    // 执行查询获取数据库列表
    const databases: DatabaseInfo[] = [];
    
    // 这里我们简化处理，实际实现中需要建立连接并执行查询
    // 模拟返回一些数据库信息
    if (connection.databaseType === 'sqlite') {
      databases.push({
        name: connection.name,
        schema: 'main',
        tables: [] // 将在单独的API中获取
      });
    } else {
      // 模拟返回一些数据库
      databases.push(
        { name: 'appdb', schema: 'public', tables: ['users', 'orders', 'products'] },
        { name: 'analytics', schema: 'public', tables: ['events', 'sessions'] }
      );
    }

    return Response.json({
      code: 200,
      message: 'Success',
      data: { databases }
    });
  } catch (error: any) {
    console.error('Error fetching database info:', error);
    return Response.json(
      { code: 500, message: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}