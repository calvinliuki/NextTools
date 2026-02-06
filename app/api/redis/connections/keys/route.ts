import { NextRequest, NextResponse } from 'next/server';
import { getCachedConnection, getOrCreateConnection } from '@/lib/redisCache';
import { getAllRedisConnections } from '@/lib/db';

// 树节点类型
interface TreeNode {
  key: string;         // 完整键名或路径
  label: string;       // 显示名称
  type: 'folder' | 'key';  // 节点类型
  children?: TreeNode[];   // 子节点
  count?: number;          // 文件夹下的键数量
}

// 获取指定数据库的键列表
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, dbIndex = 0, pattern = '*', limit = 10000 } = body;

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

    // 从缓存获取连接
    let cached: any = getCachedConnection(id);
    
    // 如果缓存中不存在，尝试从数据库自动重连
    if (!cached) {
      console.warn(`[获取keys] 缓存中连接不存在，尝试自动重连: ${id}`);
      cached = await getOrCreateConnection(id);
      if (!cached) {
        return NextResponse.json(
          {
            code: 404,
            message: '连接不存在或已关闭，且无法自动重连，请检查连接配置',
            data: null,
          },
          { status: 404 }
        );
      }
      console.log(`[获取keys] 自动重连成功: ${id}`);
    }

    // 获取连接配置，读取 namespaceSeparator
    const connections = getAllRedisConnections();
    const connection = connections.find((conn: any) => conn.id === id);
    const separator = connection?.config?.namespaceSeparator || ':';

    const { redis, mode } = cached;
    const keys: Set<string> = new Set(); // 使用 Set 自动去重
    
    try {
      if (mode === 'cluster') {
        // 集群模式：必须遍历每个主节点单独 SCAN
        console.log('[获取keys] 集群模式：遍历所有主节点扫描');
        
        try {
          // 获取所有主节点
          const nodes = redis.nodes('master');
          console.log(`[获取keys] 发现 ${nodes.length} 个主节点`);
          
          // 对每个主节点执行完整的 SCAN
          for (let i = 0; i < nodes.length; i++) {
            const node = nodes[i];
            const nodeInfo = `节点${i + 1}/${nodes.length}`;
            
            try {
              let cursor = '0';
              let nodeScans = 0;
              const maxNodeScans = 10000;
              
              console.log(`[获取keys] 开始扫描 ${nodeInfo}`);
              
              do {
                try {
                  // 在特定节点上执行 SCAN
                  const scanResult = await node.scan(
                    cursor,
                    'MATCH',
                    pattern,
                    'COUNT',
                    100
                  );
                  
                  cursor = scanResult[0];
                  const foundKeys = scanResult[1];
                  
                  // 添加键到 Set（自动去重）
                  for (const key of foundKeys) {
                    keys.add(key);
                  }
                  
                  nodeScans++;
                  
                  if (nodeScans >= maxNodeScans) {
                    console.warn(`[获取keys] ${nodeInfo} 达到最大扫描次数`);
                    break;
                  }
                } catch (scanError: any) {
                  console.warn(`[获取keys] ${nodeInfo} SCAN 错误:`, scanError.message);
                  break;
                }
              } while (cursor !== '0');
              
              console.log(`[获取keys] ${nodeInfo} 扫描完成：${nodeScans} 次迭代，当前总计 ${keys.size} 个键`);
              
              // 如果已经获取了足够的键，可以提前退出
              if (keys.size >= limit) {
                console.log(`[获取keys] 已达到键数量限制 (${keys.size} >= ${limit})`);
                break;
              }
            } catch (nodeError: any) {
              console.warn(`[获取keys] ${nodeInfo} 处理失败:`, nodeError.message);
              continue;
            }
          }
          
          console.log(`[获取keys] 集群模式扫描完成：共获取 ${keys.size} 个键`);
        } catch (clusterError: any) {
          console.warn('[获取keys] 集群模式 SCAN 失败，使用单个连接的 SCAN:', clusterError.message);
          
          // 降级为使用主连接的 SCAN
          let cursor = '0';
          let scanCount = 0;
          const maxScans = 1000;
          
          do {
            const result = await redis.scan(
              cursor,
              'MATCH',
              pattern,
              'COUNT',
              100
            );
            
            cursor = result[0];
            const foundKeys = result[1];
            
            for (const key of foundKeys) {
              keys.add(key);
            }
            
            scanCount++;
            
            if (keys.size >= limit || scanCount >= maxScans) {
              break;
            }
          } while (cursor !== '0');
        }
      } else {
        // 单机/哨兵模式
        if (mode === 'standalone') {
          await redis.select(dbIndex);
        }
        
        console.log(`[获取keys] 使用 ${mode} 模式扫描`);
        
        // 使用 SCAN 命令获取键列表（比 KEYS 更安全）
        let cursor = '0';
        let scanCount = 0;
        const maxScans = 1000; // 最多扫描 1000 次、避免超时
              
        do {
          const result = await redis.scan(
            cursor,
            'MATCH',
            pattern,
            'COUNT',
            100 // 每次扫描 100 个
          );
                
          cursor = result[0];
          const foundKeys = result[1];
                
          for (const key of foundKeys) {
            keys.add(key);
          }
          
          scanCount++;
                
          // 如果已经达到限制或扫描次数过多、停止
          if (keys.size >= limit || scanCount >= maxScans) {
            break;
          }
        } while (cursor !== '0');
      }
      
      // 将 Set 转换为数组并限制返回数量
      const keysArray = Array.from(keys);
      const limitedKeys = keysArray.slice(0, limit);
      const hasMore = keysArray.length > limit;
      
      console.log(`[获取keys] 最终返回 ${limitedKeys.length} 个键，总扫描 ${keysArray.length} 个键`);
      
      // 构建树形结构
      const tree = buildTree(limitedKeys, separator);
      
      return NextResponse.json({
        code: 200,
        message: '获取键列表成功',
        data: {
          dbIndex,
          keys: limitedKeys,  // 保留原始键列表
          tree,               // 添加树形结构
          total: limitedKeys.length,
          hasMore,
        },
      });
    } catch (error: any) {
      console.error('获取键列表失败:', error);
      return NextResponse.json(
        {
          code: 500,
          message: `获取键列表失败：${error?.message || '未知错误'}`,
          data: null,
        },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('处理请求失败:', error);
    return NextResponse.json(
      {
        code: 500,
        message: `处理请求失败：${error?.message || '未知错误'}`,
        data: null,
      },
      { status: 500 }
    );
  }
}

// 构建树形结构
function buildTree(keys: string[], separator: string): TreeNode[] {
  const root: TreeNode[] = [];
  const folderMap = new Map<string, TreeNode>();

  for (const key of keys) {
    const parts = key.split(separator);
    let currentLevel = root;
    let currentPath = '';

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;
      currentPath = currentPath ? `${currentPath}${separator}${part}` : part;

      if (isLast) {
        // 最后一级，添加为键节点
        currentLevel.push({
          key,
          label: part,
          type: 'key',
        });
      } else {
        // 中间级，添加为文件夹节点
        let folder = folderMap.get(currentPath);
        
        if (!folder) {
          folder = {
            key: currentPath,
            label: part,
            type: 'folder',
            children: [],
          };
          currentLevel.push(folder);
          folderMap.set(currentPath, folder);
        }
        
        currentLevel = folder.children!;
      }
    }
  }

  // 合并只有一个子节点的文件夹
  const merged = mergeTree(root);
  
  // 排序并计算数量
  return sortTree(merged);
}

// 合并只有一个子节点的文件夹
function mergeTree(nodes: TreeNode[]): TreeNode[] {
  return nodes.map(node => {
    if (node.type === 'folder' && node.children && node.children.length > 0) {
      node.children = mergeTree(node.children);
      
      // 如果只有一个子节点且是文件夹，合并
      while (node.children && node.children.length === 1 && node.children[0].type === 'folder') {
        const child: TreeNode = node.children[0];
        node.label = `${node.label}:${child.label}`;
        node.key = child.key;
        node.children = child.children;
      }
    }
    return node;
  });
}

// 排序树并计算数量
function sortTree(nodes: TreeNode[]): TreeNode[] {
  // 分离文件夹和键
  const folders = nodes.filter(n => n.type === 'folder');
  const keys = nodes.filter(n => n.type === 'key');

  // 排序
  folders.sort((a, b) => a.label.localeCompare(b.label));
  keys.sort((a, b) => a.label.localeCompare(b.label));

  // 递归排序子节点并计算数量
  folders.forEach(folder => {
    if (folder.children) {
      folder.children = sortTree(folder.children);
      // 计算文件夹下的键数量
      folder.count = countKeys(folder);
    }
  });

  return [...folders, ...keys];
}

// 计算节点下的键数量
function countKeys(node: TreeNode): number {
  if (node.type === 'key') {
    return 1;
  }
  
  if (node.type === 'folder' && node.children) {
    return node.children.reduce((sum, child) => sum + countKeys(child), 0);
  }
  
  return 0;
}
