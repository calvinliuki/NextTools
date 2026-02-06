import { NextRequest, NextResponse } from 'next/server';
import { SSHConnectionStore } from '@/lib/sshConnections';
import { SFTPManager } from '@/lib/sftpManager';

// 获取SFTP会话
async function getSFTPSession(connectionId: string) {
  // 获取连接信息
  const connection = SSHConnectionStore.get(connectionId);
  if (!connection) {
    throw new Error('Connection not found');
  }

  // 创建或获取SFTP会话
  return await SFTPManager.createSession(connectionId, connection);
}

// 处理SFTP请求
export async function POST(request: NextRequest) {
  try {
    const { connectionId, action, path = '/', ...options } = await request.json();

    if (!connectionId) {
      return NextResponse.json(
        { success: false, error: 'Missing connectionId' },
        { status: 400 }
      );
    }

    const sftp = await getSFTPSession(connectionId);

    switch (action) {
      case 'list':
        // 列出文件和目录
        const list = await sftp.list(path);
        return NextResponse.json({ success: true, data: list });

      case 'read':
        // 读取文件内容（用于文本文件预览）
        const content = await sftp.readFile(path, options.encoding || 'utf8');
        return NextResponse.json({ success: true, data: content });

      case 'stat':
        // 获取文件/目录状态
        const stat = await sftp.stat(path);
        return NextResponse.json({ success: true, data: stat });

      case 'mkdir':
        // 创建目录
        await sftp.mkdir(path);
        return NextResponse.json({ success: true });

      case 'delete':
        // 删除文件或目录
        await sftp.delete(path, options.recursive || false);
        return NextResponse.json({ success: true });

      case 'rename':
        // 重命名文件或目录
        const { newPath } = options;
        await sftp.rename(path, newPath);
        return NextResponse.json({ success: true });

      case 'download-to-local':
        // 直接下载到本地路径
        const { localPath } = options;
        console.log('[SFTP download-to-local] 参数:', {
          remotePath: path,
          localPath,
          connectionId
        });
        if (!localPath) {
          return NextResponse.json(
            { success: false, error: 'Missing localPath' },
            { status: 400 }
          );
        }
        await sftp.downloadFile(path, localPath);
        return NextResponse.json({ success: true, message: `File downloaded to ${localPath}` });

      case 'realpath':
        // 获取路径的绝对真实路径
        const realPath = await sftp.realpath(path);
        return NextResponse.json({ success: true, data: realPath });

      default:
        return NextResponse.json(
          { success: false, error: 'Unknown action' },
          { status: 400 }
        );
    }
  } catch (error: any) {
    console.error('SFTP API Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Unknown error' },
      { status: 500 }
    );
  }
}

// 处理文件上传
export async function PUT(request: NextRequest) {
  try {
    const formData = await request.formData();
    const connectionId = formData.get('connectionId') as string;
    const path = formData.get('path') as string;
    const file = formData.get('file') as File;

    if (!connectionId || !path || !file) {
      return NextResponse.json(
        { success: false, error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    const sftp = await getSFTPSession(connectionId);
    const buffer = Buffer.from(await file.arrayBuffer());
    const filePath = `${path}/${file.name}`;

    await sftp.writeFile(filePath, buffer);

    return NextResponse.json({ success: true, filePath });
  } catch (error: any) {
    console.error('SFTP Upload Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Unknown error' },
      { status: 500 }
    );
  }
}

// 处理文件下载
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const connectionId = searchParams.get('connectionId');
    const path = searchParams.get('path');

    if (!connectionId || !path) {
      return NextResponse.json(
        { success: false, error: 'Missing connectionId or path' },
        { status: 400 }
      );
    }

    const sftp = await getSFTPSession(connectionId);
    const fileData = await sftp.readFile(path);
    const stat = await sftp.stat(path);

    return new NextResponse(fileData, {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${path.split('/').pop()}"`,
        'Content-Length': stat.size.toString(),
      },
    });
  } catch (error: any) {
    console.error('SFTP Download Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Unknown error' },
      { status: 500 }
    );
  }
}