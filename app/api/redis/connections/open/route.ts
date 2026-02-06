import { NextRequest, NextResponse } from 'next/server';
import { getAllRedisConnections } from '@/lib/db';
import Redis from 'ioredis';
import { setCachedConnection, removeCachedConnection } from '@/lib/redisCache';

// 打开 Redis 连接
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json(
        {
          code: 400,
          message: '缺少连接 ID',
          data: null,
        },
        { status: 400 }
      );
    }

    // 从数据库获取连接配置
    const connections = getAllRedisConnections();
    const connection = connections.find((conn: any) => conn.id === id);

    if (!connection) {
      return NextResponse.json(
        {
          code: 404,
          message: '连接不存在',
          data: null,
        },
        { status: 404 }
      );
    }

    const config = connection.config;
    let redis: any = null;
    let mode = config.mode || 'standalone';

    // 准备 Redis 连接选项
    const redisOptions: any = {
      connectTimeout: (config.connectionTimeout || 60) * 1000,
      commandTimeout: (config.executionTimeout || 60) * 1000,
      retryStrategy: (times: number) => {
        if (times > 3) return null;
        return Math.min(times * 100, 2000);
      },
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

    // 根据模式创建连接
    if (mode === 'standalone') {
      // 创建单机连接
      redis = new Redis({
        host: config.host,
        port: config.port,
        ...redisOptions,
      });

      // 添加错误监听器
      redis.on('error', (err: Error) => {
        console.error(`Redis 单机连接错误 (${id}):`, err.message);
      });

      // 测试连接并检测是否是集群模式
      try {
        await redis.ping();
        
        // 检查是否是集群模式
        const info = await redis.info('cluster');
        const clusterEnabled = info.includes('cluster_enabled:1');
        
        if (clusterEnabled) {
          // 如果是集群模式，需要重新建立集群连接
          console.log(`检测到集群模式，切换到集群连接 (${id})`);
          await redis.quit();
          
          // 获取集群节点
          const clusterNodes = await getClusterNodes(config.host, config.port, redisOptions);
          
          // 创建集群连接
          redis = new (Redis as any).Cluster(clusterNodes, {
            redisOptions: {
              ...redisOptions,
            },
            clusterRetryStrategy: (times: number) => {
              if (times > 3) return null;
              return Math.min(times * 100, 2000);
            },
            enableReadyCheck: true,
            maxRedirections: 3,
            retryDelayOnFailover: 100,
            retryDelayOnClusterDown: 300,
            slotsRefreshTimeout: 1000,
          });

          redis.on('error', (err: Error) => {
            console.error(`Redis 集群连接错误 (${id}):`, err.message);
          });

          mode = 'cluster';
        }
      } catch (error) {
        await redis.quit();
        throw error;
      }
    } else if (mode === 'cluster') {
      // 创建集群连接
      if (!config.clusterNodes || config.clusterNodes.length === 0) {
        return NextResponse.json(
          {
            code: 400,
            message: '集群模式需要提供至少一个节点',
            data: null,
          },
          { status: 400 }
        );
      }

      redis = new (Redis as any).Cluster(config.clusterNodes, {
        redisOptions: {
          ...redisOptions,
        },
        clusterRetryStrategy: (times: number) => {
          if (times > 3) return null;
          return Math.min(times * 100, 2000);
        },
        enableReadyCheck: true,
        maxRedirections: 3,
        retryDelayOnFailover: 100,
        retryDelayOnClusterDown: 300,
        slotsRefreshTimeout: 1000,
      });

      redis.on('error', (err: Error) => {
        console.error(`Redis 集群连接错误 (${id}):`, err.message);
      });
    }

    // 测试连接
    await redis.ping();

    // 获取数据库数量和每个数据库的 key 数量
    let databases: Array<{ dbIndex: number; keyCount: number; isApproximate?: boolean }> = [];

    if (mode === 'standalone') {
      // 单机模式：获取配置的数据库数量
      try {
        const configResult = await redis.config('GET', 'databases');
        const dbCount = configResult && configResult.length >= 2 ? parseInt(configResult[1], 10) : 16;

        for (let i = 0; i < dbCount; i++) {
          await redis.select(i);
          const keyCount = await redis.dbsize();
          databases.push({
            dbIndex: i,
            keyCount,
            isApproximate: false,
          });
        }
      } catch (error) {
        console.error('获取数据库信息失败:', error);
        // 如果获取失败，默认返回 16 个数据库
        for (let i = 0; i < 16; i++) {
          databases.push({
            dbIndex: i,
            keyCount: 0,
            isApproximate: false,
          });
        }
      }
    } else {
      // 集群模式：需要汇总所有节点的 key 数量
      try {
        // 获取所有主节点
        const clusterNodes = await redis.cluster('NODES') as string;
        const lines = clusterNodes.split('\n');
        let totalKeyCount = 0;
        
        // 遍历所有主节点（master）
        for (const line of lines) {
          if (!line.trim() || !line.includes('master')) continue;
          
          const parts = line.split(' ');
          if (parts.length < 2) continue;
          
          const address = parts[1].split('@')[0];
          const [nodeHost, nodePortStr] = address.split(':');
          
          if (!nodeHost || !nodePortStr) continue;
          
          try {
            // 连接到每个主节点获取 DBSIZE
            const nodeRedis = new Redis({
              host: nodeHost,
              port: parseInt(nodePortStr, 10),
              ...redisOptions,
            });
            
            const nodeKeyCount = await nodeRedis.dbsize();
            totalKeyCount += nodeKeyCount;
            
            await nodeRedis.quit();
          } catch (nodeError) {
            console.error(`获取节点 ${nodeHost}:${nodePortStr} 的 DBSIZE 失败:`, nodeError);
          }
        }
        
        databases.push({
          dbIndex: 0,
          keyCount: totalKeyCount,
          isApproximate: false, // 已汇总所有节点，是准确值
        });
      } catch (error) {
        console.error('获取集群 key 数量失败，使用近似值:', error);
        // 如果汇总失败，使用当前连接的 DBSIZE（不准确，但总比没有好）
        const keyCount = await redis.dbsize();
        databases.push({
          dbIndex: 0,
          keyCount,
          isApproximate: true, // 标记为近似值
        });
      }
    }

    // 缓存连接
    setCachedConnection(id, redis, mode);

    return NextResponse.json({
      code: 200,
      message: '连接成功',
      data: {
        id,
        name: connection.name,
        mode,
        databases,
        connectionInfo: mode === 'standalone' 
          ? `${config.host}:${config.port}` 
          : config.clusterNodes?.map((n: any) => `${n.host}:${n.port}`).join(', '),
      },
    });
  } catch (error: any) {
    console.error('打开 Redis 连接失败:', error);
    return NextResponse.json(
      {
        code: 500,
        message: `打开连接失败：${error?.message || '未知错误'}`,
        data: null,
      },
      { status: 500 }
    );
  }
}

// 辅助函数：获取集群节点
async function getClusterNodes(
  host: string, 
  port: number, 
  options: any
): Promise<Array<{ host: string; port: number }>> {
  const tempRedis = new Redis({
    host,
    port,
    ...options,
  });

  try {
    const clusterInfo = await tempRedis.cluster('NODES') as string;
    const lines = clusterInfo.split('\n');
    const nodes: Array<{ host: string; port: number }> = [];

    for (const line of lines) {
      if (!line.trim()) continue;
      
      const parts = line.split(' ');
      if (parts.length < 2) continue;

      const address = parts[1].split('@')[0]; // 格式: ip:port@cport
      const [nodeHost, nodePort] = address.split(':');
      
      if (nodeHost && nodePort) {
        nodes.push({
          host: nodeHost,
          port: parseInt(nodePort, 10),
        });
      }
    }

    await tempRedis.quit();
    return nodes.length > 0 ? nodes : [{ host, port }];
  } catch (error) {
    await tempRedis.quit();
    return [{ host, port }];
  }
}

// 关闭连接
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json(
        {
          code: 400,
          message: '缺少连接 ID',
          data: null,
        },
        { status: 400 }
      );
    }

    await removeCachedConnection(id);

    return NextResponse.json({
      code: 200,
      message: '连接已关闭',
      data: null,
    });
  } catch (error: any) {
    console.error('关闭 Redis 连接失败:', error);
    return NextResponse.json(
      {
        code: 500,
        message: `关闭连接失败：${error?.message || '未知错误'}`,
        data: null,
      },
      { status: 500 }
    );
  }
}
