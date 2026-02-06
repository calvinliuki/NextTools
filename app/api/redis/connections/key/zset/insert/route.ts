import { NextRequest } from 'next/server';
import { getCachedConnection, getOrCreateConnection } from '@/lib/redisCache';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { connectionId, dbIndex: dbIndexInput, key: actualKey, value, score } = body;

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

    // 检查成员是否已存在
    const existingScore = await redisClient.zscore(actualKey, value);
    if (existingScore !== null) {
      return Response.json({
        code: 400,
        message: `成员 "${value}" 已存在（分数：${existingScore}）`,
        data: null,
      });
    }

    // 添加成员
    await redisClient.zadd(actualKey, score, value);
    const newSize = await redisClient.zcard(actualKey);

    return Response.json({
      code: 200,
      message: '插入成功',
      data: { inserted: true, newSize },
    });
  } catch (err: any) {
    return Response.json({
      code: 500,
      message: '插入失败: ' + err.message,
      data: null,
    });
  }
}
