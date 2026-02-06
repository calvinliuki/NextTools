import { NextRequest, NextResponse } from 'next/server';
import { getConnectionById } from '@/lib/db';
import { buildElasticClient } from '@/lib/elastic';

function collectFields(properties: Record<string, any> = {}, prefix = '', out: Set<string>) {
  Object.entries(properties).forEach(([key, value]) => {
    const full = prefix ? `${prefix}.${key}` : key;
    const props = value?.properties;
    if (props) {
      collectFields(props, full, out);
    } else {
      out.add(full);
    }
    const fields = value?.fields || {};
    Object.keys(fields).forEach(sub => {
      out.add(`${full}.${sub}`);
    });
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { connectionId, index } = body;

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
    const response = await client.indices.getMapping({ index });
    const bodyResult: any = (response as any).body ?? response;
    const mapping = bodyResult?.[index]?.mappings?.properties || {};

    const fields = new Set<string>();
    collectFields(mapping, '', fields);

    return NextResponse.json({
      code: 200,
      message: '获取字段成功',
      data: Array.from(fields).filter(field => !field.endsWith('.keyword')).sort(),
    });
  } catch (error: any) {
    console.error('获取 Elastic 字段错误:', error);
    return NextResponse.json(
      { code: 50001, message: `获取失败: ${error?.message || '未知错误'}`, data: null },
      { status: 500 }
    );
  }
}
