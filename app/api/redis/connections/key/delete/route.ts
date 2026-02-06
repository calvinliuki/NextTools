import { NextRequest } from 'next/server';
import { getCachedConnection, getOrCreateConnection } from '@/lib/redisCache';

interface RedisKeyResponse {
  code: number;
  message: string;
  data?: any;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { connectionId, dbIndex, key: actualKey } = body;

    if (!connectionId || dbIndex === undefined || !actualKey) {
      return Response.json({
        code: 400,
        message: '缺少必要参数: connectionId, dbIndex 或 key',
        data: null,
      } as RedisKeyResponse);
    }

    const dbIndexNum = parseInt(dbIndex);
    if (isNaN(dbIndexNum)) {
      return Response.json({
        code: 400,
        message: '无效的数据库索引',
        data: null,
      } as RedisKeyResponse);
    }

    let cachedConnection: any = getCachedConnection(connectionId);
    
    // 如果缓存中不存在，尝试从数据库自动重连
    if (!cachedConnection) {
      console.warn(`[删除key] 缓存中连接不存在，尝试自动重连: ${connectionId}`);
      cachedConnection = await getOrCreateConnection(connectionId);
      if (!cachedConnection) {
        return Response.json({
          code: 500,
          message: 'Redis连接不存在且无法自动重连，请检查连接配置',
          data: null,
        } as RedisKeyResponse);
      }
      console.log(`[删除key] 自动重连成功: ${connectionId}`);
    }

    const redisClient = cachedConnection.redis;

    // 选择数据库
    if (dbIndexNum >= 0) {
      await redisClient.select(dbIndexNum);
    }

    // 检查key是否存在
    const exists = await redisClient.exists(actualKey);
    if (!exists) {
      return Response.json({
        code: 404,
        message: 'key不存在',
        data: null,
      } as RedisKeyResponse);
    }

    // 删除key
    const deleted = await redisClient.del(actualKey);

    if (deleted > 0) {
      return Response.json({
        code: 200,
        message: '删除成功',
        data: null,
      } as RedisKeyResponse);
    } else {
      return Response.json({
        code: 500,
        message: '删除失败',
        data: null,
      } as RedisKeyResponse);
    }
  } catch (error: any) {
    console.error('删除Redis key失败:', error);
    return Response.json({
      code: 500,
      message: `删除Redis key失败: ${error.message}`,
      data: null,
    } as RedisKeyResponse);
  }
}
