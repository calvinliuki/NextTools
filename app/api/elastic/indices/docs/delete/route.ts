import { NextRequest, NextResponse } from 'next/server';
import { getConnectionById } from '@/lib/db';
import { buildElasticClient } from '@/lib/elastic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { connectionId, index, id } = body;

    if (!connectionId || !index || !id) {
      return NextResponse.json({ code: 40001, message: '缺少 connectionId/index/id', data: null }, { status: 400 });
    }

    const config = getConnectionById(connectionId);
    if (!config) {
      return NextResponse.json({ code: 40401, message: 'Elastic 连接不存在', data: null }, { status: 404 });
    }

    const client = buildElasticClient(config);
    const response = await client.delete({
      index,
      id,
      refresh: 'wait_for',
    });

    const bodyResult: any = (response as any).body ?? response;

    return NextResponse.json({
      code: 200,
      message: '删除成功',
      data: {
        id: bodyResult?._id || id,
        result: bodyResult?.result || 'deleted',
      },
    });
  } catch (error: any) {
    console.error('删除 Elastic 文档错误:', error);
    return NextResponse.json(
      { code: 50001, message: `删除失败: ${error?.message || '未知错误'}`, data: null },
      { status: 500 }
    );
  }
}
