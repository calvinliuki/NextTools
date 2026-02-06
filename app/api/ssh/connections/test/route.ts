import { NextRequest, NextResponse } from 'next/server';
import { Client } from 'ssh2';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const {
      host: rawHost,
      port,
      username: rawUsername,
      authMethod,
      password,
      privateKey,
      passphrase,
    } = body;

    const host = rawHost?.trim();
    const username = rawUsername?.trim();

    // 基础验证
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

    // 执行实际的SSH连接测试
    return new Promise<Response>((resolve) => {
      const client = new Client();
      let isResolved = false;

      const cleanup = () => {
        if (timer) {
          clearTimeout(timer);
        }
        client.removeAllListeners();
      };

      const timer = setTimeout(() => {
        if (isResolved) return;
        isResolved = true;
        client.destroy();
        resolve(NextResponse.json(
          {
            code: 500,
            message: '连接超时，请检查主机地址和端口是否正确，或网络是否通畅',
            data: null,
          },
          { status: 500 }
        ));
      }, 30000);

      client.on('banner', (msg) => {
      });

      client.on('ready', () => {
        if (isResolved) return;
        isResolved = true;
        cleanup();
        client.end();
        resolve(NextResponse.json({
          code: 200,
          message: `SSH连接测试成功 (${username}@${host}:${port})`,
          data: { connected: true },
        }));
      });

      client.on('error', (err: any) => {
        console.error(`[SSH测试-Error] 收到 error 事件: ${err.message}`);
        console.error(`[SSH测试-Error-Detail]`, JSON.stringify(err));
        if (isResolved) return;
        isResolved = true;
        cleanup();
        client.destroy();
        resolve(NextResponse.json(
          {
            code: 500,
            message: `连接测试失败: ${err.message}`,
            data: null,
          },
          { status: 500 }
        ));
      });

      client.on('close', () => {
        if (isResolved) return;
        isResolved = true;
        cleanup();
        resolve(NextResponse.json(
          {
            code: 500,
            message: '连接被意外关闭',
            data: null,
          },
          { status: 500 }
        ));
      });

      client.on('greeting', (msg) => {
      });

      const connectOptions: any = {
        host,
        port: typeof port === 'string' ? parseInt(port) : port,
        username,
        readyTimeout: 30000,
      };

      if (authMethod === 'password') {
        connectOptions.password = password;
      } else if (authMethod === 'privateKey') {
        if (privateKey && privateKey.trim().startsWith('-----BEGIN')) {
          connectOptions.privateKey = privateKey.trim();
        } else if (privateKey) {
          connectOptions.privateKeyPath = privateKey.trim();
        }
        if (passphrase) {
          connectOptions.passphrase = passphrase;
        }
      }

      try {
        client.connect(connectOptions);
      } catch (e: any) {
        console.error(`[SSH测试-Exception] 同步启动失败:`, e.message);
        if (isResolved) return;
        isResolved = true;
        cleanup();
        resolve(NextResponse.json(
          {
            code: 500,
            message: `连接启动失败: ${e.message}`,
            data: null,
          },
          { status: 500 }
        ));
      }
    });
  } catch (error: any) {
    console.error('SSH连接测试失败:', error);
    return NextResponse.json(
      {
        code: 500,
        message: `测试连接失败: ${error.message}`,
        data: null,
      },
      { status: 500 }
    );
  }
}
