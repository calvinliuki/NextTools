import { NextRequest, NextResponse } from 'next/server';
import { deleteConnection, getAllRedisConnections } from '@/lib/db';

// 统一响应格式
interface ApiResponse {
  code: number;
  message: string;
  data: any;
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { id } = body;

    // 参数验证
    if (!id) {
      return NextResponse.json<ApiResponse>({
        code: 40001,
        message: '参数校验失败：`id` 字段为必填项',
        data: null,
      }, { status: 400 });
    }

    // 删除连接
    deleteConnection(id);

    return NextResponse.json<ApiResponse>({
      code: 200,
      message: '连接删除成功',
      data: { id },
    });
  } catch (error: any) {
    return NextResponse.json<ApiResponse>({
      code: 50000,
      message: `服务器内部错误：${error?.message || '未知错误'}`,
      data: null,
    }, { status: 500 });
  }
}