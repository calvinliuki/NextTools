import { NextRequest, NextResponse } from 'next/server';
import { getConnectionById } from '@/lib/db';
import { setZooKeeperNodeData } from '@/lib/zookeeper';

function decodeData(data: string, encoding: string) {
  if (!data) return Buffer.from('');
  switch (encoding) {
    case 'base64':
      return Buffer.from(data, 'base64');
    case 'hex':
      return Buffer.from(data, 'hex');
    default:
      return Buffer.from(data, 'utf8');
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { connectionId, path, data, encoding = 'utf8', mode = 'overwrite', version } = body;

    if (!connectionId) {
      return NextResponse.json({ code: 40001, message: '缺少 connectionId', data: null }, { status: 400 });
    }

    if (!path || typeof path !== 'string') {
      return NextResponse.json({ code: 40002, message: '缺少节点路径', data: null }, { status: 400 });
    }

    const normalizedPath = path.startsWith('/') ? path.trim() : `/${path.trim()}`;
    const config = getConnectionById(connectionId);
    if (!config) {
      return NextResponse.json({ code: 40401, message: 'ZooKeeper 连接不存在', data: null }, { status: 404 });
    }

    if (config.readOnly) {
      return NextResponse.json({ code: 40301, message: '连接为只读模式，禁止修改数据', data: null }, { status: 403 });
    }

    const payload = decodeData(data || '', encoding);
    const targetVersion = mode === 'cas' && typeof version === 'number' ? version : -1;
    const result = await setZooKeeperNodeData(connectionId, config, normalizedPath, payload, targetVersion);

    return NextResponse.json({ code: 200, message: '更新节点数据成功', data: result });
  } catch (error: any) {
    console.error('更新 ZooKeeper 节点数据失败:', error);
    return NextResponse.json(
      { code: 50001, message: `更新失败: ${error?.message || '未知错误'}`, data: null },
      { status: 500 }
    );
  }
}
