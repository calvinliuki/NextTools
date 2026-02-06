'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useLanguage } from '../../i18n/LanguageContext';
import { useRouter } from 'next/navigation';
import SessionManager from '../components/SessionManager';
import RedisTab from '../components/redis/RedisTab';
import SSHTab from '../components/ssh/SSHTab';
import KafkaTab from '../components/kafka/KafkaTab';
import ZooKeeperTab from '../components/zookeeper/ZooKeeperTab';
import ElasticTab from '../components/elastic/ElasticTab';
import DatabaseTab from '../components/database/DatabaseTab';
import HttpTab from '../components/postman/PostmanTab';
import { connectionDataManager } from '@/lib/connectionCache';

interface Tab {
  id: string;
  title: string;
  clientType: string;
  sessionName: string;
  icon: string;
  color: string;
  // Redis 连接 ID
  connectionId?: string;
  // 添加状态字段，用于保存tab内部的操作数据
  state?: {
    commandHistory?: string[];  // 命令历史
    currentInput?: string;       // 当前输入
    outputData?: any[];          // 输出数据
    scrollPosition?: number;     // 滚动位置
    connectionStatus?: 'connected' | 'disconnected' | 'connecting';
    customData?: any;            // 其他自定义数据
  };
}

export default function WorkspacePage() {
  const { t } = useLanguage();
  const router = useRouter();
  const [isSessionManagerOpen, setIsSessionManagerOpen] = useState(false);
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(true); // 默认全屏（浏览器模式）
  const [isElectron, setIsElectron] = useState(false);
  
  // 为每个 SSH tab 创建 ref
  const sshTabRefs = useRef<Map<string, { closeConnection: () => void }>>(new Map());

  // 页面加载时加载所有连接数据
  useEffect(() => {
    const loadInitialConnections = async () => {
      try {
        // 从统一 API 加载所有连接
        const response = await fetch('/api/connections/all');
        const result = await response.json();
        
        if (result.code === 200 && result.data) {
          console.log('所有连接加载成功:', 
            (result.data.ssh?.length || 0) + 
            (result.data.redis?.length || 0) + 
            (result.data.kafka?.length || 0), 
            '个连接');
            
          // 将连接数据存储到全局缓存中，以便 SessionManager 可以直接使用
          if (result.data.ssh) connectionDataManager.setSSHConnections(result.data.ssh);
          if (result.data.redis) connectionDataManager.setRedisConnections(result.data.redis);
          if (result.data.kafka) connectionDataManager.setKafkaConnections(result.data.kafka);
          if (result.data.zookeeper) connectionDataManager.setZooKeeperConnections(result.data.zookeeper);
          if (result.data.elastic) connectionDataManager.setElasticConnections(result.data.elastic);
          if (result.data.database) connectionDataManager.setDatabaseConnections(result.data.database);
          if (result.data.http) connectionDataManager.setHttpConnections(result.data.http);
        } else {
          console.error('加载连接失败:', result.message);
        }
      } catch (error) {
        console.error('加载连接时发生错误:', error);
      }
    };

    loadInitialConnections();
  }, []);

  // 从 localStorage 加载 tabs 状态
  useEffect(() => {
    const savedTabs = localStorage.getItem('workspace-tabs');
    const savedActiveTabId = localStorage.getItem('workspace-active-tab');
    
    if (savedTabs) {
      try {
        const parsedTabs = JSON.parse(savedTabs);
        setTabs(parsedTabs);
      } catch (e) {
        console.error('Failed to parse saved tabs:', e);
      }
    }
    
    if (savedActiveTabId) {
      setActiveTabId(savedActiveTabId);
    }
    
    setMounted(true);
  }, []);

  // 保存 tabs 状态到 localStorage
  useEffect(() => {
    if (mounted) {
      localStorage.setItem('workspace-tabs', JSON.stringify(tabs));
    }
  }, [tabs, mounted]);

  // 保存 activeTabId 到 localStorage
  useEffect(() => {
    if (mounted && activeTabId) {
      localStorage.setItem('workspace-active-tab', activeTabId);
    }
  }, [activeTabId, mounted]);

  // 监听 Electron 全屏状态变化
  useEffect(() => {
    // 检查是否在 Electron 环境中
    if (typeof window !== 'undefined' && (window as any).electronAPI?.onFullscreenChange) {
      setIsElectron(true);
      // Electron 环境，默认非全屏（窗口模式）
      setIsFullscreen(false);
      
      (window as any).electronAPI.onFullscreenChange((fullscreen: boolean) => {
        setIsFullscreen(fullscreen);
      });
    } else {
      // 非 Electron 环境（浏览器），不需要偏移
      setIsElectron(false);
      setIsFullscreen(true);
    }
  }, []);

  const handleOpenSession = (session: {
    id?: string;
    name: string;
    clientType: string;
    icon: string;
    color: string;
  }) => {
    // 记录最近会话
    if (session.id) {
      const savedRecent = localStorage.getItem('recent-sessions');
      let recentIds: string[] = [];
      try {
        recentIds = savedRecent ? JSON.parse(savedRecent) : [];
      } catch (e) {}
      
      // 移除已存在的并放入首位
      const newRecent = [session.id, ...recentIds.filter(id => id !== session.id)].slice(0, 20);
      localStorage.setItem('recent-sessions', JSON.stringify(newRecent));
    }

    const newTab: Tab = {
      id: Date.now().toString(),
      title: session.name,
      clientType: session.clientType,
      sessionName: session.name,
      icon: session.icon,
      color: session.color,
      connectionId: session.id, // 保存连接 ID
    };
    setTabs([...tabs, newTab]);
    setActiveTabId(newTab.id);
    setIsSessionManagerOpen(false);
  };

  const handleCloseTab = (tabId: string) => {
    // 关闭 tab 之前，先关闭 SSH WebSocket 连接
    const tabToClose = tabs.find(t => t.id === tabId);
    if (tabToClose && tabToClose.clientType === 'SSH客户端') {
      const sshTabRef = sshTabRefs.current.get(tabId);
      if (sshTabRef) {
        console.log(`[关闭 Tab] 调用 SSH closeConnection: ${tabId}`);
        sshTabRef.closeConnection();
        sshTabRefs.current.delete(tabId);
      }
    }
    
    const newTabs = tabs.filter(t => t.id !== tabId);
    setTabs(newTabs);
    if (activeTabId === tabId && newTabs.length > 0) {
      setActiveTabId(newTabs[newTabs.length - 1].id);
    } else if (newTabs.length === 0) {
      setActiveTabId(null);
    }
  };

  // 新增：更新tab的内部状态
  const updateTabState = (tabId: string, newState: Partial<Tab['state']>) => {
    setTabs(prevTabs => 
      prevTabs.map(tab => 
        tab.id === tabId 
          ? { ...tab, state: { ...tab.state, ...newState } }
          : tab
      )
    );
  };

  const activeTab = tabs.find(t => t.id === activeTabId);

  // 稳定化 Redis 连接失败回调，防止切换 Tab 时触发 RedisTab 重连
  const handleRedisConnectionFailed = useCallback((error: string) => {
    console.error('Redis 连接失败:', error);
  }, []);

  return (
    <div className="flex h-screen overflow-hidden bg-[#F9FAFB]">
      {/* 左侧边栏 */}
      <div className="w-12 flex flex-col items-center py-4 bg-white border-r border-gray-200">
        {/* Electron 非全屏时的顶部占位，避开 macOS 红绿灯 */}
        {isElectron && !isFullscreen && <div className="h-6 flex-shrink-0"></div>}
        
        {/* 占位区域，保持会话管理按钮位置不变 */}
        <div className="h-9 mb-4"></div>

        {/* Session Manager 按钮 */}
        <button
          onClick={() => setIsSessionManagerOpen(true)}
          className={`w-9 h-9 flex items-center justify-center rounded mb-4 group relative transition-colors ${
            isSessionManagerOpen ? 'bg-gray-100 text-[#007acc]' : 'text-[#007acc] hover:bg-gray-100'
          }`}
          title={t('workspace.sessionManagement')}
        >
          <i className="fas fa-sitemap text-xl"></i>
          <span className="absolute left-full ml-2 px-2 py-1 text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50 bg-gray-800 text-white">
            会话管理
          </span>
        </button>
        
        <div className="flex-1"></div>
      </div>

      {/* 主内容区域 */}
      <div className="flex-grow flex flex-col">
        {/* Tab 栏 */}
        {tabs.length > 0 && (
          <div className="relative z-20 h-10 min-h-[40px] max-h-[40px] flex items-stretch overflow-x-auto bg-[#f3f3f3] border-b border-gray-300">
            {/* Electron 非全屏时的左侧占位，避开 macOS 红绿灯 */}
            {isElectron && !isFullscreen && <div className="w-10 flex-shrink-0"></div>}
            {tabs.map((tab) => (
              <div
                key={tab.id}
                className={`flex h-10 items-center gap-2 cursor-pointer min-w-[120px] max-w-[220px] min-h-[39px] max-h-[39px] px-4 group transition-all relative border-r border-gray-200 ${
                  activeTabId === tab.id ? 'tab-active' : 'tab-inactive hover:bg-[#e8e8e8]'
                }` }
             
                
                onClick={() => setActiveTabId(tab.id)}
              >
                <i className={`fas ${tab.icon} text-xs`} style={{ color: activeTabId === tab.id ? '#007acc' : tab.color }}></i>
                <span className="flex-grow truncate text-xs font-medium">{tab.title}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCloseTab(tab.id);
                  }}
                  className={`opacity-0 group-hover:opacity-100 rounded-full w-4 h-4 flex items-center justify-center transition-all ${
                    activeTabId === tab.id ? 'hover:bg-gray-200 text-gray-500' : 'hover:bg-gray-300 text-gray-500'
                  }`}
                >
                  <i className="fas fa-times text-[8px]"></i>
                </button>
              </div>
            ))}
          </div>
        )}

        {/* 工作区域 */}
        <div className="flex-grow overflow-hidden bg-white">
          {tabs.length === 0 ? (
            // 欢迎页面
            <div className="h-full flex items-center justify-center relative">
              <div className="text-center max-w-2xl px-6">
                {/* Logo 区域 - 与主页 Header 保持一致 */}
                <div className="flex items-center justify-center gap-3 mb-6">
                  <div className="w-16 h-16 rounded-xl bg-gradient-primary flex items-center justify-center text-white shadow-lg">
                    <i className="fas fa-wrench text-3xl"></i>
                  </div>
                  <span className="text-4xl font-bold text-gray-800">{t('header.title')}</span>
                  <span className="text-sm px-3 py-1 bg-[#165DFF]/10 text-[#165DFF] rounded-full font-medium">
                    {t('header.subtitle')}
                  </span>
                </div>
                <h2 className="text-3xl font-bold mb-4 text-gray-800">{t('workspace.welcomeTitle')}</h2>
                <p className="text-lg mb-8 text-gray-600">
                  {t('workspace.welcomeDescription')}
                </p>
                <button
                  onClick={() => setIsSessionManagerOpen(true)}
                  className="px-8 py-4 bg-[#007acc] text-white rounded-lg hover:bg-[#005a9e] transition-colors flex items-center gap-3 mx-auto text-lg shadow-md"
                >
                  <i className="fas fa-sitemap"></i>
                  {t('workspace.openSessionManager')}
                </button>
                <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
                  <div className="rounded-lg p-6 bg-white border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                    <i className="fas fa-layer-group text-3xl text-[#007acc] mb-3"></i>
                    <h3 className="font-semibold mb-2 text-gray-800">{t('workspace.multiClientSupport')}</h3>
                    <p className="text-sm text-gray-600">
                      {t('workspace.clientSupportDescription')}
                    </p>
                  </div>
                  <div className="rounded-lg p-6 bg-white border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                    <i className="fas fa-columns text-3xl text-[#007acc] mb-3"></i>
                    <h3 className="font-semibold mb-2 text-gray-800">{t('workspace.multiTabManagement')}</h3>
                    <p className="text-sm text-gray-600">
                      {t('workspace.multiTabDescription')}
                    </p>
                  </div>
                  <div className="rounded-lg p-6 bg-white border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                    <i className="fas fa-folder-tree text-3xl text-[#007acc] mb-3"></i>
                    <h3 className="font-semibold mb-2 text-gray-800">{t('workspace.categoryManagement')}</h3>
                    <p className="text-sm text-gray-600">
                      {t('workspace.categoryDescription')}
                    </p>
                  </div>
                </div>
                
                {/* 社交图标 - 右下角 */}
                <div className="absolute bottom-6 right-6 flex items-center gap-4">
                  <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-gray-600 transition-colors">
                    <i className="fab fa-github text-xl"></i>
                  </a>
                  <a href="https://twitter.com" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-gray-600 transition-colors">
                    <i className="fab fa-twitter text-xl"></i>
                  </a>
                  <a href="https://linkedin.com" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-gray-600 transition-colors">
                    <i className="fab fa-linkedin text-xl"></i>
                  </a>
                  <a href="https://youtube.com" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-gray-600 transition-colors">
                    <i className="fab fa-youtube text-xl"></i>
                  </a>
                </div>
              </div>
            </div>
          ) : (
            // 渲染所有 tabs，但只显示 active tab
            <div className="h-full">
              {tabs.map((tab) => {
                const isRedis = tab.clientType?.toLowerCase().includes('redis');
                const isSSH = tab.clientType?.toLowerCase().includes('ssh');
                const isKafka = tab.clientType?.toLowerCase().includes('kafka');
                const isZooKeeper = tab.clientType?.toLowerCase().includes('zookeeper');
                const isElastic = tab.clientType?.toLowerCase().includes('elastic');
                const isDatabase = tab.clientType?.toLowerCase().includes('database');
                const isPostman = tab.clientType?.toLowerCase().includes('http');
                
                return (
                  <div
                    key={tab.id}
                    className="h-full"
                    style={{ display: tab.id === activeTabId ? 'block' : 'none' }}
                  >
                    { isPostman ? (
                      // HTTP 客户端显示 HttpTab 组件
                      <HttpTab
                        connectionId={tab.connectionId || ''}
                        connectionName={tab.title}
                      />
                    ) : isKafka ? (
                      // Kafka 客户端显示 KafkaTab 组件
                      <KafkaTab
                        connectionId={tab.connectionId || ''}
                        connectionName={tab.title}
                      />
                    ) : isZooKeeper ? (
                      // ZooKeeper 客户端显示 ZooKeeperTab 组件
                      <ZooKeeperTab
                        connectionId={tab.connectionId || ''}
                        connectionName={tab.title}
                      />
                    ) : isElastic ? (
                      <ElasticTab
                        connectionId={tab.connectionId || ''}
                        connectionName={tab.title}
                      />
                    ) : isRedis && tab.connectionId ? (
                      // Redis 客户端显示 RedisTab 组件
                      <RedisTab
                        connectionId={tab.connectionId}
                        connectionName={tab.title}
                        onConnectionFailed={handleRedisConnectionFailed}
                      />
                    ) : isSSH && tab.connectionId ? (
                      // SSH 客户端显示 SSHTab 组件
                      <SSHTab
                        ref={(ref) => {
                          if (ref) {
                            sshTabRefs.current.set(tab.id, ref);
                          }
                        }}
                        connectionId={tab.connectionId}
                        connectionName={tab.title}
                      />
                    ) : isDatabase && tab.connectionId ? (
                      // Database 客户端显示 DatabaseTab 组件
                      <DatabaseTab
                        connectionId={tab.connectionId}
                        connectionName={tab.title}
                      />
                    ) : (
                      // 其他客户端显示默认内容
                      <div className="h-full p-6 bg-[#F9FAFB]">
                        <div className="h-full flex flex-col">
                          <div className="flex-grow overflow-hidden">
                            <div className="rounded-lg p-6 overflow-auto bg-white border border-gray-200 shadow-sm">
                              <div className="text-center py-12">
                                <i className={`fas ${tab.icon} text-6xl mb-4`} style={{ color: tab.color }}></i>
                                <h3 className="text-2xl font-bold mb-2 text-gray-800">{tab.clientType} {t('workspace.operationInterface')}</h3>
                                <p className="mb-6 text-gray-600">
                                  {t('workspace.integrationTip', { clientType: tab.clientType })}
                                </p>
                                
                                {/* 示例：显示保存的状态 */}
                                {tab.state && (
                                  <div className="mb-4 p-4 rounded bg-gray-50 border border-gray-200">
                                    <h4 className="font-semibold mb-2 text-gray-800">已保存的状态：</h4>
                                    <div className="text-left text-sm text-gray-600">
                                      {tab.state.commandHistory && (
                                        <div className="mb-2">
                                          <strong>命令历史:</strong> {tab.state.commandHistory.length} 条命令
                                        </div>
                                      )}
                                      {tab.state.connectionStatus && (
                                        <div className="mb-2">
                                          <strong>连接状态:</strong> {tab.state.connectionStatus}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}
                                
                                {/* 示例：测试按钮，模拟保存命令 */}
                                <div className="mt-4">
                                  <button
                                    onClick={() => {
                                      const currentHistory = tab.state?.commandHistory || [];
                                      updateTabState(tab.id, {
                                        commandHistory: [...currentHistory, `ls -la (${new Date().toLocaleTimeString()})`],
                                        connectionStatus: 'connected'
                                      });
                                    }}
                                    className="px-4 py-2 bg-[#00B42A] text-white rounded hover:bg-[#009A29] transition-colors"
                                  >
                                    {t('workspace.simulateCommand')}
                                  </button>
                                </div>

                                <div className="max-w-2xl mx-auto rounded-lg p-8 mt-6 bg-gray-50 border border-gray-200">
                                  <div className="text-left space-y-4">
                                    <div className="flex items-start gap-3">
                                      <i className="fas fa-check-circle text-[#00B42A] mt-1"></i>
                                      <div>
                                        <h4 className="font-semibold mb-1 text-gray-800">{t('workspace.connectionInfo')}</h4>
                                        <p className="text-sm text-gray-600">{t('workspace.sessionName')}: {tab.sessionName}</p>
                                      </div>
                                    </div>
                                    <div className="flex items-start gap-3">
                                      <i className="fas fa-info-circle text-[#007acc] mt-1"></i>
                                      <div>
                                        <h4 className="font-semibold mb-1 text-gray-800">{t('workspace.clientType')}</h4>
                                        <p className="text-sm text-gray-600">{tab.clientType}</p>
                                      </div>
                                    </div>
                                    <div className="flex items-start gap-3">
                                      <i className="fas fa-lightbulb text-[#FF7D00] mt-1"></i>
                                      <div>
                                        <h4 className="font-semibold mb-1 text-gray-800">{t('workspace.tip')}</h4>
                                        <p className="text-sm text-gray-600">
                                          {t('workspace.integrationTip', { clientType: tab.clientType })}
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 会话管理窗口 */}
      <SessionManager
        isOpen={isSessionManagerOpen}
        onClose={() => setIsSessionManagerOpen(false)}
        onOpenSession={handleOpenSession}
      />
    </div>
  );
}
