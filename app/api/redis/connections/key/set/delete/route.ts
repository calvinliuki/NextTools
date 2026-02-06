import { NextRequest } from 'next/server';
import { getCachedConnection, getOrCreateConnection } from '@/lib/redisCache';

interface SetDeleteRequest {
  connectionId: string;
  dbIndex: number | string;
  key: string;
  member: string;
}

interface SetDeleteResponse {
  code: number;
  message: string;
  data?: { deleted: boolean } | null;
}

export async function POST(request: NextRequest) {
  try {
    const body: SetDeleteRequest = await request.json();
    const { connectionId, dbIndex: dbIndexInput, key: actualKey, member } = body;

    if (!connectionId || dbIndexInput === undefined || !actualKey || !member) {
      return Response.json({
        code: 400,
        message: '缺少必要参数',
        data: null,
      } as SetDeleteResponse);
    }

    const dbIndex = parseInt(String(dbIndexInput));
    if (isNaN(dbIndex)) {
      return Response.json({
        code: 400,
        message: '无效的数据库索引',
        data: null,
      } as SetDeleteResponse);
    }

    console.log('[Set删除] 请求信息:', { connectionId, dbIndex, actualKey, member });

    let cachedConnection: any = getCachedConnection(connectionId);

    if (!cachedConnection) {
      console.warn(`[Set删除] 缓存中连接不存在，尝试自动重连: ${connectionId}`);
      cachedConnection = await getOrCreateConnection(connectionId);
      if (!cachedConnection) {
        return Response.json({
          code: 500,
          message: 'Redis连接不存在且无法自动重连',
          data: null,
        } as SetDeleteResponse);
      }
      console.log(`[Set删除] 自动重连成功: ${connectionId}`);
    }

    const redisClient = cachedConnection.redis;
    await redisClient.select(dbIndex);

    // 删除集合中的成员
    const affectedRows = await redisClient.srem(actualKey, member);

    console.log(`[Set删除] 删除完成: key="${actualKey}", member="${member}", 影响行数=${affectedRows}`);

    return Response.json({
      code: 200,
      message: '删除成功',
      data: {
        deleted: affectedRows > 0,
      },
    } as SetDeleteResponse);
  } catch (error) {
    console.error('[Set删除] 错误:', error);
    return Response.json({
      code: 500,
      message: '删除失败: ' + (error as Error).message,
      data: null,
    } as SetDeleteResponse);
  }
}
