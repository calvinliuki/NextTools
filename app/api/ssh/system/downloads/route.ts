import { NextResponse } from 'next/server';
import os from 'os';
import path from 'path';

export async function GET() {
  try {
    const homeDir = os.homedir();
    let downloadsDir = '';
    
    // Windows: C:\Users\Username\Downloads
    // macOS: /Users/Username/Downloads
    // Linux: /home/username/Downloads
    downloadsDir = path.join(homeDir, 'Downloads');

    return NextResponse.json({
      code: 200,
      data: {
        path: downloadsDir
      }
    });
  } catch (error: any) {
    return NextResponse.json({
      code: 500,
      message: error.message
    });
  }
}
