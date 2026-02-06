import { NextRequest, NextResponse } from 'next/server';
import { Kafka } from 'kafkajs';

interface TestRequest {
  bootstrapServers: Array<{ host: string; port: number }>;
  clientId?: string;
  securityProtocol: 'PLAINTEXT' | 'SSL' | 'SASL_PLAINTEXT' | 'SASL_SSL';
  saslMechanism?: 'PLAIN' | 'SCRAM-SHA-256' | 'SCRAM-SHA-512' | 'GSSAPI';
  saslUsername?: string;
  saslPassword?: string;
  connectionTimeout: number;
}

export async function POST(request: NextRequest) {
  try {
    const body: TestRequest = await request.json();

    if (!body.bootstrapServers || body.bootstrapServers.length === 0) {
      return NextResponse.json(
        { code: 40001, message: '至少需要一个 Bootstrap 服务器', data: null },
        { status: 400 }
      );
    }

    const brokers = body.bootstrapServers.map(s => `${s.host}:${s.port}`);
    const kafka = new Kafka({
      clientId: body.clientId || 'test-client',
      brokers: brokers,
      connectionTimeout: (body.connectionTimeout || 10) * 1000,
      ssl: body.securityProtocol === 'SSL' || body.securityProtocol === 'SASL_SSL',
      sasl: (body.securityProtocol === 'SASL_PLAINTEXT' || body.securityProtocol === 'SASL_SSL') ? {
        mechanism: (body.saslMechanism || 'plain').toLowerCase(),
        username: body.saslUsername || '',
        password: body.saslPassword || '',
      } as any : undefined,
    });

    const admin = kafka.admin();
    await admin.connect();
    await admin.describeCluster();
    await admin.disconnect();

    return NextResponse.json({
      code: 200,
      message: '连接测试成功',
      data: {
        connectionInfo: brokers.join(', '),
      }
    });
  } catch (error: any) {
    console.error('测试 Kafka 连接错误:', error);
    return NextResponse.json(
      {
        code: 50001,
        message: `连接测试失败: ${error?.message || '未知错误'}`,
        data: null
      },
      { status: 500 }
    );
  }
}
