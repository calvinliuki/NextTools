import { NextRequest } from 'next/server';
import { getCachedConnection, getOrCreateConnection } from '@/lib/redisCache';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { connectionId, dbIndex: dbIndexInput, key: actualKey, fields } = body;

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

    // 将 fields 对象转换为数组格式 [key1, val1, key2, val2, ...]
    const fieldArray: string[] = [];
    for (const [key, value] of Object.entries(fields)) {
      fieldArray.push(String(key));
      fieldArray.push(String(value));
    }

    // 使用 XADD 添加消息，使用 * 自动生成 ID
    const entryId = await redisClient.xadd(actualKey, '*', ...fieldArray);

    // 获取新的 stream 长度
    const streamLength = await redisClient.xlen(actualKey);

    return Response.json({
      code: 200,
      message: '添加成功',
      data: { entryId, streamLength },
    });
  } catch (err: any) {
    return Response.json({
      code: 500,
      message: '添加失败: ' + err.message,
      data: null,
    });
  }
}
