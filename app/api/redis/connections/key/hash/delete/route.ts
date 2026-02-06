import { NextRequest } from 'next/server';
import { getCachedConnection, getOrCreateConnection } from '@/lib/redisCache';

interface HashDeleteRequest {
  connectionId: string;
  dbIndex: number | string;
  key: string;
  field: string;
}

interface HashDeleteResponse {
  code: number;
  message: string;
  data?: { deleted: boolean; affectedRows: number } | null;
}

export async function POST(request: NextRequest) {
  try {
    const body: HashDeleteRequest = await request.json();
    const { connectionId, dbIndex: dbIndexInput, key: actualKey, field } = body;

    if (!connectionId || dbIndexInput === undefined || !actualKey || !field) {
      return Response.json({
        code: 400,
        message: '缺少必要参数',
        data: null,
      } as HashDeleteResponse);
    }

    const dbIndex = parseInt(String(dbIndexInput));
    if (isNaN(dbIndex)) {
      return Response.json({
        code: 400,
        message: '无效的数据库索引',
        data: null,
      } as HashDeleteResponse);
    }

    console.log('[Hash删除] 请求信息:', { connectionId, dbIndex, actualKey, field });

    let cachedConnection: any = getCachedConnection(connectionId);

    // 如果缓存中不存在，尝试从数据库自动重连
    if (!cachedConnection) {
      console.warn(`[Hash删除] 缓存中连接不存在，尝试自动重连: ${connectionId}`);
      cachedConnection = await getOrCreateConnection(connectionId);
      if (!cachedConnection) {
        return Response.json({
          code: 500,
          message: 'Redis连接不存在且无法自动重连，请检查连接配置',
          data: null,
        } as HashDeleteResponse);
      }
      console.log(`[Hash删除] 自动重连成功: ${connectionId}`);
    }

    const redisClient = cachedConnection.redis;

    // 选择指定的数据库
    await redisClient.select(dbIndex);

    // 删除 Hash 中的字段
    const affectedRows = await redisClient.hdel(actualKey, field);

    console.log(`[Hash删除] 删除完成: key="${actualKey}", field="${field}", 影响行数=${affectedRows}`);

    return Response.json({
      code: 200,
      message: '删除成功',
      data: {
        deleted: affectedRows > 0,
        affectedRows,
      },
    } as HashDeleteResponse);
  } catch (error) {
    console.error('[Hash删除] 错误:', error);
    return Response.json({
      code: 500,
      message: '删除失败: ' + (error as Error).message,
      data: null,
    } as HashDeleteResponse);
  }
}
