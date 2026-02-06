import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { WebSocketServer } from 'ws';
import { handleSSHWebSocket } from './lib/sshWebSocket';

const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOST || 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url!, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  });

  // 创建 WebSocket 服务器
  const wss = new WebSocketServer({ 
    server,
    path: '/api/ssh',
  });

  wss.on('connection', (ws, req) => {
    // 从 URL 路径中提取 connectionId
    // 路径格式: /api/ssh/[connectionId]
    const path = req.url || '';
    const match = path.match(/^\/api\/ssh\/([^/]+)$/);
    
    if (!match) {
      ws.send(JSON.stringify({
        type: 'error',
        message: '无效的连接路径，路径格式应为: /api/ssh/[connectionId]',
      }));
      ws.close();
      return;
    }

    const connectionId = match[1];
    console.log(`新的 WebSocket 连接请求: connectionId=${connectionId}`);

    // 处理 SSH WebSocket 连接
    handleSSHWebSocket(ws, connectionId);
  });

  wss.on('error', (error) => {
    console.error('WebSocket Server error:', error);
  });

  server
    .once('error', (err) => {
      console.error(err);
      process.exit(1);
    })
    .listen(port, () => {
      console.log(`> Ready on http://${hostname}:${port}`);
      console.log(`> WebSocket server ready on ws://${hostname}:${port}/api/ssh/[connectionId]`);
    });
});
