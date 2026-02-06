import { NextRequest, NextResponse } from 'next/server';
import { getKafkaTopics } from '@/lib/kafka';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { connectionId } = body;

    if (!connectionId) {
      return NextResponse.json(
        { code: 400, message: 'Missing connectionId in request body' },
        { status: 400 }
      );
    }

    const topics = await getKafkaTopics(connectionId);

    return NextResponse.json({
      code: 200,
      message: 'Success',
      data: topics
    });
  } catch (error: any) {
    console.error('Fetch Kafka topics error:', error);
    return NextResponse.json(
      {
        code: 500,
        message: `Failed to fetch Kafka topics: ${error?.message || 'Unknown error'}`,
        data: null
      },
      { status: 500 }
    );
  }
}
