'use client';

import { useState, useEffect, useRef } from 'react';
import { useLanguage } from '@/i18n/LanguageContext';
import KafkaSidebar from './tab/KafkaSidebar';
import KafkaHeader from './tab/KafkaHeader';
import DashboardSection from './sections/DashboardSection';
import TopicsSection from './sections/TopicsSection';
import TopicDetailSection from './sections/TopicDetailSection';
import ConsumerGroupsSection from './sections/ConsumerGroupsSection';
import ConsumerGroupDetailSection from './sections/ConsumerGroupDetailSection';
import PlaceholderSection from './sections/PlaceholderSection';
import CreateTopicDialog from './dialogs/CreateTopicDialog';
import DeleteTopicDialog from './dialogs/DeleteTopicDialog';
import ToastContainer from './ToastContainer';
import { KafkaSection, KafkaSidebarItem, KafkaToast } from './tab/types';

interface KafkaTabProps {
  connectionId: string;
  connectionName: string;
}

export default function KafkaTab({ connectionId, connectionName }: KafkaTabProps) {
  const { t } = useLanguage();
  const [activeSection, setActiveSection] = useState<KafkaSection>('dashboard');
  const [activeTopic, setActiveTopic] = useState<string>('');
  const [activeCg, setActiveCg] = useState<{ id: string; topic: string }>({ id: '', topic: '' });
  const [activeCgDetail, setActiveCgDetail] = useState<any>(null);
  const [activeCgDetailLoading, setActiveCgDetailLoading] = useState(false);
  const [activeTopicTab, setActiveTopicTab] = useState('overview');
  const [activeCgTab, setActiveCgTab] = useState('cg-members');
  const [clusterInfo, setClusterInfo] = useState<any>(null);
  const [topics, setTopics] = useState<any[]>([]);
  const [topicsLoading, setTopicsLoading] = useState(false);
  const [topicDetail, setTopicDetail] = useState<any>(null);
  const [topicConsumers, setTopicConsumers] = useState<any[]>([]);
  const [topicConsumersLoading, setTopicConsumersLoading] = useState(false);
  const [allConsumerGroups, setAllConsumerGroups] = useState<any[]>([]);
  const [allCgLoading, setAllCgLoading] = useState(false);
  const [messages, setMessages] = useState<any[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [msgFilterPartition, setMsgFilterPartition] = useState<number | string>('all');
  const [msgFilterOffset, setMsgFilterOffset] = useState<'latest' | 'earliest'>('latest');
  const [msgFilterLimit, setMsgFilterLimit] = useState(50);
  const [prodPartition, setProdPartition] = useState<number | string>('auto');
  const [prodKey, setProdKey] = useState('');
  const [prodValue, setProdValue] = useState('');
  const [prodHeaders, setProdHeaders] = useState('');
  const [sending, setSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [hideInternal, setHideInternal] = useState(true);
  const [showCreateTopicDialog, setShowCreateTopicDialog] = useState(false);
  const [newTopicName, setNewTopicName] = useState('');
  const [newTopicPartitions, setNewTopicPartitions] = useState(1);
  const [newTopicReplication, setNewTopicReplication] = useState(1);
  const [creatingTopic, setCreatingTopic] = useState(false);
  const [deleteTopicDialogOpen, setDeleteTopicDialogOpen] = useState(false);
  const [topicToDelete, setTopicToDelete] = useState<{ name: string } | null>(null);
  const [toasts, setToasts] = useState<KafkaToast[]>([]);
  const lastFetchedId = useRef<string | null>(null);

  const fetchClusterInfo = async (force = false) => {
    if (!connectionId) return;
    if (!force && lastFetchedId.current === connectionId) return;

    lastFetchedId.current = connectionId;
    try {
      const response = await fetch(`/api/kafka/cluster`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionId }),
      });
      const result = await response.json();
      if (result.code === 200) {
        setClusterInfo(result.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchTopics = async () => {
    if (!connectionId) return;
    setTopicsLoading(true);
    try {
      const response = await fetch(`/api/kafka/topics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionId }),
      });
      const result = await response.json();
      if (result.code === 200) {
        setTopics(result.data);
      }
    } catch (err) {
      console.error('Failed to fetch topics:', err);
    } finally {
      setTopicsLoading(false);
    }
  };

  const fetchTopicDetail = async (topicName: string) => {
    if (!connectionId || !topicName) return;
    try {
      const response = await fetch(`/api/kafka/topic-detail`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionId, topicName }),
      });
      const result = await response.json();
      if (result.code === 200) {
        setTopicDetail(result.data);
      }
    } catch (err) {
      console.error('Failed to fetch topic detail:', err);
    }
  };

  const fetchTopicConsumers = async (topicName: string) => {
    if (!connectionId || !topicName) return;
    setTopicConsumersLoading(true);
    try {
      const response = await fetch(`/api/kafka/topic-consumers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionId, topicName }),
      });
      const result = await response.json();
      if (result.code === 200) {
        setTopicConsumers(result.data);
      }
    } catch (err) {
      console.error('Failed to fetch topic consumers:', err);
    } finally {
      setTopicConsumersLoading(false);
    }
  };

  const pullMessages = async () => {
    if (!connectionId || !activeTopic) return;
    setMessagesLoading(true);
    try {
      const response = await fetch(`/api/kafka/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connectionId,
          topic: activeTopic,
          partition: msgFilterPartition === 'all' ? undefined : Number(msgFilterPartition),
          startOffset: msgFilterOffset,
          limit: msgFilterLimit
        }),
      });
      const result = await response.json();
      if (result.code === 200) {
        setMessages(result.data);
      }
    } catch (err) {
      console.error('Failed to pull messages:', err);
    } finally {
      setMessagesLoading(false);
    }
  };

  const fetchAllConsumerGroups = async () => {
    if (!connectionId) return;
    setAllCgLoading(true);
    try {
      const response = await fetch(`/api/kafka/consumer-groups`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionId }),
      });
      const result = await response.json();
      if (result.code === 200) {
        setAllConsumerGroups(result.data);
      }
    } catch (err) {
      console.error('Failed to fetch consumer groups:', err);
    } finally {
      setAllCgLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!connectionId || !activeTopic || !prodValue) {
      showToast(t('kafka.inputMessageContent'), 'error');
      return;
    }

    setSending(true);
    try {
      const headers: Record<string, string> = {};
      prodHeaders.split('\n').forEach(line => {
        const [k, v] = line.split(':');
        if (k && v) headers[k.trim()] = v.trim();
      });

      const response = await fetch(`/api/kafka/messages/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connectionId,
          topic: activeTopic,
          partition: prodPartition === 'auto' ? undefined : Number(prodPartition),
          key: prodKey || undefined,
          value: prodValue,
          headers
        }),
      });
      const result = await response.json();
      if (result.code === 200) {
        showToast(t('kafka.messageSentSuccessfully'), 'success');
        setProdValue('');
      } else {
        showToast(t('kafka.sendFailed', { message: result.message }), 'error');
      }
    } catch (err) {
      console.error('Failed to send message:', err);
      showToast(t('kafka.sendMessageError'), 'error');
    } finally {
      setSending(false);
    }
  };

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, message, type }]);

    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  };

  const handleCreateTopic = async () => {
    if (!connectionId || !newTopicName) {
      showToast(t('kafka.inputTopicName'), 'error');
      return;
    }

    setCreatingTopic(true);
    try {
      const response = await fetch('/api/kafka/topics/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connectionId,
          name: newTopicName,
          numPartitions: newTopicPartitions,
          replicationFactor: newTopicReplication,
        }),
      });
      const result = await response.json();
      if (result.code === 200) {
        showToast(t('kafka.topicCreatedSuccessfully'), 'success');
        setShowCreateTopicDialog(false);
        await fetchTopics();
        setNewTopicName('');
        setNewTopicPartitions(1);
        setNewTopicReplication(1);
      } else {
        showToast(t('kafka.creationFailed', { message: result.message }), 'error');
      }
    } catch (err) {
      console.error('Failed to create topic:', err);
      showToast(t('kafka.createTopicError'), 'error');
    } finally {
      setCreatingTopic(false);
    }
  };

  const handleDeleteTopic = async () => {
    if (!connectionId || !topicToDelete) return;

    try {
      const response = await fetch('/api/kafka/topics/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionId, topicName: topicToDelete.name }),
      });
      const result = await response.json();
      if (result.code === 200) {
        showToast(t('kafka.deleteSuccessful'), 'success');
        await fetchTopics();
        if (activeTopic === topicToDelete.name) {
          setActiveSection('topics');
          setActiveTopic('');
        }
      } else {
        showToast(t('kafka.deleteFailed', { message: result.message }), 'error');
      }
    } catch (err) {
      console.error('Failed to delete topic:', err);
      showToast(t('kafka.deleteTopicError'), 'error');
    } finally {
      setDeleteTopicDialogOpen(false);
      setTopicToDelete(null);
    }
  };

  useEffect(() => {
    console.log('KafkaTab useEffect', connectionId);
    fetchClusterInfo();
  }, [connectionId]);

  useEffect(() => {
    if (activeSection === 'topic-detail' && activeTopic) {
      if (activeTopicTab === 'messages' && messages.length === 0) {
        pullMessages();
      } else if (activeTopicTab === 'consumers') {
        fetchTopicConsumers(activeTopic);
      }
    }
  }, [activeSection, activeTopic, activeTopicTab]);

  useEffect(() => {
    if (activeSection === 'topics') {
      fetchTopics();
    } else if (activeSection === 'topic-detail' && activeTopic) {
      fetchTopicDetail(activeTopic);
    } else if (activeSection === 'consumer-groups') {
      fetchAllConsumerGroups();
    }
  }, [activeSection, connectionId, activeTopic]);

  const filteredTopics = topics.filter(t => {
    const matchesSearch = t.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesInternal = hideInternal ? !t.isInternal : true;
    return matchesSearch && matchesInternal;
  });

  const sidebarItems: KafkaSidebarItem[] = [
    { id: 'dashboard', label: t('kafka.dashboardLabel'), icon: '🏠' },
    { id: 'topics', label: t('kafka.topics'), icon: '🧵' },
    { id: 'consumer-groups', label: t('kafka.consumerGroups'), icon: '👥' },
  ];

  const handleTopicClick = (topicName: string) => {
    setActiveTopic(topicName);
    setActiveSection('topic-detail');
  };

  const fetchCgDetail = async (groupId: string) => {
    if (!connectionId || !groupId) return;
    setActiveCgDetailLoading(true);
    try {
      const response = await fetch(`/api/kafka/consumer-groups/detail`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionId, groupId }),
      });
      const result = await response.json();
      if (result.code === 200) {
        setActiveCgDetail(result.data);
      }
    } catch (err) {
      console.error('Failed to fetch consumer group detail:', err);
    } finally {
      setActiveCgDetailLoading(false);
    }
  };

  const handleCgClick = (groupId: string, topic: string) => {
    setActiveCg({ id: groupId, topic });
    setActiveSection('consumer-group-detail');
    fetchCgDetail(groupId);
  };

  const resetCreateTopicForm = () => {
    setShowCreateTopicDialog(false);
    setNewTopicName('');
    setNewTopicPartitions(1);
    setNewTopicReplication(1);
  };

  const handleOpenCreateTopicDialog = () => {
    setShowCreateTopicDialog(true);
    setNewTopicName('');
    setNewTopicPartitions(1);
    setNewTopicReplication(1);
  };

  const handleRequestDeleteTopic = (topic: { name: string } | string) => {
    if (typeof topic === 'string') {
      setTopicToDelete({ name: topic });
    } else {
      setTopicToDelete(topic);
    }
    setDeleteTopicDialogOpen(true);
  };

  return (
    <>
      <style jsx global>{`
        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        .animate-slide-in {
          animation: slideIn 0.3s ease-out;
        }
      `}</style>
      <div className="flex h-full w-full bg-[#F9FAFB] overflow-hidden">
        <KafkaSidebar
          items={sidebarItems}
          activeSection={activeSection}
          onSelect={setActiveSection}
          connectionName={connectionName}
          clusterInfo={clusterInfo}
        />

        <main className="flex-1 flex flex-col overflow-hidden">
          <KafkaHeader connectionName={connectionName} clusterInfo={clusterInfo} />

          <div className="flex-1 p-6 overflow-auto">
            <div className="max-w-7xl mx-auto">
              {activeSection === 'dashboard' && (
                <DashboardSection
                  connectionName={connectionName}
                  clusterInfo={clusterInfo}
                  onRefresh={() => fetchClusterInfo(true)}
                  onCgClick={handleCgClick}
                />
              )}

              {activeSection === 'topics' && (
                <TopicsSection
                  topics={topics}
                  topicsLoading={topicsLoading}
                  filteredTopics={filteredTopics}
                  searchQuery={searchQuery}
                  setSearchQuery={setSearchQuery}
                  hideInternal={hideInternal}
                  setHideInternal={setHideInternal}
                  onRefresh={fetchTopics}
                  onCreateTopic={handleOpenCreateTopicDialog}
                  onTopicClick={handleTopicClick}
                  onDeleteTopic={handleRequestDeleteTopic}
                />
              )}

              {activeSection === 'topic-detail' && (
                <TopicDetailSection
                  activeTopic={activeTopic}
                  topicDetail={topicDetail}
                  activeTopicTab={activeTopicTab}
                  setActiveTopicTab={setActiveTopicTab}
                  topicConsumers={topicConsumers}
                  topicConsumersLoading={topicConsumersLoading}
                  onRefreshConsumers={fetchTopicConsumers}
                  onBackToList={() => setActiveSection('topics')}
                  onDeleteTopic={handleRequestDeleteTopic}
                  onPullMessages={pullMessages}
                  messages={messages}
                  messagesLoading={messagesLoading}
                  msgFilterPartition={msgFilterPartition}
                  setMsgFilterPartition={setMsgFilterPartition}
                  msgFilterOffset={msgFilterOffset}
                  setMsgFilterOffset={setMsgFilterOffset}
                  msgFilterLimit={msgFilterLimit}
                  setMsgFilterLimit={setMsgFilterLimit}
                  prodPartition={prodPartition}
                  setProdPartition={setProdPartition}
                  prodKey={prodKey}
                  setProdKey={setProdKey}
                  prodValue={prodValue}
                  setProdValue={setProdValue}
                  prodHeaders={prodHeaders}
                  setProdHeaders={setProdHeaders}
                  onSendMessage={handleSendMessage}
                  sending={sending}
                  onToast={showToast}
                  onCgClick={handleCgClick}
                />
              )}

              {activeSection === 'consumer-groups' && (
                <ConsumerGroupsSection
                  allConsumerGroups={allConsumerGroups}
                  allCgLoading={allCgLoading}
                  onRefresh={fetchAllConsumerGroups}
                  onCgClick={handleCgClick}
                />
              )}

              {activeSection === 'consumer-group-detail' && (
                <ConsumerGroupDetailSection
                  activeCg={activeCg}
                  activeCgDetail={activeCgDetail}
                  activeCgDetailLoading={activeCgDetailLoading}
                  activeCgTab={activeCgTab}
                  setActiveCgTab={setActiveCgTab}
                  onBack={() => setActiveSection('consumer-groups')}
                />
              )}

              {['schemas', 'connectors'].includes(activeSection) && (
                <PlaceholderSection title={activeSection} />
              )}
            </div>
          </div>
        </main>

        <CreateTopicDialog
          isOpen={showCreateTopicDialog}
          newTopicName={newTopicName}
          setNewTopicName={setNewTopicName}
          newTopicPartitions={newTopicPartitions}
          setNewTopicPartitions={setNewTopicPartitions}
          newTopicReplication={newTopicReplication}
          setNewTopicReplication={setNewTopicReplication}
          creatingTopic={creatingTopic}
          onClose={resetCreateTopicForm}
          onCreate={handleCreateTopic}
        />

        <DeleteTopicDialog
          isOpen={deleteTopicDialogOpen}
          topicName={topicToDelete?.name || null}
          onClose={() => {
            setDeleteTopicDialogOpen(false);
            setTopicToDelete(null);
          }}
          onConfirm={handleDeleteTopic}
        />

        <ToastContainer
          toasts={toasts}
          onDismiss={(id) => setToasts(prev => prev.filter(t => t.id !== id))}
        />
      </div>
    </>
  );
}
