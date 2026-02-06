import { NextRequest } from 'next/server';
import { getAllRedisConnections } from '@/lib/db';
import { getCachedConnection, getOrCreateConnection } from '@/lib/redisCache';

interface RedisKeyResponse {
  code: number;
  message: string;
  data: any;
}

export async function POST(request: NextRequest) {
  try {
    const { connectionId, dbIndex, key: actualKey, value } = await request.json();

    if (!connectionId || dbIndex === undefined || !actualKey || value === undefined) {
      return Response.json({
        code: 400,
        message: '缺少必要参数: connectionId, dbIndex, key 或 value',
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

    console.log('[更新key] 请求信息:', { connectionId, dbIndex: dbIndexNum, actualKey });

    let cachedConnection: any = getCachedConnection(connectionId);

    // 如果缓存中不存在，尝试从数据库自动重连
    if (!cachedConnection) {
      console.warn(`[更新key] 缓存中连接不存在，尝试自动重连: ${connectionId}`);
      cachedConnection = await getOrCreateConnection(connectionId);
      if (!cachedConnection) {
        return Response.json({
          code: 500,
          message: 'Redis连接不存在且无法自动重连，请检查连接配置',
          data: null,
        } as RedisKeyResponse);
      }
      console.log(`[更新key] 自动重连成功: ${connectionId}`);
    }

    const redisClient = cachedConnection.redis;

    // 选择指定的数据库
    await redisClient.select(dbIndexNum);

    // 使用 SET 命令更新 string 类型的值
    const result = await redisClient.set(actualKey, value);

    if (result === 'OK') {
      console.log(`[更新key] 成功更新: ${actualKey}`);
      return Response.json({
        code: 200,
        message: '更新成功',
        data: null,
      } as RedisKeyResponse);
    } else {
      console.error(`[更新key] 更新失败: ${result}`);
      return Response.json({
        code: 500,
        message: '更新失败: ' + result,
        data: null,
      } as RedisKeyResponse);
    }
  } catch (error) {
    console.error('[更新key] 错误:', error);
    return Response.json({
      code: 500,
      message: '更新失败: ' + (error as Error).message,
      data: null,
    } as RedisKeyResponse);
  }
}
