import { NextRequest } from 'next/server';
import { getCachedConnection, getOrCreateConnection } from '@/lib/redisCache';

interface HashSearchRequest {
  connectionId: string;
  dbIndex: number | string;
  key: string;
  keyword: string;
  limit?: number;
}

interface HashSearchResponse {
  code: number;
  message: string;
  data?: { results: Array<{ id: number; key: string; value: string }>; total: number } | null;
}

export async function POST(request: NextRequest) {
  try {
    const body: HashSearchRequest = await request.json();
    const { connectionId, dbIndex: dbIndexInput, key: actualKey, keyword = '', limit = 100 } = body;

    if (!connectionId || dbIndexInput === undefined || !actualKey) {
      return Response.json({
        code: 400,
        message: '缺少必要参数',
        data: null,
      } as HashSearchResponse);
    }

    if (!keyword) {
      return Response.json({
        code: 400,
        message: '缺少搜索关键词',
        data: null,
      } as HashSearchResponse);
    }

    const dbIndex = parseInt(String(dbIndexInput));
    if (isNaN(dbIndex)) {
      return Response.json({
        code: 400,
        message: '无效的数据库索引',
        data: null,
      } as HashSearchResponse);
    }

    console.log('[Hash搜索] 请求信息:', { connectionId, dbIndex, actualKey, keyword });

    let cachedConnection: any = getCachedConnection(connectionId);

    // 如果缓存中不存在，尝试从数据库自动重连
    if (!cachedConnection) {
      console.warn(`[Hash搜索] 缓存中连接不存在，尝试自动重连: ${connectionId}`);
      cachedConnection = await getOrCreateConnection(connectionId);
      if (!cachedConnection) {
        return Response.json({
          code: 500,
          message: 'Redis连接不存在且无法自动重连，请检查连接配置',
          data: null,
        } as HashSearchResponse);
      }
      console.log(`[Hash搜索] 自动重连成功: ${connectionId}`);
    }

    const redisClient = cachedConnection.redis;

    // 选择指定的数据库
    await redisClient.select(dbIndex);

    // 获取整个 Hash 的所有数据
    // 注意：对于大 Hash，这可能会耗时较长，建议后续优化为分页搜索
    const hashData = await redisClient.hgetall(actualKey);

    if (!hashData || Object.keys(hashData).length === 0) {
      console.log(`[Hash搜索] 未找到 Hash 数据: ${actualKey}`);
      return Response.json({
        code: 200,
        message: '搜索成功',
        data: {
          results: [],
          total: 0,
        },
      } as HashSearchResponse);
    }

    // 搜索逻辑：在字段名和值中搜索关键词（不区分大小写）
    const lowerKeyword = keyword.toLowerCase();
    const results = [];
    let id = 1;

    for (const [field, value] of Object.entries(hashData)) {
      if (
        field.toLowerCase().includes(lowerKeyword) ||
        (typeof value === 'string' && value.toLowerCase().includes(lowerKeyword))
      ) {
        results.push({
          id,
          key: field,
          value: String(value),
        });
        id++;

        // 达到限制数量时停止
        if (results.length >= limit) {
          break;
        }
      }
    }

    console.log(`[Hash搜索] 搜索完成: 关键词="${keyword}", 找到 ${results.length} 条结果`);

    return Response.json({
      code: 200,
      message: '搜索成功',
      data: {
        results,
        total: results.length,
      },
    } as HashSearchResponse);
  } catch (error) {
    console.error('[Hash搜索] 错误:', error);
    return Response.json({
      code: 500,
      message: '搜索失败: ' + (error as Error).message,
      data: null,
    } as HashSearchResponse);
  }
}
