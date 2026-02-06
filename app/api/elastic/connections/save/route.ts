import { NextRequest, NextResponse } from 'next/server';
import { connectionNameExistsByType, saveConnection } from '@/lib/db';

interface SaveRequest {
  id?: string;
  name: string;
  mode?: 'standalone' | 'cluster';
  protocol?: 'http' | 'https';
  host?: string;
  port?: number;
  nodes?: Array<{ host: string; port: number }>;
  authType?: 'none' | 'basic' | 'apiKey';
  username?: string;
  password?: string;
  apiKey?: string;
  defaultIndex?: string;
  requestTimeout?: number;
  maxRetries?: number;
  sniffOnStart?: boolean;
  sniffInterval?: number;
}

export async function POST(request: NextRequest) {
  try {
    const body: SaveRequest = await request.json();

    if (!body.name || !body.name.trim()) {
      return NextResponse.json(
        { code: 40001, message: '连接名称不能为空', data: null },
        { status: 400 }
      );
    }

    const mode = body.mode || 'standalone';
    if (mode === 'cluster') {
      if (!body.nodes || body.nodes.length === 0) {
        return NextResponse.json(
          { code: 40002, message: '集群模式需要至少一个节点', data: null },
          { status: 400 }
        );
      }
      for (const node of body.nodes) {
        if (!node.host || !node.host.trim()) {
          return NextResponse.json(
            { code: 40003, message: '集群节点地址不能为空', data: null },
            { status: 400 }
          );
        }
        if (!node.port || node.port < 1 || node.port > 65535) {
          return NextResponse.json(
            { code: 40004, message: '集群节点端口必须在 1-65535 之间', data: null },
            { status: 400 }
          );
        }
      }
    } else {
      if (!body.host || !body.host.trim()) {
        return NextResponse.json(
          { code: 40002, message: '主机地址不能为空', data: null },
          { status: 400 }
        );
      }

      if (!body.port || body.port < 1 || body.port > 65535) {
        return NextResponse.json(
          { code: 40003, message: '端口号必须在 1-65535 之间', data: null },
          { status: 400 }
        );
      }
    }

    if (connectionNameExistsByType('elastic', body.name.trim(), body.id)) {
      return NextResponse.json(
        { code: 40901, message: 'Elastic 连接名称已存在', data: null },
        { status: 409 }
      );
    }

    const id = body.id || `elastic_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

    const config = {
      mode,
      protocol: body.protocol || 'http',
      host: body.host?.trim(),
      port: body.port,
      authType: body.authType || 'none',
      username: body.username || '',
      password: body.password || '',
      apiKey: body.apiKey || '',
      nodes: mode === 'cluster'
        ? (body.nodes?.map(node => ({ host: node.host.trim(), port: node.port })) || [])
        : [],
      defaultIndex: body.defaultIndex || '',
      requestTimeout: body.requestTimeout || 5,
      maxRetries: body.maxRetries || 3,
      sniffOnStart: body.sniffOnStart || false,
      sniffInterval: body.sniffInterval || 0,
    };

    saveConnection(id, body.name.trim(), config);

    return NextResponse.json({
      code: 200,
      message: 'Elastic 连接保存成功',
      data: { id, name: body.name.trim() },
    });
  } catch (error) {
    console.error('保存 Elastic 连接错误:', error);
    return NextResponse.json(
      { code: 50000, message: '服务器内部错误', data: null },
      { status: 500 }
    );
  }
}
