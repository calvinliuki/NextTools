'use client';

import { useLanguage } from '../../../../i18n/LanguageContext';

interface ConsumerGroupsSectionProps {
  allConsumerGroups: any[];
  allCgLoading: boolean;
  onRefresh: () => void;
  onCgClick: (groupId: string, topic: string) => void;
}

export default function ConsumerGroupsSection({
  allConsumerGroups,
  allCgLoading,
  onRefresh,
  onCgClick,
}: ConsumerGroupsSectionProps) {
  const { t } = useLanguage();
  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">Consumer Groups</h2>
          <span className="text-xs px-2 py-0.5 rounded-full bg-[#F2F3F5] text-[#4E5969]">{allConsumerGroups.length} groups</span>
        </div>
        <div className="flex gap-2">
          <button
            className="px-3 py-1.5 text-sm rounded-lg border border-[#E5E6EB] bg-white hover:bg-[#F2F3F5] transition-colors"
            onClick={onRefresh}
          >
            {allCgLoading && <i className="fas fa-spinner fa-spin mr-1"></i>}
            {t('sessionManager.refresh')}
          </button>
        </div>
      </div>

      <div className="p-4 rounded-xl bg-white border border-[#E5E6EB] shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <input
            className="px-3 py-1.5 text-sm border border-[#E5E6EB] rounded-lg focus:outline-none focus:border-[#165DFF] min-w-[220px]"
            placeholder={t('kafka.searchGroupIdPlaceholder')}
          />
          <select className="px-3 py-1.5 text-sm border border-[#E5E6EB] rounded-lg focus:outline-none focus:border-[#165DFF] min-w-[150px]">
            <option>{t('kafka.filterAll')}</option>
            <option>Stable</option>
            <option>Rebalancing</option>
            <option>Empty</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#F9FAFB] border-b border-[#E5E6EB]">
              <tr>
                <th className="text-left py-2 px-3 font-medium text-[#4E5969]">Group Id</th>
                <th className="text-left py-2 px-3 font-medium text-[#4E5969]">{t('kafka.statusLabel')}</th>
                <th className="text-left py-2 px-3 font-medium text-[#4E5969]">{t('kafka.membersCountLabel')}</th>
                <th className="text-left py-2 px-3 font-medium text-[#4E5969]">{t('kafka.subscribedTopicsLabel')}</th>
                <th className="text-left py-2 px-3 font-medium text-[#4E5969]">Total Lag</th>
                <th className="text-left py-2 px-3 font-medium text-[#4E5969]">{t('kafka.operationLabel')}</th>
              </tr>
            </thead>
            <tbody>
              {allCgLoading && allConsumerGroups.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-[#86909C]">{t('kafka.fetchingConsumerGroups')}</td>
                </tr>
              ) : allConsumerGroups.length > 0 ? (
                allConsumerGroups.map((cg) => (
                  <tr key={cg.groupId} className="border-b border-[#E5E6EB] hover:bg-[#F9FAFB]">
                    <td className="py-2 px-3 font-medium">{cg.groupId}</td>
                    <td className="py-2 px-3">
                      <span className={`px-2 py-0.5 text-xs rounded-full ${
                        cg.state === 'Stable' || cg.state === 'Empty'
                          ? 'bg-[#E8FFEA] text-[#00B42A]'
                          : cg.state === 'PreparingRebalance' || cg.state === 'CompletingRebalance'
                          ? 'bg-[#FFF7E8] text-[#FF7D00]'
                          : 'bg-[#FFECE8] text-[#F53F3F]'
                      }`}>
                        {cg.state}
                      </span>
                    </td>
                    <td className="py-2 px-3">{cg.members}</td>
                    <td className="py-2 px-3">{cg.subscribedTopics?.join(', ') || 'N/A'}</td>
                    <td className={`py-2 px-3 ${cg.totalLag > 0 ? 'text-[#F53F3F] font-semibold' : ''}`}>
                      {cg.totalLag?.toLocaleString() || 0}
                    </td>
                    <td className="py-2 px-3">
                      <button
                        className="px-2 py-1 text-xs rounded-lg border border-[#E5E6EB] bg-white hover:bg-[#F2F3F5] transition-colors"
                        onClick={() => onCgClick(cg.groupId, cg.subscribedTopics?.[0] || '')}
                      >
                        {t('kafka.detailsResetOffset')}
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-[#86909C]">{t('kafka.noConsumerGroups')}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
