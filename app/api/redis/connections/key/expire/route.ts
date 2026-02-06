import { NextRequest } from 'next/server';
import { getCachedConnection, getOrCreateConnection } from '@/lib/redisCache';

interface ExpireKeyRequest {
  connectionId: string;
  dbIndex: number | string;
  key: string;
  ttl: number;
}

interface RedisKeyResponse {
  code: number;
  message: string;
  data?: any;
}

export async function POST(request: NextRequest) {
  try {
    const body: ExpireKeyRequest = await request.json();
    const { connectionId, dbIndex, key: actualKey, ttl } = body;

    if (!connectionId || dbIndex === undefined || !actualKey || ttl === undefined) {
      return Response.json({
        code: 400,
        message: '缺少必要参数: connectionId, dbIndex, key 或 ttl',
        data: null,
      } as RedisKeyResponse);
    }

    const dbIndexNum = parseInt(String(dbIndex));
    if (isNaN(dbIndexNum)) {
      return Response.json({
        code: 400,
        message: '无效的数据库索引',
        data: null,
      } as RedisKeyResponse);
    }

    let cachedConnection: any = getCachedConnection(connectionId);
    
    if (!cachedConnection) {
      console.warn(`[设置过期时间] 缓存中连接不存在，尝试自动重连: ${connectionId}`);
      cachedConnection = await getOrCreateConnection(connectionId);
      if (!cachedConnection) {
        return Response.json({
          code: 500,
          message: 'Redis连接不存在且无法自动重连',
          data: null,
        } as RedisKeyResponse);
      }
      console.log(`[设置过期时间] 自动重连成功: ${connectionId}`);
    }

    const redis = cachedConnection.redis;

    // 选择指定的数据库
    await redis.select(dbIndexNum);

    // 检查key是否存在
    const exists = await redis.exists(actualKey);
    if (!exists) {
      return Response.json({
        code: 404,
        message: 'key不存在',
        data: null,
      } as RedisKeyResponse);
    }

    // 设置过期时间
    let result;
    if (ttl === -1) {
      // 如果ttl为-1，表示要设置为永不过期，使用PERSIST命令
      result = await redis.persist(actualKey);
      console.log(`[设置过期时间] PERSIST命令结果: ${result}, key: ${actualKey}`);
      // persist返回1表示成功移除过期时间，0表示key没有过期时间（也是成功的状态）
      if (result === 1 || result === 0) {
        return Response.json({
          code: 200,
          message: '设置成功',
          data: null,
        } as RedisKeyResponse);
      }
    } else {
      // 否则使用EXPIRE命令设置过期时间
      result = await redis.expire(actualKey, ttl);
      console.log(`[设置过期时间] EXPIRE命令结果: ${result}, key: ${actualKey}, ttl: ${ttl}`);
      if (result === 1) {
        return Response.json({
          code: 200,
          message: '设置成功',
          data: null,
        } as RedisKeyResponse);
      }
    }

    return Response.json({
      code: 500,
      message: `设置失败: 操作返回值为${result}`,
      data: null,
    } as RedisKeyResponse);
  } catch (error: any) {
    console.error('设置过期时间失败:', error);
    return Response.json({
      code: 500,
      message: `设置过期时间失败: ${error.message}`,
      data: null,
    } as RedisKeyResponse);
  }
}
