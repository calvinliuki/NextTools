import { NextRequest, NextResponse } from 'next/server';
import { getAllPostmanHistory, savePostmanHistoryEntry } from '@/lib/db';

export async function GET() {
  try {
    const history = getAllPostmanHistory();
    return NextResponse.json({
      code: 200,
      message: '获取历史记录成功',
      data: history,
    });
  } catch (error: any) {
    console.error('获取 Postman 历史记录失败:', error);
    return NextResponse.json(
      { code: 500, message: `获取历史记录失败: ${error.message}` },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const entry = await request.json();
    savePostmanHistoryEntry(entry);
    return NextResponse.json({
      code: 200,
      message: '保存历史记录成功',
    });
  } catch (error: any) {
    console.error('保存 Postman 历史记录失败:', error);
    return NextResponse.json(
      { code: 500, message: `保存历史记录失败: ${error.message}` },
      { status: 500 }
    );
  }
}
