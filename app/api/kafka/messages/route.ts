import { NextRequest, NextResponse } from 'next/server';
import { fetchKafkaMessages } from '@/lib/kafka';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { connectionId, topic, partition, startOffset, limit } = body;

    if (!connectionId || !topic) {
      return NextResponse.json(
        { code: 400, message: 'Missing connectionId or topic in request body' },
        { status: 400 }
      );
    }

    const messages = await fetchKafkaMessages(
      connectionId, 
      topic, 
      partition !== undefined ? partition : null, 
      startOffset || 'latest', 
      limit || 50
    );

    return NextResponse.json({
      code: 200,
      message: 'Success',
      data: messages
    });
  } catch (error: any) {
    console.error('Fetch Kafka messages error:', error);
    return NextResponse.json(
      {
        code: 500,
        message: `Failed to fetch Kafka messages: ${error?.message || 'Unknown error'}`,
        data: null
      },
      { status: 500 }
    );
  }
}
