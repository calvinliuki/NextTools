import { NextRequest } from 'next/server';
import { getCachedConnection, getOrCreateConnection } from '@/lib/redisCache';

interface ListSearchRequest {
  connectionId: string;
  dbIndex: number | string;
  key: string;
  keyword: string;
  limit?: number;
}

interface ListSearchResponse {
  code: number;
  message: string;
  data?: { results: Array<{ id: number; value: string }>; total: number } | null;
}

export async function POST(request: NextRequest) {
  try {
    const body: ListSearchRequest = await request.json();
    const { connectionId, dbIndex: dbIndexInput, key: actualKey, keyword = '', limit = 100 } = body;

    if (!connectionId || dbIndexInput === undefined || !actualKey) {
      return Response.json({
        code: 400,
        message: '缺少必要参数',
        data: null,
      } as ListSearchResponse);
    }

    if (!keyword) {
      return Response.json({
        code: 400,
        message: '缺少搜索关键词',
        data: null,
      } as ListSearchResponse);
    }

    const dbIndex = parseInt(String(dbIndexInput));
    if (isNaN(dbIndex)) {
      return Response.json({
        code: 400,
        message: '无效的数据库索引',
        data: null,
      } as ListSearchResponse);
    }

    console.log('[List搜索] 请求信息:', { connectionId, dbIndex, actualKey, keyword });

    let cachedConnection: any = getCachedConnection(connectionId);

    if (!cachedConnection) {
      console.warn(`[List搜索] 缓存中连接不存在，尝试自动重连: ${connectionId}`);
      cachedConnection = await getOrCreateConnection(connectionId);
      if (!cachedConnection) {
        return Response.json({
          code: 500,
          message: 'Redis连接不存在且无法自动重连',
          data: null,
        } as ListSearchResponse);
      }
      console.log(`[List搜索] 自动重连成功: ${connectionId}`);
    }

    const redisClient = cachedConnection.redis;
    await redisClient.select(dbIndex);

    // 获取列表长度
    const listLength = await redisClient.llen(actualKey);
    if (listLength === 0) {
      return Response.json({
        code: 200,
        message: '搜索成功',
        data: {
          results: [],
          total: 0,
        },
      } as ListSearchResponse);
    }

    // 获取所有列表元素并搜索
    const allValues = await redisClient.lrange(actualKey, 0, -1);
    const lowerKeyword = keyword.toLowerCase();
    const results = [];
    let id = 1;

    for (const value of allValues) {
      if (value && String(value).toLowerCase().includes(lowerKeyword)) {
        results.push({
          id,
          value: String(value),
        });
        id++;

        if (results.length >= limit) {
          break;
        }
      }
    }

    console.log(`[List搜索] 搜索完成: 关键词="${keyword}", 找到 ${results.length} 条结果`);

    return Response.json({
      code: 200,
      message: '搜索成功',
      data: {
        results,
        total: results.length,
      },
    } as ListSearchResponse);
  } catch (error) {
    console.error('[List搜索] 错误:', error);
    return Response.json({
      code: 500,
      message: '搜索失败: ' + (error as Error).message,
      data: null,
    } as ListSearchResponse);
  }
}
