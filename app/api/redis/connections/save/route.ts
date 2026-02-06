import { NextRequest, NextResponse } from 'next/server';
import { testRedisConnection } from '@/lib/redis';
import { 
  generateConnectionId, 
  connectionNameExists, 
  connectionNameExistsByType,
  saveConnection 
} from '@/lib/db';

// 统一响应格式
interface ApiResponse {
  code: number;
  message: string;
  data: any;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // 参数验证
    if (!body.name) {
      return NextResponse.json<ApiResponse>({
        code: 40001,
        message: '参数校验失败：`name` 字段为必填项',
        data: null,
      }, { status: 400 });
    }

    const mode = body.mode || 'standalone';
    
    if (mode === 'standalone' && (!body.host || !body.port)) {
      return NextResponse.json<ApiResponse>({
        code: 40001,
        message: '参数校验失败：单机模式需要 `host` 和 `port` 字段',
        data: null,
      }, { status: 400 });
    }

    if (mode === 'cluster' && (!body.clusterNodes || body.clusterNodes.length === 0)) {
      return NextResponse.json<ApiResponse>({
        code: 40001,
        message: '参数校验失败：集群模式需要至少一个集群节点',
        data: null,
      }, { status: 400 });
    }



    // 检查连接名是否已存在（按类型检查，避免不同类型连接名称冲突）
    if (connectionNameExistsByType('redis', body.name, body.id)) {
      return NextResponse.json<ApiResponse>({
        code: 40901,
        message: `Redis连接名称 '${body.name}' 已存在`,
        data: null,
      }, { status: 409 });
    }

    // 根据是否有ID来区分新建和编辑操作
    const connectionId = body.id || generateConnectionId();

    // 构建配置对象
    const config: any = {
      mode,
      password: body.password || '',
      username: body.username || '',
      securityMode: body.securityMode || 'none',
      defaultFilter: body.defaultFilter || '*',
      namespaceSeparator: body.namespaceSeparator || ':',
      connectionTimeout: body.connectionTimeout || 60,
      executionTimeout: body.executionTimeout || 60,
      dbScanLimit: body.dbScanLimit || 20,
      clusterRedirect: body.clusterRedirect || false,
    };

    // 根据不同模式添加对应的配置字段
    if (mode === 'standalone') {
      config.host = body.host;
      config.port = parseInt(body.port, 10);
    } else if (mode === 'cluster') {
      config.clusterNodes = body.clusterNodes.map((node: any) => ({
        host: node.host,
        port: parseInt(node.port, 10),
      }));
    }

    // 保存到数据库
    saveConnection(connectionId, body.name, config);

    return NextResponse.json<ApiResponse>({
      code: 200,
      message: '连接创建成功',
      data: {
        id: connectionId,
        name: body.name,
        savedAt: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    return NextResponse.json<ApiResponse>({
      code: 50000,
      message: `服务器内部错误：${error?.message || '未知错误'}`,
      data: null,
    }, { status: 500 });
  }
}