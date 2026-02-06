import { NextRequest } from 'next/server';
import { getCachedConnection, getOrCreateConnection } from '@/lib/redisCache';

/**
 * POST /api/redis/connections/key/set/update
 * 更新 Set 成员（删除旧值，添加新值）
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { connectionId, dbIndex: dbIndexInput, key: actualKey, oldValue, newValue } = body;

    // 参数验证
    if (!connectionId || dbIndexInput === undefined || !actualKey) {
      return Response.json({
        code: 400,
        message: '缺少必要参数: connectionId, dbIndex 或 key',
        data: null,
      });
    }

    if (oldValue === undefined || oldValue === null) {
      return Response.json({
        code: 400,
        message: '参数 oldValue 必须提供',
        data: null,
      });
    }

    if (newValue === undefined || newValue === null) {
      return Response.json({
        code: 400,
        message: '参数 newValue 必须提供',
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

    // 获取 Redis 客户端
    let cachedConnection: any = getCachedConnection(connectionId);

    if (!cachedConnection) {
      console.warn(`[Set编辑] 缓存中连接不存在，尝试自动重连: ${connectionId}`);
      cachedConnection = await getOrCreateConnection(connectionId);
      if (!cachedConnection) {
        return Response.json({
          code: 500,
          message: 'Redis连接不存在且无法自动重连',
          data: null,
        });
      }
      console.log(`[Set编辑] 自动重连成功: ${connectionId}`);
    }

    const redisClient = cachedConnection.redis;
    await redisClient.select(dbIndex);

    // 如果新旧值相同，直接返回成功
    if (oldValue === newValue) {
      return Response.json({
        code: 200,
        message: '编辑成功',
        data: { updated: true },
      });
    }

    // 检查旧值是否存在
    const exists = await redisClient.sismember(actualKey, oldValue);
    if (!exists) {
      return Response.json({
        code: 404,
        message: '原成员不存在',
        data: null,
      });
    }

    // 检查新值是否已存在（如果新旧值不同）
    const newExists = await redisClient.sismember(actualKey, newValue);
    if (newExists) {
      return Response.json({
        code: 400,
        message: `成员 "${newValue}" 已存在`,
        data: null,
      });
    }

    // 删除旧成员
    await redisClient.srem(actualKey, oldValue);
    
    // 添加新成员
    await redisClient.sadd(actualKey, newValue);

    console.log(`[Set编辑] 编辑完成: key="${actualKey}", oldValue="${oldValue}", newValue="${newValue}"`);

    return Response.json({
      code: 200,
      message: '编辑成功',
      data: {
        updated: true,
        oldValue,
        newValue,
      },
    });
  } catch (err: any) {
    console.error('[Set编辑] 错误:', err);
    return Response.json({
      code: 500,
      message: '编辑失败: ' + err.message,
      data: null,
    });
  }
}
