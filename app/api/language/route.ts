import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // 从请求头或查询参数获取语言偏好
    const url = new URL(request.url);
    const preferredLang = url.searchParams.get('lang');
    
    // 验证语言代码
    const validLanguages = ['zh-CN', 'en'];
    const language = validLanguages.includes(preferredLang || '') 
      ? preferredLang 
      : request.headers.get('accept-language')?.split(',')[0] || 'zh-CN';
    
    return NextResponse.json({
      success: true,
      language: language,
      supported: validLanguages,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to detect language' 
      }, 
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { language } = await request.json();
    
    // 验证语言代码
    const validLanguages = ['zh-CN', 'en'];
    if (!validLanguages.includes(language)) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid language code',
          supported: validLanguages
        }, 
        { status: 400 }
      );
    }
    
    // 这里可以添加保存用户语言偏好的逻辑
    // 例如：保存到数据库或返回设置语言的cookie
    
    return NextResponse.json({
      success: true,
      message: 'Language preference saved',
      language: language
    });
  } catch (error) {
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to set language' 
      }, 
      { status: 500 }
    );
  }
}