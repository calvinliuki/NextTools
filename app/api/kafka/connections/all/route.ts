import { NextResponse } from 'next/server';
import { getAllKafkaConnections } from '@/lib/db';

export async function GET() {
  try {
    const connections = getAllKafkaConnections();
    
    // 格式化返回数据，展平 config 对象，与 Redis 和 SSH 保持一致
    const formattedConnections = connections.map(conn => ({
      id: conn.id,
      name: conn.name,
      ...conn.config,
      savedAt: conn.created_at
    }));

    return NextResponse.json({
      code: 200,
      message: '获取 Kafka 连接列表成功',
      data: formattedConnections
    });
  } catch (error) {
    console.error('获取 Kafka 连接列表错误:', error);
    return NextResponse.json(
      { code: 50000, message: '服务器内部错误', data: null },
      { status: 500 }
    );
  }
}
