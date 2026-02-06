import { NextResponse } from 'next/server';
import { getAllRedisConnections, getAllKafkaConnections, getAllZooKeeperConnections, getAllElasticConnections, getAllDatabaseConnections, getAllHTTPConnections, getAllSSHConnections } from '@/lib/db';
import { SSHConnectionStore } from '@/lib/sshConnections';
import { getDatabaseStructure } from '@/lib/databaseCache';

export async function GET() {
  try {
    // 1. 获取 Redis 连接并格式化
    const redisConnections = getAllRedisConnections();
    const formattedRedis = redisConnections.map(conn => ({
      id: conn.id,
      name: conn.name,
      is_favorite: conn.is_favorite,
      environment: conn.environment,
      mode: conn.config.mode || 'standalone',
      host: conn.config.host,
      port: conn.config.port,
      password: conn.config.password || '',
      username: conn.config.username || '',
      securityMode: conn.config.securityMode || 'none',
      defaultFilter: conn.config.defaultFilter || '*',
      namespaceSeparator: conn.config.namespaceSeparator || ':',
      connectionTimeout: conn.config.connectionTimeout || 60,
      executionTimeout: conn.config.executionTimeout || 60,
      dbScanLimit: conn.config.dbScanLimit || 20,
      clusterRedirect: conn.config.clusterRedirect || false,
      clusterNodes: conn.config.clusterNodes,
      savedAt: conn.created_at,
      clientType: 'Redis'
    }));

    // 2. 获取 SSH 连接并格式化
    const sshConnections = getAllSSHConnections();
    const formattedSSH = sshConnections.map(conn => ({
      id: conn.id,
      name: conn.name,
      is_favorite: conn.is_favorite,
      environment: conn.environment,
      ...conn.config,
      downloadDir: conn.config.downloadDir || '',
      clientType: 'SSH'
    }));

    // 3. 获取 Kafka 连接并格式化
    const kafkaConnections = getAllKafkaConnections();
    const formattedKafka = kafkaConnections.map(conn => ({
      id: conn.id,
      name: conn.name,
      is_favorite: conn.is_favorite,
      environment: conn.environment,
      ...conn.config,
      savedAt: conn.created_at,
      clientType: 'Kafka'
    }));

    // 4. 获取 ZooKeeper 连接并格式化
    const zookeeperConnections = getAllZooKeeperConnections();
    const formattedZooKeeper = zookeeperConnections.map(conn => ({
      id: conn.id,
      name: conn.name,
      is_favorite: conn.is_favorite,
      environment: conn.environment,
      ...conn.config,
      savedAt: conn.created_at,
      clientType: 'ZooKeeper'
    }));

    // 5. 获取 Elastic 连接并格式化
    const elasticConnections = getAllElasticConnections();
    const formattedElastic = elasticConnections.map(conn => ({
      id: conn.id,
      name: conn.name,
      is_favorite: conn.is_favorite,
      environment: conn.environment,
      ...conn.config,
      savedAt: conn.created_at,
      clientType: 'Elastic'
    }));

    // 6. 获取 Database 连接并格式化
    const databaseConnections = getAllDatabaseConnections();
    const formattedDatabase = databaseConnections.map((conn) => {
      return {
        id: conn.id,
        name: conn.name,
        is_favorite: conn.is_favorite,
        environment: conn.environment,
        ...conn.config,
        savedAt: conn.created_at,
        clientType: 'Database',
        // 注意：这里不获取数据库结构，以避免在获取连接列表时尝试建立数据库连接
      };
    });

    // 7. 获取 HTTP 连接并格式化
    const httpConnections = getAllHTTPConnections();
    const formattedHTTP = httpConnections.map((conn) => ({
      id: conn.id,
      name: conn.name,
      is_favorite: conn.is_favorite,
      environment: conn.environment,
      ...conn.config,
      savedAt: conn.created_at,
      clientType: 'HTTP'
    }));

    return NextResponse.json({
      code: 200,
      message: '获取所有连接列表成功',
      data: {
        redis: formattedRedis,
        ssh: formattedSSH,
        kafka: formattedKafka,
        zookeeper: formattedZooKeeper,
        elastic: formattedElastic,
        database: formattedDatabase,
        http: formattedHTTP,
        all: [
          ...formattedRedis, 
          ...formattedSSH, 
          ...formattedKafka, 
          ...formattedZooKeeper, 
          ...formattedElastic, 
          ...formattedDatabase,
          ...formattedHTTP
        ]
      }
    });
  } catch (error: any) {
    console.error('获取所有连接列表错误:', error);
    return NextResponse.json(
      { code: 50000, message: `服务器内部错误：${error?.message || '未知错误'}`, data: null },
      { status: 500 }
    );
  }
}