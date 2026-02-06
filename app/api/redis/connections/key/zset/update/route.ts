import { NextRequest } from 'next/server';
import { getCachedConnection, getOrCreateConnection } from '@/lib/redisCache';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { connectionId, dbIndex: dbIndexInput, key: actualKey, oldValue, newValue, newScore } = body;

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

    // 检查旧成员是否存在
    const oldScore = await redisClient.zscore(actualKey, oldValue);
    if (oldScore === null) {
      return Response.json({
        code: 404,
        message: '原成员不存在',
        data: null,
      });
    }

    // 如果值和分数都没变，直接返回成功
    if (oldValue === newValue && parseFloat(oldScore) === parseFloat(newScore)) {
      return Response.json({
        code: 200,
        message: '编辑成功',
        data: { updated: true },
      });
    }

    // 如果值改变，检查新值是否已存在（且不是当前编辑的值）
    if (oldValue !== newValue) {
      const newExists = await redisClient.zscore(actualKey, newValue);
      if (newExists !== null) {
        return Response.json({
          code: 400,
          message: `成员 "${newValue}" 已存在`,
          data: null,
        });
      }
      // 删除旧成员
      await redisClient.zrem(actualKey, oldValue);
    }

    // 添加/更新新成员（如果值相同，就是更新分数；如果值不同，就是添加新成员）
    await redisClient.zadd(actualKey, newScore, newValue);

    return Response.json({
      code: 200,
      message: '编辑成功',
      data: { updated: true },
    });
  } catch (err: any) {
    return Response.json({
      code: 500,
      message: '编辑失败: ' + err.message,
      data: null,
    });
  }
}
