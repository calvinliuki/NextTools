'use client';

import { useLanguage } from '../../../../i18n/LanguageContext';

interface TopicDetailSectionProps {
  activeTopic: string;
  topicDetail: any;
  activeTopicTab: string;
  setActiveTopicTab: (value: string) => void;
  topicConsumers: any[];
  topicConsumersLoading: boolean;
  onRefreshConsumers: (topicName: string) => void;
  onBackToList: () => void;
  onDeleteTopic: (topicName: string) => void;
  onPullMessages: () => void;
  messages: any[];
  messagesLoading: boolean;
  msgFilterPartition: number | string;
  setMsgFilterPartition: (value: number | string) => void;
  msgFilterOffset: 'latest' | 'earliest';
  setMsgFilterOffset: (value: 'latest' | 'earliest') => void;
  msgFilterLimit: number;
  setMsgFilterLimit: (value: number) => void;
  prodPartition: number | string;
  setProdPartition: (value: number | string) => void;
  prodKey: string;
  setProdKey: (value: string) => void;
  prodValue: string;
  setProdValue: (value: string) => void;
  prodHeaders: string;
  setProdHeaders: (value: string) => void;
  onSendMessage: () => void;
  sending: boolean;
  onToast: (message: string, type: 'success' | 'error' | 'info') => void;
  onCgClick: (groupId: string, topic: string) => void;
}

export default function TopicDetailSection({
  activeTopic,
  topicDetail,
  activeTopicTab,
  setActiveTopicTab,
  topicConsumers,
  topicConsumersLoading,
  onRefreshConsumers,
  onBackToList,
  onDeleteTopic,
  onPullMessages,
  messages,
  messagesLoading,
  msgFilterPartition,
  setMsgFilterPartition,
  msgFilterOffset,
  setMsgFilterOffset,
  msgFilterLimit,
  setMsgFilterLimit,
  prodPartition,
  setProdPartition,
  prodKey,
  setProdKey,
  prodValue,
  setProdValue,
  prodHeaders,
  setProdHeaders,
  onSendMessage,
  sending,
  onToast,
  onCgClick,
}: TopicDetailSectionProps) {
  const { t } = useLanguage();
  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">Topic: <span className="text-[#165DFF]">{activeTopic}</span></h2>
          <span className="text-xs px-2 py-0.5 rounded-full bg-[#F2F3F5] text-[#4E5969]">
            {topicDetail?.isInternal ? 'Internal Topic' : 'User Topic'}
          </span>
        </div>
        <div className="flex gap-2">
          <button
            className="px-3 py-1.5 text-sm rounded-lg border border-[#E5E6EB] bg-white hover:bg-[#FFECE8] hover:text-[#F53F3F] transition-colors"
            onClick={() => onDeleteTopic(activeTopic)}
          >
            {t('kafka.deleteTopic')}
          </button>
          <button className="px-3 py-1.5 text-sm rounded-lg border border-[#E5E6EB] bg-white hover:bg-[#F2F3F5] transition-colors">
            {t('kafka.modifyConfig')}
          </button>
          <button
            className="px-3 py-1.5 text-sm rounded-lg border border-[#E5E6EB] bg-white hover:bg-[#F2F3F5] transition-colors"
            onClick={onBackToList}
          >
            {t('kafka.backToList')}
          </button>
        </div>
      </div>

      <div className="p-4 rounded-xl bg-white border border-[#E5E6EB] shadow-sm">
        <div className="grid grid-cols-6 gap-4 text-sm">
          <div>
            <div className="text-xs text-[#86909C] uppercase mb-1">Partitions</div>
            <div className="font-medium">{topicDetail?.partitions?.length || 0}</div>
          </div>
          <div>
            <div className="text-xs text-[#86909C] uppercase mb-1">Replication factor</div>
            <div className="font-medium">{topicDetail?.replicationFactor || 0}</div>
          </div>
          <div>
            <div className="text-xs text-[#86909C] uppercase mb-1">Total Messages</div>
            <div className="font-medium">{topicDetail?.totalMessages?.toLocaleString() || 0}</div>
          </div>
          <div>
            <div className="text-xs text-[#86909C] uppercase mb-1">Cleanup policy</div>
            <div className="font-medium">
              {topicDetail?.configs?.find((c: any) => c.name === 'cleanup.policy')?.value || 'delete'}
            </div>
          </div>
          <div>
            <div className="text-xs text-[#86909C] uppercase mb-1">Min ISR</div>
            <div className="font-medium">
              {topicDetail?.configs?.find((c: any) => c.name === 'min.insync.replicas')?.value || '1'}
            </div>
          </div>
          <div>
            <div className="text-xs text-[#86909C] uppercase mb-1">Retention</div>
            <div className="font-medium">
              {Math.round(parseInt(topicDetail?.configs?.find((c: any) => c.name === 'retention.ms')?.value || '0') / 3600000)}h
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-2 border-b border-[#E5E6EB]">
          {[
            { id: 'overview', label: 'Overview' },
            { id: 'partitions', label: 'Partitions' },
            { id: 'messages', label: 'Messages', badge: 'Browser' },
            { id: 'consumers', label: 'Consumers' },
            { id: 'produce', label: 'Produce', badge: t('kafka.manualWrite') },
          ].map(tab => (
            <button
              key={tab.id}
              className={`px-4 py-2 text-sm transition-colors relative ${
                activeTopicTab === tab.id
                  ? 'text-[#165DFF] font-medium after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-[#165DFF]'
                  : 'text-[#4E5969] hover:text-[#1D2129]'
              }`}
              onClick={() => setActiveTopicTab(tab.id)}
            >
              {tab.label}
              {tab.badge && (
                <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded-full bg-[#F2F3F5] text-[#86909C]">
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="min-h-[200px]">
          {activeTopicTab === 'overview' && (
            <div className="grid grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-white border border-[#E5E6EB] shadow-sm">
                <div className="text-xs text-[#86909C] mb-1">Topic 详情概览</div>
                <div className="text-lg font-semibold mb-3">{activeTopic}</div>
                <div className="space-y-1.5 text-xs text-[#4E5969]">
                  <div>Internal: {topicDetail?.isInternal ? 'Yes' : 'No'}</div>
                  <div>Cleanup Policy: {topicDetail?.configs?.find((c: any) => c.name === 'cleanup.policy')?.value || 'delete'}</div>
                  <div>Retention: {Math.round(parseInt(topicDetail?.configs?.find((c: any) => c.name === 'retention.ms')?.value || '0') / 3600000)} hours</div>
                </div>
              </div>
              <div className="p-4 rounded-xl bg-white border border-[#E5E6EB] shadow-sm">
                <div className="text-xs text-[#86909C] mb-1">Partition Overview</div>
                <div className="text-2xl font-semibold">{topicDetail?.partitions?.length || 0}</div>
                <div className="text-xs text-[#86909C] mt-1">Total partitions</div>
                <div className="mt-3 space-y-1">
                  {topicDetail?.partitions?.slice(0, 5).map((p: any) => (
                    <div key={p.id} className="text-xs flex justify-between">
                      <span>Partition {p.id}</span>
                      <span className={p.isr.length < p.replicas.length ? 'text-[#F53F3F]' : 'text-[#00B42A]'}>
                        Leader: {p.leader}
                      </span>
                    </div>
                  ))}
                  {topicDetail?.partitions?.length > 5 && (
                    <div className="text-[10px] text-[#86909C]">...及更多分区</div>
                  )}
                </div>
              </div>
              <div className="p-4 rounded-xl bg-white border border-[#E5E6EB] shadow-sm">
                <div className="text-xs text-[#86909C] mb-1">Message Stats</div>
                <div className="text-2xl font-semibold">{topicDetail?.totalMessages?.toLocaleString() || 0}</div>
                <div className="text-xs text-[#86909C] mt-1">Total messages</div>
                <div className="mt-3">
                  <div className="text-xs text-[#86909C]">Total size</div>
                  <div className="text-sm font-medium">{topicDetail?.totalSize || 'N/A'}</div>
                </div>
              </div>
            </div>
          )}

          {activeTopicTab === 'partitions' && (
            <div className="p-4 rounded-xl bg-white border border-[#E5E6EB] shadow-sm">
              <div className="mb-3 text-xs text-[#86909C]">查看每个 partition 的 leader / replicas / ISR 信息。</div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-[#F9FAFB] border-b border-[#E5E6EB]">
                    <tr>
                      <th className="text-left py-2 px-3 font-medium text-[#4E5969]">#</th>
                      <th className="text-left py-2 px-3 font-medium text-[#4E5969]">Leader</th>
                      <th className="text-left py-2 px-3 font-medium text-[#4E5969]">Replicas</th>
                      <th className="text-left py-2 px-3 font-medium text-[#4E5969]">ISR</th>
                      <th className="text-left py-2 px-3 font-medium text-[#4E5969]">Start Offset</th>
                      <th className="text-left py-2 px-3 font-medium text-[#4E5969]">End Offset</th>
                      <th className="text-left py-2 px-3 font-medium text-[#4E5969]">Messages</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topicDetail?.partitions?.map((p: any) => (
                      <tr key={p.id} className="border-b border-[#E5E6EB]">
                        <td className="py-2 px-3">{p.id}</td>
                        <td className="py-2 px-3">{p.leader}</td>
                        <td className="py-2 px-3">[{p.replicas.join(', ')}]</td>
                        <td className="py-2 px-3">[{p.isr.join(', ')}]</td>
                        <td className="py-2 px-3">{p.startOffset}</td>
                        <td className="py-2 px-3">{p.endOffset}</td>
                        <td className="py-2 px-3">{p.messageCount.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTopicTab === 'messages' && (
            <div className="p-4 rounded-xl bg-white border border-[#E5E6EB] shadow-sm">
              <div className="flex items-center gap-2 mb-4 flex-wrap">
                <select
                  className="px-3 py-1.5 text-sm border border-[#E5E6EB] rounded-lg focus:outline-none focus:border-[#165DFF]"
                  value={msgFilterPartition}
                  onChange={(e) => setMsgFilterPartition(e.target.value)}
                >
                  <option value="all">Partition: All</option>
                  {topicDetail?.partitions?.map((p: any) => (
                    <option key={p.id} value={p.id}>Partition: {p.id}</option>
                  ))}
                </select>
                <select
                  className="px-3 py-1.5 text-sm border border-[#E5E6EB] rounded-lg focus:outline-none focus:border-[#165DFF]"
                  value={msgFilterOffset}
                  onChange={(e) => setMsgFilterOffset(e.target.value as 'latest' | 'earliest')}
                >
                  <option value="latest">{t('kafka.startPosition')}: {t('kafka.latest')}</option>
                  <option value="earliest">{t('kafka.startPosition')}: {t('kafka.earliest')}</option>
                </select>
                <input
                  className="w-20 px-3 py-1.5 text-sm border border-[#E5E6EB] rounded-lg focus:outline-none focus:border-[#165DFF]"
                  placeholder={t('kafka.quantity')}
                  type="number"
                  value={msgFilterLimit}
                  onChange={(e) => setMsgFilterLimit(Number(e.target.value))}
                />
                <button
                  className="px-4 py-1.5 text-sm rounded-lg bg-[#165DFF] text-white hover:bg-[#4080FF] transition-colors"
                  onClick={onPullMessages}
                  disabled={messagesLoading}
                >
                  {messagesLoading && <i className="fas fa-spinner fa-spin mr-1"></i>}
                  {t('kafka.pullMessages')}
                </button>
              </div>

              <div className="space-y-2 max-h-[500px] overflow-auto">
                {messagesLoading && messages.length === 0 ? (
                  <div className="text-center py-10 text-[#86909C]">{t('kafka.fetchingLatestMessages')}</div>
                ) : messages.length > 0 ? (
                  messages.map((msg, i) => (
                    <div key={`${msg.offset}-${i}`} className="p-3 rounded-lg border border-[#E5E6EB] hover:border-[#165DFF] transition-colors">
                      <div className="flex justify-between items-center mb-2 text-xs text-[#86909C]">
                        <div className="flex gap-2">
                          <span>Partition {msg.partition}</span>
                          <span>Offset {msg.offset}</span>
                          {msg.key && <span>Key: <code>{msg.key}</code></span>}
                        </div>
                        <span className="px-2 py-0.5 rounded-full bg-[#F2F3F5]">
                          {new Date(Number(msg.timestamp)).toLocaleString()}
                        </span>
                      </div>
                      <div className="font-mono text-xs bg-[#F9FAFB] p-2 rounded border border-[#E5E6EB] whitespace-pre-wrap">
                        {msg.value}
                      </div>
                      {Object.keys(msg.headers || {}).length > 0 && (
                        <div className="mt-2 flex gap-1.5 flex-wrap">
                          {Object.entries(msg.headers).map(([k, v]) => (
                            <span key={k} className="text-[10px] bg-[#F2F3F5] px-1.5 py-0.5 rounded border border-[#E5E6EB]">
                              <span className="text-[#86909C]">{k}:</span> {String(v)}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="text-center py-10 text-[#86909C] italic">
                    {t('kafka.clickPullMessages')}
                  </div>
                )}
              </div>
              <div className="mt-3 text-xs text-[#86909C] italic">
                {t('kafka.pullLargeHistoryMessageWarning')} 支持 JSON 展示及消息 Header 查看。
              </div>
            </div>
          )}

          {activeTopicTab === 'produce' && (
            <div className="p-4 rounded-xl bg-white border border-[#E5E6EB] shadow-sm">
              <div className="text-xs text-[#86909C] mb-4">{t('kafka.writeMessageToTopic')}（生产消息）。</div>
              <div className="grid grid-cols-[260px_1fr] gap-6">
                <div className="space-y-3">
                  <div>
                    <div className="text-xs text-[#4E5969] mb-1">Topic</div>
                    <input
                      className="w-full px-3 py-1.5 text-sm border border-[#E5E6EB] rounded-lg bg-[#F9FAFB]"
                      value={activeTopic}
                      readOnly
                    />
                  </div>
                  <div>
                    <div className="text-xs text-[#4E5969] mb-1">Partition</div>
                    <select
                      className="w-full px-3 py-1.5 text-sm border border-[#E5E6EB] rounded-lg focus:outline-none focus:border-[#165DFF]"
                      value={prodPartition}
                      onChange={(e) => setProdPartition(e.target.value)}
                    >
                      <option value="auto">{t('kafka.brokerAssign')}</option>
                      {topicDetail?.partitions?.map((p: any) => (
                        <option key={p.id} value={p.id}>Partition: {p.id}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <div className="text-xs text-[#4E5969] mb-1">Key（可选）</div>
                    <input
                      className="w-full px-3 py-1.5 text-sm border border-[#E5E6EB] rounded-lg focus:outline-none focus:border-[#165DFF]"
                      placeholder="例如 order-102938"
                      value={prodKey}
                      onChange={(e) => setProdKey(e.target.value)}
                    />
                  </div>
                  <div>
                    <div className="text-xs text-[#4E5969] mb-1">Headers（可选，key:value 多行）</div>
                    <textarea
                      className="w-full px-3 py-1.5 text-xs border border-[#E5E6EB] rounded-lg focus:outline-none focus:border-[#165DFF] resize-none font-mono"
                      style={{ minHeight: '80px' }}
                      placeholder="x-trace-id: 123456\nx-source: next-tools\nevent-type: user-action"
                      value={prodHeaders}
                      onChange={(e) => setProdHeaders(e.target.value)}
                    ></textarea>
                    <div className="text-[10px] text-[#86909C] mt-1">每行一个 header，格式为 key:value</div>
                  </div>

                  <div className="flex justify-end mt-2">
                    <button
                      className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
                      onClick={() => {
                        setProdKey('');
                        setProdValue('');
                        setProdHeaders('');
                        setProdPartition('auto');
                      }}
                    >
                      {t('kafka.clearForm')}
                    </button>
                  </div>
                </div>

                <div className="flex flex-col">
                  <div className="text-xs text-[#4E5969] mb-2">Message Value</div>
                  <textarea
                    className="flex-1 w-full min-h-[200px] p-3 rounded-lg border border-[#E5E6EB] text-xs font-mono resize-none focus:outline-none focus:border-[#165DFF]"
                    placeholder='{"id": 1, "data": "..."}'
                    value={prodValue}
                    onChange={(e) => setProdValue(e.target.value)}
                  ></textarea>
                  <div className="flex justify-between items-center mt-2">
                    <span className="text-xs text-[#86909C]">建议发送标准 JSON 格式数据。</span>
                    <div className="flex gap-2">
                      <button
                        className="px-3 py-1.5 text-sm rounded-lg border border-[#E5E6EB] bg-white hover:bg-[#F2F3F5] transition-colors"
                        onClick={() => {
                          try {
                            setProdValue(JSON.stringify(JSON.parse(prodValue), null, 2));
                          } catch (e) {
                            onToast(t('kafka.invalidFormat'), 'error');
                          }
                        }}
                      >
                        {t('kafka.formatJson')}
                      </button>
                      <button
                        className="px-3 py-1.5 text-sm rounded-lg border border-[#E5E6EB] bg-white hover:bg-[#F2F3F5] transition-colors"
                        onClick={() => {
                          try {
                            JSON.parse(prodValue);
                            onToast(t('kafka.validFormat'), 'success');
                          } catch (e) {
                            onToast(t('kafka.invalidFormat'), 'error');
                          }
                        }}
                      >
                        {t('kafka.validateJson')}
                      </button>
                      <button
                        className="px-4 py-1.5 text-sm rounded-lg bg-[#165DFF] text-white hover:bg-[#4080FF] transition-colors"
                        onClick={onSendMessage}
                        disabled={sending}
                      >
                        {sending && <i className="fas fa-spinner fa-spin mr-1"></i>}
                        {t('kafka.sendMessage')}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTopicTab === 'consumers' && (
            <div className="p-4 rounded-xl bg-white border border-[#E5E6EB] shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div className="text-xs text-[#86909C]">显示订阅该 topic 的 consumer group 及其 lag。</div>
                <button
                  className="px-3 py-1.5 text-sm rounded-lg border border-[#E5E6EB] bg-white hover:bg-[#F2F3F5] transition-colors"
                  onClick={() => onRefreshConsumers(activeTopic)}
                >
                  {t('sessionManager.refresh')}
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-[#F9FAFB] border-b border-[#E5E6EB]">
                    <tr>
                      <th className="text-left py-2 px-3 font-medium text-[#4E5969]">Group</th>
                      <th className="text-left py-2 px-3 font-medium text-[#4E5969]">Members</th>
                      <th className="text-left py-2 px-3 font-medium text-[#4E5969]">Lag</th>
                      <th className="text-left py-2 px-3 font-medium text-[#4E5969]">{t('kafka.statusLabel')}</th>
                      <th className="text-left py-2 px-3 font-medium text-[#4E5969]">{t('kafka.operationLabel')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topicConsumersLoading && topicConsumers.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="text-center py-10 text-[#86909C]">{t('kafka.fetchingConsumers')}</td>
                      </tr>
                    ) : topicConsumers.length > 0 ? (
                      topicConsumers.map((cg) => (
                        <tr key={cg.groupId} className="border-b border-[#E5E6EB] hover:bg-[#F9FAFB]">
                          <td className="py-2.5 px-3 font-medium text-[#165DFF]">{cg.groupId}</td>
                          <td className="py-2.5 px-3">{cg.members}</td>
                          <td className={`py-2.5 px-3 ${cg.totalLag > 0 ? 'text-[#F53F3F] font-semibold' : ''}`}>
                            {cg.totalLag.toLocaleString()}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-xs ${
                              cg.state === 'Stable'
                                ? 'bg-[#E8FFEA] border-[#AFF0B5] text-[#00B42A]'
                                : 'bg-[#FFFBE6] border-[#FFE4BA] text-[#FF7D00]'
                            }`}>
                              <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                                cg.state === 'Stable' ? 'bg-[#00B42A]' : 'bg-[#FF7D00]'
                              }`} />
                              {cg.state}
                            </span>
                          </td>
                          <td className="py-2.5 px-3">
                            <button
                              className="px-3 py-1 text-xs rounded-lg border border-[#E5E6EB] bg-white hover:bg-[#F2F3F5] transition-colors"
                              onClick={() => onCgClick(cg.groupId, activeTopic)}
                            >
                              {t('kafka.detailsResetOffset')}
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="text-center py-10 text-[#86909C]">{t('kafka.noActiveConsumers')}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
