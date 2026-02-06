import { NextRequest } from 'next/server';
import { getCachedConnection, getOrCreateConnection } from '@/lib/redisCache';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { connectionId, dbIndex: dbIndexInput, key: actualKey, keyword, limit = 100 } = body;

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

    // 获取所有消息
    const entries = await redisClient.xrange(actualKey, '-', '+', 'COUNT', 1000);

    // 根据关键词过滤
    const keywordLower = keyword.toLowerCase();
    const results = entries
      .filter((entry: any) => {
        const [id, fields] = entry;
        // 搜索 ID 或字段值
        if (id.toLowerCase().includes(keyword)) return true;
        // 搜索所有字段值
        for (let i = 1; i < fields.length; i += 2) {
          if (fields[i].toLowerCase().includes(keywordLower)) {
            return true;
          }
        }
        return false;
      })
      .slice(0, limit)
      .map((entry: any, index: number) => {
        const [id, fields] = entry;
        const data: Record<string, string> = {};
        for (let i = 0; i < fields.length; i += 2) {
          data[fields[i]] = fields[i + 1];
        }
        return {
          id: index + 1,
          entryId: id,
          timestamp: id.split('-')[0],
          data,
        };
      });

    return Response.json({
      code: 200,
      message: '搜索成功',
      data: { results, total: results.length },
    });
  } catch (err: any) {
    return Response.json({
      code: 500,
      message: '搜索失败: ' + err.message,
      data: null,
    });
  }
}
