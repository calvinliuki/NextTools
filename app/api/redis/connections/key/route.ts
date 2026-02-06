import { NextRequest } from 'next/server';
import { getCachedConnection, getOrCreateConnection, redisConnectionCache } from '@/lib/redisCache';

interface RedisKeyRequest {
  connectionId: string;
  dbIndex: number | string;
  key: string;
}

interface RedisKeyResponse {
  code: number;
  message: string;
  data?: any;
}

interface KeyDetailBase {
  key: string;
  type: string;
  littleKey: string;
  ttl: number;
  mem: number;
  coding: string;
}

interface StringDetail extends KeyDetailBase {
  value: string;
}

interface HashDetail extends KeyDetailBase {
  list: Array<{ id: number; key: string; value: string }>;
  length: number;
  cursor?: string;
}

interface ListDetail extends KeyDetailBase {
  list: Array<{ id: number; value: string }>;
  length: number;
}

interface SetDetail extends KeyDetailBase {
  list: Array<{ id: number; value: string }>;
  length: number;
}

interface ZSetDetail extends KeyDetailBase {
  list: Array<{ id: number; value: string; score: string }>;
  length: number;
}

interface StreamDetail extends KeyDetailBase {
  list: Array<{ id: number; entryId: string; timestamp: string; data: Record<string, string> }>;
  length: number;
}

export async function POST(request: NextRequest) {
  try {
    const body: RedisKeyRequest = await request.json();
    const { connectionId, dbIndex: dbIndexInput, key: actualKey } = body;

    if (!connectionId || dbIndexInput === undefined || !actualKey) {
      return Response.json({
        code: 400,
        message: '缺少必要参数: connectionId, dbIndex 或 key',
        data: null,
      } as RedisKeyResponse);
    }

    const dbIndex = parseInt(String(dbIndexInput));
    if (isNaN(dbIndex)) {
      return Response.json({
        code: 400,
        message: '无效的数据库索引',
        data: null,
      } as RedisKeyResponse);
    }

    console.log('[Key Detail API] 请求信息:', { connectionId, dbIndex, actualKey });
    console.log('[Key Detail API] 缓存中的连接:', Array.from(redisConnectionCache.keys()));

    let cachedConnection: any = getCachedConnection(connectionId);
    
    // 如果缓存中不存在，尝试从数据库自动重连
    if (!cachedConnection) {
      console.warn('[Key Detail API] 缓存中连接不存在，尝试自动重连...');
      cachedConnection = await getOrCreateConnection(connectionId);
      if (!cachedConnection) {
        console.error('[Key Detail API] 自动重连失败:', { connectionId });
        return Response.json({
          code: 500,
          message: 'Redis连接不存在且无法自动重连，请检查连接配置',
          data: null,
        } as RedisKeyResponse);
      }
      console.log('[Key Detail API] 自动重连成功:', { connectionId });
    }

    const redisClient = cachedConnection.redis;
    
    // 选择数据库
    if (dbIndex >= 0) {
      await redisClient.select(dbIndex);
      console.log('[Key Detail API] 已选择数据库:', dbIndex);
    }

    // 获取key类型
    const type = await redisClient.type(actualKey);
    console.log('[Key Detail API] key类型:', { actualKey, type });
    
    // 检查key是否存在
    if (type === 'none') {
      console.log('[Key Detail API] key不存在或已被删除:', { actualKey, connectionId, dbIndex, type });
      // 添加更多诊断信息
      const allKeys = await redisClient.keys('*');
      console.log('[Key Detail API] 当前db中的key总数:', allKeys.length);
      if (allKeys.length > 0 && allKeys.length <= 10) {
        console.log('[Key Detail API] 当前db中的所有key:', allKeys);
      }
      return Response.json({
        code: 404,
        message: `key不存在。请检查：1.key是否存在；2.是否在正确的数据库(db${dbIndex})；3.key名称是否正确`,
        data: null,
      } as RedisKeyResponse);
    }
    
    // 获取key的基础信息
    const ttl = await redisClient.ttl(actualKey);
    // 使用 MEMORY USAGE 命令获取内存占用
    let mem = 0;
    try {
      mem = await redisClient.call('MEMORY', 'USAGE', actualKey) || 0;
    } catch (e) {
      // 如果命令执行失败，则使用默认值0
      mem = 0;
    }
    // 查询编码格式
    let coding = '';
    try {
      // 使用 OBJECT ENCODING 查询编码格式
      const encodingResult = await redisClient.call('OBJECT', 'ENCODING', actualKey);
      coding = encodingResult ? String(encodingResult) : '';
      
      // 详细日志输出：key的类型和其编码
      console.log(`[Key Detail API] OBJECT ENCODING: key=${actualKey}, type=${type}, encoding=${coding}`);
    } catch (e) {
      // 如果命令执行失败，使用默认值
      console.warn(`[Key Detail API] OBJECT ENCODING 查询失败: key=${actualKey}, type=${type}, error=${(e as Error).message}`);
      coding = '';
    }

    // 构造返回的fullKey（保持三字段分别返回的格式，供前端后续操作使用）
    const fullKey = `${connectionId}-${dbIndex}-${actualKey}`;

    // 根据类型获取详细信息
    let result: any;
    
    switch (type) {
      case 'string':
        const value = await redisClient.get(actualKey);
        result = {
          key: fullKey,
          littleKey: actualKey,
          type: 'string',
          value,
          ttl: ttl >= 0 ? ttl : -1,
          mem,
          coding,
        } as StringDetail;
        break;

      case 'hash':
        // 获取hash長度
        const hashLength = await redisClient.hlen(actualKey);
              
        // 使用HSCAN获取前100个字段
        const [cursor, hashFields] = await redisClient.hscan(actualKey, '0', 'COUNT', 100);
        const hashList = [];
        for (let i = 0; i < hashFields.length; i += 2) {
          if (hashFields[i] && hashFields[i + 1] !== undefined) {
            hashList.push({
              id: i / 2 + 1,
              key: hashFields[i],
              value: hashFields[i + 1],
            });
          }
        }
        
        result = {
          key: fullKey,
          littleKey: actualKey,
          type: 'hash',
          list: hashList,
          length: hashLength,
          cursor,
          ttl: ttl >= 0 ? ttl : -1,
          mem,
          coding,
        } as HashDetail;
        break;

      case 'list':
        const listLength = await redisClient.llen(actualKey);
        const listValues = await redisClient.lrange(actualKey, 0, 99) as string[]; // 获取前100个元素
        
        const listItems = listValues.map((value: string, index: number) => ({
          id: index + 1,
          value,
        }));
        
        result = {
          key: fullKey,
          littleKey: actualKey,
          type: 'list',
          list: listItems,
          length: listLength,
          ttl: ttl >= 0 ? ttl : -1,
          mem,
          coding,
        } as ListDetail;
        break;

      case 'set':
        const setSize = await redisClient.scard(actualKey);
        const [setCursor, setMembers] = await redisClient.sscan(actualKey, '0', 'COUNT', 100) as [string, string[]];
        
        const setItems = setMembers.map((value: string, index: number) => ({
          id: index + 1,
          value,
        }));
        
        result = {
          key: fullKey,
          littleKey: actualKey,
          type: 'set',
          list: setItems,
          length: setSize,
          ttl: ttl >= 0 ? ttl : -1,
          mem,
          coding,
        } as SetDetail;
        break;

      case 'zset':
        const zsetLength = await redisClient.zcard(actualKey);
        // 使用 zrange 命令并指定 WITHSCORES 获取分数（前100个）
        const zsetRangeResult = await redisClient.zrange(actualKey, 0, 99, 'WITHSCORES');
        const zsetItems = [];
        for (let i = 0; i < zsetRangeResult.length; i += 2) {
          if (zsetRangeResult[i] && zsetRangeResult[i + 1] !== undefined) {
            zsetItems.push({
              id: Math.floor(i / 2) + 1,
              value: zsetRangeResult[i],
              score: zsetRangeResult[i + 1],
            });
          }
        }
        
        result = {
          key: fullKey,
          littleKey: actualKey,
          type: 'zset',
          list: zsetItems,
          length: zsetLength,
          ttl: ttl >= 0 ? ttl : -1,
          mem,
          coding,
        } as ZSetDetail;
        break;

      case 'stream':
        const streamLength = await redisClient.xlen(actualKey);
        // 使用 xrange 命令获取前100条消息
        const streamEntries = await redisClient.xrange(actualKey, '-', '+', 'COUNT', 100);
        const streamItems = streamEntries.map((entry: any, index: number) => {
          const [id, fields] = entry;
          const data: Record<string, string> = {};
          for (let i = 0; i < fields.length; i += 2) {
            data[fields[i]] = fields[i + 1];
          }
          return {
            id: index + 1,
            entryId: id,
            timestamp: id.split('-')[0],
            data,
          };
        });
        
        result = {
          key: fullKey,
          littleKey: actualKey,
          type: 'stream',
          list: streamItems,
          length: streamLength,
          ttl: ttl >= 0 ? ttl : -1,
          mem,
          coding,
        } as StreamDetail;
        break;

      default:
        return Response.json({
          code: 500,
          message: `不支持的key类型: ${type}`,
          data: null,
        } as RedisKeyResponse);
    }

    return Response.json({
      code: 200,
      message: '查询成功',
      data: result,
    } as RedisKeyResponse);
  } catch (error: any) {
    console.error('查询Redis key详情失败:', error);
    return Response.json({
      code: 500,
      message: `查询Redis key详情失败: ${error.message}`,
      data: null,
    } as RedisKeyResponse);
  }
}

