import { NextRequest } from 'next/server';
import { getCachedConnection, getOrCreateConnection } from '@/lib/redisCache';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { connectionId, dbIndex: dbIndexInput, key: actualKey } = body;

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

    // 获取 stream 长度
    const streamLength = await redisClient.xlen(actualKey);

    // 使用 XRANGE 获取所有消息（最多100条）
    // XRANGE key - + COUNT 100 会从旧到新返回最多100条
    const entries = await redisClient.xrange(actualKey, '-', '+', 'COUNT', 100);

    // 格式化返回数据
    const results = entries.map((entry: any, index: number) => {
      const [id, fields] = entry;
      // fields 是一个数组 [key1, val1, key2, val2, ...]
      const data: Record<string, string> = {};
      for (let i = 0; i < fields.length; i += 2) {
        data[fields[i]] = fields[i + 1];
      }
      return {
        id: index + 1,
        entryId: id,
        timestamp: id.split('-')[0], // 从 ID 中提取时间戳部分
        data,
      };
    });

    return Response.json({
      code: 200,
      message: '获取成功',
      data: { results, total: results.length, streamLength },
    });
  } catch (err: any) {
    return Response.json({
      code: 500,
      message: '获取失败: ' + err.message,
      data: null,
    });
  }
}
