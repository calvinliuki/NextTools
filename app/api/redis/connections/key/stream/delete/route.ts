import { NextRequest } from 'next/server';
import { getCachedConnection, getOrCreateConnection } from '@/lib/redisCache';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { connectionId, dbIndex: dbIndexInput, key: actualKey, entryId } = body;

    // 参数验证
    if (!connectionId || dbIndexInput === undefined || !actualKey) {
      return Response.json({
        code: 400,
        message: '缺少必要参数: connectionId, dbIndex 或 key',
        data: null,
      });
    }

    const dbIndex = parseInt(String(dbIndexInput));
    if (isNaN(dbIndex)) {
      return Response.json({
        code: 400,
        message: '无效的数据库索引',
        data: null,
      });
    }

    // 获取 Redis 客户端（支持自动重连）
    let cachedConnection: any = getCachedConnection(connectionId);
    if (!cachedConnection) {
      cachedConnection = await getOrCreateConnection(connectionId);
    }
    const redisClient = cachedConnection.redis;
    await redisClient.select(dbIndex);

    // 验证消息是否存在
    const exists = await redisClient.xlen(actualKey);
    if (exists === 0) {
      return Response.json({
        code: 404,
        message: '消息不存在',
        data: null,
      });
    }

    // 删除消息
    const deleted = await redisClient.xdel(actualKey, entryId);

    if (deleted === 0) {
      return Response.json({
        code: 404,
        message: '消息不存在',
        data: null,
      });
    }

    return Response.json({
      code: 200,
      message: '删除成功',
      data: { deleted: true },
    });
  } catch (err: any) {
    return Response.json({
      code: 500,
      message: '删除失败: ' + err.message,
      data: null,
    });
  }
}
