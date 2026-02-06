import { NextRequest } from 'next/server';
import { getCachedConnection, getOrCreateConnection } from '@/lib/redisCache';

interface ListDeleteRequest {
  connectionId: string;
  dbIndex: number | string;
  key: string;
  index: number;
}

interface ListDeleteResponse {
  code: number;
  message: string;
  data?: { deleted: boolean } | null;
}

export async function POST(request: NextRequest) {
  try {
    const body: ListDeleteRequest = await request.json();
    const { connectionId, dbIndex: dbIndexInput, key: actualKey, index } = body;

    if (!connectionId || dbIndexInput === undefined || !actualKey || index === undefined || index === null) {
      return Response.json({
        code: 400,
        message: '缺少必要参数',
        data: null,
      } as ListDeleteResponse);
    }

    const dbIndex = parseInt(String(dbIndexInput));
    if (isNaN(dbIndex)) {
      return Response.json({
        code: 400,
        message: '无效的数据库索引',
        data: null,
      } as ListDeleteResponse);
    }

    console.log('[List删除] 请求信息:', { connectionId, dbIndex, actualKey, index });

    let cachedConnection: any = getCachedConnection(connectionId);

    if (!cachedConnection) {
      console.warn(`[List删除] 缓存中连接不存在，尝试自动重连: ${connectionId}`);
      cachedConnection = await getOrCreateConnection(connectionId);
      if (!cachedConnection) {
        return Response.json({
          code: 500,
          message: 'Redis连接不存在且无法自动重连',
          data: null,
        } as ListDeleteResponse);
      }
      console.log(`[List删除] 自动重连成功: ${connectionId}`);
    }

    const redisClient = cachedConnection.redis;
    await redisClient.select(dbIndex);

    // 获取列表长度
    const listLength = await redisClient.llen(actualKey);
    if (index < 0 || index >= listLength) {
      return Response.json({
        code: 400,
        message: `索引 ${index} 超出范围（0-${listLength - 1}）`,
        data: null,
      } as ListDeleteResponse);
    }

    // 使用占位符删除元素
    // Redis 没有直接的删除索引的命令，所以使用以下策略：
    // 1. 使用 LSET 将要删除的元素设置为占位符
    // 2. 使用 LREM 删除所有占位符
    const placeholder = '__DELETED__';
    await redisClient.lset(actualKey, index, placeholder);
    await redisClient.lrem(actualKey, 1, placeholder);

    console.log(`[List删除] 删除完成: key="${actualKey}", index=${index}`);

    return Response.json({
      code: 200,
      message: '删除成功',
      data: {
        deleted: true,
      },
    } as ListDeleteResponse);
  } catch (error) {
    console.error('[List删除] 错误:', error);
    return Response.json({
      code: 500,
      message: '删除失败: ' + (error as Error).message,
      data: null,
    } as ListDeleteResponse);
  }
}
