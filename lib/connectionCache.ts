// 全局连接数据缓存
// 用于在页面和SessionManager组件之间共享连接数据

interface ConnectionCache {
  sshConnections: any[];
  redisConnections: any[];
  kafkaConnections: any[];
  zookeeperConnections: any[];
  elasticConnections: any[];
  databaseConnections: any[];
  httpConnections: any[];
  lastUpdated: number;
}

class ConnectionDataManager {
  private cache: ConnectionCache = {
    sshConnections: [],
    redisConnections: [],
    kafkaConnections: [],
    zookeeperConnections: [],
    elasticConnections: [],
    databaseConnections: [],
    httpConnections: [],
    lastUpdated: 0,
  };

  // 设置SSH连接数据
  setSSHConnections(connections: any[]) {
    this.cache.sshConnections = connections;
    this.cache.lastUpdated = Date.now();
  }

  // 设置Redis连接数据
  setRedisConnections(connections: any[]) {
    this.cache.redisConnections = connections;
    this.cache.lastUpdated = Date.now();
  }

  // 设置Kafka连接数据
  setKafkaConnections(connections: any[]) {
    this.cache.kafkaConnections = connections;
    this.cache.lastUpdated = Date.now();
  }

  // 设置ZooKeeper连接数据
  setZooKeeperConnections(connections: any[]) {
    this.cache.zookeeperConnections = connections;
    this.cache.lastUpdated = Date.now();
  }

  setElasticConnections(connections: any[]) {
    this.cache.elasticConnections = connections;
    this.cache.lastUpdated = Date.now();
  }

  setDatabaseConnections(connections: any[]) {
    this.cache.databaseConnections = connections;
    this.cache.lastUpdated = Date.now();
  }

  setHttpConnections(connections: any[]) {
    this.cache.httpConnections = connections;
    this.cache.lastUpdated = Date.now();
  }

  // 获取SSH连接数据
  getSSHConnections(): any[] {
    return this.cache.sshConnections;
  }

  // 获取Redis连接数据
  getRedisConnections(): any[] {
    return this.cache.redisConnections;
  }

  // 获取Kafka连接数据
  getKafkaConnections(): any[] {
    return this.cache.kafkaConnections;
  }

  // 获取ZooKeeper连接数据
  getZooKeeperConnections(): any[] {
    return this.cache.zookeeperConnections;
  }

  getElasticConnections(): any[] {
    return this.cache.elasticConnections;
  }

  getDatabaseConnections(): any[] {
    return this.cache.databaseConnections;
  }

  getHttpConnections(): any[] {
    return this.cache.httpConnections;
  }

  // 获取最后更新时间
  getLastUpdated(): number {
    return this.cache.lastUpdated;
  }

  // 清除缓存
  clear() {
    this.cache = {
      sshConnections: [],
      redisConnections: [],
      kafkaConnections: [],
      zookeeperConnections: [],
      elasticConnections: [],
      databaseConnections: [],
      httpConnections: [],
      lastUpdated: 0,
    };
  }
}

export const connectionDataManager = new ConnectionDataManager();
