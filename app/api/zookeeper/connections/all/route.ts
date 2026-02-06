import { NextResponse } from 'next/server';
import { getAllZooKeeperConnections } from '@/lib/db';

export async function GET() {
  try {
    const connections = getAllZooKeeperConnections();
    const formatted = connections.map(conn => ({
      id: conn.id,
      name: conn.name,
      ...conn.config,
      savedAt: conn.created_at,
      clientType: 'ZooKeeper',
    }));

    return NextResponse.json({
      code: 200,
      message: '获取 ZooKeeper 连接列表成功',
      data: formatted,
    });
  } catch (error: any) {
    console.error('获取 ZooKeeper 连接列表错误:', error);
    return NextResponse.json(
      { code: 50000, message: `服务器内部错误：${error?.message || '未知错误'}`, data: null },
      { status: 500 }
    );
  }
}
