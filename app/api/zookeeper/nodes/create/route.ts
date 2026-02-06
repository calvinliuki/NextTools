import { NextRequest, NextResponse } from 'next/server';
import zookeeper from 'node-zookeeper-client';
import { getConnectionById } from '@/lib/db';
import { createZooKeeperNode } from '@/lib/zookeeper';

function decodeData(data: string, encoding: string) {
  if (!data) return Buffer.from('');
  switch (encoding) {
    case 'base64':
      return Buffer.from(data, 'base64');
    case 'hex':
      return Buffer.from(data, 'hex');
    default:
      return Buffer.from(data, 'utf8');
  }
}

function resolveCreateMode(mode?: string) {
  switch (mode) {
    case 'ephemeral':
      return zookeeper.CreateMode.EPHEMERAL;
    case 'persistent_sequential':
      return zookeeper.CreateMode.PERSISTENT_SEQUENTIAL;
    case 'ephemeral_sequential':
      return zookeeper.CreateMode.EPHEMERAL_SEQUENTIAL;
    default:
      return zookeeper.CreateMode.PERSISTENT;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { connectionId, path, data, encoding = 'utf8', createMode, createParents } = body;

    if (!connectionId) {
      return NextResponse.json({ code: 40001, message: '缺少 connectionId', data: null }, { status: 400 });
    }

    if (!path || typeof path !== 'string') {
      return NextResponse.json({ code: 40002, message: '缺少节点路径', data: null }, { status: 400 });
    }

    const normalizedPath = path.startsWith('/') ? path.trim() : `/${path.trim()}`;
    const config = getConnectionById(connectionId);
    if (!config) {
      return NextResponse.json({ code: 40401, message: 'ZooKeeper 连接不存在', data: null }, { status: 404 });
    }

    if (config.readOnly) {
      return NextResponse.json({ code: 40301, message: '连接为只读模式，禁止创建节点', data: null }, { status: 403 });
    }

    const payload = decodeData(data || '', encoding);
    const result = await createZooKeeperNode(
      connectionId,
      config,
      normalizedPath,
      payload,
      resolveCreateMode(createMode),
      !!createParents
    );

    return NextResponse.json({ code: 200, message: '创建节点成功', data: result });
  } catch (error: any) {
    console.error('创建 ZooKeeper 节点失败:', error);
    return NextResponse.json(
      { code: 50001, message: `创建失败: ${error?.message || '未知错误'}`, data: null },
      { status: 500 }
    );
  }
}
