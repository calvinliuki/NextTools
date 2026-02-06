import { NextRequest, NextResponse } from 'next/server';
import { toggleConnectionFavorite } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, isFavorite } = body;

    if (!id) {
      return NextResponse.json(
        { code: 400, message: 'ID 不能为空' },
        { status: 400 }
      );
    }

    toggleConnectionFavorite(id, isFavorite);

    return NextResponse.json({
      code: 200,
      message: isFavorite ? '已加入收藏' : '已取消收藏',
      data: { id, isFavorite }
    });
  } catch (error: any) {
    console.error('切换收藏状态错误:', error);
    return NextResponse.json(
      { code: 500, message: `服务器内部错误：${error?.message || '未知错误'}` },
      { status: 500 }
    );
  }
}
