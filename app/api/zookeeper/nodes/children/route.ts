import { NextRequest, NextResponse } from 'next/server';
import { getConnectionById } from '@/lib/db';
import { fetchZooKeeperNodeChildren } from '@/lib/zookeeper';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { connectionId, path, includeStat } = body;

    if (!connectionId) {
      return NextResponse.json({ code: 40001, message: '缺少 connectionId', data: null }, { status: 400 });
    }

    const normalizedPath = typeof path === 'string' && path.trim() ? (path.startsWith('/') ? path.trim() : `/${path.trim()}`) : '/';

    const config = getConnectionById(connectionId);
    if (!config) {
      return NextResponse.json({ code: 40401, message: 'ZooKeeper 连接不存在', data: null }, { status: 404 });
    }

    const data = await fetchZooKeeperNodeChildren(connectionId, config, normalizedPath, !!includeStat);
    return NextResponse.json({ code: 200, message: '获取子节点成功', data });
  } catch (error: any) {
    console.error('获取 ZooKeeper 子节点失败:', error);
    return NextResponse.json(
      { code: 50001, message: `获取失败: ${error?.message || '未知错误'}`, data: null },
      { status: 500 }
    );
  }
}
