import { NextRequest } from 'next/server';
import { getCachedConnection, getOrCreateConnection } from '@/lib/redisCache';

interface RenameKeyRequest {
  connectionId: string;
  dbIndex: number | string;
  key: string;
  newKey: string;
}

interface RedisKeyResponse {
  code: number;
  message: string;
  data?: any;
}

export async function POST(request: NextRequest) {
  try {
    const body: RenameKeyRequest = await request.json();
    const { connectionId, dbIndex, key: actualKey, newKey } = body;

    if (!connectionId || dbIndex === undefined || !actualKey || !newKey) {
      return Response.json({
        code: 400,
        message: '缺少必要参数: connectionId, dbIndex, key 或 newKey',
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
      console.warn(`[重命名key] 缓存中连接不存在，尝试自动重连: ${connectionId}`);
      cachedConnection = await getOrCreateConnection(connectionId);
      if (!cachedConnection) {
        return Response.json({
          code: 500,
          message: 'Redis连接不存在且无法自动重连',
          data: null,
        } as RedisKeyResponse);
      }
      console.log(`[重命名key] 自动重连成功: ${connectionId}`);
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

    // 检查新key是否已存在
    const newKeyExists = await redis.exists(newKey);
    if (newKeyExists) {
      return Response.json({
        code: 400,
        message: '新key已存在',
        data: null,
      } as RedisKeyResponse);
    }

    // 重命名key
    const result = await redis.rename(actualKey, newKey);

    if (result === 'OK') {
      return Response.json({
        code: 200,
        message: '重命名成功',
        data: null,
      } as RedisKeyResponse);
    } else {
      return Response.json({
        code: 500,
        message: '重命名失败',
        data: null,
      } as RedisKeyResponse);
    }
  } catch (error: any) {
    console.error('重命名key失败:', error);
    return Response.json({
      code: 500,
      message: `重命名key失败: ${error.message}`,
      data: null,
    } as RedisKeyResponse);
  }
}
