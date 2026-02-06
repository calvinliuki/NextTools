import { NextRequest, NextResponse } from 'next/server';
import { saveConnection } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, name, config } = body;

    if (!id || !name) {
      return NextResponse.json(
        { code: 400, message: 'ID 和名称不能为空' },
        { status: 400 }
      );
    }

    // 强制设置 clientType 为 HTTP
    const finalConfig = {
      ...config,
      clientType: 'HTTP'
    };

    saveConnection(id, name, finalConfig);

    return NextResponse.json({
      code: 200,
      message: 'HTTP 请求连接保存成功',
      data: { id, name }
    });
  } catch (error: any) {
    console.error('保存 HTTP 请求连接错误:', error);
    return NextResponse.json(
      { code: 500, message: `服务器内部错误：${error?.message || '未知错误'}` },
      { status: 500 }
    );
  }
}
