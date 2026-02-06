import { NextRequest, NextResponse } from 'next/server';
import { getKafkaClusterInfo, getKafkaDetailedMetrics } from '@/lib/kafka';

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

    // Parallel fetch basic info and detailed metrics
    const [clusterInfo, metrics] = await Promise.all([
      getKafkaClusterInfo(connectionId),
      getKafkaDetailedMetrics(connectionId)
    ]);

    return NextResponse.json({
      code: 200,
      message: 'Success',
      data: {
        ...clusterInfo,
        ...metrics
      }
    });
  } catch (error: any) {
    console.error('Fetch Kafka cluster info error:', error);
    return NextResponse.json(
      {
        code: 500,
        message: `Failed to fetch Kafka info: ${error?.message || 'Unknown error'}`,
        data: null
      },
      { status: 500 }
    );
  }
}
