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

    // 获取所有成员（带分数）并过滤
    // ZRANGE key 0 -1 WITHSCORES 返回 [member1, score1, member2, score2, ...]
    const allData = await redisClient.zrange(actualKey, 0, -1, 'WITHSCORES');
    
    // 将返回的数组转换为 { value, score } 格式
    const allMembers = [];
    for (let i = 0; i < allData.length; i += 2) {
      allMembers.push({
        value: allData[i],
        score: parseFloat(allData[i + 1]),
      });
    }

    // 根据关键词过滤（搜索 value 或 score）
    const results = allMembers
      .filter((item) => {
        const keywordLower = keyword.toLowerCase();
        const valueMatch = item.value.toLowerCase().includes(keywordLower);
        const scoreMatch = item.score.toString().includes(keyword);
        return valueMatch || scoreMatch;
      })
      .slice(0, limit)
      .map((item, index) => ({
        id: index + 1,
        value: item.value,
        score: item.score,
      }));

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
