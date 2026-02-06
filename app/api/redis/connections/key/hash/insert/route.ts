import { NextRequest } from 'next/server';
import { getCachedConnection, getOrCreateConnection } from '@/lib/redisCache';

interface HashInsertRequest {
  connectionId: string;
  dbIndex: number | string;
  key: string;
  field: string;
  value: string;
}

interface HashInsertResponse {
  code: number;
  message: string;
  data?: { inserted: boolean } | null;
}

export async function POST(request: NextRequest) {
  try {
    const body: HashInsertRequest = await request.json();
    const { connectionId, dbIndex: dbIndexInput, key: actualKey, field, value } = body;

    if (!connectionId || dbIndexInput === undefined || !actualKey || !field) {
      return Response.json({
        code: 400,
        message: '缺少必要参数',
        data: null,
      } as HashInsertResponse);
    }

    const dbIndex = parseInt(String(dbIndexInput));
    if (isNaN(dbIndex)) {
      return Response.json({
        code: 400,
        message: '无效的数据库索引',
        data: null,
      } as HashInsertResponse);
    }

    console.log('[Hash插入] 请求信息:', { connectionId, dbIndex, actualKey, field, value });

    let cachedConnection: any = getCachedConnection(connectionId);

    if (!cachedConnection) {
      console.warn(`[Hash插入] 缓存中连接不存在，尝试自动重连: ${connectionId}`);
      cachedConnection = await getOrCreateConnection(connectionId);
      if (!cachedConnection) {
        return Response.json({
          code: 500,
          message: 'Redis连接不存在且无法自动重连',
          data: null,
        } as HashInsertResponse);
      }
      console.log(`[Hash插入] 自动重连成功: ${connectionId}`);
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
      } as HashInsertResponse);
    }

    // 检查字段是否已存在
    const fieldExists = await redisClient.hexists(actualKey, field);
    if (fieldExists) {
      return Response.json({
        code: 400,
        message: '字段已存在',
        data: null,
      } as HashInsertResponse);
    }

    // 插入新字段
    const result = await redisClient.hset(actualKey, field, value);

    console.log(`[Hash插入] 插入完成: key="${actualKey}", field="${field}"`);

    return Response.json({
      code: 200,
      message: '插入成功',
      data: {
        inserted: result > 0,
      },
    } as HashInsertResponse);
  } catch (error) {
    console.error('[Hash插入] 错误:', error);
    return Response.json({
      code: 500,
      message: '插入失败: ' + (error as Error).message,
      data: null,
    } as HashInsertResponse);
  }
}
