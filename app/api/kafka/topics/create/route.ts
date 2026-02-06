import { NextRequest, NextResponse } from 'next/server';
import { createKafkaTopic } from '@/lib/kafka';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { connectionId, topicName, partitions, replicationFactor, configs } = body;

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

    // Validate partitions and replicationFactor if provided
    if (partitions !== undefined && (isNaN(partitions) || partitions <= 0)) {
      return NextResponse.json(
        { code: 400, message: 'Partitions must be a positive integer' },
        { status: 400 }
      );
    }

    if (replicationFactor !== undefined && (isNaN(replicationFactor) || replicationFactor <= 0)) {
      return NextResponse.json(
        { code: 400, message: 'Replication factor must be a positive integer' },
        { status: 400 }
      );
    }

    // Call the create topic function
    await createKafkaTopic(connectionId, topicName, partitions, replicationFactor, configs);

    return NextResponse.json({
      code: 200,
      message: 'Topic created successfully',
      data: { topicName }
    });
  } catch (error: any) {
    console.error('Create Kafka topic error:', error);
    return NextResponse.json(
      {
        code: 500,
        message: `Failed to create Kafka topic: ${error?.message || 'Unknown error'}`,
        data: null
      },
      { status: 500 }
    );
  }
}