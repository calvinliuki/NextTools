import { getConnectionById } from './db';
import * as mysql from 'mysql2/promise';
import pg from 'pg';
import Database from 'better-sqlite3';

// 配置 PostgreSQL 类型解析器，将日期/时间类型作为字符串返回
// 防止自动转换为 JavaScript Date 对象导致的时区序列化问题
// 使用 require 获取 types 避免 TS 类型检查问题
const pgTypes = require('pg').types;
pgTypes.setTypeParser(1114, (val: any) => val); // TIMESTAMP
pgTypes.setTypeParser(1184, (val: any) => val); // TIMESTAMPTZ
pgTypes.setTypeParser(1082, (val: any) => val); // DATE

// 数据库连接缓存，用于在不同 API 路由间共享连接
export const databaseConnectionCache: Map<string, any> = new Map();

// 获取缓存的连接
export function getCachedDatabaseConnection(id: string, tabId?: string, dbName?: string): any | undefined {
  let cacheKey = tabId ? `${id}:${tabId}` : id;
  // 如果是 PG 且指定了库名，则使用更细粒度的 Key
  if (dbName) {
    const baseCached = databaseConnectionCache.get(cacheKey);
    if (baseCached && baseCached.type === 'postgresql') {
      cacheKey = `${cacheKey}:${dbName}`;
    } else if (baseCached === undefined && dbName) {
      // 如果基础缓存不存在，但请求的是PG且指定了库名，直接使用包含数据库名的键
      cacheKey = tabId ? `${id}:${tabId}:${dbName}` : `${id}:${dbName}`;
    }
  }
  return databaseConnectionCache.get(cacheKey);
}

// 设置缓存的连接
export function setCachedDatabaseConnection(id: string, connection: any, tabId?: string, dbName?: string) {
  let cacheKey = tabId ? `${id}:${tabId}` : id;
  if (connection.type === 'postgresql' && dbName) {
    cacheKey = `${cacheKey}:${dbName}`;
  }
  databaseConnectionCache.set(cacheKey, connection);
}

// 删除缓存的连接
export async function removeCachedDatabaseConnection(id: string, tabId?: string) {
  const baseKey = tabId ? `${id}:${tabId}` : id;
  
  // 清理基础 Key 和所有带库名后缀的 Key (PG)
  for (const key of Array.from(databaseConnectionCache.keys())) {
    if (key === baseKey || key.startsWith(`${baseKey}:`)) {
      const cached = databaseConnectionCache.get(key);
      if (cached) {
        console.log(`正在关闭物理连接并清理缓存: ${key}`);
        try {
          if (cached.client) {
            if (cached.type === 'mysql' && typeof cached.client.end === 'function') {
              await cached.client.end();
            } else if (cached.type === 'postgresql' && typeof cached.client.end === 'function') {
              await cached.client.end();
            } else if (cached.type === 'sqlite' && typeof cached.client.close === 'function') {
              cached.client.close();
            }
          }
        } catch (error) {
          console.error(`关闭连接 ${key} 失败:`, error);
        }
        databaseConnectionCache.delete(key);
      }
    }
  }
}

// 根据数据库类型创建连接
export async function createDatabaseConnection(connectionId: string, overrideDbName?: string): Promise<any | null> {
  try {
    // 从数据库获取连接配置
    const config = getConnectionById(connectionId);
    
    if (!config) {
      console.error(`数据库连接配置未找到: ${connectionId}`);
      return null;
    }

    let client: any;
    const { databaseType, host, port, username, password, databaseName, filePath, additionalParams, connectionTimeout } = config;

    // 优先使用传入的库名覆盖
    const targetDbName = overrideDbName || databaseName;

    if (databaseType === 'mysql') {
      // MySQL 连接
      const mysqlConfig: any = {
        host: host || 'localhost',
        port: port || 3306,
        user: username || 'root',
        password: password || '',
        database: targetDbName || undefined,
        connectTimeout: (connectionTimeout || 30) * 1000, // 转换为毫秒
        dateStrings: true, // 强制将日期/时间类型作为字符串返回
        multipleStatements: true, // 开启多语句支持，允许执行 use db; select...
      };

      // 添加额外参数
      if (additionalParams) {
        try {
          const params = JSON.parse(additionalParams);
          Object.assign(mysqlConfig, params);
        } catch (e) {
          console.warn('无法解析额外参数:', additionalParams);
        }
      }

      client = await mysql.createConnection(mysqlConfig);

      // 创建 executeQuery 方法
      const executeQuery = async (sql: string) => {
        try {
          // 切换为使用 .query() 以支持 USE 等非预处理指令和多语句
          const [result, fields]: [any, any] = await client.query(sql);
          
          // 执行完后获取当前数据库上下文 (Navicat 风格同步)
          let currentDb = undefined;
          try {
            const [dbResult]: any = await client.query('SELECT DATABASE() as db');
            currentDb = dbResult[0]?.db;
          } catch (e) {
            console.warn('获取当前数据库失败:', e);
          }
          
          // 判断是否返回了多个结果集 (多个语句执行)
          // 逻辑：如果 fields 是数组，且 (第一个元素是数组 或 长度>1 且第一个元素为 undefined)
          const isMultiResult = Array.isArray(fields) && (
            (fields.length > 0 && Array.isArray(fields[0])) || 
            (fields.length > 1 && fields[0] === undefined)
          );
          
          let actualRows = result;
          let actualFields = fields;

          if (isMultiResult) {
            // 如果是多结果集，寻找最后一个有效的 rows 和 fields
            actualRows = result[result.length - 1];
            actualFields = fields[fields.length - 1];
          }

          let columns: string[] = [];
          if (Array.isArray(actualFields)) {
            columns = actualFields.map((f: any) => f?.name).filter(Boolean);
          }
          
          // 兜底逻辑：如果驱动没返回 fields 但有数据，尝试从数据中提取列名
          if (columns.length === 0 && Array.isArray(actualRows) && actualRows.length > 0) {
            columns = Object.keys(actualRows[0]);
          }

          return { 
            rows: actualRows, 
            columns,
            currentDb
          };
        } catch (error) {
          console.error(`MySQL 查询执行失败: ${sql}`, error);
          throw error;
        }
      };

      return {
        client,
        type: databaseType,
        config: config,
        executeQuery
      };
    } else if (databaseType === 'postgresql') {
      // PostgreSQL 连接
      const pgConfig: any = {
        host: host || 'localhost',
        port: port || 5432,
        user: username || 'postgres',
        password: password || '',
        database: targetDbName || 'postgres',
        query_timeout: (connectionTimeout || 30) * 1000, // 转换为毫秒
        application_name: 'next-tools',
      };

      // 添加额外参数
      if (additionalParams) {
        try {
          const params = JSON.parse(additionalParams);
          Object.assign(pgConfig, params);
        } catch (e) {
          console.warn('无法解析额外参数:', additionalParams);
        }
      }

      // 如果有 timezone 参数，将其注入到启动选项中
      // 这是 PostgreSQL 最稳健的时区设置方式，在建立物理连接时直接生效
      if (pgConfig.timezone) {
        if (!pgConfig.options) {
          pgConfig.options = '';
        }
        // 追加时区配置到 options
        const tzOption = `-c timezone=${pgConfig.timezone}`;
        pgConfig.options = pgConfig.options ? `${pgConfig.options} ${tzOption}` : tzOption;
      }

      const { Client } = require('pg');
      client = new Client(pgConfig);
      await client.connect();

      // 为了确保万无一失，连接后再执行一次 SQL 设置（针对不支持启动参数的环境）
      if (pgConfig.timezone) {
        try {
          const tzValue = pgConfig.timezone;
          if (tzValue.startsWith('+') || tzValue.startsWith('-')) {
            await client.query(`SET TIME ZONE INTERVAL '${tzValue}' HOUR TO MINUTE`);
          } else {
            await client.query(`SET TIME ZONE '${tzValue}'`);
          }
          const tzCheck = await client.query('SHOW TIME ZONE');
          console.log(`PostgreSQL 会话时区二次确认: ${tzCheck.rows[0].TimeZone}`);
        } catch (tzError: any) {
          console.warn('PostgreSQL 物理连接后 SET TIME ZONE 失败:', tzError.message);
        }
      }

      // 创建 executeQuery 方法
      const executeQuery = async (sql: string) => {
        try {
          const result = await client.query(sql);
          
          // 获取当前数据库上下文
          let currentDb = undefined;
          try {
            const dbCheck = await client.query('SELECT current_database() as db');
            currentDb = dbCheck.rows[0]?.db;
          } catch (e) {
            // 忽略错误
          }

          // 处理多条语句返回的结果（数组）
          const actualResult = Array.isArray(result) ? result[result.length - 1] : result;
          
          const rows = actualResult.rows || [];
          let columns = actualResult.fields ? actualResult.fields.map((f: any) => f.name) : [];
          
          // 兜底逻辑：如果驱动没返回 fields 但有数据，尝试从数据中提取列名
          if (columns.length === 0 && rows.length > 0) {
            columns = Object.keys(rows[0]);
          }
          
          return { rows, columns, currentDb };
        } catch (error) {
          console.error(`PostgreSQL 查询执行失败: ${sql}`, error);
          throw error;
        }
      };

      return {
        client,
        type: databaseType,
        config: config,
        executeQuery
      };
    } else if (databaseType === 'sqlite') {
      // SQLite 连接
      const dbPath = filePath || './default.sqlite';
      client = new Database(dbPath);

      // 创建 executeQuery 方法
      const executeQuery = async (sql: string) => {
        try {
          const stmt = client.prepare(sql);
          if (sql.toUpperCase().trim().startsWith('SELECT') || sql.toUpperCase().includes('PRAGMA')) {
            const rows = stmt.all();
            const columns = stmt.columns().map((c: any) => c.name);
            return { rows, columns };
          } else {
            // 对于非查询语句
            const result = stmt.run();
            return { rows: [], columns: [], changes: result.changes };
          }
        } catch (error) {
          console.error(`SQLite 查询执行失败: ${sql}`, error);
          throw error;
        }
      };

      return {
        client,
        type: databaseType,
        config: config,
        executeQuery
      };
    } else {
      throw new Error(`不支持的数据库类型: ${databaseType}`);
    }
  } catch (error: any) {
    console.error(`创建数据库连接失败 [${connectionId}]:`, error);
    return null;
  }
}

// 获取或创建数据库连接（带缓存）
export async function getOrCreateDatabaseConnection(connectionId: string, tabId?: string, dbName?: string): Promise<any | null> {
  // 先检查缓存中是否存在
  const cached = getCachedDatabaseConnection(connectionId, tabId, dbName);
  if (cached) {
    // 验证连接是否仍然有效
    try {
      if (cached.type === 'postgresql') {
        await cached.client.query('SELECT 1');
      } else if (cached.type === 'mysql') {
        await cached.client.execute('SELECT 1');
      } else if (cached.type === 'sqlite') {
        await cached.client.prepare('SELECT 1').all();
      }
      return cached;
    } catch (error) {
      console.log(`缓存连接无效，正在重新创建: ${connectionId}${tabId ? ':' + tabId : ''}`);
      await removeCachedDatabaseConnection(connectionId, tabId);
    }
  }

  // 创建新连接
  const config = getConnectionById(connectionId);
  if (!config) return null;

  // 对于 PostgreSQL，如果传入了新库名，则临时覆盖配置进行连接
  if (dbName && config.databaseType === 'postgresql') {
    config.databaseName = dbName;
  }

  const newConnection = await createDatabaseConnection(connectionId, dbName);
  if (newConnection) {
    setCachedDatabaseConnection(connectionId, newConnection, tabId, dbName);
  }
  
  return newConnection;
}

// 获取数据库结构信息
export async function getDatabaseStructure(connectionId: string, tabId?: string): Promise<any> {
  const connection = await getOrCreateDatabaseConnection(connectionId, tabId);
  if (!connection) {
    // 如果无法建立连接，返回空结构而不是抛出错误
    // 这样可以让API继续运行，而不至于因为单个无效连接导致整个API失败
    return [];
  }

  const config = connection.config;
  let structure: any = [];

  try {
    if (config.databaseType === 'mysql') {
      // MySQL: 获取数据库列表，然后获取每个数据库的表
      const databasesResult = await connection.executeQuery("SHOW DATABASES");
      const rawDatabases = Array.isArray(databasesResult) ? databasesResult[0] : databasesResult.rows;
      const databases = Array.isArray(rawDatabases) 
        ? rawDatabases
            .map((row: any) => row['Database'] || row.database || Object.values(row)[0])
            .filter((db: string) => 
              db && db !== ''
            )
        : [];

      // 使用 Promise.all 来并行获取每个数据库的表列表
      const databaseStructures = await Promise.all(databases.map(async (dbName: string) => {
        // 获取特定数据库中的表
        let tableNames: string[] = [];
        try {
          // 切换到指定数据库并获取表列表
          const tablesResult = await connection.executeQuery(`SELECT TABLE_NAME FROM information_schema.tables WHERE table_schema = '${dbName}' AND table_type = 'BASE TABLE' ORDER BY TABLE_NAME`);
          tableNames = tablesResult.rows.map((row: any) => row.TABLE_NAME || row.table_name || Object.values(row)[0]).filter(Boolean);
          // 对表名进行排序
          tableNames.sort();
        } catch (e) {
          // 如果获取表失败，使用默认值
          tableNames = [];
        }

        return {
          id: dbName,
          name: dbName,
          schema: 'public', // 默认schema
          tables: tableNames,
          tableCount: tableNames.length,
          size: 'N/A',
          status: 'connected' as const,
          type: config.databaseType,
          children: tableNames.map((tableName: string) => ({
            name: tableName,
            type: 'table',
            dbName: dbName
          }))
        };
      }));

      // MySQL 结构：直接返回数据库列表（移除Connection顶层）
      structure = databaseStructures;
    } else if (config.databaseType === 'postgresql') {
      // PostgreSQL: 1. 获取所有数据库列表
      const dbsResult = await connection.executeQuery("SELECT datname FROM pg_database WHERE datistemplate = false AND datallowconn = true ORDER BY datname");
      const databases = dbsResult.rows.map((row: any) => row.datname);
      
      const currentDbRes = await connection.executeQuery("SELECT current_database()");
      const currentConnectedDb = currentDbRes.rows[0].current_database;
      
      const { Client } = require('pg');

      // 2. 深度扫描：为每个库获取其 Schema 和 Table
      // 注意：PG 需要连接到具体库才能查询其元数据，我们并行执行以提高速度
      const databaseStructures = await Promise.all(databases.map(async (dbName: string) => {
        let dbClient: any = null;
        try {
          // 如果是当前库，直接用现有连接；否则创建临时连接
          const isCurrent = dbName.toLowerCase() === currentConnectedDb.toLowerCase();
          
          let schemas: string[] = [];
          if (isCurrent) {
            const res = await connection.executeQuery("SELECT schema_name FROM information_schema.schemata WHERE schema_name NOT IN ('information_schema', 'pg_catalog') AND schema_name NOT LIKE 'pg_toast%' AND schema_name NOT LIKE 'pg_temp%'");
            schemas = res.rows.map((r: any) => r.schema_name);
          } else {
            // 创建临时连接获取元数据
            dbClient = new Client({
              host: config.host,
              port: config.port,
              user: config.username,
              password: config.password,
              database: dbName,
              connectionTimeoutMillis: 5000
            });
            await dbClient.connect();
            const res = await dbClient.query("SELECT schema_name FROM information_schema.schemata WHERE schema_name NOT IN ('information_schema', 'pg_catalog') AND schema_name NOT LIKE 'pg_toast%' AND schema_name NOT LIKE 'pg_temp%'");
            schemas = res.rows.map((r: any) => r.schema_name);
          }

          const schemaNodes = await Promise.all(schemas.map(async (schemaName: string) => {
            let tableNames: string[] = [];
            if (isCurrent) {
              const res = await connection.executeQuery(`SELECT table_name FROM information_schema.tables WHERE table_schema = '${schemaName}' AND table_type = 'BASE TABLE' ORDER BY table_name`);
              tableNames = res.rows.map((r: any) => r.table_name);
            } else if (dbClient) {
              const res = await dbClient.query(`SELECT table_name FROM information_schema.tables WHERE table_schema = '${schemaName}' AND table_type = 'BASE TABLE' ORDER BY table_name`);
              tableNames = res.rows.map((r: any) => r.table_name);
            }

            return {
              id: `${dbName}:${schemaName}`,
              name: schemaName,
              type: 'schema',
              children: tableNames.map((tableName: string) => ({
                name: tableName,
                type: 'table',
                dbName: dbName,
                schema: schemaName
              })),
              tableCount: tableNames.length
            };
          }));

          // 智能拍平逻辑：如果是 public 模式，将其子节点提升到数据库根部
          const finalChildren: any[] = [];
          schemaNodes.forEach(sNode => {
            if (sNode.name === 'public') {
              // 将 public 模式下的表直接放入根列表
              finalChildren.push(...sNode.children);
            } else {
              // 其他模式保留文件夹形式
              finalChildren.push(sNode);
            }
          });

          return {
            id: dbName,
            name: dbName,
            type: config.databaseType,
            status: isCurrent ? 'connected' : 'available',
            children: finalChildren,
            tableCount: schemaNodes.reduce((sum, s) => sum + s.tableCount, 0)
          };
        } catch (err: any) {
          console.warn(`[PG 扫描] 无法读取数据库 ${dbName} 的结构:`, err.message);
          return {
            id: dbName,
            name: dbName,
            type: config.databaseType,
            status: 'error',
            children: [],
            tableCount: 0
          };
        } finally {
          if (dbClient) {
            try { await dbClient.end(); } catch (e) {}
          }
        }
      }));

      structure = databaseStructures;
    } else if (config.databaseType === 'sqlite') {
      // SQLite: 直接获取表列表
      const tablesResult = await connection.executeQuery("SELECT name FROM sqlite_master WHERE type='table' AND name != 'sqlite_sequence' ORDER BY name");
      const rawTables = Array.isArray(tablesResult) ? tablesResult[0] : tablesResult.rows;
      const tableNames = Array.isArray(rawTables) 
        ? rawTables.map((row: any) => row.name || row.NAME || Object.values(row)[0]).filter(Boolean)
        : []; // 实际表列表
      // 对表名进行排序
      tableNames.sort();
      
      // SQLite 结构：直接返回数据库（单个数据库文件）
      structure = [{
        id: 'main',
        name: config.filePath || 'database.db',
        schema: 'main',
        tables: tableNames,
        tableCount: tableNames.length,
        size: 'N/A', // SQLite文件大小需要单独计算
        status: 'connected' as const,
        type: config.databaseType,
        children: tableNames.map((tableName: string) => ({
          name: tableName,
          type: 'table',
          dbName: config.filePath || 'database.db'
        }))
      }];
    }
  } catch (error: any) {
    console.error(`获取数据库结构失败 [${connectionId}]:`, error);
    // 发生错误时返回空结构，而不是抛出异常
    // 这样可以让API继续运行，而不至于因为单个连接的问题导致整个API失败
    return [];
  }

  return structure;
}