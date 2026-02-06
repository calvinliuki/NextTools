import { NextRequest, NextResponse } from 'next/server';
import { getConnectionById } from '@/lib/db';
import { buildElasticClient } from '@/lib/elastic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { connectionId } = body;

    if (!connectionId) {
      return NextResponse.json({ code: 40001, message: '缺少 connectionId', data: null }, { status: 400 });
    }

    const config = getConnectionById(connectionId);
    if (!config) {
      return NextResponse.json({ code: 40401, message: 'Elastic 连接不存在', data: null }, { status: 404 });
    }

    const client = buildElasticClient(config);

    const [catIndices, aliasResponse, settingsResponse] = await Promise.all([
      client.cat.indices({ format: 'json' }),
      client.indices.getAlias({ index: '*' }),
      client.indices.getSettings({ index: '*', flat_settings: true }),
    ]);

    const indicesBody: any[] = Array.isArray((catIndices as any).body)
      ? (catIndices as any).body
      : Array.isArray(catIndices)
        ? (catIndices as any)
        : [];
    const aliasBody: Record<string, any> = (aliasResponse as any).body ?? aliasResponse ?? {};
    const settingsBody: Record<string, any> = (settingsResponse as any).body ?? settingsResponse ?? {};

    const list = indicesBody
      .map((item: any) => {
      const name = item.index || item['index'] || '';
      const aliases = Object.keys(aliasBody?.[name]?.aliases || {});
      const creationDate = settingsBody?.[name]?.settings?.['index.creation_date'];
      const createdAt = creationDate ? new Date(Number(creationDate)).toISOString() : null;
      return {
        name,
        status: item.status || '',
        health: item.health || 'green',
        docs: Number(item['docs.count'] || item.docs || 0),
        size: item['store.size'] || item.store || '',
        pri: Number(item.pri || 0),
        rep: Number(item.rep || 0),
        aliases,
        alias: aliases[0] || '',
        createdAt,
      };
    })
      .filter(item => item.name && !item.name.startsWith('.'))
      .sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json({
      code: 200,
      message: '获取索引列表成功',
      data: list,
    });
  } catch (error: any) {
    console.error('获取 Elastic 索引列表错误:', error);
    return NextResponse.json(
      { code: 50001, message: `获取失败: ${error?.message || '未知错误'}`, data: null },
      { status: 500 }
    );
  }
}
