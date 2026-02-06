import { NextRequest, NextResponse } from 'next/server';
import { getConnectionById } from '@/lib/db';
import { buildElasticClient } from '@/lib/elastic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { connectionId } = body;

    if (!connectionId) {
      return NextResponse.json({ code: 40001, message: '缺少 connectionId', data: null }, { status: 400 });
    }

    const config = getConnectionById(connectionId);
    if (!config) {
      return NextResponse.json({ code: 40401, message: 'Elastic 连接不存在', data: null }, { status: 404 });
    }

    const client = buildElasticClient(config);

    const [health, stats, nodesStats, catIndices] = await Promise.all([
      client.cluster.health(),
      client.cluster.stats(),
      client.nodes.stats({ metric: ['indices', 'jvm', 'os', 'fs'] }),
      client.cat.indices({ format: 'json' }),
    ]);

    const healthBody: any = (health as any).body ?? health;
    const statsBody: any = (stats as any).body ?? stats;
    const nodesBody: any = (nodesStats as any).body ?? nodesStats;
    const indicesBody: any[] = Array.isArray((catIndices as any).body)
      ? (catIndices as any).body
      : Array.isArray(catIndices)
        ? (catIndices as any)
        : [];

    const queryTotal = Object.values(nodesBody.nodes || {}).reduce((sum: number, node: any) => {
      return sum + (node?.indices?.search?.query_total || 0);
    }, 0);
    const queryTimeMs = Object.values(nodesBody.nodes || {}).reduce((sum: number, node: any) => {
      return sum + (node?.indices?.search?.query_time_in_millis || 0);
    }, 0);
    const uptimeMs = Object.values(nodesBody.nodes || {}).reduce((max: number, node: any) => {
      return Math.max(max, node?.jvm?.uptime_in_millis || 0);
    }, 0);

    const nodes = Object.values(nodesBody.nodes || {}).map((node: any) => {
      const diskTotal = node?.fs?.total?.total_in_bytes || 0;
      const diskFree = node?.fs?.total?.free_in_bytes || 0;
      const used = diskTotal > 0 ? Math.round(((diskTotal - diskFree) / diskTotal) * 100) : 0;
      const roles = Array.isArray(node?.roles) ? node.roles : [];
      const role = roles.includes('master')
        ? 'master'
        : roles.includes('data')
          ? 'data'
          : roles.includes('ingest')
            ? 'ingest'
            : roles[0] || 'data';
      return {
        id: node?.name || '',
        name: node?.name || '',
        role,
        status: 'online',
        heap: node?.jvm?.mem?.heap_used_percent || 0,
        cpu: node?.os?.cpu?.percent || 0,
        disk: used,
        shards: node?.indices?.shard_stats?.total_count || 0,
      };
    });

    const indices = indicesBody
      .map((item: any) => ({
        name: item.index || item['index'],
        docs: Number(item['docs.count'] || item.docs || 0),
        size: item['store.size'] || item.store || '',
        status: item.status || '',
        health: item.health || 'green',
      }))
      .sort((a, b) => b.docs - a.docs)
      .slice(0, 6);

    return NextResponse.json({
      code: 200,
      message: '获取指标成功',
      data: {
        cluster: {
          status: healthBody.status,
          nodes: healthBody.number_of_nodes,
          activeShards: healthBody.active_shards,
          unassignedShards: healthBody.unassigned_shards,
        },
        stats: {
          indices: statsBody.indices?.count || 0,
          docs: statsBody.indices?.docs?.count || 0,
          storeBytes: statsBody.indices?.store?.size_in_bytes || 0,
          shards: statsBody.indices?.shards?.total || 0,
          qps: uptimeMs ? Math.round((queryTotal / (uptimeMs / 1000)) * 100) / 100 : 0,
          avgResponseTimeMs: queryTotal ? Math.round(queryTimeMs / queryTotal) : 0,
        },
        nodes,
        indices,
      },
    });
  } catch (error: any) {
    console.error('获取 Elastic 指标错误:', error);
    return NextResponse.json(
      { code: 50001, message: `获取失败: ${error?.message || '未知错误'}`, data: null },
      { status: 500 }
    );
  }
}
