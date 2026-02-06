import { NextRequest, NextResponse } from 'next/server';
import { connectionNameExists, connectionNameExistsByType, saveConnection } from '@/lib/db';

interface SaveRequest {
  id?: string;
  name: string;
  bootstrapServers: Array<{ host: string; port: number }>;
  clientId?: string;
  groupId?: string;
  securityProtocol: 'PLAINTEXT' | 'SSL' | 'SASL_PLAINTEXT' | 'SASL_SSL';
  saslMechanism?: 'PLAIN' | 'SCRAM-SHA-256' | 'SCRAM-SHA-512' | 'GSSAPI';
  saslUsername?: string;
  saslPassword?: string;
  sslTruststoreLocation?: string;
  sslTruststorePassword?: string;
  connectionTimeout: number;
  requestTimeout: number;
  sessionTimeout: number;
  heartbeatInterval: number;
  maxPollRecords: number;
}

export async function POST(request: NextRequest) {
  try {
    const body: SaveRequest = await request.json();

    // 验证必填字段
    if (!body.name || !body.name.trim()) {
      return NextResponse.json(
        { code: 40001, message: '连接名称不能为空', data: null },
        { status: 400 }
      );
    }

    if (!body.bootstrapServers || body.bootstrapServers.length === 0) {
      return NextResponse.json(
        { code: 40002, message: '至少需要一个 Bootstrap 服务器', data: null },
        { status: 400 }
      );
    }

    // 验证每个 bootstrap 服务器
    for (const server of body.bootstrapServers) {
      if (!server.host || !server.host.trim()) {
        return NextResponse.json(
          { code: 40003, message: 'Bootstrap 服务器地址不能为空', data: null },
          { status: 400 }
        );
      }
      if (!server.port || server.port < 1 || server.port > 65535) {
        return NextResponse.json(
          { code: 40004, message: '端口号必须在 1-65535 之间', data: null },
          { status: 400 }
        );
      }
    }

    // 检查连接名唯一性（按类型检查，避免不同类型连接名称冲突）
    if (connectionNameExistsByType('kafka', body.name.trim(), body.id)) {
      return NextResponse.json(
        { code: 40901, message: 'Kafka连接名称已存在', data: null },
        { status: 409 }
      );
    }

    // 如果使用 SASL，验证 SASL 配置
    if (body.securityProtocol.includes('SASL')) {
      if (!body.saslMechanism) {
        return NextResponse.json(
          { code: 40005, message: 'SASL 协议需要指定 SASL 机制', data: null },
          { status: 400 }
        );
      }
      if (!body.saslUsername || !body.saslUsername.trim()) {
        return NextResponse.json(
          { code: 40006, message: 'SASL 认证需要用户名', data: null },
          { status: 400 }
        );
      }
      if (!body.saslPassword) {
        return NextResponse.json(
          { code: 40007, message: 'SASL 认证需要密码', data: null },
          { status: 400 }
        );
      }
    }

    // 生成连接 ID
    const id = body.id || `kafka_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // 准备配置数据
    const config = {
      bootstrapServers: body.bootstrapServers,
      clientId: body.clientId || '',
      groupId: body.groupId || '',
      securityProtocol: body.securityProtocol,
      saslMechanism: body.securityProtocol.includes('SASL') ? body.saslMechanism : undefined,
      saslUsername: body.securityProtocol.includes('SASL') ? body.saslUsername || '' : undefined,
      saslPassword: body.securityProtocol.includes('SASL') ? body.saslPassword || '' : undefined,
      sslTruststoreLocation: body.securityProtocol.includes('SSL') ? body.sslTruststoreLocation : undefined,
      sslTruststorePassword: body.securityProtocol.includes('SSL') ? body.sslTruststorePassword : undefined,
      connectionTimeout: body.connectionTimeout,
      requestTimeout: body.requestTimeout,
      sessionTimeout: body.sessionTimeout,
      heartbeatInterval: body.heartbeatInterval,
      maxPollRecords: body.maxPollRecords,
    };

    // 保存连接配置
    saveConnection(id, body.name.trim(), config);

    return NextResponse.json({
      code: 200,
      message: 'Kafka 连接保存成功',
      data: { id, name: body.name.trim() }
    });
  } catch (error) {
    console.error('保存 Kafka 连接错误:', error);
    return NextResponse.json(
      { code: 50000, message: '服务器内部错误', data: null },
      { status: 500 }
    );
  }
}
