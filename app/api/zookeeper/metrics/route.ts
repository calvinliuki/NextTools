import { NextRequest, NextResponse } from 'next/server';
import { getConnectionById } from '@/lib/db';
import { fetchZooKeeperMetrics } from '@/lib/zookeeper';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { connectionId } = body;

    if (!connectionId) {
      return NextResponse.json(
        { code: 40001, message: '缺少 connectionId', data: null },
        { status: 400 }
      );
    }

    const config = getConnectionById(connectionId);
    if (!config) {
      return NextResponse.json(
        { code: 40401, message: 'ZooKeeper 连接不存在', data: null },
        { status: 404 }
      );
    }

    const metrics = await fetchZooKeeperMetrics(config);

    return NextResponse.json({
      code: 200,
      message: '获取 ZooKeeper 指标成功',
      data: metrics,
    });
  } catch (error: any) {
    console.error('获取 ZooKeeper 指标失败:', error);
    return NextResponse.json(
      { code: 50001, message: `获取失败: ${error?.message || '未知错误'}`, data: null },
      { status: 500 }
    );
  }
}
