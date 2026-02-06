import { NextRequest, NextResponse } from 'next/server';
import { testZooKeeperConnection } from '@/lib/zookeeper';

interface TestRequest {
  mode?: 'standalone' | 'cluster';
  host?: string;
  port?: number;
  clusterNodes?: Array<{ host: string; port: number }>;
  connectionTimeout?: number;
  sessionTimeout?: number;
  readOnly?: boolean;
}

export async function POST(request: NextRequest) {
  try {
    const body: TestRequest = await request.json();

    const mode = body.mode || 'standalone';

    if (mode === 'cluster') {
      if (!body.clusterNodes || body.clusterNodes.length === 0) {
        return NextResponse.json(
          { code: 40003, message: '集群模式需要至少一个节点', data: null },
          { status: 400 }
        );
      }
    } else {
      if (!body.host || !body.host.trim()) {
        return NextResponse.json(
          { code: 40001, message: '主机地址不能为空', data: null },
          { status: 400 }
        );
      }
      if (!body.port || body.port < 1 || body.port > 65535) {
        return NextResponse.json(
          { code: 40002, message: '端口号必须在 1-65535 之间', data: null },
          { status: 400 }
        );
      }
    }

    const result = await testZooKeeperConnection({
      mode,
      host: body.host,
      port: body.port,
      clusterNodes: body.clusterNodes,
      connectionTimeout: body.connectionTimeout || 5,
      sessionTimeout: body.sessionTimeout || 10,
      readOnly: body.readOnly || false,
    });

    return NextResponse.json({
      code: 200,
      message: '连接测试成功',
      data: {
        connectionString: result.connectionString,
      }
    });
  } catch (error: any) {
    console.error('测试 ZooKeeper 连接错误:', error);
    return NextResponse.json(
      { code: 50001, message: `连接测试失败: ${error?.message || '未知错误'}`, data: null },
      { status: 500 }
    );
  }
}
