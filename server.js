const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { WebSocketServer } = require('ws');
const { Client: SSHClient } = require('ssh2');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

// SSH会话管理
const sshSessions = new Map();

// 获取数据库连接
function resolveDbPath() {
  if (process.env.NEXTTOOLS_DB_PATH) {
    return process.env.NEXTTOOLS_DB_PATH;
  }
  if (process.env.NEXTTOOLS_DATA_DIR) {
    return path.join(process.env.NEXTTOOLS_DATA_DIR, 'connections.db');
  }
  return path.join(process.cwd(), 'data', 'connections.db');
}

function getDatabase() {
  const dbPath = resolveDbPath();
  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
  const db = new Database(dbPath);
  
  // 初始化数据库表
  db.exec(`
    CREATE TABLE IF NOT EXISTS connections (
      id TEXT PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      config TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_connections_name ON connections(name)
  `);
  
  return db;
}

// 从数据库获取SSH连接信息
function getSSHConnection(connectionId) {
  try {
    const database = getDatabase();
    const stmt = database.prepare('SELECT * FROM connections WHERE id = ?');
    const row = stmt.get(connectionId);
    
    if (!row) {
      console.error(`[\u6570据库] 不存在的connectionId: ${connectionId}`);
      return null;
    }
    
    const config = JSON.parse(row.config);
    const result = {
      id: row.id,
      name: row.name,
      host: config.host,
      port: config.port,
      username: config.username,
      authMethod: config.authMethod,
      password: config.password,
      privateKey: config.privateKey,
      passphrase: config.passphrase,
      terminalSettings: config.terminalSettings,
    };
    
    // 清理空格（这是一个常见的买一个一个一）
    result.host = result.host ? result.host.trim() : result.host;
    result.username = result.username ? result.username.trim() : result.username;
    if (result.password) result.password = result.password.trim();
    
    return result;
  } catch (error) {
    console.error('[\u6570据库] 获取SSH连接失败:', error);
    return null;
  }
}

app.prepare().then(() => {
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });

  // 创建WebSocket服务器
  const wss = new WebSocketServer({ noServer: true });

  // 处理WebSocket升级
  server.on('upgrade', (req, socket, head) => {
    const parsedUrl = parse(req.url, true);
    const { pathname, query } = parsedUrl;
    
    // 只记录SSH相关的升级请求，过滤掉webpack-hmr的日志噪音
    const isSSHPath = pathname === '/api/ssh';
    
    // 只处理 /api/ssh 路径的WebSocket
    if (isSSHPath) {
      const connectionId = query.connectionId;

      if (!connectionId) {
        console.error(`[WebSocket] 错误: 缺少connectionId`);
        socket.destroy();
        return;
      }

      // 获取SSH连接信息
      const sshConnection = getSSHConnection(connectionId);
      if (!sshConnection) {
        console.error(`[WebSocket] 错误: 找不到SSH连接信息, connectionId=${connectionId}`);
        socket.destroy();
        return;
      }

      wss.handleUpgrade(req, socket, head, (ws) => {
        handleSSHConnection(ws, sshConnection, connectionId);
      });
    }
    // 其他路径（如 HMR）不处理，让它们自然超时
    // 不要调用 socket.destroy()，这样 Next.js 可以尝试处理
  });

  // 获取格式化的当前时间
  function getCurrentTime() {
    return new Date().toLocaleString('zh-CN', { 
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit', 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit',
      hour12: false
    });
  }

  // 处理SSH连接
  function handleSSHConnection(ws, sshConnection, connectionId) {
    const sshClient = new SSHClient();
    let stream = null;
    const sessionId = `${connectionId}_${Date.now()}`;
    let isConnected = false;
    let isClosing = false;
    let heartbeatInterval = null;

    // 启动心跳保活机制
    const startHeartbeat = () => {
      heartbeatInterval = setInterval(() => {
        if (ws.readyState === ws.OPEN && isConnected) {
          try {
            ws.ping();
          } catch (err) {
          }
        }
      }, 30000); // 每30秒发送一次心跳
    };

    // 停止心跳
    const stopHeartbeat = () => {
      if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
      }
    };

    // 处理WebSocket关闭
    ws.on('close', () => {
      isClosing = true;
      stopHeartbeat();
      sshSessions.delete(sessionId);
      if (stream && !stream.destroyed) {
        stream.end();
      }
      if (sshClient) {
        sshClient.end();
      }
    });

    // 处理WebSocket错误
    ws.on('error', (err) => {
      console.error(`WebSocket错误: ${err}`);
      sshSessions.delete(sessionId);
      if (stream && !stream.destroyed) {
        stream.end();
      }
      if (sshClient) {
        sshClient.end();
      }
    });

    // 处理WebSocket消息
    let pendingResize = null; // 保存等待应用的 resize 请求
    let isPwdCommandRunning = false; // 标志位：pwd命令执行中，暂停主数据输出
    
    ws.on('message', (data) => {
      try {
        const dataStr = data.toString();
        
        // 处理控制消息（带 __CONTROL__ 前缀）
        if (dataStr.startsWith('__CONTROL__')) {
          const controlMsg = JSON.parse(dataStr.substring(11)); // 去掉 __CONTROL__ 前缀
          
          if (controlMsg.type === 'get-pwd') {
            // 获取当前工作目录
            console.log(`[SSH控制] ========== get-pwd 开始 ==========`);
            console.log(`[SSH控制] sessionId=${sessionId}`);
            console.log(`[SSH控制] stream状态: ${stream ? (stream.destroyed ? '已销毁' : '正常') : '不存在'}`);
            
            if (!stream || stream.destroyed) {
              console.error(`[SSH控制] stream未就绪或已销毁`);
              if (ws.readyState === ws.OPEN) {
                ws.send('__PWD_RESPONSE__null');
              }
              return;
            }
            
            // 设置标志位，暂停主监听器输出
            isPwdCommandRunning = true;
            console.log(`[SSH控制] isPwdCommandRunning = true`);
            
            let pwdOutput = '';
            let pwdFound = false;
            let chunkCount = 0;
            
            const pwdTimeout = setTimeout(() => {
              if (pwdFound) return;
              console.error(`[SSH控制] ========== pwd命令超时 ==========`);
              console.error(`[SSH控制] 收到的chunk数量: ${chunkCount}`);
              console.error(`[SSH控制] 已收集输出 (${pwdOutput.length}字符):`);
              console.error(`[SSH控制] ---原始内容开始---`);
              console.error(JSON.stringify(pwdOutput));
              console.error(`[SSH控制] ---原始内容结束---`);
              isPwdCommandRunning = false;
              stream.removeListener('data', pwdDataHandler);
              if (ws.readyState === ws.OPEN) {
                ws.send('__PWD_RESPONSE__null');
              }
            }, 5000);
            
            // 临时监听数据
            const pwdDataHandler = (chunk) => {
              if (pwdFound) return;
              
              chunkCount++;
              const chunkStr = chunk.toString('utf8');
              pwdOutput += chunkStr;
              
              console.log(`[SSH控制] 收到chunk #${chunkCount}, 长度=${chunkStr.length}`);
              console.log(`[SSH控制] chunk内容: ${JSON.stringify(chunkStr)}`);
              
              // 查找路径：以/开头的独立行，不包含空格和特殊字符
              const lines = pwdOutput.split(/[\r\n]+/);
              console.log(`[SSH控制] 解析出 ${lines.length} 行`);
              
              for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                const trimmed = line.trim();
                
                // 跳过空行
                if (!trimmed) continue;
                
                console.log(`[SSH控制] 检查行${i}: "${trimmed}"`);
                
                // 路径匹配：以/开头，不包含空格、#、$、echo、pwd等
                const isPath = trimmed.startsWith('/') && 
                    !trimmed.includes(' ') && 
                    !trimmed.includes('#') &&
                    !trimmed.includes('$') &&
                    !trimmed.includes('echo') &&
                    !trimmed.includes('pwd') &&
                    trimmed.length > 1 &&
                    trimmed.length < 300;
                
                console.log(`[SSH控制]   -> 是否为路径: ${isPath}`);
                
                if (isPath) {
                  pwdFound = true;
                  clearTimeout(pwdTimeout);
                  stream.removeListener('data', pwdDataHandler);
                  isPwdCommandRunning = false;
                  
                  console.log(`[SSH控制] ========== 找到路径 ==========`);
                  console.log(`[SSH控制] 路径: ${trimmed}`);
                  
                  if (ws.readyState === ws.OPEN) {
                    ws.send(`__PWD_RESPONSE__${trimmed}`);
                  }
                  return;
                }
              }
            };
            
            stream.on('data', pwdDataHandler);
            
            // 先发送回车清空当前行，然后稍延迟发送pwd命令
            console.log(`[SSH控制] 发送\\n清空当前行`);
            stream.write('\n');
            
            setTimeout(() => {
              if (!pwdFound && stream && !stream.destroyed) {
                console.log(`[SSH控制] 发送pwd命令`);
                stream.write('pwd\n');
              }
            }, 100);
            return;
          }
        }
        
        // 尝试解析 JSON 格式的消息（如 resize）
        const message = JSON.parse(dataStr);
        
        if (message.type === 'resize') {
          // 处理窗口大小改变请求
          const { cols, rows } = message;
          
          if (!sshClient) {
            return;
          }
          
          if (!stream || stream.destroyed) {
            // 保存这个resize请求，等待 shell 打开后应用
            pendingResize = { cols, rows };
            return;
          }
          
          // 向 SSH 服务器发送窗口大小改变信号
          stream.setWindow(rows, cols, (err) => {
            if (err) {
              console.error(`[SSH resize] 设置窗口大小失败: ${err}`);
            }
          });
        } else {
          // 其他消息直接发送到 SSH 流
          if (stream && !stream.destroyed) {
            stream.write(data.toString());
          }
        }
      } catch (e) {
        // 如果不是 JSON，直接作为普通数据发送
        if (stream && !stream.destroyed) {
          stream.write(data.toString());
        }
      }
    });

    // 监听WebSocket pong事件（心跳响应）
    ws.on('pong', () => {
    });

    // SSH连接就绪 - 打开shell
    
    sshClient.on('ready', () => {
      isConnected = true;
      startHeartbeat(); // 连接成功后启动心跳

      sshClient.shell({ pty: { term: 'xterm-256color' } }, (err, channelStream) => {
        if (err) {
          console.error(`[SSH shell] 打开失败: ${err}`);
          if (ws.readyState === ws.OPEN) {
            ws.send(JSON.stringify({ type: 'error', data: `打开shell失败: ${err.message}` }));
            ws.close();
          }
          sshClient.end();
          return;
        }

        stream = channelStream;
        sshSessions.set(sessionId, { sshClient, stream, ws });
        
        // 如果有保存的 resize 请求，应用
        if (pendingResize) {
          const { cols, rows } = pendingResize;
          stream.setWindow(rows, cols, (err) => {
            if (err) {
              console.error(`[SSH shell启动] 应用 resize 失败: ${err}`);
            }
          });
          pendingResize = null;
        }

        // 发送欢迎信息
        try {
          ws.send(`连接到 ${sshConnection.name} 成功\r\n`);
        } catch (err) {
          console.error(`[WebSocket] 发送欢迎信息失败: ${err}`);
        }

        // 处理SSH数据输出
        stream.on('data', (data) => {
          // pwd命令执行中，不发送数据到前端（避免pwd输出显示在终端）
          if (isPwdCommandRunning) {
            return;
          }
          
          const dataStr = data.toString('utf8');
          
          if (ws.readyState === ws.OPEN) {
            try {
              ws.send(dataStr);
            } catch (err) {
              console.error(`发送数据到WebSocket失败: ${err}`);
            }
          }
        });

        // 处理stream关闭
        stream.on('close', () => {
          if (ws.readyState === ws.OPEN) {
            ws.close();
          }
        });

        // 处理stream错误
        stream.on('error', (err) => {
          console.error(`SSH stream错误: ${err}`);
          if (ws.readyState === ws.OPEN) {
            ws.send(JSON.stringify({ type: 'error', data: `连接错误: ${err.message}` }));
          }
        });
      });
    });

    // SSH连接关闭
    sshClient.on('close', () => {
      stopHeartbeat();
      sshSessions.delete(sessionId);
      
      // 主动关闭 WebSocket 连接
      if (ws.readyState === ws.OPEN || ws.readyState === ws.CONNECTING) {
        ws.close();
      }
    });

    // SSH连接错误
    sshClient.on('error', (err) => {
      console.error(`\n[SSH错误] ${connectionId} [${getCurrentTime()}]`);
      console.error(`  错误信息: ${err.message}`);
      console.error(`  错误详情: ${JSON.stringify(err)}`);
      console.error(`  isConnected=${isConnected}, isClosing=${isClosing}`);
      
      if (!isConnected && !isClosing) {
        let errorMsg = `SSH连接失败: ${err.message}`;
        
        if (err.message.includes('Timed out')) {
          errorMsg = `连接超时 - SSH服务器无响应。请检查:\n- 主机地址和端口是否正确\n- 防火墙是否阻止连接\n- SSH服务是否运行`;
          
          // 添加诊断日志
          console.error(`\n[SSH诊断] 连接超时诊断信息:`);
          console.error(`  目标地址: ${sshConnection.host}:${sshConnection.port}`);
          console.error(`  用户名: ${sshConnection.username}`);
          console.error(`  认证方式: ${sshConnection.authMethod}`);
          console.error(`  可能原因:`);
          console.error(`    1. 目标服务器地址不可达 (ping测试)`);
          console.error(`    2. SSH服务未运行 (netstat -tuln | grep 22)`);
          console.error(`    3. 防火墙阻止连接 (iptables/firewalld)`);
          console.error(`    4. SSH服务配置问题`);
        } else if (err.message.includes('getaddrinfo')) {
          errorMsg = `无法解析主机地址。请检查主机名是否正确`;
          console.error(`\n[SSH诊断] DNS解析失败: ${sshConnection.host}`);
        } else if (err.message.includes('refused')) {
          errorMsg = `连接被拒绝。请检查SSH服务是否正在运行`;
          console.error(`\n[SSH诊断] 连接被拒绝 - SSH服务可能未运行`);
        } else if (err.message.includes('Authentication')) {
          errorMsg = `身份验证失败。请检查用户名、密码或密钥`;
          console.error(`\n[SSH诊断] 身份验证失败 - 用户名或密码错误`);
        }
        
        if (ws.readyState === ws.OPEN) {
          ws.send(JSON.stringify({ type: 'error', data: errorMsg }));
          ws.close();
        }
      }
    });

    // 构建SSH连接选项
    const connectOptions = {
      host: sshConnection.host,
      port: sshConnection.port,
      username: sshConnection.username,
      readyTimeout: 30000,
      algorithms: {
        serverHostKey: ['ssh-rsa', 'ssh-dss', 'ecdsa-sha2-nistp256', 'ecdsa-sha2-nistp384', 'ecdsa-sha2-nistp521'],
        cipher: ['aes128-ctr', 'aes192-ctr', 'aes256-ctr', 'aes128-gcm@openssh.com', 'aes256-gcm@openssh.com'],
      },
    };

    // 设置认证信息
    if (sshConnection.authMethod === 'password') {
      connectOptions.password = sshConnection.password;
    } else if (sshConnection.authMethod === 'privateKey') {
      try {
        if (sshConnection.privateKey && sshConnection.privateKey.startsWith('-----BEGIN')) {
          connectOptions.privateKey = sshConnection.privateKey;
        } else if (sshConnection.privateKey) {
          connectOptions.privateKeyPath = sshConnection.privateKey;
        }
        if (sshConnection.passphrase) {
          connectOptions.passphrase = sshConnection.passphrase;
        }
      } catch (error) {
        console.error(`设置privateKey失败: ${error}`);
        if (ws.readyState === ws.OPEN) {
          ws.send(JSON.stringify({ type: 'error', data: `设置私钥失败: ${error.message}` }));
          ws.close();
        }
        return;
      }
    }

    sshClient.connect(connectOptions);
  }

  const port = parseInt(process.env.PORT || '3000', 10);
  server.listen(port, (err) => {
    if (err) throw err;
    console.log(`> Ready on http://localhost:${port}`);
  });
});
