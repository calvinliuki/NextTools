import { NextRequest } from 'next/server';
import { getCachedConnection, getOrCreateConnection } from '@/lib/redisCache';

interface SetInsertRequest {
  connectionId: string;
  dbIndex: number | string;
  key: string;
  member: string;
}

interface SetInsertResponse {
  code: number;
  message: string;
  data?: { inserted: boolean } | null;
}

export async function POST(request: NextRequest) {
  try {
    const body: SetInsertRequest = await request.json();
    const { connectionId, dbIndex: dbIndexInput, key: actualKey, member } = body;

    if (!connectionId || dbIndexInput === undefined || !actualKey || !member) {
      return Response.json({
        code: 400,
        message: '缺少必要参数',
        data: null,
      } as SetInsertResponse);
    }

    const dbIndex = parseInt(String(dbIndexInput));
    if (isNaN(dbIndex)) {
      return Response.json({
        code: 400,
        message: '无效的数据库索引',
        data: null,
      } as SetInsertResponse);
    }

    console.log('[Set插入] 请求信息:', { connectionId, dbIndex, actualKey, member });

    let cachedConnection: any = getCachedConnection(connectionId);

    if (!cachedConnection) {
      console.warn(`[Set插入] 缓存中连接不存在，尝试自动重连: ${connectionId}`);
      cachedConnection = await getOrCreateConnection(connectionId);
      if (!cachedConnection) {
        return Response.json({
          code: 500,
          message: 'Redis连接不存在且无法自动重连',
          data: null,
        } as SetInsertResponse);
      }
      console.log(`[Set插入] 自动重连成功: ${connectionId}`);
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
      } as SetInsertResponse);
    }

    // 检查成员是否已存在
    const memberExists = await redisClient.sismember(actualKey, member);
    if (memberExists) {
      return Response.json({
        code: 400,
        message: '成员已存在',
        data: null,
      } as SetInsertResponse);
    }

    // 添加新成员
    const result = await redisClient.sadd(actualKey, member);

    console.log(`[Set插入] 插入完成: key="${actualKey}", member="${member}"`);

    return Response.json({
      code: 200,
      message: '插入成功',
      data: {
        inserted: result > 0,
      },
    } as SetInsertResponse);
  } catch (error) {
    console.error('[Set插入] 错误:', error);
    return Response.json({
      code: 500,
      message: '插入失败: ' + (error as Error).message,
      data: null,
    } as SetInsertResponse);
  }
}
