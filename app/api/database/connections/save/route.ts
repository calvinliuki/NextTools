import { NextRequest, NextResponse } from 'next/server';
import { connectionNameExistsByType, saveConnection } from '@/lib/db';

interface SaveRequest {
  id?: string;
  name: string;
  databaseType: 'mysql' | 'postgresql' | 'sqlite';
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  databaseName?: string;
  filePath?: string;
  additionalParams?: string;
  connectionTimeout?: number;
}

export async function POST(request: NextRequest) {
  try {
    const body: SaveRequest = await request.json();

    if (!body.name || !body.name.trim()) {
      return NextResponse.json(
        { code: 40001, message: '连接名称不能为空', data: null },
        { status: 400 }
      );
    }

    if (!body.databaseType) {
      return NextResponse.json(
        { code: 40002, message: '数据库类型不能为空', data: null },
        { status: 400 }
      );
    }

    if (body.databaseType === 'sqlite') {
      if (!body.filePath || !body.filePath.trim()) {
        return NextResponse.json(
          { code: 40003, message: 'SQLite 文件路径不能为空', data: null },
          { status: 400 }
        );
      }
    } else {
      if (!body.host || !body.host.trim()) {
        return NextResponse.json(
          { code: 40003, message: '主机地址不能为空', data: null },
          { status: 400 }
        );
      }
      if (!body.port || body.port < 1 || body.port > 65535) {
        return NextResponse.json(
          { code: 40004, message: '端口号必须在 1-65535 之间', data: null },
          { status: 400 }
        );
      }
      if (!body.username) {
        return NextResponse.json(
          { code: 40005, message: '用户名不能为空', data: null },
          { status: 400 }
        );
      }
    }

    if (connectionNameExistsByType('database', body.name.trim(), body.id)) {
      return NextResponse.json(
        { code: 40901, message: 'Database 连接名称已存在', data: null },
        { status: 409 }
      );
    }

    const id = body.id || `database_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

    const config = {
      databaseType: body.databaseType,
      host: body.host?.trim(),
      port: body.port,
      username: body.username || '',
      password: body.password || '',
      databaseName: body.databaseName || '',
      filePath: body.filePath || '',
      additionalParams: body.additionalParams || '',
      connectionTimeout: body.connectionTimeout || 30,
    };

    saveConnection(id, body.name.trim(), config);

    return NextResponse.json({
      code: 200,
      message: 'Database 连接保存成功',
      data: { id, name: body.name.trim() },
    });
  } catch (error: any) {
    console.error('保存 Database 连接错误:', error);
    return NextResponse.json(
      { code: 50000, message: `服务器内部错误：${error?.message || '未知错误'}`, data: null },
      { status: 500 }
    );
  }
}
