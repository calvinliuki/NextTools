import net from 'net';
import zookeeper from 'node-zookeeper-client';

export interface ZooKeeperConnectionConfig {
  mode?: 'standalone' | 'cluster';
  host?: string;
  port?: number;
  clusterNodes?: Array<{ host: string; port: number }>;
  connectionTimeout?: number;
  sessionTimeout?: number;
  readOnly?: boolean;
}

interface ManagedClient {
  client: zookeeper.Client;
  lastUsed: number;
  configHash: string;
}

const DEFAULT_IDLE_TIMEOUT_MS = 30 * 60 * 1000;
const clientPool = new Map<string, ManagedClient>();

function getConnectionString(config: ZooKeeperConnectionConfig): string {
  const mode = config.mode || 'standalone';
  if (mode === 'cluster' && config.clusterNodes && config.clusterNodes.length > 0) {
    return config.clusterNodes
      .map(node => `${node.host.trim()}:${node.port}`)
      .join(',');
  }
  const host = config.host?.trim() || '127.0.0.1';
  const port = config.port || 2181;
  return `${host}:${port}`;
}

function getConfigHash(config: ZooKeeperConnectionConfig): string {
  return JSON.stringify({
    mode: config.mode || 'standalone',
    host: config.host || '',
    port: config.port || 0,
    clusterNodes: config.clusterNodes || [],
    sessionTimeout: config.sessionTimeout || 10,
    readOnly: config.readOnly || false,
  });
}

function isConnected(client: zookeeper.Client): boolean {
  const state = client.getState();
  return state && state.name === 'SYNC_CONNECTED';
}

function closeClient(client: zookeeper.Client) {
  try {
    client.removeAllListeners();
    client.close();
  } catch (error) {
    console.error('关闭 ZooKeeper 连接失败:', error);
  }
}

function cleanupIdleClients(maxIdleMs = DEFAULT_IDLE_TIMEOUT_MS) {
  const now = Date.now();
  for (const [id, entry] of clientPool.entries()) {
    if (now - entry.lastUsed > maxIdleMs) {
      closeClient(entry.client);
      clientPool.delete(id);
    }
  }
}

async function connectClient(config: ZooKeeperConnectionConfig): Promise<zookeeper.Client> {
  const connectionString = getConnectionString(config);
  const sessionTimeoutMs = Math.max(1, config.sessionTimeout || 10) * 1000;
  const connectionTimeoutMs = Math.max(1, config.connectionTimeout || 10) * 1000;

  return new Promise((resolve, reject) => {
    const client = zookeeper.createClient(connectionString, {
      sessionTimeout: sessionTimeoutMs,
      readOnly: config.readOnly || false,
    });

    const timeout = setTimeout(() => {
      cleanup();
      closeClient(client);
      reject(new Error('ZooKeeper 连接超时'));
    }, connectionTimeoutMs);

    const cleanup = () => {
      clearTimeout(timeout);
      client.removeListener('connected', onConnected);
      client.removeListener('error', onError);
      client.removeListener('authenticationFailed', onAuthFailed);
      client.removeListener('expired', onExpired);
    };

    const onConnected = () => {
      cleanup();
      resolve(client);
    };

    const onError = (err: Error) => {
      cleanup();
      closeClient(client);
      reject(err);
    };

    const onAuthFailed = () => {
      cleanup();
      closeClient(client);
      reject(new Error('ZooKeeper 认证失败'));
    };

    const onExpired = () => {
      cleanup();
      closeClient(client);
      reject(new Error('ZooKeeper 会话已过期'));
    };

    client.once('connected', onConnected);
    client.once('error', onError);
    client.once('authenticationFailed', onAuthFailed);
    client.once('expired', onExpired);

    client.connect();
  });
}

export async function getZooKeeperClient(connectionId: string, config: ZooKeeperConnectionConfig): Promise<zookeeper.Client> {
  cleanupIdleClients();
  const configHash = getConfigHash(config);
  const existing = clientPool.get(connectionId);

  if (existing) {
    if (existing.configHash !== configHash || !isConnected(existing.client)) {
      closeClient(existing.client);
      clientPool.delete(connectionId);
    } else {
      existing.lastUsed = Date.now();
      return existing.client;
    }
  }

  const client = await connectClient(config);
  clientPool.set(connectionId, {
    client,
    lastUsed: Date.now(),
    configHash,
  });
  return client;
}

export function releaseZooKeeperClient(connectionId: string) {
  const existing = clientPool.get(connectionId);
  if (existing) {
    existing.lastUsed = Date.now();
  }
}

export function closeZooKeeperClient(connectionId: string) {
  const existing = clientPool.get(connectionId);
  if (existing) {
    closeClient(existing.client);
    clientPool.delete(connectionId);
  }
}

export async function testZooKeeperConnection(config: ZooKeeperConnectionConfig) {
  const client = await connectClient(config);
  closeClient(client);
  return { connectionString: getConnectionString(config) };
}

function normalizeNodes(config: ZooKeeperConnectionConfig): Array<{ host: string; port: number }> {
  const mode = config.mode || 'standalone';
  if (mode === 'cluster' && config.clusterNodes && config.clusterNodes.length > 0) {
    return config.clusterNodes
      .filter(node => node.host && node.port)
      .map(node => ({ host: node.host.trim(), port: node.port }));
  }
  return [{ host: (config.host || '127.0.0.1').trim(), port: config.port || 2181 }];
}

async function sendFourLetterCommand(host: string, port: number, command: string, timeoutMs: number) {
  return new Promise<string>((resolve, reject) => {
    const socket = net.createConnection({ host, port });
    let data = '';
    let resolved = false;

    const finish = (result: string) => {
      if (resolved) return;
      resolved = true;
      socket.removeAllListeners();
      socket.end();
      socket.destroy();
      resolve(result);
    };

    const fail = (error: Error) => {
      if (resolved) return;
      resolved = true;
      socket.removeAllListeners();
      socket.destroy();
      reject(error);
    };

    socket.setTimeout(timeoutMs);
    socket.on('connect', () => {
      socket.write(command);
    });
    socket.on('data', chunk => {
      data += chunk.toString('utf8');
    });
    socket.on('timeout', () => finish(data.trim()));
    socket.on('error', err => fail(err));
    socket.on('close', () => finish(data.trim()));
  });
}

function parseMntr(text: string) {
  const result: Record<string, string> = {};
  text.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (!trimmed) return;
    const parts = trimmed.split(/\s+/);
    if (parts.length >= 2) {
      const key = parts[0];
      const value = parts.slice(1).join(' ');
      result[key] = value;
    }
  });
  return result;
}

function parseSrvr(text: string) {
  const result: Record<string, string> = {};
  text.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (!trimmed) return;
    const match = trimmed.match(/^([^:]+):\s*(.*)$/);
    if (match) {
      result[match[1].trim()] = match[2].trim();
    }
  });
  return result;
}

function isFourLetterWhitelistBlocked(text: string) {
  return text.toLowerCase().includes('not in the whitelist');
}

function toStatNumber(value: any) {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return Number.isNaN(value) ? 0 : value;
  if (typeof value === 'bigint') return Number(value);
  if (Buffer.isBuffer(value)) {
    if (value.length >= 8) {
      const num = Number(value.readBigInt64BE(0));
      return Number.isNaN(num) ? 0 : num;
    }
    if (value.length > 0) {
      const num = Number(value.readUIntBE(0, value.length));
      return Number.isNaN(num) ? 0 : num;
    }
    return 0;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  if (value && typeof value === 'object') {
    if (typeof value.toNumber === 'function') {
      const num = value.toNumber();
      return Number.isNaN(num) ? 0 : num;
    }
    if (typeof value.low === 'number' && typeof value.high === 'number') {
      const unsigned = !!value.unsigned;
      const low = BigInt(value.low >>> 0);
      const high = BigInt(value.high >>> 0);
      let combined = (high << 32n) + low;
      if (!unsigned) {
        combined = BigInt.asIntN(64, combined);
      }
      const num = Number(combined);
      return Number.isNaN(num) ? 0 : num;
    }
    if (typeof value.toString === 'function') {
      const parsed = Number(value.toString());
      return Number.isNaN(parsed) ? 0 : parsed;
    }
  }
  return 0;
}

function toStatPayload(stat?: zookeeper.Stat | null) {
  if (!stat) return null;
  return {
    czxid: toStatNumber(stat.czxid),
    mzxid: toStatNumber(stat.mzxid),
    ctime: toStatNumber(stat.ctime),
    mtime: toStatNumber(stat.mtime),
    version: toStatNumber(stat.version),
    cversion: toStatNumber(stat.cversion),
    aversion: toStatNumber(stat.aversion),
    ephemeralOwner: toStatNumber(stat.ephemeralOwner),
    dataLength: toStatNumber(stat.dataLength),
    numChildren: toStatNumber(stat.numChildren),
    pzxid: toStatNumber(stat.pzxid),
  };
}

export async function fetchZooKeeperMetrics(config: ZooKeeperConnectionConfig) {
  const nodes = normalizeNodes(config);
  const timeoutMs = Math.max(1, config.connectionTimeout || 5) * 1000;
  let lastError: Error | null = null;

  for (const node of nodes) {
    try {
      const mntr = await sendFourLetterCommand(node.host, node.port, 'mntr', timeoutMs);
      if (mntr) {
        if (isFourLetterWhitelistBlocked(mntr)) {
          lastError = new Error('mntr not in whitelist');
        } else {
          const parsed = parseMntr(mntr);
          console.log("parsed:",parsed)
          console.log('[zookeeper] mntr mode:', parsed['zk_server_state'] || parsed['server_state'] || 'unknown', 'node:', `${node.host}:${node.port}`);
          return {
            mode: parsed['zk_server_state'] || parsed['server_state'] || 'unknown',
            connections: Number(parsed['zk_num_alive_connections'] || parsed['num_alive_connections'] || 0),
            watchCount: Number(parsed['zk_watch_count'] || parsed['watch_count'] || 0),
            nodeCount: Number(parsed['zk_node_count'] || parsed['node_count'] || 0),
            latency: {
              min: Number(parsed['zk_min_latency'] || 0),
              avg: Number(parsed['zk_avg_latency'] || 0),
              max: Number(parsed['zk_max_latency'] || 0),
            },
            outstanding: Number(parsed['zk_outstanding_requests'] || 0),
            nodes: nodes.map(item => `${item.host}:${item.port}`),
          };
        }
      }
    } catch (error) {
      lastError = error as Error;
    }

    try {
      const srvr = await sendFourLetterCommand(node.host, node.port, 'srvr', timeoutMs);
      if (srvr) {
        const parsed = parseSrvr(srvr);
       // 打印 parsed
        const connections = parsed['Connections'] ? Number(parsed['Connections']) : 0;
        const nodeCount = parsed['Node count'] ? Number(parsed['Node count']) : 0;
        const outstanding = parsed['Outstanding'] ? Number(parsed['Outstanding']) : 0;
        return {
          mode: parsed['Mode'] || 'unknown',
          connections,
          watchCount: parsed['Watch count'] ? Number(parsed['Watch count']) : 0,
          nodeCount,
          latency: {
            min: 0,
            avg: 0,
            max: 0,
          },
          outstanding,
          nodes: nodes.map(item => `${item.host}:${item.port}`),
        };
      }
    } catch (error) {
      lastError = error as Error;
    }
  }

  throw lastError || new Error('未能获取 ZooKeeper 指标');
}

function getDataAsync(client: zookeeper.Client, path: string) {
  return new Promise<{ data: Buffer | null; stat: zookeeper.Stat | null }>((resolve, reject) => {
    client.getData(path, (error, data, stat) => {
      if (error) {
        reject(error);
        return;
      }
      resolve({ data: data ?? null, stat: stat ?? null });
    });
  });
}

function getChildrenAsync(client: zookeeper.Client, path: string) {
  return new Promise<{ children: string[]; stat: zookeeper.Stat | null }>((resolve, reject) => {
    client.getChildren(path, (error, children, stat) => {
      if (error) {
        reject(error);
        return;
      }
      resolve({ children: children || [], stat: stat ?? null });
    });
  });
}

function existsAsync(client: zookeeper.Client, path: string) {
  return new Promise<zookeeper.Stat | null>((resolve, reject) => {
    client.exists(path, (error, stat) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(stat ?? null);
    });
  });
}

function setDataAsync(client: zookeeper.Client, path: string, data: Buffer, version: number) {
  return new Promise<zookeeper.Stat | null>((resolve, reject) => {
    client.setData(path, data, version, (error, stat) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(stat ?? null);
    });
  });
}

function createAsync(client: zookeeper.Client, path: string, data: Buffer, mode: zookeeper.CreateMode) {
  return new Promise<string>((resolve, reject) => {
    client.create(path, data, zookeeper.ACL.OPEN_ACL_UNSAFE, mode, (error, createdPath) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(createdPath);
    });
  });
}

function removeAsync(client: zookeeper.Client, path: string, version: number) {
  return new Promise<void>((resolve, reject) => {
    client.remove(path, version, error => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

async function deleteRecursive(client: zookeeper.Client, path: string, version: number) {
  const { children } = await getChildrenAsync(client, path);
  for (const child of children) {
    const childPath = path === '/' ? `/${child}` : `${path}/${child}`;
    await deleteRecursive(client, childPath, -1);
  }
  await removeAsync(client, path, version);
}

function isZkError(error: any, code: number, name: string) {
  if (!error) return false;
  if (typeof error.getCode === 'function' && error.getCode() === code) return true;
  if (typeof error.code === 'number' && error.code === code) return true;
  if (typeof error.message === 'string' && error.message.includes(name)) return true;
  return false;
}

async function ensureParentPaths(client: zookeeper.Client, path: string) {
  const parts = path.split('/').filter(Boolean);
  let current = '';
  for (let i = 0; i < parts.length - 1; i += 1) {
    current += `/${parts[i]}`;
    try {
      await createAsync(client, current, Buffer.from(''), zookeeper.CreateMode.PERSISTENT);
    } catch (error: any) {
      if (!isZkError(error, zookeeper.Exception.NODE_EXISTS, 'NODE_EXISTS')) {
        throw error;
      }
    }
  }
}

export async function fetchZooKeeperNodeData(connectionId: string, config: ZooKeeperConnectionConfig, path: string) {
  const client = await getZooKeeperClient(connectionId, config);
  try {
    const { data, stat } = await getDataAsync(client, path);
    return {
      path,
      data: data ? data.toString('utf8') : '',
      dataBase64: data ? data.toString('base64') : '',
      stat: toStatPayload(stat),
    };
  } catch (error: any) {
    console.error('[zookeeper] getData failed:', { path, message: error?.message, code: error?.code });
    throw error;
  } finally {
    releaseZooKeeperClient(connectionId);
  }
}

export async function fetchZooKeeperNodeChildren(
  connectionId: string,
  config: ZooKeeperConnectionConfig,
  path: string,
  includeStat = false
) {
  const client = await getZooKeeperClient(connectionId, config);
  try {
    const { children, stat } = await getChildrenAsync(client, path);
    const childPaths = [...children].sort((a, b) => a.localeCompare(b, 'en')).map(child => (
      path === '/' ? `/${child}` : `${path}/${child}`
    ));
    let childStats: Record<string, any> = {};

    if (includeStat && childPaths.length > 0) {
      const stats = await Promise.all(
        childPaths.map(async childPath => {
          try {
            const childStat = await existsAsync(client, childPath);
            return [childPath, toStatPayload(childStat)] as const;
          } catch {
            return [childPath, null] as const;
          }
        })
      );
      childStats = Object.fromEntries(stats);
    }

    return {
      path,
      stat: toStatPayload(stat),
      children: childPaths.map(childPath => ({
        name: childPath.split('/').pop() || '/',
        path: childPath,
        stat: childStats[childPath] || null,
      })),
    };
  } catch (error: any) {
    console.error('[zookeeper] getChildren failed:', { path, message: error?.message, code: error?.code });
    throw error;
  } finally {
    releaseZooKeeperClient(connectionId);
  }
}

export async function setZooKeeperNodeData(
  connectionId: string,
  config: ZooKeeperConnectionConfig,
  path: string,
  data: Buffer,
  version: number
) {
  const client = await getZooKeeperClient(connectionId, config);
  try {
    const stat = await setDataAsync(client, path, data, version);
    return {
      path,
      stat: toStatPayload(stat),
    };
  } finally {
    releaseZooKeeperClient(connectionId);
  }
}

export async function createZooKeeperNode(
  connectionId: string,
  config: ZooKeeperConnectionConfig,
  path: string,
  data: Buffer,
  mode: zookeeper.CreateMode,
  createParents = false
) {
  const client = await getZooKeeperClient(connectionId, config);
  try {
    if (createParents) {
      await ensureParentPaths(client, path);
    }
    const createdPath = await createAsync(client, path, data, mode);
    return { path: createdPath };
  } finally {
    releaseZooKeeperClient(connectionId);
  }
}

export async function deleteZooKeeperNode(
  connectionId: string,
  config: ZooKeeperConnectionConfig,
  path: string,
  version: number,
  recursive = false
) {
  const client = await getZooKeeperClient(connectionId, config);
  try {
    if (recursive) {
      await deleteRecursive(client, path, version);
    } else {
      await removeAsync(client, path, version);
    }
    return { path };
  } finally {
    releaseZooKeeperClient(connectionId);
  }
}
