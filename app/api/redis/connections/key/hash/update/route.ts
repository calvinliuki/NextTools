import { NextRequest } from 'next/server';
import { getCachedConnection, getOrCreateConnection } from '@/lib/redisCache';

interface HashUpdateRequest {
  connectionId: string;
  dbIndex: number | string;
  key: string;
  oldField: string;
  newField: string;
  value: string;
}

interface HashUpdateResponse {
  code: number;
  message: string;
  data?: { updated: boolean } | null;
}

export async function POST(request: NextRequest) {
  try {
    const body: HashUpdateRequest = await request.json();
    const { connectionId, dbIndex: dbIndexInput, key: actualKey, oldField, newField, value } = body;

    if (!connectionId || dbIndexInput === undefined || !actualKey || !oldField || !newField) {
      return Response.json({
        code: 400,
        message: '缺少必要参数',
        data: null,
      } as HashUpdateResponse);
    }

    const dbIndex = parseInt(String(dbIndexInput));
    if (isNaN(dbIndex)) {
      return Response.json({
        code: 400,
        message: '无效的数据库索引',
        data: null,
      } as HashUpdateResponse);
    }

    console.log('[Hash更新] 请求信息:', { connectionId, dbIndex, actualKey, oldField, newField, value });

    let cachedConnection: any = getCachedConnection(connectionId);

    if (!cachedConnection) {
      console.warn(`[Hash更新] 缓存中连接不存在，尝试自动重连: ${connectionId}`);
      cachedConnection = await getOrCreateConnection(connectionId);
      if (!cachedConnection) {
        return Response.json({
          code: 500,
          message: 'Redis连接不存在且无法自动重连',
          data: null,
        } as HashUpdateResponse);
      }
      console.log(`[Hash更新] 自动重连成功: ${connectionId}`);
    }

    const redisClient = cachedConnection.redis;
    await redisClient.select(dbIndex);

    // 如果字段名改变了，需要先删除旧字段，再添加新字段
    if (oldField !== newField) {
      // 检查新字段名是否已存在
      const exists = await redisClient.hexists(actualKey, newField);
      if (exists) {
        return Response.json({
          code: 400,
          message: `字段名 "${newField}" 已存在`,
          data: null,
        } as HashUpdateResponse);
      }
      // 删除旧字段
      await redisClient.hdel(actualKey, oldField);
    }

    // 设置新值
    await redisClient.hset(actualKey, newField, value);

    console.log(`[Hash更新] 更新完成: key="${actualKey}", oldField="${oldField}", newField="${newField}"`);

    return Response.json({
      code: 200,
      message: '更新成功',
      data: {
        updated: true,
      },
    } as HashUpdateResponse);
  } catch (error) {
    console.error('[Hash更新] 错误:', error);
    return Response.json({
      code: 500,
      message: '更新失败: ' + (error as Error).message,
      data: null,
    } as HashUpdateResponse);
  }
}
