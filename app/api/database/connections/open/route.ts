import { NextRequest, NextResponse } from 'next/server';
import { getConnectionById } from '@/lib/db';
import { getDatabaseStructure } from '@/lib/databaseCache';

export async function POST(request: NextRequest) {
  try {
    const { id: connectionId, tabId } = await request.json();

    if (!connectionId) {
      return NextResponse.json(
        { code: 400, message: 'Missing connectionId parameter' },
        { status: 400 }
      );
    }

    // 获取数据库连接配置
    const connection = getConnectionById(connectionId);
    if (!connection) {
      return NextResponse.json(
        { code: 404, message: 'Database connection not found' },
        { status: 404 }
      );
    }

    // 获取真实的数据库结构
    let structure = [];
    let connectionError = null;
    try {
      structure = await getDatabaseStructure(connectionId, tabId);
    } catch (error: any) {
      console.error(`获取数据库结构失败 [${connectionId}]:`, error);
      connectionError = error;
      // 如果获取结构失败，返回空结构
      structure = [];
    }
    
    // 如果无法连接且没有获取到任何数据库结构，返回错误
    if (structure.length === 0 && connectionError) {
      return NextResponse.json(
        { 
          code: 500, 
          message: `无法连接到数据库服务器，请检查连接配置和服务器状态。错误: ${connectionError.code || connectionError.message || '未知错误'}` 
        },
        { status: 500 }
      );
    }
    
    // 构建连接信息字符串
    const connectionInfo = `${connection.host || connection.filePath}:${connection.port || ''}`;
    
    return NextResponse.json({
      code: 200,
      message: 'Connected',
      data: {
        databases: structure,  // 使用真实的数据库结构
        connectionInfo
      }
    });
  } catch (error: any) {
    console.error('Error opening database connection:', error);
    return NextResponse.json(
      { code: 500, message: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}