import { NextRequest, NextResponse } from 'next/server';
import { removeCachedDatabaseConnection } from '@/lib/databaseCache';

export async function POST(request: NextRequest) {
  try {
    const { id: connectionId, tabId } = await request.json();

    if (!connectionId) {
      return NextResponse.json(
        { code: 400, message: 'Missing connectionId parameter' },
        { status: 400 }
      );
    }

    // 关闭数据库连接并清理缓存
    await removeCachedDatabaseConnection(connectionId, tabId);
    console.log(`数据库连接已关闭并从缓存中移除: ${connectionId}${tabId ? ':' + tabId : ''}`);
    
    return NextResponse.json({
      code: 200,
      message: 'Connection closed successfully',
      data: null
    });
  } catch (error: any) {
    console.error('Error closing database connection:', error);
    return NextResponse.json(
      { code: 500, message: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}