import { NextRequest, NextResponse } from 'next/server';
import { getConnectionById } from '@/lib/db';
import { buildElasticClient } from '@/lib/elastic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { connectionId, name, shards, replicas, alias } = body;

    if (!connectionId || !name) {
      return NextResponse.json({ code: 40001, message: '缺少 connectionId 或 name', data: null }, { status: 400 });
    }
    if (name.startsWith('.')) {
      return NextResponse.json({ code: 40301, message: '系统索引禁止创建', data: null }, { status: 403 });
    }

    const config = getConnectionById(connectionId);
    if (!config) {
      return NextResponse.json({ code: 40401, message: 'Elastic 连接不存在', data: null }, { status: 404 });
    }

    const client = buildElasticClient(config);
    const settings: Record<string, any> = {};
    if (typeof shards === 'number') settings.number_of_shards = shards;
    if (typeof replicas === 'number') settings.number_of_replicas = replicas;
    const aliases = alias ? { [alias]: {} } : undefined;

    const response = await client.indices.create({
      index: name,
      settings: Object.keys(settings).length > 0 ? settings : undefined,
      aliases,
    });

    const bodyResult: any = (response as any).body ?? response;

    return NextResponse.json({
      code: 200,
      message: '创建索引成功',
      data: {
        acknowledged: bodyResult?.acknowledged ?? true,
        index: name,
      },
    });
  } catch (error: any) {
    console.error('创建 Elastic 索引错误:', error);
    return NextResponse.json(
      { code: 50001, message: `创建失败: ${error?.message || '未知错误'}`, data: null },
      { status: 500 }
    );
  }
}
