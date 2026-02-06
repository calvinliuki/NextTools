import { NextRequest, NextResponse } from 'next/server';
import { getAllPostmanCollections, savePostmanCollections } from '@/lib/db';

export async function GET() {
  try {
    const collections = getAllPostmanCollections();
    return NextResponse.json({
      code: 200,
      message: '获取集合成功',
      data: collections,
    });
  } catch (error: any) {
    console.error('获取 Postman 集合失败:', error);
    return NextResponse.json(
      { code: 500, message: `获取集合失败: ${error.message}` },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const collections = await request.json();
    savePostmanCollections(collections);
    return NextResponse.json({
      code: 200,
      message: '保存集合成功',
    });
  } catch (error: any) {
    console.error('保存 Postman 集合失败:', error);
    return NextResponse.json(
      { code: 500, message: `保存集合失败: ${error.message}` },
      { status: 500 }
    );
  }
}
