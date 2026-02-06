import Redis from 'ioredis';

export interface RedisConnectionOptions {
  host?: string;
  port?: number;
  password?: string;
  username?: string;
  securityMode?: 'none' | 'ssl' | 'ssh';
  connectionTimeout?: number;
  executionTimeout?: number;
  mode?: 'standalone' | 'sentinel' | 'cluster';
  clusterNodes?: Array<{ host: string; port: number }>;
  sentinelMasterId?: string;
  sentinelNodes?: Array<{ host: string; port: number }>;
}

// 测试 Redis 连接
export async function testRedisConnection(options: RedisConnectionOptions): Promise<{
  success: boolean;
  message: string;
  data?: {
    connectionInfo: string;
    serverVersion?: string;
  };
}> {
  let redis: any = null;
  
  try {
    const redisOptions: any = {
      connectTimeout: (options.connectionTimeout || 60) * 1000,
      commandTimeout: (options.executionTimeout || 60) * 1000,
      retryStrategy: () => null,
      maxRetriesPerRequest: 1,
    };

    // 设置认证信息
    if (options.password) {
      redisOptions.password = options.password;
    }
    if (options.username) {
      redisOptions.username = options.username;
    }

    // SSL/TLS 配置
    if (options.securityMode === 'ssl') {
      redisOptions.tls = {
        rejectUnauthorized: false,
      };
    }

    // SSH 通道暂不支持
    if (options.securityMode === 'ssh') {
      return {
        success: false,
        message: 'SSH 通道模式暂未实现',
      };
    }

    const mode = options.mode || 'standalone';
    let connectionInfo = '';

    // 根据连接模式创建连接
    if (mode === 'standalone') {
      if (!options.host || !options.port) {
        return {
          success: false,
          message: '单机模式需要提供地址和端口',
        };
      }
      
      // 使用普通单机模式连接
      redis = new Redis({
        host: options.host,
        port: options.port,
        ...redisOptions,
      });
      
      // 添加错误监听器
      redis.on('error', (err: Error) => {
        console.error('Redis 单机连接错误:', err.message);
      });
      
      connectionInfo = `${options.host}:${options.port}`;
    } else if (mode === 'cluster') {
      if (!options.clusterNodes || options.clusterNodes.length === 0) {
        return {
          success: false,
          message: '集群模式需要提供至少一个节点',
        };
      }
      redis = new (Redis as any).Cluster(options.clusterNodes, {
        redisOptions: {
          ...redisOptions,
        },
        clusterRetryStrategy: (times: number) => {
          if (times > 3) {
            return null; // 停止重试
          }
          return Math.min(times * 100, 2000);
        },
        enableReadyCheck: true,
        maxRedirections: 3,
        retryDelayOnFailover: 100,
        retryDelayOnClusterDown: 300,
        slotsRefreshTimeout: 1000,
      });
      
      // 添加错误监听器，防止未处理的错误事件
      redis.on('error', (err: Error) => {
        console.error('Redis Cluster 连接错误:', err.message);
      });
      
      connectionInfo = options.clusterNodes.map(n => `${n.host}:${n.port}`).join(', ');
    }

    if (!redis) {
      return {
        success: false,
        message: '无法创建 Redis 连接',
      };
    }

    // 测试连接
    const pong = await redis.ping();
    if (pong !== 'PONG') {
      throw new Error('Redis 连接测试失败：PING 命令返回异常');
    }

    // 获取服务器信息
    let serverVersion = 'unknown';
    try {
      const info = await redis.info('server');
      const versionMatch = info.match(/redis_version:([^\r\n]+)/);
      serverVersion = versionMatch ? versionMatch[1] : 'unknown';
    } catch (infoError) {
      // 忽略获取版本信息的错误，继续返回成功
      console.warn('无法获取 Redis 版本信息');
    }

    await redis.quit();

    return {
      success: true,
      message: '连接测试成功',
      data: {
        connectionInfo,
        serverVersion,
      },
    };
  } catch (error: any) {
    // 确保连接被关闭
    if (redis) {
      try {
        await redis.quit();
      } catch (e) {
        // 忽略关闭错误
      }
    }

    const errorMessage = error?.message || '未知错误';
    
    // 根据错误类型提供更详细的错误信息
    if (errorMessage.includes('ClusterAllFailedError') || errorMessage.includes('Failed to refresh slots cache')) {
      return {
        success: false,
        message: `集群连接失败：无法连接到任何集群节点，请检查：\n1. 节点地址和端口是否正确\n2. Redis 集群是否正在运行\n3. 网络连接是否正常`,
      };
    } else if (errorMessage.includes('ECONNREFUSED')) {
      return {
        success: false,
        message: `连接被拒绝：无法连接到 Redis 服务器，请检查 Redis 是否正在运行`,
      };
    } else if (errorMessage.includes('ETIMEDOUT')) {
      return {
        success: false,
        message: `连接超时：无法在指定时间内连接到 Redis 服务器`,
      };
    } else if (errorMessage.includes('ENOTFOUND')) {
      return {
        success: false,
        message: `主机名解析失败：无法找到指定的主机地址`,
      };
    } else if (errorMessage.includes('NOAUTH') || errorMessage.includes('invalid password')) {
      return {
        success: false,
        message: `认证失败：密码错误或未提供密码`,
      };
    }
    
    return {
      success: false,
      message: `无法连接到 Redis 服务器：${errorMessage}`,
    };
  }
}

