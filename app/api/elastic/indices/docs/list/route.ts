import { NextRequest, NextResponse } from 'next/server';
import { getConnectionById } from '@/lib/db';
import { buildElasticClient } from '@/lib/elastic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { connectionId, index, from = 0, size = 20 } = body;

    if (!connectionId || !index) {
      return NextResponse.json({ code: 40001, message: '缺少 connectionId 或 index', data: null }, { status: 400 });
    }
    if (index.startsWith('.')) {
      return NextResponse.json({ code: 40301, message: '系统索引禁止读取', data: null }, { status: 403 });
    }

    const config = getConnectionById(connectionId);
    if (!config) {
      return NextResponse.json({ code: 40401, message: 'Elastic 连接不存在', data: null }, { status: 404 });
    }

    const client = buildElasticClient(config);
    const response = await client.search({
      index,
      from,
      size: Math.min(200, size),
      sort: ['_doc'],
      query: { match_all: {} },
    });

    const bodyResult: any = (response as any).body ?? response;
    const hits = bodyResult?.hits?.hits || [];
    const total = typeof bodyResult?.hits?.total?.value === 'number'
      ? bodyResult.hits.total.value
      : bodyResult?.hits?.total || hits.length;

    return NextResponse.json({
      code: 200,
      message: '获取索引文档成功',
      data: {
        index,
        total,
        docs: hits.map((hit: any) => ({
          id: hit._id,
          score: hit._score,
          source: hit._source || {},
        })),
      },
    });
  } catch (error: any) {
    console.error('获取 Elastic 文档列表错误:', error);
    return NextResponse.json(
      { code: 50001, message: `获取失败: ${error?.message || '未知错误'}`, data: null },
      { status: 500 }
    );
  }
}
