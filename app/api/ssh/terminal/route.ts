import { NextRequest } from 'next/server';
import { WebSocketServer } from 'ws';
import { SSHConnectionStore } from '@/lib/sshConnections';
import { Client } from 'ssh2';
import type { ClientChannel } from 'ssh2';

// 管理SSH连接的Map，key为WebSocket连接ID，value为{sshClient, connectionId}
const sshSessions = new Map<string, {
  sshClient: Client;
  connectionId: string;
  stream: NodeJS.ReadWriteStream | null;
}>();

let wss: WebSocketServer | null = null;

// 初始化WebSocket服务器
function initializeWebSocketServer() {
  if (wss) return wss;

  wss = new WebSocketServer({ 
    noServer: true,
    perMessageDeflate: {
      clientNoContextTakeover: true,
      serverNoContextTakeover: true,
    }
  });

  return wss;
}

// 处理WebSocket升级请求
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const connectionId = searchParams.get('connectionId');

  if (!connectionId) {
    return new Response('Missing connectionId', { status: 400 });
  }

  // 获取连接信息
  const connection = SSHConnectionStore.get(connectionId);
  if (!connection) {
    return new Response('Connection not found', { status: 404 });
  }

  // 检查是否支持WebSocket升级
  const upgrade = request.headers.get('upgrade');
  if (upgrade !== 'websocket') {
    return new Response('Not a WebSocket request', { status: 400 });
  }

  // 这里Next.js不直接支持WebSocket升级
  // 需要通过自定义服务器或使用socket.io等库
  return new Response('WebSocket upgrade not supported in this endpoint', { status: 500 });
}

// 处理WebSocket消息
export async function POST(request: NextRequest) {
  try {
    const { connectionId, message } = await request.json();

    if (!connectionId || !message) {
      return new Response(
        JSON.stringify({ code: 400, message: 'Missing parameters' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 这是一个临时的REST API端点用于测试
    // 实际的WebSocket通信需要在自定义服务器中实现
    return new Response(
      JSON.stringify({ code: 200, message: 'Message received' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ code: 500, message: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
