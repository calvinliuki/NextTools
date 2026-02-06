import { NextRequest } from 'next/server';
import { getCachedConnection, getOrCreateConnection } from '@/lib/redisCache';

interface ListInsertRequest {
  connectionId: string;
  dbIndex: number | string;
  key: string;
  value: string;
  position?: 'head' | 'tail';
}

interface ListInsertResponse {
  code: number;
  message: string;
  data?: { inserted: boolean } | null;
}

export async function POST(request: NextRequest) {
  try {
    const body: ListInsertRequest = await request.json();
    const { connectionId, dbIndex: dbIndexInput, key: actualKey, value, position = 'tail' } = body;

    if (!connectionId || dbIndexInput === undefined || !actualKey || !value) {
      return Response.json({
        code: 400,
        message: '缺少必要参数',
        data: null,
      } as ListInsertResponse);
    }

    const dbIndex = parseInt(String(dbIndexInput));
    if (isNaN(dbIndex)) {
      return Response.json({
        code: 400,
        message: '无效的数据库索引',
        data: null,
      } as ListInsertResponse);
    }

    console.log('[List插入] 请求信息:', { connectionId, dbIndex, actualKey, value, position });

    let cachedConnection: any = getCachedConnection(connectionId);

    if (!cachedConnection) {
      console.warn(`[List插入] 缓存中连接不存在，尝试自动重连: ${connectionId}`);
      cachedConnection = await getOrCreateConnection(connectionId);
      if (!cachedConnection) {
        return Response.json({
          code: 500,
          message: 'Redis连接不存在且无法自动重连',
          data: null,
        } as ListInsertResponse);
      }
      console.log(`[List插入] 自动重连成功: ${connectionId}`);
    }

    const redisClient = cachedConnection.redis;
    await redisClient.select(dbIndex);

    // 检查key是否存在
    const exists = await redisClient.exists(actualKey);
    if (!exists) {
      return Response.json({
        code: 404,
        message: 'key不存在',
        data: null,
      } as ListInsertResponse);
    }

    // 在列表头或尾部插入元素
    if (position === 'head') {
      await redisClient.lpush(actualKey, value);
    } else {
      await redisClient.rpush(actualKey, value);
    }

    console.log(`[List插入] 插入完成: key="${actualKey}", position="${position}"`);

    return Response.json({
      code: 200,
      message: '插入成功',
      data: {
        inserted: true,
      },
    } as ListInsertResponse);
  } catch (error) {
    console.error('[List插入] 错误:', error);
    return Response.json({
      code: 500,
      message: '插入失败: ' + (error as Error).message,
      data: null,
    } as ListInsertResponse);
  }
}
