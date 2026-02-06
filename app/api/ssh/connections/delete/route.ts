import { NextRequest, NextResponse } from 'next/server';
import { SSHConnectionStore } from '@/lib/sshConnections';

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json(
        {
          code: 400,
          message: '缺少必需参数：id',
          data: null,
        },
        { status: 400 }
      );
    }

    // 从共享存储中删除
    const deleted = SSHConnectionStore.delete(id);
    
    if (deleted) {
      return NextResponse.json(
        {
          code: 200,
          message: 'SSH连接删除成功',
          data: { id },
        },
        { status: 200 }
      );
    } else {
      return NextResponse.json(
        {
          code: 404,
          message: 'SSH连接不存在',
          data: null,
        },
        { status: 404 }
      );
    }
  } catch (error: any) {
    console.error('删除SSH连接失败:', error);
    return NextResponse.json(
      {
        code: 500,
        message: `删除连接失败: ${error.message}`,
        data: null,
      },
      { status: 500 }
    );
  }
}
