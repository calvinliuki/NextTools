import { NextRequest, NextResponse } from 'next/server';
import { Client } from '@elastic/elasticsearch';

interface TestRequest {
  mode?: 'standalone' | 'cluster';
  protocol?: 'http' | 'https';
  host?: string;
  port?: number;
  nodes?: Array<{ host: string; port: number }>;
  authType?: 'none' | 'basic' | 'apiKey';
  username?: string;
  password?: string;
  apiKey?: string;
  requestTimeout?: number;
}

function buildClientAuth(body: TestRequest) {
  if (body.authType === 'basic' && body.username) {
    return { username: body.username, password: body.password || '' };
  }
  if (body.authType === 'apiKey' && body.apiKey) {
    return { apiKey: body.apiKey };
  }
  return undefined;
}

export async function POST(request: NextRequest) {
  try {
    const body: TestRequest = await request.json();

    const mode = body.mode || 'standalone';
    if (mode === 'cluster') {
      if (!body.nodes || body.nodes.length === 0) {
        return NextResponse.json(
          { code: 40001, message: '集群模式需要至少一个节点', data: null },
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

    const protocol = body.protocol || 'http';
    const timeoutMs = Math.max(1, body.requestTimeout || 5) * 1000;
    const candidates =
      mode === 'cluster'
        ? body.nodes!.map(node => ({ host: node.host.trim(), port: node.port }))
        : [{ host: body.host!.trim(), port: body.port! }];
    const nodes = candidates.map(node => `${protocol}://${node.host}:${node.port}`);

    const client = new Client({
      nodes,
      auth: buildClientAuth(body),
      requestTimeout: timeoutMs,
      maxRetries: 0,
    });

    const info = await client.info();
    const clusterName = info?.cluster_name || '';
    const version = info?.version?.number || '';
    const host = nodes[0]; // 使用配置的第一个节点作为 host

    return NextResponse.json({
      code: 200,
      message: '连接测试成功',
      data: {
        clusterName,
        version,
        node: host,
      },
    });
  } catch (error: any) {
    const message = error?.name === 'AbortError' ? '连接超时' : error?.message || '未知错误';
    console.error('测试 Elastic 连接错误:', error);
    return NextResponse.json(
      { code: 50001, message: `连接测试失败: ${message}`, data: null },
      { status: 500 }
    );
  }
}
