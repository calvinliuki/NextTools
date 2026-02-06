'use client';

import { useLanguage } from '../../../../i18n/LanguageContext';

interface DashboardSectionProps {
  connectionName: string;
  clusterInfo: any;
  onRefresh: () => void;
  onCgClick: (groupId: string, topic: string) => void;
}

export default function DashboardSection({
  connectionName,
  clusterInfo,
  onRefresh,
  onCgClick,
}: DashboardSectionProps) {
  const { t } = useLanguage();
  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">{t('kafka.dashboardOverview')}</h2>
          <span className="text-xs px-2 py-0.5 rounded-full bg-[#F2F3F5] text-[#4E5969]">
            Cluster {connectionName}
          </span>
        </div>
        <div className="flex gap-2">
          <button
            className="px-3 py-1.5 text-sm rounded-lg border border-[#E5E6EB] bg-white hover:bg-[#F2F3F5] transition-colors"
            onClick={onRefresh}
          >
            {t('sessionManager.refresh')}
          </button>
          <button className="px-3 py-1.5 text-sm rounded-lg border border-[#E5E6EB] bg-white hover:bg-[#F2F3F5] transition-colors">
            {t('kafka.exportMetrics')}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-white border border-[#E5E6EB] shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm text-[#4E5969]">Brokers</div>
            <span className="px-2 py-0.5 text-xs rounded-full bg-[#E8F3FF] text-[#165DFF]">
              {t('kafka.allBrokersAlive')}
            </span>
          </div>
          <div className="text-2xl font-semibold mb-1">{clusterInfo?.brokers || 0}</div>
          <div className="text-xs text-[#86909C]">
            {clusterInfo?.brokerList?.map((b: any) => `node-${b.nodeId}`).join(' / ') || 'Fetching...'}
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white border border-[#E5E6EB] shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm text-[#4E5969]">Topics</div>
            <span className="px-2 py-0.5 text-xs rounded-full bg-[#F2F3F5] text-[#86909C]">Internal: 4</span>
          </div>
          <div className="text-2xl font-semibold mb-1">{clusterInfo?.topics || 0}</div>
          <div className="text-xs text-[#86909C]">
            {t('kafka.totalPartitions')}：{clusterInfo?.totalPartitions || 0} • {t('kafka.totalReplicas')}：{clusterInfo ? clusterInfo.topics * 3 : 0}
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white border border-[#E5E6EB] shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm text-[#4E5969]">Total Consumer Lag</div>
            <span className={`px-2 py-0.5 text-xs rounded-full ${
              clusterInfo?.totalLag > 0 ? 'bg-[#FFECE8] text-[#F53F3F]' : 'bg-[#E8F3FF] text-[#165DFF]'
            }`}>
              {clusterInfo?.totalLag > 0 ? t('kafka.hasLag') : t('kafka.consumptionNormal')}
            </span>
          </div>
          <div className="text-2xl font-semibold mb-2">{clusterInfo?.totalLag?.toLocaleString() || 0}</div>
          <div className="h-1.5 bg-[#F2F3F5] rounded-full overflow-hidden">
            <div
              className={`h-full ${clusterInfo?.totalLag > 0 ? 'bg-[#F53F3F]' : 'bg-[#00B42A]'}`}
              style={{ width: `${Math.min(100, (clusterInfo?.totalLag / 10000) * 100)}%` }}
            ></div>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white border border-[#E5E6EB] shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm text-[#4E5969]">Traffic</div>
            <span className="px-2 py-0.5 text-xs rounded-full bg-[#F2F3F5] text-[#86909C]">In / Out</span>
          </div>
          <div className="text-2xl font-semibold mb-2">{clusterInfo?.traffic?.in || '0 msg/s'}</div>
          <div className="text-xs text-[#86909C]">
            In: {clusterInfo?.traffic?.in || '0 msg/s'} • Out: {clusterInfo?.traffic?.out || '0 msg/s'}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-white border border-[#E5E6EB] shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-medium">Top Lag Consumer Groups</div>
            <span className="px-2 py-0.5 text-xs rounded-full bg-[#F2F3F5] text-[#86909C]">Consumer Lag</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-[#F9FAFB] text-[#4E5969] border-b border-[#E5E6EB]">
                <tr>
                  <th className="text-left py-2 px-3 font-medium">Group Id</th>
                  <th className="text-left py-2 px-3 font-medium">Topic</th>
                  <th className="text-left py-2 px-3 font-medium">Lag</th>
                  <th className="text-left py-2 px-3 font-medium">{t('kafka.statusLabel')}</th>
                </tr>
              </thead>
              <tbody>
                {clusterInfo?.topLagGroups?.length > 0 ? (
                  clusterInfo.topLagGroups.map((g: any) => (
                    <tr
                      key={g.groupId}
                      className="hover:bg-[#F9FAFB] cursor-pointer group border-b border-[#E5E6EB] last:border-0 transition-colors"
                      onClick={() => onCgClick(g.groupId, g.topic || '')}
                    >
                      <td className="py-2.5 px-3 truncate max-w-[100px]" title={g.groupId}>{g.groupId}</td>
                      <td className="py-2.5 px-3 truncate max-w-[80px] text-[#86909C]" title={g.topic}>{g.topic}</td>
                      <td className="py-2.5 px-3 font-medium">{g.lag.toLocaleString()}</td>
                      <td className="py-2.5 px-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full border ${
                          g.status === 'Unstable'
                            ? 'bg-[#FFF7F8] border-[#FFECE8] text-[#F53F3F]'
                            : g.status === 'Warning'
                            ? 'bg-[#FFFBE6] border-[#FFE4BA] text-[#FF7D00]'
                            : 'bg-[#E8FFEA] border-[#AFF0B5] text-[#00B42A]'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                            g.status === 'Unstable' ? 'bg-[#F53F3F]' : g.status === 'Warning' ? 'bg-[#FF7D00]' : 'bg-[#00B42A]'
                          }`} />
                          {g.status}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="text-center py-6 text-[#86909C]">{t('kafka.noLagData')}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-white border border-[#E5E6EB] shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-medium">Under-replicated Partitions</div>
            <span className="px-2 py-0.5 text-xs rounded-full bg-[#F2F3F5] text-[#86909C]">Replication</span>
          </div>
          {clusterInfo?.underReplicatedPartitions > 0 ? (
            <div className="p-3 rounded-lg bg-[#FFFAF0] border border-[#FFECE8]">
              <div className="text-sm font-medium text-[#F53F3F] mb-1">
                {t('kafka.foundAbnormalPartitions', { count: clusterInfo.underReplicatedPartitions })}
              </div>
              <div className="text-xs text-[#FF7D00]">{t('kafka.replicationStatusInconsistent')}</div>
            </div>
          ) : (
            <div className="p-3 rounded-lg bg-[#F2F3F5]">
              <div className="text-sm font-medium mb-1">当前没有 under-replicated partitions 🎉</div>
              <div className="text-xs text-[#86909C]">{t('kafka.replicationStatusNormal')}</div>
            </div>
          )}
        </div>

        <div className="p-4 rounded-xl bg-white border border-[#E5E6EB] shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-medium text-[#86909C]">{t('kafka.recentOperations')}</div>
            <span className="px-2 py-0.5 text-xs rounded-full bg-[#F2F3F5] text-[#86909C]">Audit</span>
          </div>
          <div className="text-center py-8">
            <div className="text-[#86909C] mb-1">{t('kafka.noOperationRecords')}</div>
            <div className="text-xs text-[#86909C]">{t('kafka.featureComingSoon')}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
