import { NextRequest } from 'next/server';
import { getCachedConnection, getOrCreateConnection } from '@/lib/redisCache';

interface ListUpdateRequest {
  connectionId: string;
  dbIndex: number | string;
  key: string;
  index: number;
  value: string;
}

interface ListUpdateResponse {
  code: number;
  message: string;
  data?: { updated: boolean } | null;
}

export async function POST(request: NextRequest) {
  try {
    const body: ListUpdateRequest = await request.json();
    const { connectionId, dbIndex: dbIndexInput, key: actualKey, index, value } = body;

    if (!connectionId || dbIndexInput === undefined || !actualKey || index === undefined || index === null) {
      return Response.json({
        code: 400,
        message: '缺少必要参数',
        data: null,
      } as ListUpdateResponse);
    }

    const dbIndex = parseInt(String(dbIndexInput));
    if (isNaN(dbIndex)) {
      return Response.json({
        code: 400,
        message: '无效的数据库索引',
        data: null,
      } as ListUpdateResponse);
    }

    console.log('[List编辑] 请求信息:', { connectionId, dbIndex, actualKey, index, value });

    let cachedConnection: any = getCachedConnection(connectionId);

    if (!cachedConnection) {
      console.warn(`[List编辑] 缓存中连接不存在，尝试自动重连: ${connectionId}`);
      cachedConnection = await getOrCreateConnection(connectionId);
      if (!cachedConnection) {
        return Response.json({
          code: 500,
          message: 'Redis连接不存在且无法自动重连',
          data: null,
        } as ListUpdateResponse);
      }
      console.log(`[List编辑] 自动重连成功: ${connectionId}`);
    }

    const redisClient = cachedConnection.redis;
    await redisClient.select(dbIndex);

    // 检查索引是否有效
    const listLength = await redisClient.llen(actualKey);
    if (index < 0 || index >= listLength) {
      return Response.json({
        code: 400,
        message: `索引 ${index} 超出范围（0-${listLength - 1}）`,
        data: null,
      } as ListUpdateResponse);
    }

    // 更新列表元素
    await redisClient.lset(actualKey, index, value);

    console.log(`[List编辑] 更新完成: key="${actualKey}", index=${index}`);

    return Response.json({
      code: 200,
      message: '更新成功',
      data: {
        updated: true,
      },
    } as ListUpdateResponse);
  } catch (error) {
    console.error('[List编辑] 错误:', error);
    return Response.json({
      code: 500,
      message: '更新失败: ' + (error as Error).message,
      data: null,
    } as ListUpdateResponse);
  }
}
