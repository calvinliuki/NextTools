import { NextRequest } from 'next/server';
import { getCachedConnection, getOrCreateConnection } from '@/lib/redisCache';

interface HashScanRequest {
  connectionId: string;
  dbIndex: number;
  key: string; // actualKey
  cursor?: string; // 分页游标，默认为 '0'
}

interface HashScanResponse {
  code: number;
  message: string;
  data?: {
    list: Array<{ id: number; key: string; value: string }>;
    cursor: string; // 下一次的游标
    hasMore: boolean; // 是否还有更多数据
  } | null;
}

export async function POST(request: NextRequest) {
  try {
    const body: HashScanRequest = await request.json();
    const { connectionId, dbIndex: dbIndexInput, key: actualKey, cursor = '0' } = body;

    // 参数验证
    if (!connectionId || dbIndexInput === undefined || !actualKey) {
      return Response.json({
        code: 400,
        message: '缺少必要参数: connectionId, dbIndex 或 key',
        data: null,
      } as HashScanResponse);
    }

    const dbIndex = parseInt(String(dbIndexInput));
    if (isNaN(dbIndex)) {
      return Response.json({
        code: 400,
        message: '无效的数据库索引',
        data: null,
      } as HashScanResponse);
    }

    console.log('[Hash分页] 请求信息:', { connectionId, dbIndex, actualKey, cursor });

    let cachedConnection: any = getCachedConnection(connectionId);

    // 如果缓存中不存在，尝试从数据库自动重连
    if (!cachedConnection) {
      console.warn(`[Hash分页] 缓存中连接不存在，尝试自动重连: ${connectionId}`);
      cachedConnection = await getOrCreateConnection(connectionId);
      if (!cachedConnection) {
        return Response.json({
          code: 500,
          message: 'Redis连接不存在且无法自动重连，请检查连接配置',
          data: null,
        } as HashScanResponse);
      }
      console.log(`[Hash分页] 自动重连成功: ${connectionId}`);
    }

    const redisClient = cachedConnection.redis;

    // 选择指定的数据库
    await redisClient.select(dbIndex);

    // 使用HSCAN获取数据，每页8条
    const [nextCursor, hashFields] = await redisClient.hscan(actualKey, cursor, 'COUNT', 8);
    const hashList = [];
    for (let i = 0; i < hashFields.length; i += 2) {
      if (hashFields[i] && hashFields[i + 1] !== undefined) {
        hashList.push({
          id: (parseInt(cursor) * 8 + i / 2) + 1,
          key: hashFields[i],
          value: hashFields[i + 1],
        });
      }
    }

    // 判断是否还有更多数据
    const hasMore = nextCursor !== '0';

    console.log(`[Hash分页] 成功扫描: cursor=${nextCursor}, hasMore=${hasMore}, count=${hashList.length}`);

    return Response.json({
      code: 200,
      message: '分页扫描成功',
      data: {
        list: hashList,
        cursor: nextCursor,
        hasMore,
      },
    } as HashScanResponse);
  } catch (error) {
    console.error('[Hash分页] 错误:', error);
    return Response.json({
      code: 500,
      message: '分页扫描失败: ' + (error as Error).message,
      data: null,
    } as HashScanResponse);
  }
}
