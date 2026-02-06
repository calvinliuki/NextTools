import { NextRequest } from 'next/server';
import { getCachedConnection, getOrCreateConnection } from '@/lib/redisCache';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { connectionId, dbIndex: dbIndexInput, key: actualKey, entryId, fields } = body;

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

    // 验证 fields 不为空
    if (!fields || Object.keys(fields).length === 0) {
      return Response.json({
        code: 400,
        message: '消息字段不能为空',
        data: null,
      });
    }

    // Redis Stream 不支持直接修改，需要删除旧消息后插入新消息
    // 首先检查消息是否存在
    const entries = await redisClient.xrange(actualKey, entryId, entryId);
    if (entries.length === 0) {
      return Response.json({
        code: 404,
        message: '消息不存在',
        data: null,
      });
    }

    // 删除旧消息
    await redisClient.xdel(actualKey, entryId);

    // 将 fields 对象转换为数组格式 [key1, val1, key2, val2, ...]
    const fieldArray: string[] = [];
    for (const [key, value] of Object.entries(fields)) {
      fieldArray.push(String(key));
      fieldArray.push(String(value));
    }

    // 添加新消息（保持原有的 ID 时间戳，序列号递增）
    // 提取原 ID 的时间戳部分和序列号部分
    const [timestamp, sequence] = entryId.split('-');
    const newSequence = String(parseInt(sequence) + 1);
    const newEntryId = `${timestamp}-${newSequence}`;

    // 使用 XADD 加上 ID 来指定消息 ID
    try {
      await redisClient.xadd(actualKey, newEntryId, ...fieldArray);
    } catch {
      // 如果 ID 冲突，使用自动生成的 ID
      await redisClient.xadd(actualKey, '*', ...fieldArray);
    }

    return Response.json({
      code: 200,
      message: '更新成功',
      data: { updated: true },
    });
  } catch (err: any) {
    return Response.json({
      code: 500,
      message: '更新失败: ' + err.message,
      data: null,
    });
  }
}
