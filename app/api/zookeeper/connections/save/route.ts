import { NextRequest, NextResponse } from 'next/server';
import { connectionNameExistsByType, saveConnection } from '@/lib/db';

interface SaveRequest {
  id?: string;
  name: string;
  mode?: 'standalone' | 'cluster';
  host?: string;
  port?: number;
  clusterNodes?: Array<{ host: string; port: number }>;
  connectionTimeout: number;
  sessionTimeout: number;
  readOnly?: boolean;
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

    if (mode === 'standalone' && (!body.host || !body.host.trim())) {
      return NextResponse.json(
        { code: 40002, message: '主机地址不能为空', data: null },
        { status: 400 }
      );
    }

    if (mode === 'standalone' && (!body.port || body.port < 1 || body.port > 65535)) {
      return NextResponse.json(
        { code: 40003, message: '端口号必须在 1-65535 之间', data: null },
        { status: 400 }
      );
    }

    if (mode === 'cluster' && (!body.clusterNodes || body.clusterNodes.length === 0)) {
      return NextResponse.json(
        { code: 40004, message: '集群模式需要至少一个节点', data: null },
        { status: 400 }
      );
    }

    if (mode === 'cluster' && body.clusterNodes) {
      for (const node of body.clusterNodes) {
        if (!node.host || !node.host.trim()) {
          return NextResponse.json(
            { code: 40005, message: '集群节点地址不能为空', data: null },
            { status: 400 }
          );
        }
        if (!node.port || node.port < 1 || node.port > 65535) {
          return NextResponse.json(
            { code: 40006, message: '集群节点端口必须在 1-65535 之间', data: null },
            { status: 400 }
          );
        }
      }
    }

    if (connectionNameExistsByType('zookeeper', body.name.trim(), body.id)) {
      return NextResponse.json(
        { code: 40901, message: 'ZooKeeper 连接名称已存在', data: null },
        { status: 409 }
      );
    }

    const id = body.id || `zookeeper_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

    const config: any = {
      mode,
      connectionTimeout: body.connectionTimeout || 10,
      sessionTimeout: body.sessionTimeout || 10,
      readOnly: body.readOnly || false,
    };

    if (mode === 'standalone') {
      config.host = body.host?.trim();
      config.port = body.port;
    } else {
      config.clusterNodes = body.clusterNodes?.map(node => ({
        host: node.host.trim(),
        port: node.port,
      }));
    }

    saveConnection(id, body.name.trim(), config);

    return NextResponse.json({
      code: 200,
      message: 'ZooKeeper 连接保存成功',
      data: { id, name: body.name.trim() },
    });
  } catch (error) {
    console.error('保存 ZooKeeper 连接错误:', error);
    return NextResponse.json(
      { code: 50000, message: '服务器内部错误', data: null },
      { status: 500 }
    );
  }
}
