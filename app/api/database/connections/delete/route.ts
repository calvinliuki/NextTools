import { NextRequest, NextResponse } from 'next/server';
import { deleteDatabaseConnection } from '@/lib/db';

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json(
        { code: 40001, message: '连接ID不能为空', data: null },
        { status: 400 }
      );
    }

    deleteDatabaseConnection(id);

    return NextResponse.json({
      code: 200,
      message: 'Database 连接删除成功',
      data: null,
    });
  } catch (error: any) {
    console.error('删除 Database 连接错误:', error);
    return NextResponse.json(
      { code: 50000, message: `服务器内部错误：${error?.message || '未知错误'}`, data: null },
      { status: 500 }
    );
  }
}
