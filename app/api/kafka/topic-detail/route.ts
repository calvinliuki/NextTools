import { NextRequest, NextResponse } from 'next/server';
import { getKafkaTopicDetail } from '@/lib/kafka';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { connectionId, topicName } = body;

    if (!connectionId || !topicName) {
      return NextResponse.json(
        { code: 400, message: 'Missing connectionId or topicName in request body' },
        { status: 400 }
      );
    }

    const detail = await getKafkaTopicDetail(connectionId, topicName);

    return NextResponse.json({
      code: 200,
      message: 'Success',
      data: detail
    });
  } catch (error: any) {
    console.error('Fetch Kafka topic detail error:', error);
    return NextResponse.json(
      {
        code: 500,
        message: `Failed to fetch Kafka topic detail: ${error?.message || 'Unknown error'}`,
        data: null
      },
      { status: 500 }
    );
  }
}
