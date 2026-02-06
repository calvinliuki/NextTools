import { NextRequest, NextResponse } from 'next/server';
import { getAllRedisConnections } from '@/lib/db';

// 统一响应格式
interface ApiResponse {
  code: number;
  message: string;
  data: any;
}

export async function GET(request: NextRequest) {
  try {
    // 获取所有 Redis 连接
    const connections = getAllRedisConnections();

    // 格式化返回数据，包含所有配置信息
    const formattedConnections = connections.map(conn => ({
      id: conn.id,
      name: conn.name,
      mode: conn.config.mode || 'standalone',
      host: conn.config.host,
      port: conn.config.port,
      password: conn.config.password || '',
      username: conn.config.username || '',
      securityMode: conn.config.securityMode || 'none',
      defaultFilter: conn.config.defaultFilter || '*',
      namespaceSeparator: conn.config.namespaceSeparator || ':',
      connectionTimeout: conn.config.connectionTimeout || 60,
      executionTimeout: conn.config.executionTimeout || 60,
      dbScanLimit: conn.config.dbScanLimit || 20,
      clusterRedirect: conn.config.clusterRedirect || false,
      clusterNodes: conn.config.clusterNodes,
      savedAt: conn.created_at,
    }));

    return NextResponse.json<ApiResponse>({
      code: 200,
      message: '获取连接列表成功',
      data: formattedConnections,
    });
  } catch (error: any) {
    return NextResponse.json<ApiResponse>({
      code: 50000,
      message: `服务器内部错误：${error?.message || '未知错误'}`,
      data: null,
    }, { status: 500 });
  }
}