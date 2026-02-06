import { NextRequest, NextResponse } from 'next/server';
import { getKafkaClient } from '@/lib/kafka';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { connectionId, topicName } = body;

    if (!connectionId) {
      return NextResponse.json(
        { code: 400, message: 'Missing connectionId in request body' },
        { status: 400 }
      );
    }

    if (!topicName) {
      return NextResponse.json(
        { code: 400, message: 'Missing topicName in request body' },
        { status: 400 }
      );
    }

    const kafka = await getKafkaClient(connectionId);
    const admin = kafka.admin();
    await admin.connect();

    try {
      // 删除指定的topic
      await admin.deleteTopics({
        topics: [topicName],
        timeout: 5000, // 5秒超时
      });

      return NextResponse.json({
        code: 200,
        message: 'Topic deleted successfully',
        data: { topicName }
      });
    } finally {
      await admin.disconnect();
    }
  } catch (error: any) {
    console.error('Delete Kafka topic error:', error);
    return NextResponse.json(
      {
        code: 500,
        message: `Failed to delete Kafka topic: ${error?.message || 'Unknown error'}`,
        data: null
      },
      { status: 500 }
    );
  }
}