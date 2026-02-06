import { NextRequest, NextResponse } from 'next/server';
import { getConnectionById } from '@/lib/db';
import { deleteZooKeeperNode } from '@/lib/zookeeper';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { connectionId, path, version, recursive } = body;

    if (!connectionId) {
      return NextResponse.json({ code: 40001, message: '缺少 connectionId', data: null }, { status: 400 });
    }

    if (!path || typeof path !== 'string') {
      return NextResponse.json({ code: 40002, message: '缺少节点路径', data: null }, { status: 400 });
    }

    const normalizedPath = path.startsWith('/') ? path.trim() : `/${path.trim()}`;
    if (normalizedPath === '/') {
      return NextResponse.json({ code: 40003, message: '不允许删除根节点', data: null }, { status: 400 });
    }

    const config = getConnectionById(connectionId);
    if (!config) {
      return NextResponse.json({ code: 40401, message: 'ZooKeeper 连接不存在', data: null }, { status: 404 });
    }

    if (config.readOnly) {
      return NextResponse.json({ code: 40301, message: '连接为只读模式，禁止删除节点', data: null }, { status: 403 });
    }

    const targetVersion = typeof version === 'number' ? version : -1;
    const result = await deleteZooKeeperNode(connectionId, config, normalizedPath, targetVersion, !!recursive);

    return NextResponse.json({ code: 200, message: '删除节点成功', data: result });
  } catch (error: any) {
    console.error('删除 ZooKeeper 节点失败:', error);
    return NextResponse.json(
      { code: 50001, message: `删除失败: ${error?.message || '未知错误'}`, data: null },
      { status: 500 }
    );
  }
}
