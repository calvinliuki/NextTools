import { NextRequest, NextResponse } from 'next/server';
import { getTopicConsumers } from '@/lib/kafka';

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

    const consumers = await getTopicConsumers(connectionId, topicName);

    return NextResponse.json({
      code: 200,
      message: 'Success',
      data: consumers
    });
  } catch (error: any) {
    console.error('Fetch topic consumers error:', error);
    return NextResponse.json(
      {
        code: 500,
        message: `Failed to fetch topic consumers: ${error?.message || 'Unknown error'}`,
        data: null
      },
      { status: 500 }
    );
  }
}
