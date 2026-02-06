import Redis from 'ioredis';
import { getAllConnections } from './db';

// Redis 连接缓存，用于在不同 API 路由间共享连接
export const redisConnectionCache: Map<string, { 
  redis: any; 
  mode: 'standalone' | 'cluster';
}> = new Map();

// 获取缓存的连接
export function getCachedConnection(id: string): { redis: any; mode: 'standalone' | 'cluster' } | undefined {
  return redisConnectionCache.get(id);
}

// 设置缓存的连接
export function setCachedConnection(id: string, redis: any, mode: 'standalone' | 'cluster') {
  redisConnectionCache.set(id, { redis, mode });
}

// 删除缓存的连接
export async function removeCachedConnection(id: string) {
  const cached = redisConnectionCache.get(id);
  if (cached) {
    try {
      await cached.redis.quit();
    } catch (error) {
      console.error('关闭 Redis 连接失败:', error);
    }
    redisConnectionCache.delete(id);
  }
}

// 自动重连机制：从数据库获取配置并创建连接
export async function getOrCreateConnection(connectionId: string): Promise<{ redis: any; mode: 'standalone' | 'cluster' } | null> {
  // 先检查缓存中是否存在
  const cached = getCachedConnection(connectionId);
  if (cached) {
    return cached;
  }

  try {
    // 从数据库获取连接配置
    const connections = getAllConnections();
    const connection = connections.find(c => c.id === connectionId);
    
    if (!connection) {
      return null;
    }

    const config = connection.config;
    const mode = config.mode || 'standalone';
    const redisOptions: any = {
      connectTimeout: (config.connectionTimeout || 60) * 1000,
      commandTimeout: (config.executionTimeout || 60) * 1000,
      retryStrategy: () => null,
      maxRetriesPerRequest: 1,
    };

    // 设置认证信息
    if (config.password) {
      redisOptions.password = config.password;
    }
    if (config.username) {
      redisOptions.username = config.username;
    }

    // SSL/TLS 配置
    if (config.securityMode === 'ssl') {
      redisOptions.tls = {
        rejectUnauthorized: false,
      };
    }

    let redis: any = null;

    // 根据连接模式创建连接
    if (mode === 'standalone') {
      redis = new Redis({
        host: config.host,
        port: config.port,
        ...redisOptions,
      });

      redis.on('error', (err: Error) => {
        console.error(`Redis 单机连接错误 [${connectionId}]:`, err.message);
      });
    } else if (mode === 'cluster') {
      redis = new (Redis as any).Cluster(config.clusterNodes, {
        redisOptions: {
          ...redisOptions,
        },
        clusterRetryStrategy: (times: number) => {
          if (times > 3) {
            return null;
          }
          return Math.min(times * 100, 2000);
        },
        enableReadyCheck: true,
        maxRedirections: 3,
        retryDelayOnFailover: 100,
        retryDelayOnClusterDown: 300,
        slotsRefreshTimeout: 1000,
      });

      redis.on('error', (err: Error) => {
        console.error(`Redis Cluster 连接错误 [${connectionId}]:`, err.message);
      });
    }

    if (!redis) {
      return null;
    }

    // 测试连接
    try {
      const pong = await redis.ping();
      if (pong !== 'PONG') {
        throw new Error('PING 命令返回异常');
      }
    } catch (error) {
      // 连接失败，关闭连接
      try {
        await redis.quit();
      } catch (e) {
        // 忽略关闭错误
      }
      return null;
    }

    // 连接成功，缓存该连接
    setCachedConnection(connectionId, redis, mode);
    console.log(`自动重连成功：${connectionId} (${mode} 模式)`);
    
    return { redis, mode };
  } catch (error: any) {
    console.error(`自动重连失败 [${connectionId}]:`, error.message);
    return null;
  }
}
