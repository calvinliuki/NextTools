import { NextRequest, NextResponse } from 'next/server';
import { testRedisConnection } from '@/lib/redis';

// 统一响应格式
interface ApiResponse {
  code: number;
  message: string;
  data: any;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // 参数验证
    const mode = body.mode || 'standalone';
    
    if (mode === 'standalone' && (!body.host || !body.port)) {
      return NextResponse.json<ApiResponse>({
        code: 40001,
        message: '参数校验失败：单机模式需要 `host` 和 `port` 字段',
        data: null,
      }, { status: 400 });
    }

    if (mode === 'cluster' && (!body.clusterNodes || body.clusterNodes.length === 0)) {
      return NextResponse.json<ApiResponse>({
        code: 40001,
        message: '参数校验失败：集群模式需要至少一个集群节点',
        data: null,
      }, { status: 400 });
    }



    // 构建连接选项
    const connectionOptions: any = {
      mode,
      password: body.password || undefined,
      username: body.username || undefined,
      securityMode: body.securityMode || 'none',
      connectionTimeout: body.connectionTimeout || 60,
      executionTimeout: body.executionTimeout || 60,
    };

    if (mode === 'standalone') {
      connectionOptions.host = body.host;
      connectionOptions.port = parseInt(body.port, 10);
    } else if (mode === 'cluster') {
      connectionOptions.clusterNodes = body.clusterNodes.map((node: any) => ({
        host: node.host,
        port: parseInt(node.port, 10),
      }));
    }

    // 测试连接
    const result = await testRedisConnection(connectionOptions);

    if (result.success) {
      return NextResponse.json<ApiResponse>({
        code: 200,
        message: result.message,
        data: result.data,
      });
    } else {
      return NextResponse.json<ApiResponse>({
        code: 50001,
        message: result.message,
        data: null,
      }, { status: 500 });
    }
  } catch (error: any) {
    return NextResponse.json<ApiResponse>({
      code: 50000,
      message: `服务器内部错误：${error?.message || '未知错误'}`,
      data: null,
    }, { status: 500 });
  }
}