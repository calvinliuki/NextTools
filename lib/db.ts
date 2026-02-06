import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// 数据库文件路径（延迟初始化，避免编译时加载 Electron）
let dbPath: string | null = null;

function getDbPath(): string {
  if (dbPath) {
    return dbPath;
  }

  // 在运行时动态判断 Electron 环境
  const isElectron = typeof process !== 'undefined' && process.versions && process.versions.electron;
  const skipElectronLoad = process.env.SKIP_ELECTRON_LOAD === 'true';

  if (isElectron && !skipElectronLoad) {
    try {
      // 动态加载 Electron（仅在运行时执行）
      const electronApp = require('electron').app;
      if (electronApp && typeof electronApp.getPath === 'function') {
        const userDataPath = electronApp.getPath('userData');
        dbPath = path.join(userDataPath, 'connections.db');
        console.log('[DB] Using Electron userData path:', dbPath);
      } else {
        throw new Error('Electron app.getPath not available');
      }
    } catch (error) {
      console.warn('[DB] Failed to use Electron path, falling back to dev path:', error);
      dbPath = path.join(process.cwd(), 'data', 'connections.db');
    }
  } else {
    // 开发环境或构建时
    dbPath = path.join(process.cwd(), 'data', 'connections.db');
  }

  // 确保数据库目录存在
  const dataDir = path.dirname(dbPath);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  return dbPath;
}

// 创建数据库连接
let db: Database.Database | null = null;

export function getDatabase(): Database.Database {
  if (!db) {
    db = new Database(getDbPath());
    initializeDatabase(db);
  }
  return db;
}

// 初始化数据库表
function initializeDatabase(database: Database.Database) {
  // 创建连接表
  database.exec(`
    CREATE TABLE IF NOT EXISTS connections (
      id TEXT PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      config TEXT NOT NULL,
      is_favorite INTEGER DEFAULT 0,
      environment TEXT DEFAULT '开发',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  
  // 创建索引
  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_connections_name ON connections(name)
  `);

  // 检查并添加缺失的列
  try {
    const tableInfo = database.prepare("PRAGMA table_info(connections)").all() as any[];
    const hasFavorite = tableInfo.some(col => col.name === 'is_favorite');
    const hasEnvironment = tableInfo.some(col => col.name === 'environment');
    
    if (!hasFavorite) {
      database.exec("ALTER TABLE connections ADD COLUMN is_favorite INTEGER DEFAULT 0");
    }
    if (!hasEnvironment) {
      database.exec("ALTER TABLE connections ADD COLUMN environment TEXT DEFAULT '开发'");
    }
  } catch (err) {
    console.warn('检查或添加 connections 表列时出错:', err);
  }

  // 创建 HTTP 集合表
  database.exec(`
    CREATE TABLE IF NOT EXISTS http_collections (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      request_ids TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);
}

// 生成唯一 ID（格式：redis_xxx）
export function generateConnectionId(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 9);
  return `redis_${timestamp}_${random}`;
}

// 检查连接名是否已存在（排除指定ID的连接）
export function connectionNameExists(name: string, excludeId?: string): boolean {
  const database = getDatabase();
  let stmt;
  if (excludeId) {
    stmt = database.prepare('SELECT COUNT(*) as count FROM connections WHERE name = ? AND id != ?');
    return (stmt.get(name, excludeId) as { count: number }).count > 0;
  } else {
    stmt = database.prepare('SELECT COUNT(*) as count FROM connections WHERE name = ?');
    return (stmt.get(name) as { count: number }).count > 0;
  }
}

// 检查指定类型的连接名是否已存在（排除指定ID的连接）
export function connectionNameExistsByType(type: 'redis' | 'kafka' | 'ssh' | 'zookeeper' | 'elastic' | 'database', name: string, excludeId?: string): boolean {
  const database = getDatabase();
  let stmt;
  if (excludeId) {
    stmt = database.prepare('SELECT COUNT(*) as count FROM connections WHERE name = ? AND id != ? AND id LIKE ?');
    return (stmt.get(name, excludeId, `${type}_%`) as { count: number }).count > 0;
  } else {
    stmt = database.prepare('SELECT COUNT(*) as count FROM connections WHERE name = ? AND id LIKE ?');
    return (stmt.get(name, `${type}_%`) as { count: number }).count > 0;
  }
}

// 保存连接配置
export function saveConnection(id: string, name: string, config: any): void {
  const database = getDatabase();
  const stmt = database.prepare('INSERT OR REPLACE INTO connections (id, name, config) VALUES (?, ?, ?)');
  stmt.run(id, name, JSON.stringify(config));
}

// 获取所有连接
export function getAllConnections(): Array<{ id: string; name: string; config: any; is_favorite: number; environment: string; created_at: string }> {
  const database = getDatabase();
  const stmt = database.prepare('SELECT * FROM connections ORDER BY created_at DESC');
  const rows = stmt.all() as Array<{ id: string; name: string; config: string; is_favorite: number; environment: string; created_at: string }>;
  return rows.map(row => ({
    ...row,
    config: JSON.parse(row.config)
  }));
}

// 获取单个连接
export function getConnectionById(id: string): any | null {
  const database = getDatabase();
  const stmt = database.prepare('SELECT * FROM connections WHERE id = ?');
  const row = stmt.get(id) as { id: string; name: string; config: string; created_at: string } | undefined;
  if (!row) return null;
  return JSON.parse(row.config);
}

// 获取所有 Redis 连接（只获取 id 以 redis_ 开头的）
export function getAllRedisConnections(): Array<{ id: string; name: string; config: any; is_favorite: number; environment: string; created_at: string }> {
  const database = getDatabase();
  const stmt = database.prepare('SELECT * FROM connections WHERE id LIKE ? ORDER BY created_at DESC');
  const rows = stmt.all('redis_%') as Array<{ id: string; name: string; config: string; is_favorite: number; environment: string; created_at: string }>;
  return rows.map(row => ({
    ...row,
    config: JSON.parse(row.config)
  }));
}

// 删除连接
export function deleteConnection(id: string): void {
  const database = getDatabase();
  const stmt = database.prepare('DELETE FROM connections WHERE id = ?');
  stmt.run(id);
}

// 切换收藏状态
export function toggleConnectionFavorite(id: string, isFavorite: boolean): void {
  const database = getDatabase();
  const stmt = database.prepare('UPDATE connections SET is_favorite = ? WHERE id = ?');
  stmt.run(isFavorite ? 1 : 0, id);
}

// 更新环境标记
export function updateConnectionEnvironment(id: string, environment: string): void {
  const database = getDatabase();
  const stmt = database.prepare('UPDATE connections SET environment = ? WHERE id = ?');
  stmt.run(environment, id);
}

// 获取所有 SSH 连接（只获取 id 以 ssh_ 开头的）
export function getAllSSHConnections(): Array<{ id: string; name: string; config: any; is_favorite: number; environment: string; created_at: string }> {
  const database = getDatabase();
  const stmt = database.prepare('SELECT * FROM connections WHERE id LIKE ? ORDER BY created_at DESC');
  const rows = stmt.all('ssh_%') as Array<{ id: string; name: string; config: string; is_favorite: number; environment: string; created_at: string }>;
  return rows.map(row => ({
    ...row,
    config: JSON.parse(row.config)
  }));
}

// 获取所有 Kafka 连接（只获取 id 以 kafka_ 开头的）
export function getAllKafkaConnections(): Array<{ id: string; name: string; config: any; is_favorite: number; environment: string; created_at: string }> {
  const database = getDatabase();
  const stmt = database.prepare('SELECT * FROM connections WHERE id LIKE ? ORDER BY created_at DESC');
  const rows = stmt.all('kafka_%') as Array<{ id: string; name: string; config: string; is_favorite: number; environment: string; created_at: string }>;
  return rows.map(row => ({
    ...row,
    config: JSON.parse(row.config)
  }));
}

// 获取所有 ZooKeeper 连接（只获取 id 以 zookeeper_ 开头的）
export function getAllZooKeeperConnections(): Array<{ id: string; name: string; config: any; is_favorite: number; environment: string; created_at: string }> {
  const database = getDatabase();
  const stmt = database.prepare('SELECT * FROM connections WHERE id LIKE ? ORDER BY created_at DESC');
  const rows = stmt.all('zookeeper_%') as Array<{ id: string; name: string; config: string; is_favorite: number; environment: string; created_at: string }>;
  return rows.map(row => ({
    ...row,
    config: JSON.parse(row.config)
  }));
}

// 获取所有 Elastic 连接（只获取 id 以 elastic_ 开头的）
export function getAllElasticConnections(): Array<{ id: string; name: string; config: any; is_favorite: number; environment: string; created_at: string }> {
  const database = getDatabase();
  const stmt = database.prepare('SELECT * FROM connections WHERE id LIKE ? ORDER BY created_at DESC');
  const rows = stmt.all('elastic_%') as Array<{ id: string; name: string; config: string; is_favorite: number; environment: string; created_at: string }>;
  return rows.map(row => ({
    ...row,
    config: JSON.parse(row.config)
  }));
}

// 获取所有 Database 连接（只获取 id 以 database_ 开头的）
export function getAllDatabaseConnections(): Array<{ id: string; name: string; config: any; is_favorite: number; environment: string; created_at: string }> {
  const database = getDatabase();
  const stmt = database.prepare('SELECT * FROM connections WHERE id LIKE ? ORDER BY created_at DESC');
  const rows = stmt.all('database_%') as Array<{ id: string; name: string; config: string; is_favorite: number; environment: string; created_at: string }>;
  return rows.map(row => ({
    ...row,
    config: JSON.parse(row.config)
  }));
}

// 获取所有 HTTP 连接（只获取 id 以 http_ 开头的，或者 config 中 clientType 为 HTTP 的）
export function getAllHTTPConnections(): Array<{ id: string; name: string; config: any; is_favorite: number; environment: string; created_at: string }> {
  const database = getDatabase();
  const stmt = database.prepare('SELECT * FROM connections WHERE id LIKE ? OR config LIKE ? ORDER BY created_at DESC');
  const rows = stmt.all('http_%', '%"clientType":"HTTP"%') as Array<{ id: string; name: string; config: string; is_favorite: number; environment: string; created_at: string }>;
  return rows.map(row => ({
    ...row,
    config: JSON.parse(row.config)
  }));
}

// 删除 Redis 连接
export function deleteRedisConnection(id: string): void {
  deleteConnection(id);
}

// 删除 SSH 连接
export function deleteSSHConnection(id: string): void {
  deleteConnection(id);
}

// 删除 Kafka 连接
export function deleteKafkaConnection(id: string): void {
  deleteConnection(id);
}

// 删除 Database 连接
export function deleteDatabaseConnection(id: string): void {
  deleteConnection(id);
}

// --- HTTP/Postman 相关操作 ---

// 获取所有 HTTP 集合
export function getAllHTTPCollections(): any[] {
  const database = getDatabase();
  const stmt = database.prepare('SELECT * FROM http_collections ORDER BY updated_at DESC');
  const rows = stmt.all() as any[];
  return rows.map(row => ({
    id: row.id,
    name: row.name,
    requestIds: JSON.parse(row.request_ids),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }));
}

// 保存所有 HTTP 集合
export function saveHTTPCollections(collections: any[]): void {
  const database = getDatabase();
  const transaction = database.transaction((cols) => {
    const currentIds = (database.prepare('SELECT id FROM http_collections').all() as any[]).map(r => r.id);
    const newIds = cols.map((c: any) => c.id);
    
    const insertStmt = database.prepare('INSERT OR REPLACE INTO http_collections (id, name, request_ids, created_at, updated_at) VALUES (?, ?, ?, ?, ?)');
    for (const col of cols) {
      const createdAt = col.createdAt || Date.now();
      const updatedAt = col.updatedAt || Date.now();
      insertStmt.run(col.id, col.name, JSON.stringify(col.requestIds || []), createdAt, updatedAt);
    }
    
    const deleteStmt = database.prepare('DELETE FROM http_collections WHERE id = ?');
    for (const id of currentIds) {
      if (!newIds.includes(id)) {
        deleteStmt.run(id);
      }
    }
  });
  transaction(collections);
}

// 获取所有 Postman 历史记录
export function getAllPostmanHistory(): any[] {
  const database = getDatabase();
  const stmt = database.prepare('SELECT * FROM postman_history ORDER BY timestamp DESC LIMIT 100');
  const rows = stmt.all() as any[];
  return rows.map(row => ({
    ...row,
    request: JSON.parse(row.request),
    response: row.response ? JSON.parse(row.response) : null
  }));
}

// 保存 Postman 历史记录
export function savePostmanHistoryEntry(entry: any): void {
  // 限制响应体大小，避免数据库存储过大
  let processedEntry = { ...entry };
  if (processedEntry.response && processedEntry.response.body) {
    if (typeof processedEntry.response.body === 'string' && processedEntry.response.body.length > 10240) { // 10KB 限制
      processedEntry = {
        ...processedEntry,
        response: {
          ...processedEntry.response,
          body: processedEntry.response.body.substring(0, 10240) + '... [TRUNCATED]',
        }
      };
    }
  }
  
  const database = getDatabase();
  const stmt = database.prepare('INSERT INTO postman_history (id, request, response, error, timestamp) VALUES (?, ?, ?, ?, ?)');
  stmt.run(
    processedEntry.id, 
    JSON.stringify(processedEntry.request), 
    processedEntry.response ? JSON.stringify(processedEntry.response) : null, 
    processedEntry.error, 
    processedEntry.timestamp
  );
  
  // 保持历史记录在 100 条以内
  database.prepare('DELETE FROM postman_history WHERE id NOT IN (SELECT id FROM postman_history ORDER BY timestamp DESC LIMIT 100)').run();
}
