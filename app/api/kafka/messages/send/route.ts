import { NextRequest, NextResponse } from 'next/server';
import { sendKafkaMessage } from '@/lib/kafka';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { connectionId, topic, partition, key, value, headers } = body;

    if (!connectionId || !topic || value === undefined) {
      return NextResponse.json(
        { code: 400, message: 'Missing connectionId, topic or value in request body' },
        { status: 400 }
      );
    }

    const result = await sendKafkaMessage(
      connectionId,
      topic,
      partition !== undefined && partition !== null ? Number(partition) : null,
      key,
      value,
      headers
    );

    return NextResponse.json({
      code: 200,
      message: 'Message sent successfully',
      data: result
    });
  } catch (error: any) {
    console.error('Send Kafka message error:', error);
    return NextResponse.json(
      {
        code: 500,
        message: `Failed to send Kafka message: ${error?.message || 'Unknown error'}`,
        data: null
      },
      { status: 500 }
    );
  }
}
