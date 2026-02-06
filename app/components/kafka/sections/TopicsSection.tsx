'use client';

import { useLanguage } from '../../../../i18n/LanguageContext';

interface TopicsSectionProps {
  topics: any[];
  topicsLoading: boolean;
  filteredTopics: any[];
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  hideInternal: boolean;
  setHideInternal: (value: boolean) => void;
  onRefresh: () => void;
  onCreateTopic: () => void;
  onTopicClick: (topicName: string) => void;
  onDeleteTopic: (topic: any) => void;
}

export default function TopicsSection({
  topics,
  topicsLoading,
  filteredTopics,
  searchQuery,
  setSearchQuery,
  hideInternal,
  setHideInternal,
  onRefresh,
  onCreateTopic,
  onTopicClick,
  onDeleteTopic,
}: TopicsSectionProps) {
  const { t } = useLanguage();
  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">Topics</h2>
          <span className="text-xs px-2 py-0.5 rounded-full bg-[#F2F3F5] text-[#4E5969]">
            {topics.length} topics • {topics.reduce((acc, t) => acc + t.partitions, 0)} partitions
          </span>
        </div>
        <div className="flex gap-2">
          <button
            className="px-3 py-1.5 text-sm rounded-lg border border-[#E5E6EB] bg-white hover:bg-[#F2F3F5] transition-colors"
            onClick={onRefresh}
          >
            {topicsLoading && <i className="fas fa-spinner fa-spin mr-1"></i>}
            {t('sessionManager.refresh')}
          </button>
          <button
            className="px-3 py-1.5 text-sm rounded-lg bg-[#165DFF] text-white hover:bg-[#4080FF] transition-colors"
            onClick={onCreateTopic}
          >
            {t('kafka.createTopic')}
          </button>
        </div>
      </div>

      <div className="p-4 rounded-xl bg-white border border-[#E5E6EB] shadow-sm">
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <input
            className="px-3 py-1.5 text-sm border border-[#E5E6EB] rounded-lg focus:outline-none focus:border-[#165DFF] min-w-[220px]"
            placeholder={t('kafka.searchTopicName')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <label className="flex items-center gap-1.5 text-xs text-[#4E5969] cursor-pointer">
            <input
              type="checkbox"
              checked={hideInternal}
              onChange={(e) => setHideInternal(e.target.checked)}
              className="rounded"
            />
            {t('kafka.hideInternalTopics')}
          </label>
          <select className="px-3 py-1.5 text-sm border border-[#E5E6EB] rounded-lg focus:outline-none focus:border-[#165DFF] min-w-[180px]">
            <option>{t('kafka.sortBy')}</option>
            <option>{t('kafka.sortByPartitions')}</option>
            <option>{t('kafka.sortByCreateTime')}</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[#F9FAFB] border-b border-[#E5E6EB]">
              <tr>
                <th className="text-left py-2 px-3 font-medium text-[#4E5969]">Topic</th>
                <th className="text-left py-2 px-3 font-medium text-[#4E5969]">Partitions</th>
                <th className="text-left py-2 px-3 font-medium text-[#4E5969]">Replication</th>
                <th className="text-left py-2 px-3 font-medium text-[#4E5969]">{t('kafka.cleanupPolicyLabel')}</th>
                <th className="text-left py-2 px-3 font-medium text-[#4E5969]">{t('kafka.statusLabel')}</th>
                <th className="text-left py-2 px-3 font-medium text-[#4E5969]">{t('kafka.operationLabel')}</th>
              </tr>
            </thead>
            <tbody>
              {topicsLoading && filteredTopics.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-[#86909C]">
                    {t('kafka.fetchingTopicList')}
                  </td>
                </tr>
              ) : filteredTopics.length > 0 ? (
                filteredTopics.map((topic) => (
                  <tr
                    key={topic.name}
                    className="border-b border-[#E5E6EB] hover:bg-[#F9FAFB] transition-colors"
                  >
                    <td className="py-2 px-3 font-medium text-[#165DFF] cursor-pointer" onClick={() => onTopicClick(topic.name)}>{topic.name}</td>
                    <td className="py-2 px-3">{topic.partitions}</td>
                    <td className="py-2 px-3">{topic.replicationFactor}</td>
                    <td className="py-2 px-3">
                      <span className="px-2 py-0.5 text-xs rounded-full bg-[#F2F3F5] border border-[#E5E6EB]">
                        {topic.cleanupPolicy}
                      </span>
                    </td>
                    <td className="py-2 px-3">
                      <span className={`px-2 py-0.5 text-xs rounded-full ${
                        topic.status === 'Under-replicated'
                          ? 'bg-[#FFECE8] text-[#F53F3F]'
                          : 'bg-[#E8FFEA] text-[#00B42A]'
                      }`}>
                        {topic.status}
                      </span>
                    </td>
                    <td className="py-2 px-3">
                      <button
                        className="px-2 py-1 text-xs rounded-lg border border-[#E5E6EB] bg-white hover:bg-[#F2F3F5] hover:text-[#F53F3F] transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteTopic(topic);
                        }}
                      >
                        {t('kafka.deleteAction')}
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-[#86909C]">
                    {t('kafka.noMatchingTopics')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="mt-3 text-xs text-[#86909C] italic">
          {t('kafka.clickTopicRowInfo')}
        </div>
      </div>
    </div>
  );
}
