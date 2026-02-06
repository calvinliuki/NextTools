import { NextRequest } from 'next/server';
import { getCachedConnection, getOrCreateConnection } from '@/lib/redisCache';

/**
 * POST /api/redis/connections/key/add
 * 添加新的 Redis key
 */

interface AddKeyRequest {
  connectionId: string;
  dbIndex: number;
  key: string; // 新key名称
  type: 'string' | 'hash' | 'list' | 'set' | 'zset' | 'stream';
  value?: string; // string类型的值
  fields?: Array<{name: string, value: string}>; // hash类型的字段
  values?: string[]; // list/set类型的值列表
  members?: Array<{value: string, score: number}>; // zset类型的成员
  streamFields?: {[key: string]: string}; // stream类型的字段
  ttl?: number; // 过期时间（秒），-1表示永不过期
}

interface AddKeyResponse {
  code: number;
  message: string;
  data?: { success: boolean } | null;
}

export async function POST(request: NextRequest) {
  try {
    const body: AddKeyRequest = await request.json();
    const { connectionId, dbIndex, key, type, value, fields, values, members, streamFields, ttl } = body;

    if (!connectionId || dbIndex === undefined || !key || !type) {
      return Response.json({
        code: 400,
        message: '缺少必要参数',
        data: null,
      } as AddKeyResponse);
    }

    console.log('[添加Key] 请求信息:', { connectionId, dbIndex, key, type });

    let cachedConnection: any = getCachedConnection(connectionId);

    if (!cachedConnection) {
      console.warn(`[添加Key] 缓存中连接不存在，尝试自动重连: ${connectionId}`);
      cachedConnection = await getOrCreateConnection(connectionId);
      if (!cachedConnection) {
        return Response.json({
          code: 500,
          message: 'Redis连接不存在且无法自动重连',
          data: null,
        } as AddKeyResponse);
      }
      console.log(`[添加Key] 自动重连成功: ${connectionId}`);
    }

    const redis = cachedConnection.redis;
    const mode = cachedConnection.mode;

    // 集群模式不需要 SELECT
    if (mode !== 'cluster') {
      await redis.select(dbIndex);
    }

    // 检查key是否已存在
    const exists = await redis.exists(key);
    if (exists) {
      return Response.json({
        code: 400,
        message: `Key "${key}" 已存在`,
        data: null,
      } as AddKeyResponse);
    }

    // 根据类型创建key
    switch (type) {
      case 'string':
        if (value === undefined) {
          return Response.json({
            code: 400,
            message: 'String类型需要提供value参数',
            data: null,
          } as AddKeyResponse);
        }
        await redis.set(key, value);
        break;

      case 'hash':
        if (!fields || fields.length === 0) {
          return Response.json({
            code: 400,
            message: 'Hash类型需要提供至少一个字段',
            data: null,
          } as AddKeyResponse);
        }
        const hashData: string[] = [];
        fields.forEach(f => {
          hashData.push(f.name, f.value);
        });
        await redis.hset(key, ...hashData);
        break;

      case 'list':
        if (!values || values.length === 0) {
          return Response.json({
            code: 400,
            message: 'List类型需要提供至少一个值',
            data: null,
          } as AddKeyResponse);
        }
        await redis.rpush(key, ...values);
        break;

      case 'set':
        if (!values || values.length === 0) {
          return Response.json({
            code: 400,
            message: 'Set类型需要提供至少一个成员',
            data: null,
          } as AddKeyResponse);
        }
        await redis.sadd(key, ...values);
        break;

      case 'zset':
        if (!members || members.length === 0) {
          return Response.json({
            code: 400,
            message: 'ZSet类型需要提供至少一个成员',
            data: null,
          } as AddKeyResponse);
        }
        const zsetData: Array<number | string> = [];
        members.forEach(m => {
          zsetData.push(m.score, m.value);
        });
        await redis.zadd(key, ...zsetData);
        break;

      case 'stream':
        if (!streamFields || Object.keys(streamFields).length === 0) {
          return Response.json({
            code: 400,
            message: 'Stream类型需要提供至少一个字段',
            data: null,
          } as AddKeyResponse);
        }
        await redis.xadd(key, '*', ...Object.entries(streamFields).flat());
        break;

      default:
        return Response.json({
          code: 400,
          message: `不支持的类型: ${type}`,
          data: null,
        } as AddKeyResponse);
    }

    // 设置过期时间
    if (ttl && ttl > 0) {
      await redis.expire(key, ttl);
    }

    console.log(`[添加Key] 创建成功: key="${key}", type="${type}"`);

    return Response.json({
      code: 200,
      message: '创建成功',
      data: {
        success: true,
      },
    } as AddKeyResponse);
  } catch (error) {
    console.error('[添加Key] 错误:', error);
    return Response.json({
      code: 500,
      message: '创建失败: ' + (error as Error).message,
      data: null,
    } as AddKeyResponse);
  }
}
