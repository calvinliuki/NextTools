'use client';

import { useLanguage } from '../../../../i18n/LanguageContext';

interface ConsumerGroupDetailSectionProps {
  activeCg: { id: string; topic: string };
  activeCgDetail: any;
  activeCgDetailLoading: boolean;
  activeCgTab: string;
  setActiveCgTab: (value: string) => void;
  onBack: () => void;
}

export default function ConsumerGroupDetailSection({
  activeCg,
  activeCgDetail,
  activeCgDetailLoading,
  activeCgTab,
  setActiveCgTab,
  onBack,
}: ConsumerGroupDetailSectionProps) {
  const { t } = useLanguage();
  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">Consumer Group: <span className="text-[#165DFF]">{activeCg.id}</span></h2>
          <span className="text-xs px-2 py-0.5 rounded-full bg-[#F2F3F5] text-[#4E5969]">
            {t('kafka.subscribeTopic')}{activeCg.topic}
          </span>
        </div>
        <div className="flex gap-2">
          <button
            className="px-3 py-1.5 text-sm rounded-lg border border-[#E5E6EB] bg-white hover:bg-[#F2F3F5] transition-colors"
            onClick={onBack}
          >
            {t('kafka.backToList')}
          </button>
        </div>
      </div>

      <div className="p-4 rounded-xl bg-white border border-[#E5E6EB] shadow-sm">
        <div className="grid grid-cols-5 gap-4 text-sm">
          <div>
            <div className="text-xs text-[#86909C] uppercase mb-1">Group Id</div>
            <div className="font-medium">{activeCg.id}</div>
          </div>
          <div>
            <div className="text-xs text-[#86909C] uppercase mb-1">{t('kafka.statusLabel')}</div>
            <div>
              <span className={`px-2 py-0.5 text-xs rounded-full ${
                activeCgDetail?.state === 'Stable' || activeCgDetail?.state === 'Empty'
                  ? 'bg-[#E8FFEA] text-[#00B42A]'
                  : activeCgDetail?.state === 'PreparingRebalance' || activeCgDetail?.state === 'CompletingRebalance'
                  ? 'bg-[#FFF7E8] text-[#FF7D00]'
                  : 'bg-[#FFECE8] text-[#F53F3F]'
              }`}>
                {activeCgDetail?.state || 'Unknown'}
              </span>
            </div>
          </div>
          <div>
            <div className="text-xs text-[#86909C] uppercase mb-1">成员数</div>
            <div className="font-medium">{activeCgDetail?.members || 0}</div>
          </div>
          <div>
            <div className="text-xs text-[#86909C] uppercase mb-1">{t('kafka.subscribedTopicsLabel')}</div>
            <div className="font-medium">{activeCg.topic}</div>
          </div>
          <div>
            <div className="text-xs text-[#86909C] uppercase mb-1">Total Lag</div>
            <div className="font-medium text-[#F53F3F]">{activeCgDetail?.totalLag?.toLocaleString() || 0}</div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-2 border-b border-[#E5E6EB]">
          {[
            { id: 'cg-members', label: 'Members' },
            { id: 'cg-reset', label: t('kafka.resetOffset') },
          ].map(tab => (
            <button
              key={tab.id}
              className={`px-4 py-2 text-sm transition-colors relative ${
                activeCgTab === tab.id
                  ? 'text-[#165DFF] font-medium after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-[#165DFF]'
                  : 'text-[#4E5969] hover:text-[#1D2129]'
              }`}
              onClick={() => setActiveCgTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="min-h-[200px]">
          {activeCgTab === 'cg-members' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-white border border-[#E5E6EB] shadow-sm">
                <div className="text-sm font-medium mb-2">{t('kafka.memberInfoTitle')}</div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-[#F9FAFB] border-b border-[#E5E6EB]">
                      <tr>
                        <th className="text-left py-2 px-3 font-medium text-[#4E5969]">Consumer Id</th>
                        <th className="text-left py-2 px-3 font-medium text-[#4E5969]">{t('kafka.hostLabel')}</th>
                        <th className="text-left py-2 px-3 font-medium text-[#4E5969]">{t('kafka.protocolLabel')}</th>
                        <th className="text-left py-2 px-3 font-medium text-[#4E5969]">{t('kafka.assignedPartitionsLabel')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeCgDetailLoading && activeCgDetail === null ? (
                        <tr>
                          <td colSpan={4} className="text-center py-10 text-[#86909C]">{t('kafka.fetchingMembers')}</td>
                        </tr>
                      ) : activeCgDetail?.assignments && activeCgDetail.assignments.length > 0 ? (
                        activeCgDetail.assignments.map((member: any, i: number) => (
                          <tr key={i} className="border-b border-[#E5E6EB]">
                            <td className="py-2 px-3">{member.clientId || `consumer-${i + 1}`}</td>
                            <td className="py-2 px-3">{member.host || 'N/A'}</td>
                            <td className="py-2 px-3">{activeCgDetail.protocol || 'N/A'}</td>
                            <td className="py-2 px-3">{member.assignments ? member.assignments.reduce((acc: number, assignment: any) => {
                              const partitionCount = Array.isArray(assignment.partitions) ? assignment.partitions.length : 0;
                              return acc + partitionCount;
                            }, 0) : 0}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={4} className="text-center py-10 text-[#86909C]">{t('kafka.noMembers')}</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-white border border-[#E5E6EB] shadow-sm">
                <div className="text-sm font-medium mb-2">{t('kafka.allocationDetailsTitle')}</div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-[#F9FAFB] border-b border-[#E5E6EB]">
                      <tr>
                        <th className="text-left py-2 px-3 font-medium text-[#4E5969]">Consumer Id</th>
                        <th className="text-left py-2 px-3 font-medium text-[#4E5969]">{t('kafka.topicLabel')}</th>
                        <th className="text-left py-2 px-3 font-medium text-[#4E5969]">{t('kafka.partitionLabel')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeCgDetailLoading && activeCgDetail === null ? (
                        <tr>
                          <td colSpan={3} className="text-center py-10 text-[#86909C]">{t('kafka.fetchingAllocation')}</td>
                        </tr>
                      ) : activeCgDetail?.assignments && activeCgDetail.assignments.length > 0 ? (
                        activeCgDetail.assignments.flatMap((member: any, i: number) => {
                          if (!member.assignments || member.assignments.length === 0) {
                            return [
                              <tr key={`${i}-empty`} className="border-b border-[#E5E6EB]">
                                <td className="py-2 px-3">{member.clientId || `consumer-${i + 1}`}</td>
                                <td className="py-2 px-3">-</td>
                                <td className="py-2 px-3">-</td>
                              </tr>
                            ];
                          }

                          return member.assignments.flatMap((assignment: any, j: number) => {
                            return [
                              <tr key={`${i}-${j}`} className="border-b border-[#E5E6EB]">
                                <td className="py-2 px-3" rowSpan={assignment.partitions?.length || 1}>{member.clientId || `consumer-${i + 1}`}</td>
                                <td className="py-2 px-3">{assignment.topic}</td>
                                <td className="py-2 px-3">{Array.isArray(assignment.partitions) ? assignment.partitions.join(', ') : '-'}</td>
                              </tr>
                            ];
                          });
                        })
                      ) : (
                        <tr>
                          <td colSpan={3} className="text-center py-10 text-[#86909C]">{t('kafka.noAllocation')}</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeCgTab === 'cg-reset' && (
            <div className="p-4 rounded-xl bg-white border border-[#E5E6EB] shadow-sm">
              <div className="text-xs text-[#86909C] mb-4">{t('kafka.resetOffsetInfo')}</div>
              <div className="grid grid-cols-[260px_1fr] gap-6">
                <div className="space-y-3 text-sm">
                  <div>
                    <div className="text-xs text-[#4E5969] mb-1">{t('kafka.resetStrategy')}</div>
                    <select className="w-full px-3 py-1.5 text-sm border border-[#E5E6EB] rounded-lg focus:outline-none focus:border-[#165DFF]">
                      <option>{t('kafka.resetToEarliest')}</option>
                      <option>{t('kafka.resetToLatest')}</option>
                      <option>{t('kafka.resetByTimestamp')}</option>
                      <option>{t('kafka.specifyOffset')}</option>
                    </select>
                  </div>
                  <div>
                    <div className="text-xs text-[#4E5969] mb-1">{t('kafka.timestampOrOffset')}</div>
                    <input
                      className="w-full px-3 py-1.5 text-sm border border-[#E5E6EB] rounded-lg focus:outline-none focus:border-[#165DFF]"
                      placeholder={t('kafka.timestampExample')}
                    />
                  </div>
                  <div className="flex gap-2 mt-4">
                    <button className="flex-1 px-3 py-1.5 text-sm rounded-lg border border-[#E5E6EB] bg-white hover:bg-[#F2F3F5] transition-colors">
                      {t('kafka.simulateExecution')}
                    </button>
                    <button className="flex-1 px-3 py-1.5 text-sm rounded-lg bg-[#165DFF] text-white hover:bg-[#4080FF] transition-colors">
                      {t('kafka.confirmReset')}
                    </button>
                  </div>
                </div>
                <div className="bg-[#F9FAFB] p-3 rounded-lg border border-[#E5E6EB]">
                  <div className="text-xs font-semibold text-[#4E5969] mb-2 uppercase">{t('kafka.operationPreview')}</div>
                  <div className="font-mono text-[10px] bg-white p-2 rounded border border-[#E5E6EB] whitespace-pre leading-relaxed">
{`# group: ${activeCg.id}
# topic: ${activeCg.topic}
# strategy: reset to timestamp >= 2026-01-07 10:00:00

partition 0: offset 468,210 -> 468,300
partition 1: offset 469,880 -> 469,950
partition 2: offset 465,840 -> 465,880`}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
