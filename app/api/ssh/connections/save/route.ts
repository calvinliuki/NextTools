import { NextRequest, NextResponse } from 'next/server';
import { SSHConnectionStore } from '@/lib/sshConnections';
import { connectionNameExistsByType } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const {
      id,
      name,
      host,
      port,
      username,
      authMethod,
      password,
      privateKey,
      passphrase,
      downloadDir,
      terminalSettings,
    } = body;

    // 基础验证
    if (!name?.trim()) {
      return NextResponse.json(
        {
          code: 400,
          message: '连接名称不能为空',
          data: null,
        },
        { status: 400 }
      );
    }

    // 检查SSH连接名是否已存在（按类型检查，避免不同类型连接名称冲突）
    if (connectionNameExistsByType('ssh', name.trim(), id)) {
      return NextResponse.json(
        {
          code: 409,
          message: `SSH连接名称 '${name}' 已存在`,
          data: null,
        },
        { status: 409 }
      );
    }

    if (!host || !port || !username) {
      return NextResponse.json(
        {
          code: 400,
          message: '缺少必需参数：host、port、username',
          data: null,
        },
        { status: 400 }
      );
    }

    if (authMethod === 'password' && !password) {
      return NextResponse.json(
        {
          code: 400,
          message: '密码认证方式必须提供密码',
          data: null,
        },
        { status: 400 }
      );
    }

    if (authMethod === 'privateKey' && !privateKey) {
      return NextResponse.json(
        {
          code: 400,
          message: '私钥认证方式必须提供私钥',
          data: null,
        },
        { status: 400 }
      );
    }

    // 生成或使用提供的ID
    const connectionId = id || SSHConnectionStore.generateId();

    // 创建SSH连接配置
    const sshConfig = {
      id: connectionId,
      name: name.trim(),
      host,
      port,
      username,
      authMethod,
      password: authMethod === 'password' ? password : undefined,
      privateKey: authMethod === 'privateKey' ? privateKey : undefined,
      passphrase: authMethod === 'privateKey' ? passphrase : undefined,
      downloadDir: downloadDir || '',
      terminalSettings,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // 保存到共享存储
    // 注意：私钥内容会被加密存储，公钥文件(.pub)不能用于SSH连接
    SSHConnectionStore.save(sshConfig as any);

    return NextResponse.json(
      {
        code: 200,
        message: id ? 'SSH连接更新成功' : 'SSH连接创建成功',
        data: {
          id: connectionId,
          name: sshConfig.name,
          host: sshConfig.host,
          port: sshConfig.port,
          username: sshConfig.username,
          downloadDir: sshConfig.downloadDir,
          terminalSettings: sshConfig.terminalSettings,
        },
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('保存SSH连接失败:', error);
    return NextResponse.json(
      {
        code: 500,
        message: `保存连接失败: ${error.message}`,
        data: null,
      },
      { status: 500 }
    );
  }
}
