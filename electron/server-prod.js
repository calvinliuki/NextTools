/**
 * Electron 生产环境专用启动器
 * 使用 Next.js standalone 生成的服务器 + WebSocket 支持
 */

const { createServer } = require('http');
const { parse } = require('url');
const path = require('path');
const { WebSocketServer } = require('ws');

// 切换到正确的工作目录
process.chdir(__dirname);

// 加载 Next.js standalone 服务器
const NextServer = require('next/dist/server/next-server').default;

const hostname = 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);

// 配置
const nextConfig = {
  hostname,
  port,
  dir: __dirname,
  dev: false,
  customServer: true,
  conf: {
    distDir: '.next',
  },
};

const nextServer = new NextServer(nextConfig);
const handler = nextServer.getRequestHandler();

// 创建 HTTP 服务器
const server = createServer((req, res) => {
  const parsedUrl = parse(req.url, true);
  handler(req, res, parsedUrl);
});

// 创建 WebSocket 服务器（用于 SSH 终端）
const wss = new WebSocketServer({ noServer: true });

// 处理 WebSocket 升级请求
server.on('upgrade', (req, socket, head) => {
  const { pathname, query } = parse(req.url, true);
  
  // 只处理 /api/ssh 路径的 WebSocket
  if (pathname === '/api/ssh') {
    const connectionId = query.connectionId;
    
    if (!connectionId) {
      console.error('[WebSocket] 错误: 缺少connectionId');
      socket.destroy();
      return;
    }
    
    wss.handleUpgrade(req, socket, head, (ws) => {
      // 这里需要实现 SSH 连接逻辑
      // 但在生产环境中，我们简化处理，返回错误消息
      ws.send(JSON.stringify({ 
        type: 'error', 
        data: 'SSH WebSocket 在生产环境中暂不可用，请使用开发模式' 
      }));
      ws.close();
    });
  }
});

// 启动服务器
server.listen(port, hostname, () => {
  console.log(`> Ready on http://${hostname}:${port}`);
});

// 优雅退出
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down...');
  server.close(() => {
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down...');
  server.close(() => {
    process.exit(0);
  });
});
