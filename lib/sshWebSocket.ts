import { Client } from 'ssh2';
import { WebSocket } from 'ws';
import { SSHConnectionStore } from './sshConnections';

interface SSHWebSocketConnection {
  ws: WebSocket;
  ssh: Client | null;
  connectionId: string;
  stream?: any; // SSH shell stream
}

// 活动的 WebSocket 连接映射
const activeConnections = new Map<string, SSHWebSocketConnection>();

/**
 * 处理 SSH WebSocket 连接
 */
export async function handleSSHWebSocket(ws: WebSocket, connectionId: string) {
  const connection: SSHWebSocketConnection = {
    ws,
    ssh: null,
    connectionId,
  };

  try {
    // 1. 从 SQLite 获取连接信息
    const sshConfig = SSHConnectionStore.get(connectionId);
    
    if (!sshConfig) {
      ws.send(JSON.stringify({
        type: 'error',
        message: `未找到连接信息: ${connectionId}`,
      }));
      ws.close();
      return;
    }

    // 2. 创建 SSH 客户端
    const ssh = new Client();

    // 配置 SSH 连接
    const config: any = {
      host: sshConfig.host,
      port: sshConfig.port,
      username: sshConfig.username,
      readyTimeout: 30000,
    };

    // 根据认证方式设置凭证
    if (sshConfig.authMethod === 'password') {
      config.password = sshConfig.password;
    } else if (sshConfig.authMethod === 'privateKey') {
      try {
        config.privateKey = sshConfig.privateKey;
        if (sshConfig.passphrase) {
          config.passphrase = sshConfig.passphrase;
        }
      } catch (error: any) {
        ws.send(JSON.stringify({
          type: 'error',
          message: `私钥格式错误: ${error.message}`,
        }));
        ws.close();
        return;
      }
    }

    // 3. 建立 SSH 连接
    ssh.on('ready', () => {
      console.log(`SSH 连接已建立: ${sshConfig.name} (${connectionId})`);
      
      // 发送连接成功消息
      ws.send(JSON.stringify({
        type: 'connected',
        message: `连接到 ${sshConfig.name} 成功`,
      }));

      // 4. 打开 shell 会话
      ssh.shell({ term: 'xterm-256color' }, (err, stream) => {
        if (err) {
          console.error('打开 shell 失败:', err);
          ws.send(JSON.stringify({
            type: 'error',
            message: `打开 shell 失败: ${err.message}`,
          }));
          ws.close();
          return;
        }

        // 5. 将 SSH 输出流绑定到 WebSocket
        stream.on('data', (data: Buffer) => {
          if (ws.readyState === WebSocket.OPEN) {
            const text = data.toString('utf-8');
            
            // 检查是否正在捕获 pwd 输出
            if ((connection as any).capturingPwd) {
              (connection as any).pwdBuffer += text;
              
              // 检查是否包含完整的 pwd 结果
              const pwdMatch = (connection as any).pwdBuffer.match(/___PWD_START___(\/[^\r\n]*)___PWD_END___/);
              if (pwdMatch) {
                const path = pwdMatch[1].trim();
                console.log('[get-pwd] 获取到路径:', path);
                
                // 发送 pwd 结果给前端
                ws.send(JSON.stringify({
                  type: 'pwd-result',
                  path: path
                }));
                
                // 重置捕获状态
                (connection as any).capturingPwd = false;
                (connection as any).pwdBuffer = '';
                
            // 过滤掉这部分输出，不发送给终端
            const filteredText = text
              .replace(/\x15/g, '') // 移除 Ctrl+U
              .replace(/\x03/g, '') // 移除 Ctrl+C
              .replace(/echo "___PWD_START___\$\(pwd\)___PWD_END___"\r?\n?/g, '')
              .replace(/___PWD_START___\/[^\r\n]*___PWD_END___\r?\n?/g, '')
              .replace(/\[\w+@[\w-]+ [^\]]*\]#\s*$/g, '') // 移除空提示符
              .replace(/[\r\n]+$/, ''); // 移除结尾换行

            // 如果还有其他内容，且不是我们要捕获的内容的一部分，发送给终端
            if (filteredText.trim() && !filteredText.includes('___PWD_START___')) {
              ws.send(filteredText);
            }
                return;
              }
              
              // 超时保护：如果累积太多数据还没匹配到，可能出错了
              if ((connection as any).pwdBuffer.length > 500) {
                console.error('[get-pwd] 超时，未能匹配到路径');
                (connection as any).capturingPwd = false;
                ws.send(JSON.stringify({
                  type: 'pwd-result',
                  path: null,
                  error: 'Timeout'
                }));
                // 发送累积的内容
                ws.send((connection as any).pwdBuffer);
                (connection as any).pwdBuffer = '';
              }
              return;
            }
            
            ws.send(text);
          }
        });

        // SSH 会话关闭处理
        stream.on('close', () => {
          console.log(`SSH stream 已关闭: ${connectionId}`);
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
              type: 'disconnected',
              message: 'SSH 会话已关闭',
            }));
            ws.close();
          }
        });

        stream.stderr.on('data', (data: Buffer) => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(data.toString('utf-8'));
          }
        });

        // 将 stream 保存到连接对象中，以便后续使用
        connection.ssh = ssh;
        // @ts-ignore - 保存 stream 引用
        connection.stream = stream;
      });
    });

    ssh.on('error', (err) => {
      console.error(`SSH 连接错误 (${connectionId}):`, err.message);
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'error',
          message: `SSH 连接错误: ${err.message}`,
        }));
      }
    });

    ssh.on('close', () => {
      console.log(`SSH 连接已关闭: ${connectionId}`);
      activeConnections.delete(connectionId);
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'disconnected',
          message: 'SSH 连接已关闭',
        }));
        ws.close();
      }
    });

    // 保存连接
    activeConnections.set(connectionId, connection);

    // 6. 监听 WebSocket 消息（用户输入）
    ws.on('message', (data: Buffer | string) => {
      try {
        const message = typeof data === 'string' ? data : data.toString('utf-8');
        const trimmed = message.trim();
            
        // 严格识别控制消息：只要包含 __CONTROL__ 就拦截
        if (trimmed.startsWith('__CONTROL__')) {
          try {
            const jsonStr = trimmed.substring(trimmed.indexOf('{'));
            const msg = JSON.parse(jsonStr);
                
            if (msg.type === 'resize') {
              const { cols, rows } = msg;
              if (connection.stream && connection.stream.setWindow) {
                connection.stream.setWindow(rows, cols);
              }
            } else if (msg.type === 'get-pwd') {
              const stream = connection.stream;
              if (stream && stream.writable) {
                (connection as any).capturingPwd = true;
                (connection as any).pwdBuffer = '';
                // 静默执行，不清理终端防止副作用
                stream.write('echo "___PWD_START___$(pwd)___PWD_END___"\r');
              }
            }
            return; // 关键：控制消息必须在这里 return，绝对不能传给 SSH
          } catch (e) {
            console.error('[WebSocket] 解析控制消息失败:', e);
            return; // 解析失败也拦截，防止乱码传给终端
          }
        }
            
        // 普通输入，发送到 SSH
        const stream = (connection as any).stream;
        if (stream && stream.writable) {
          stream.write(typeof data === 'string' ? data : data);
        }
      } catch (error) {
        // ...
      }
    });

    // 7. 监听 WebSocket 关闭
    ws.on('close', () => {
      console.log(`WebSocket 连接已关闭: ${connectionId}`);
      const conn = activeConnections.get(connectionId);
      
      if (conn && conn.ssh) {
        conn.ssh.end();
      }
      
      activeConnections.delete(connectionId);
    });

    // 开始 SSH 连接
    ssh.connect(config);

  } catch (error: any) {
    console.error(`处理 SSH WebSocket 连接失败 (${connectionId}):`, error);
    ws.send(JSON.stringify({
      type: 'error',
      message: `连接失败: ${error.message}`,
    }));
    ws.close();
  }
}

/**
 * 获取活动连接数
 */
export function getActiveConnectionCount(): number {
  return activeConnections.size;
}

/**
 * 获取所有活动连接的 ID
 */
export function getActiveConnectionIds(): string[] {
  return Array.from(activeConnections.keys());
}

/**
 * 强制关闭指定连接
 */
export function closeConnection(connectionId: string): boolean {
  const conn = activeConnections.get(connectionId);
  if (conn) {
    if (conn.ssh) {
      conn.ssh.end();
    }
    if (conn.ws.readyState === WebSocket.OPEN) {
      conn.ws.close();
    }
    activeConnections.delete(connectionId);
    return true;
  }
  return false;
}
