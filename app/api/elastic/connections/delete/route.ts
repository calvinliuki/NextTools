import { NextRequest, NextResponse } from 'next/server';
import { deleteConnection } from '@/lib/db';

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json(
        { code: 40001, message: '缺少连接 ID', data: null },
        { status: 400 }
      );
    }

    deleteConnection(id);

    return NextResponse.json({
      code: 200,
      message: 'Elastic 连接删除成功',
      data: null,
    });
  } catch (error) {
    console.error('删除 Elastic 连接错误:', error);
    return NextResponse.json(
      { code: 50000, message: '服务器内部错误', data: null },
      { status: 500 }
    );
  }
}
