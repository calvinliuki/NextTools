import { NextRequest, NextResponse } from 'next/server';
import { updateConnectionEnvironment } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, environment } = body;

    if (!id || !environment) {
      return NextResponse.json(
        { code: 400, message: 'ID 和环境标记不能为空' },
        { status: 400 }
      );
    }

    updateConnectionEnvironment(id, environment);

    return NextResponse.json({
      code: 200,
      message: '环境标记更新成功',
      data: { id, environment }
    });
  } catch (error: any) {
    console.error('更新环境标记错误:', error);
    return NextResponse.json(
      { code: 500, message: `服务器内部错误：${error?.message || '未知错误'}` },
      { status: 500 }
    );
  }
}
