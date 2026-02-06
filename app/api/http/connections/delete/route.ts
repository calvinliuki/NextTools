import { NextRequest, NextResponse } from 'next/server';
import { deleteConnection } from '@/lib/db';

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json(
        { code: 400, message: 'ID 不能为空' },
        { status: 400 }
      );
    }

    deleteConnection(id);

    return NextResponse.json({
      code: 200,
      message: 'HTTP 请求连接删除成功'
    });
  } catch (error: any) {
    console.error('删除 HTTP 请求连接错误:', error);
    return NextResponse.json(
      { code: 500, message: `服务器内部错误：${error?.message || '未知错误'}` },
      { status: 500 }
    );
  }
}
