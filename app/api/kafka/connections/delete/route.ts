import { NextRequest, NextResponse } from 'next/server';
import { deleteKafkaConnection } from '@/lib/db';

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json(
        { code: 40001, message: '连接 ID 不能为空', data: null },
        { status: 400 }
      );
    }

    deleteKafkaConnection(id);

    return NextResponse.json({
      code: 200,
      message: '删除 Kafka 连接成功',
      data: null
    });
  } catch (error) {
    console.error('删除 Kafka 连接错误:', error);
    return NextResponse.json(
      { code: 50000, message: '服务器内部错误', data: null },
      { status: 500 }
    );
  }
}
