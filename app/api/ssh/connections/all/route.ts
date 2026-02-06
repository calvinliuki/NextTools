import { NextRequest, NextResponse } from 'next/server';
import { SSHConnectionStore } from '@/lib/sshConnections';

export async function GET(request: NextRequest) {
  try {
    // 从共享存储获取所有连接
    const connections = SSHConnectionStore.getAll();

    return NextResponse.json(
      {
        code: 200,
        message: '获取SSH连接列表成功',
        data: connections,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('获取SSH连接列表失败:', error);
    return NextResponse.json(
      {
        code: 500,
        message: `获取连接列表失败: ${error.message}`,
        data: null,
      },
      { status: 500 }
    );
  }
}
