'use client';

import { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../../i18n/LanguageContext';
import RedisConnectionDialog, { RedisConnectionConfig } from './redis/RedisConnectionDialog';
import SSHConnectionDialog, { SSHConnectionConfig } from './ssh/SSHConnectionDialog';
import KafkaConnectionDialog, { KafkaConnectionConfig } from './kafka/KafkaConnectionDialog';
import ZooKeeperConnectionDialog, { ZooKeeperConnectionConfig } from './zookeeper/ZooKeeperConnectionDialog';
import ElasticConnectionDialog, { ElasticConnectionConfig } from './elastic/ElasticConnectionDialog';
import { DatabaseConnectionDialog } from './database/dialogs';
import DeleteConfirmDialog from './common/DeleteConfirmDialog';
import { connectionDataManager } from '@/lib/connectionCache';

interface DatabaseConnectionConfig {
  id?: string;
  name: string;
  databaseType: 'mysql' | 'postgresql' | 'sqlite' | 'oracle';
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  databaseName?: string;
  sid?: string;
  filePath?: string;
  additionalParams?: string;
  connectionTimeout?: number;
}

interface Session {
  id: string;
  name: string;
  host?: string;
  port?: number;
  clientType: string;
  is_favorite?: number;
  environment?: string;
  // Redis连接的额外配置
  password?: string;
  username?: string;
  security?: 'none' | 'ssl' | 'ssh';
  defaultFilter?: string;
  namespaceSeparator?: string;
  connectionTimeout?: number;
  executionTimeout?: number;
  databaseDiscoveryLimit?: number;
  modifyClusterRedirection?: boolean;
  // 集群配置
  clusterNodes?: Array<{ host: string; port: number }>;
  mode?: 'standalone' | 'cluster';
  // SSH连接的额外配置
  authMethod?: 'password' | 'privateKey';
  privateKey?: string;
  passphrase?: string;
  downloadDir?: string;
  terminalSettings?: {
    fontSize?: number;
    fontFamily?: string;
    fontWeight?: string;
    foreground?: string;
    background?: string;
    cursorColor?: string;
  };
  // Kafka连接的额外配置
  bootstrapServers?: Array<{ host: string; port: number }>;
  clientId?: string;
  groupId?: string;
  securityProtocol?: 'PLAINTEXT' | 'SSL' | 'SASL_PLAINTEXT' | 'SASL_SSL';
  saslMechanism?: 'PLAIN' | 'SCRAM-SHA-256' | 'SCRAM-SHA-512' | 'GSSAPI';
  saslUsername?: string;
  saslPassword?: string;
  sslTruststoreLocation?: string;
  sslTruststorePassword?: string;
  requestTimeout?: number;
  sessionTimeout?: number;
  heartbeatInterval?: number;
  maxPollRecords?: number;
  // ZooKeeper 连接的额外配置
  readOnly?: boolean;
  group?: string;
  color?: string;
  // Elastic 连接的额外配置
  protocol?: 'http' | 'https';
  authType?: 'none' | 'basic' | 'apiKey';
  apiKey?: string;
  defaultIndex?: string;
  maxRetries?: number;
  sniffOnStart?: boolean;
  sniffInterval?: number;
  // Database 连接的额外配置
  databaseType?: 'mysql' | 'postgresql' | 'sqlite' | 'oracle';
  databaseName?: string;
  sid?: string;
  filePath?: string;
  additionalParams?: string;
  oracleConnectType?: 'service_name' | 'sid';
  oracleClientLibDir?: string;
  // HTTP 连接的额外配置
  method?: string;
  url?: string;
}

interface ClientCategory {
  name: string;
  type: string;
  icon: string;
  color: string;
  defaultPort: number;
}

interface SessionManagerProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenSession: (session: {
    id?: string;
    name: string;
    clientType: string;
    icon: string;
    color: string;
  }) => void;
}

export default function SessionManager({
  isOpen,
  onClose,
  onOpenSession,
}: SessionManagerProps) {
  const { t, locale, setLocale } = useLanguage();

  // 客户端分类配置
  const clientCategories: ClientCategory[] = [
    { name: 'Redis', type: 'Redis', icon: 'fa-database', color: '#F53F3F', defaultPort: 6379 },
    { name: 'Kafka', type: 'Kafka', icon: 'fa-exchange-alt', color: '#722ED1', defaultPort: 9092 },
    { name: 'SSH', type: 'SSH', icon: 'fa-terminal', color: '#165DFF', defaultPort: 22 },
    { name: 'HTTP', type: 'HTTP', icon: 'fa-paper-plane', color: '#FF7D00', defaultPort: 8080 },
    { name: 'ZooKeeper', type: 'ZooKeeper', icon: 'fa-sitemap', color: '#00B42A', defaultPort: 2181 },
    { name: 'Elastic', type: 'Elastic', icon: 'fa-search', color: '#F7BA1E', defaultPort: 9200 },
    { name: 'Database', type: 'Database', icon: 'fa-database', color: '#16A951', defaultPort: 3306 },
  ];

  const [sessions, setSessions] = useState<Session[]>([
    { id: '2', name: 'Kafka开发环境', host: 'dev.kafka.local', port: 9092, clientType: 'Kafka', bootstrapServers: [{ host: 'dev.kafka.local', port: 9092 }] },
  ]);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [activeFilterTab, setActiveFilterTab] = useState<'all' | 'starred' | 'recent' | 'production'>('all');
  const [selectedEnv, setSelectedEnv] = useState<string | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sidebarWidth, setSidebarWidth] = useState(140);
  const [isResizing, setIsResizing] = useState(false);
  const [isNewDropdownOpen, setIsNewDropdownOpen] = useState(false);
  const [recentSessionIds, setRecentSessionIds] = useState<string[]>([]);
  const [showEnvSelector, setShowEnvSelector] = useState<string | null>(null);

  // 删除确认框状态
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [pendingDeleteSession, setPendingDeleteSession] = useState<Session | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // 模拟一些数据用于演示 UI (实际应用中这些应该是会话对象的属性)
  const getSessionTags = (session: Session) => {
    // 这里简单返回一些模拟标签，实际应该从后端获取
    const tags = [];
    // 标签系统目前是硬编码的，可以根据需要添加国际化
    if (session.clientType === 'SSH' && session.name.includes('bastion')) tags.push('Jump Server', 'High Risk');
    if (session.clientType === 'Database' && session.name.includes('master')) tags.push('Master DB', 'High Risk');
    if (session.clientType === 'Redis' && session.name.includes('main')) tags.push('Read-only');
    return tags;
  };

  const isStarred = (session: Session) => {
    return session.is_favorite === 1;
  };

  const handleToggleFavorite = async (e: React.MouseEvent, session: Session) => {
    e.stopPropagation();
    const newStatus = session.is_favorite === 1 ? 0 : 1;
    
    // 立即更新本地状态以保证响应速度
    setSessions(prev => prev.map(s => s.id === session.id ? { ...s, is_favorite: newStatus } : s));

    try {
      await fetch('/api/connections/favorite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: session.id, isFavorite: newStatus === 1 }),
      });
      // 强制刷新缓存
      loadAllConnections(true);
    } catch (error) {
      console.error('Failed to toggle favorite:', error);
      // 失败时回滚本地状态
      setSessions(prev => prev.map(s => s.id === session.id ? { ...s, is_favorite: session.is_favorite } : s));
    }
  };

  const handleSetEnvironment = async (session: Session, env: string) => {
    // 立即更新本地状态
    setSessions(prev => prev.map(s => s.id === session.id ? { ...s, environment: env } : s));
    setShowEnvSelector(null);

    try {
      await fetch('/api/connections/environment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: session.id, environment: env }),
      });
      // 强制刷新缓存
      loadAllConnections(true);
    } catch (error) {
      console.error('Failed to update environment:', error);
      // 失败时回滚
      setSessions(prev => prev.map(s => s.id === session.id ? { ...s, environment: session.environment } : s));
    }
  };

  const filteredSessions = sessions.filter(session => {
    const name = session.name || '';
    const host = session.host || '';
    const categoryMatch = selectedCategory === 'All' || session.clientType === selectedCategory;
    const searchMatch = name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                       host.toLowerCase().includes(searchQuery.toLowerCase());
    const envMatch = !selectedEnv || session.environment === selectedEnv;
    const tabMatch = activeFilterTab === 'all' || 
                    (activeFilterTab === 'starred' && isStarred(session)) ||
                    (activeFilterTab === 'recent' && recentSessionIds.includes(session.id)) ||
                    (activeFilterTab === 'production' && session.environment === '生产');
    
    return categoryMatch && searchMatch && envMatch && tabMatch;
  });

  const getCategoryCount = (type: string) => {
    if (type === 'All') return sessions.length;
    return sessions.filter(s => s.clientType === type).length;
  };
  const [isCreating, setIsCreating] = useState(false);
  const [createForType, setCreateForType] = useState<string>('');
  const [newSessionName, setNewSessionName] = useState('');
  const [newSessionHost, setNewSessionHost] = useState('');
  const [newSessionPort, setNewSessionPort] = useState('');
  const [isRedisDialogOpen, setIsRedisDialogOpen] = useState(false);
  const [isSSHDialogOpen, setIsSSHDialogOpen] = useState(false);
  const [isKafkaDialogOpen, setIsKafkaDialogOpen] = useState(false);
  const [isZooKeeperDialogOpen, setIsZooKeeperDialogOpen] = useState(false);
  const [isElasticDialogOpen, setIsElasticDialogOpen] = useState(false);
  const [isDatabaseDialogOpen, setIsDatabaseDialogOpen] = useState(false);
  const [isLoadingRedis, setIsLoadingRedis] = useState(false);
  const [isLoadingSSH, setIsLoadingSSH] = useState(false);
  const [isLoadingKafka, setIsLoadingKafka] = useState(false);
  const [isLoadingZooKeeper, setIsLoadingZooKeeper] = useState(false);
  const [isLoadingElastic, setIsLoadingElastic] = useState(false);
  const [editingSession, setEditingSession] = useState<Session | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(true);
  const [isElectron, setIsElectron] = useState(false);

  // 监听全屏状态
  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).electronAPI?.onFullscreenChange) {
      setIsElectron(true);
      // 默认假设非全屏（窗口模式）
      setIsFullscreen(false);
      (window as any).electronAPI.onFullscreenChange((fullscreen: boolean) => {
        setIsFullscreen(fullscreen);
      });
    }

    // 加载最近会话
    const savedRecent = localStorage.getItem('recent-sessions');
    if (savedRecent) {
      try {
        setRecentSessionIds(JSON.parse(savedRecent));
      } catch (e) {
        console.error('Failed to parse recent sessions:', e);
      }
    }
  }, []);

  // 拖拽调整宽度逻辑
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const newWidth = Math.max(160, Math.min(400, e.clientX - 100)); // 简单粗暴的计算，根据实际面板位置微调
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  // 加载所有连接
  const loadAllConnections = useCallback(async (force = false) => {
    setIsLoadingRedis(true);
    setIsLoadingSSH(true);
    setIsLoadingKafka(true);
    setIsLoadingZooKeeper(true);
    setIsLoadingElastic(true);
    try {
      // 检查全局缓存中是否有数据
      const cachedRedis = connectionDataManager.getRedisConnections();
      const cachedSSH = connectionDataManager.getSSHConnections();
      const cachedKafka = connectionDataManager.getKafkaConnections();
      const cachedZooKeeper = connectionDataManager.getZooKeeperConnections();
      const cachedElastic = connectionDataManager.getElasticConnections();
      const cachedDatabase = connectionDataManager.getDatabaseConnections();
      const cachedHTTP = connectionDataManager.getHttpConnections();
      
      let result;
      if (!force && cachedRedis.length > 0 && cachedSSH.length > 0 && cachedKafka.length > 0 && cachedZooKeeper.length > 0 && cachedElastic.length > 0 && cachedDatabase.length > 0 && cachedHTTP.length > 0) {
        // 使用缓存的数据
        result = { 
          code: 200, 
          data: { 
            redis: cachedRedis, 
            ssh: cachedSSH, 
            kafka: cachedKafka,
            zookeeper: cachedZooKeeper,
            elastic: cachedElastic,
            database: cachedDatabase,
            http: cachedHTTP
          } 
        };
      } else {
        // 从统一 API 获取数据
        const response = await fetch('/api/connections/all');
        result = await response.json();
        
        // 如果 API 调用成功，将数据存储到全局缓存
        if (result.code === 200 && result.data) {
          connectionDataManager.setRedisConnections(result.data.redis || []);
          connectionDataManager.setSSHConnections(result.data.ssh || []);
          connectionDataManager.setKafkaConnections(result.data.kafka || []);
          connectionDataManager.setZooKeeperConnections(result.data.zookeeper || []);
          connectionDataManager.setElasticConnections(result.data.elastic || []);
          connectionDataManager.setDatabaseConnections(result.data.database || []);
          connectionDataManager.setHttpConnections(result.data.http || []);
        }
      }
      
      if (result.code === 200 && result.data) {
        // 1. 处理 Redis 会话
        const redisSessions: Session[] = (result.data.redis || []).map((conn: any) => ({
          ...conn,
          security: conn.securityMode, // 适配前端字段名
          databaseDiscoveryLimit: conn.dbScanLimit, // 适配前端字段名
          modifyClusterRedirection: conn.clusterRedirect, // 适配前端字段名
          clientType: 'Redis',
        }));

        // 2. 处理 SSH 会话
        const sshSessions: Session[] = (result.data.ssh || []).map((conn: any) => ({
          ...conn,
          clientType: 'SSH',
        }));

        // 3. 处理 Kafka 会话
        const kafkaSessions: Session[] = (result.data.kafka || []).map((conn: any) => ({
          ...conn,
          host: conn.host || (conn.bootstrapServers && conn.bootstrapServers[0]?.host),
          port: conn.port || (conn.bootstrapServers && conn.bootstrapServers[0]?.port),
          clientType: 'Kafka',
        }));

        // 4. 处理 ZooKeeper 会话
        const zookeeperSessions: Session[] = (result.data.zookeeper || []).map((conn: any) => ({
          ...conn,
          mode: conn.mode || 'standalone',
          host: conn.host || (conn.clusterNodes && conn.clusterNodes[0]?.host),
          port: conn.port || (conn.clusterNodes && conn.clusterNodes[0]?.port),
          clusterNodes: conn.clusterNodes,
          clientType: 'ZooKeeper',
        }));

        const elasticSessions: Session[] = (result.data.elastic || []).map((conn: any) => ({
          ...conn,
          mode: conn.mode || 'standalone',
          protocol: conn.protocol || 'http',
          host: conn.host || conn.nodes?.[0]?.host,
          port: conn.port || conn.nodes?.[0]?.port,
          clusterNodes: conn.mode === 'cluster' ? (conn.nodes || []) : [],
          clientType: 'Elastic',
        }));
        
        // 5. 处理 Database 会话
        const databaseSessions: Session[] = (result.data.database || []).map((conn: any) => ({
          ...conn,
          clientType: 'Database',
        }));

        // 6. 处理 HTTP 会话
        const httpSessions: Session[] = (result.data.http || []).map((conn: any) => ({
          ...conn,
          name: conn.name || '未命名请求',
          clientType: 'HTTP',
        }));
        
        // 更新 sessions，保留非自动加载类型的会话，替换所有自动加载的会话
        setSessions(prevSessions => {
          const others = prevSessions.filter(s => 
            s.clientType !== 'Redis' && s.clientType !== 'SSH' && s.clientType !== 'Kafka' && s.clientType !== 'ZooKeeper' && s.clientType !== 'Elastic' && s.clientType !== 'Database' && s.clientType !== 'HTTP'
          );
          return [...others, ...redisSessions, ...sshSessions, ...kafkaSessions, ...zookeeperSessions, ...elasticSessions, ...databaseSessions, ...httpSessions];
        });
      }
    } catch (error: any) {
      console.error('加载连接失败:', error);
    } finally {
      setIsLoadingRedis(false);
      setIsLoadingSSH(false);
      setIsLoadingKafka(false);
      setIsLoadingZooKeeper(false);
      setIsLoadingElastic(false);
    }
  }, []);

  // 当会话管理器打开时，加载所有连接
  useEffect(() => {
    if (isOpen) {
      loadAllConnections();
      // 重新加载最近会话，防止多窗口不一致
      const savedRecent = localStorage.getItem('recent-sessions');
      if (savedRecent) {
        try {
          setRecentSessionIds(JSON.parse(savedRecent));
        } catch (e) {}
      }
    }
  }, [isOpen, loadAllConnections]);

  const getSessionsByType = (type: string) => {
    return sessions.filter(s => s.clientType === type);
  };

  const getCategoryConfig = (type: string) => {
    return clientCategories.find(c => c.type === type);
  };

  const handleCreateSession = () => {
    if (newSessionName.trim() && createForType) {
      const category = getCategoryConfig(createForType);
      const newSession: Session = {
        id: Date.now().toString(),
        name: newSessionName,
        host: newSessionHost || 'localhost',
        port: parseInt(newSessionPort) || category?.defaultPort || 0,
        clientType: createForType,
      };
      setSessions([...sessions, newSession]);
      setNewSessionName('');
      setNewSessionHost('');
      setNewSessionPort('');
      setIsCreating(false);
      setCreateForType('');
    }
  };

  const handleRedisDialogConfirm = (config: RedisConnectionConfig) => {
    // 创建或编辑连接成功后，重新加载所有连接列表
    loadAllConnections(true);
    setEditingSession(null); // 清除编辑状态
  };

  const handleSSHDialogConfirm = (config: SSHConnectionConfig) => {
    // 创建或编辑连接成功后，重新加载所有连接列表
    loadAllConnections(true);
    setEditingSession(null); // 清除编辑状态
  };

  const handleKafkaDialogConfirm = (config: KafkaConnectionConfig) => {
    // 创建或编辑连接成功后，重新加载所有连接列表
    loadAllConnections(true);
    setEditingSession(null); // 清除编辑状态
  };

  const handleZooKeeperDialogConfirm = (config: ZooKeeperConnectionConfig) => {
    // 创建或编辑连接成功后，重新加载所有连接列表
    loadAllConnections(true);
    setEditingSession(null); // 清除编辑状态
  };

  const handleElasticDialogConfirm = (config: ElasticConnectionConfig) => {
    loadAllConnections(true);
    setEditingSession(null);
  };

  const handleDatabaseDialogConfirm = (config: DatabaseConnectionConfig) => {
    loadAllConnections(true);
    setEditingSession(null);
  };

  const handleConnectSession = (session: Session) => {
    const category = getCategoryConfig(session.clientType);
    if (category) {
      onOpenSession({
        id: session.id, // 传递连接 ID
        name: session.name,
        clientType: category.name,
        icon: category.icon,
        color: category.color,
      });
    }
  };

  // 打开删除确认框
  const openDeleteConfirm = (session: Session) => {
    setPendingDeleteSession(session);
    setDeleteConfirmOpen(true);
  };

  // 执行删除会话
  const executeDeleteSession = async () => {
    if (!pendingDeleteSession) return;
    
    const id = pendingDeleteSession.id;
    const sessionToDelete = pendingDeleteSession;
    
    setIsDeleting(true);
    
    try {
      if (sessionToDelete.clientType === 'Redis') {
        const response = await fetch('/api/redis/connections/delete', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id }),
        });
        const result = await response.json();
        if (result.code === 200) {
          loadAllConnections(true);
        } else {
          alert(`${t('sessionManager.deleteError')}: ${result.message}`);
        }
      } else if (sessionToDelete.clientType === 'SSH') {
        const response = await fetch('/api/ssh/connections/delete', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id }),
        });
        const result = await response.json();
        if (result.code === 200) {
          loadAllConnections(true);
        } else {
          alert(`${t('sessionManager.deleteError')}: ${result.message}`);
        }
      } else if (sessionToDelete.clientType === 'Kafka') {
        const response = await fetch('/api/kafka/connections/delete', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id }),
        });
        const result = await response.json();
        if (result.code === 200) {
          loadAllConnections(true);
        } else {
          alert(`${t('sessionManager.deleteError')}: ${result.message}`);
        }
      } else if (sessionToDelete.clientType === 'ZooKeeper') {
        const response = await fetch('/api/zookeeper/connections/delete', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id }),
        });
        const result = await response.json();
        if (result.code === 200) {
          loadAllConnections(true);
        } else {
          alert(`${t('sessionManager.deleteError')}: ${result.message}`);
        }
      } else if (sessionToDelete.clientType === 'Elastic') {
        const response = await fetch('/api/elastic/connections/delete', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id }),
        });
        const result = await response.json();
        if (result.code === 200) {
          loadAllConnections(true);
        } else {
          alert(`${t('sessionManager.deleteError')}: ${result.message}`);
        }
      } else if (sessionToDelete.clientType === 'Database') {
        const response = await fetch('/api/database/connections/delete', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id }),
        });
        const result = await response.json();
        if (result.code === 200) {
          loadAllConnections(true);
        } else {
          alert(`${t('sessionManager.deleteError')}: ${result.message}`);
        }
      } else {
        // 对于其他类型，直接从前端删除
        setSessions(sessions.filter(s => s.id !== id));
      }
    } catch (error) {
      console.error('删除连接失败:', error);
      alert(t('sessionManager.deleteError'));
    } finally {
      setIsDeleting(false);
      setDeleteConfirmOpen(false);
      setPendingDeleteSession(null);
    }
  };

  const handleEditSession = async (session: Session) => {
    // 已经包含完整配置，直接从会话中获取
    if (session.clientType === 'Redis') {
      setEditingSession({
        ...session,
        security: session.security || 'none',
      });
      setIsRedisDialogOpen(true);
    } else if (session.clientType === 'SSH') {
      setEditingSession(session);
      setIsSSHDialogOpen(true);
    } else if (session.clientType === 'Kafka') {
      setEditingSession(session);
      setIsKafkaDialogOpen(true);
    } else if (session.clientType === 'ZooKeeper') {
      setEditingSession(session);
      setIsZooKeeperDialogOpen(true);
    } else if (session.clientType === 'Elastic') {
      setEditingSession(session);
      setIsElasticDialogOpen(true);
    } else if (session.clientType === 'Database') {
      setEditingSession(session);
      setIsDatabaseDialogOpen(true);
    } else {
      // 非Redis/SSH/Kafka连接使用基础信息
      setEditingSession(session);
      setIsRedisDialogOpen(true);
    }
  };

  // 格式化节点信息显示
  const formatNodeInfo = (session: Session): string => {
    // HTTP 连接：显示方法和解析后的 URL 信息
    if (session.clientType === 'HTTP') {
      const method = session.method || 'GET';
      let displayUrl = session.url || '';
      
      try {
        if (displayUrl && (displayUrl.startsWith('http://') || displayUrl.startsWith('https://'))) {
          const urlObj = new URL(displayUrl);
          // 优先显示 host，如果 host 后面有路径则显示路径缩略
          displayUrl = urlObj.host + (urlObj.pathname !== '/' ? urlObj.pathname : '');
        }
      } catch (e) {
        // 如果解析失败（比如 URL 不完整），则保留原样
      }
      
      return `${method} ${displayUrl || '(无 URL)'}`;
    }
    // Database 连接：显示数据库类型和连接信息
    if (session.clientType === 'Database') {
      if (session.databaseType === 'sqlite' && session.filePath) {
        return `SQLite: ${session.filePath}`;
      } else if (session.host && session.port) {
        return `${session.databaseType?.toUpperCase() || 'DATABASE'}: ${session.host}:${session.port}`;
      } else if (session.host) {
        return `${session.databaseType?.toUpperCase() || 'DATABASE'}: ${session.host}`;
      }
      return session.databaseType?.toUpperCase() || 'DATABASE';
    }
    // Kafka 连接：显示 bootstrap 服务器列表
    if (session.clientType === 'Kafka' && session.bootstrapServers && session.bootstrapServers.length > 0) {
      const nodeList = session.bootstrapServers.map(node => `${node.host}:${node.port}`).join(', ');
      // 如果超过50个字符，截断并显示省略号
      if (nodeList.length > 50) {
        return nodeList.substring(0, 47) + '...';
      }
      return nodeList;
    }
    // Elastic 集群：显示节点列表（即使没有 mode 标记）
    if (session.clientType === 'Elastic' && session.clusterNodes && session.clusterNodes.length > 0) {
      const nodeList = session.clusterNodes.map(node => `${node.host}:${node.port}`).join(', ');
      if (nodeList.length > 50) {
        return nodeList.substring(0, 47) + '...';
      }
      return nodeList;
    }
    // 集群模式：显示所有节点
    if (session.mode === 'cluster' && session.clusterNodes && session.clusterNodes.length > 0) {
      const nodeList = session.clusterNodes.map(node => `${node.host}:${node.port}`).join(', ');
      // 如果超过50个字符，截断并显示省略号
      if (nodeList.length > 50) {
        return nodeList.substring(0, 47) + '...';
      }
      return nodeList;
    }

    // 单机模式：显示单个IP和端口
    if (session.host) {
      return `${session.host}:${session.port}`;
    }

    return '';
  };

  if (!isOpen) return null;

  return (
    <>
      {/* 遮罩层 */}
      <div 
        className="fixed inset-0 z-40 transition-opacity bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      ></div>
      
      {/* 改为贴着最左边显示，宽度减半（原来800px，现在400px） */}
      <div className="fixed inset-0 z-50 pointer-events-none">
        <div className="absolute inset-y-0 left-0 w-[400px] bg-white shadow-2xl flex overflow-hidden border-r border-gray-200 pointer-events-auto animate-in slide-in-from-left duration-300">
          
          {/* 左侧分类导航 - 更加紧凑以适配窄屏 */}
          <div 
            className="flex flex-col border-r border-gray-100 bg-[#f8f9fa] relative group/sidebar shrink-0"
            style={{ width: sidebarWidth }}
          >
            <div className="p-3 border-b border-gray-100">
              <h2 className="text-gray-800 font-bold text-sm flex items-center gap-2">
                <i className="fas fa-sitemap text-[#007acc] text-[12px]"></i>
                {t('sessionManager.title')}
              </h2>
            </div>
            
            <div className="flex-1 overflow-y-auto p-1.5 scrollbar-hide">
              <div className="space-y-0.5">
                <button
                  onClick={() => setSelectedCategory('All')}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md transition-all ${
                    selectedCategory === 'All' ? 'bg-[#e7f3ff] text-[#007acc]' : 'text-gray-600 hover:bg-gray-200/50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <i className="fas fa-th-large text-[12px]"></i>
                    <span className="text-[12px] font-medium">{t('sessionManager.all')}</span>
                  </div>
                  <span className={`text-[10px] font-bold ${selectedCategory === 'All' ? 'text-[#007acc]' : 'text-gray-400'}`}>
                    {getCategoryCount('All')}
                  </span>
                </button>

                {clientCategories.map(cat => (
                  <button
                    key={cat.type}
                    onClick={() => setSelectedCategory(cat.type)}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md transition-all ${
                      selectedCategory === cat.type ? 'bg-[#e7f3ff] text-[#007acc]' : 'text-gray-600 hover:bg-gray-200/50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <i className={`fas ${cat.icon} text-[12px]`} style={{ color: selectedCategory === cat.type ? '#007acc' : cat.color }}></i>
                      <span className="text-[12px] font-medium">{cat.name}</span>
                    </div>
                    <span className={`text-[10px] font-bold ${selectedCategory === cat.type ? 'text-[#007acc]' : 'text-gray-400'}`}>
                      {getCategoryCount(cat.type)}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="p-2 border-t border-gray-100 bg-[#f8f9fa] space-y-2">
              {/* 语言切换胶囊按钮 */}
              <div className="flex items-center justify-center">
                <div className="inline-flex rounded-full bg-gray-200/80 p-0.5">
                  <button
                    onClick={() => setLocale('zh-CN')}
                    className={`px-2.5 py-1 rounded-full text-[10px] font-bold transition-all ${
                      locale === 'zh-CN' 
                        ? 'bg-white text-[#007acc] shadow-sm' 
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    中
                  </button>
                  <button
                    onClick={() => setLocale('en')}
                    className={`px-2.5 py-1 rounded-full text-[10px] font-bold transition-all ${
                      locale === 'en' 
                        ? 'bg-white text-[#007acc] shadow-sm' 
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    En
                  </button>
                </div>
              </div>
              
              <button
                onClick={() => loadAllConnections(true)}
                className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-md bg-white border border-gray-200 text-gray-400 hover:text-[#007acc] hover:border-[#007acc] transition-all text-[10px]"
              >
                <i className={`fas fa-sync-alt ${isLoadingRedis || isLoadingSSH || isLoadingKafka || isLoadingZooKeeper || isLoadingElastic ? 'fa-spin' : ''}`}></i>
                {t('sessionManager.refresh')}
              </button>
            </div>

            {/* Resize Handle */}
            <div 
              className="absolute top-0 -right-1 w-1.5 h-full cursor-col-resize z-20 hover:bg-[#007acc]/30 transition-colors"
              onMouseDown={(e) => {
                e.preventDefault();
                setIsResizing(true);
              }}
            ></div>
          </div>

          {/* 右侧主内容区 - 添加 min-w-0 防止内容溢出截断 */}
          <div className="flex-1 flex flex-col bg-white min-w-0">
            {/* 顶部工具栏 - 优化间距 */}
            <div className="p-2.5 border-b border-gray-100 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex bg-gray-100 p-0.5 rounded-md">
                  <button
                    onClick={() => setActiveFilterTab('all')}
                    className={`px-2.5 py-1 rounded text-[10px] font-bold transition-all ${
                      activeFilterTab === 'all' ? 'bg-white text-[#007acc] shadow-sm' : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {t('sessionManager.all')}
                  </button>
                  <button
                    onClick={() => setActiveFilterTab('starred')}
                    className={`px-2.5 py-1 rounded text-[10px] font-bold transition-all flex items-center gap-0.5 ${
                      activeFilterTab === 'starred' ? 'bg-white text-[#007acc] shadow-sm' : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    <i className="fas fa-star text-yellow-500"></i>
                    {t('sessionManager.favorites')}
                  </button>
                  <button
                    onClick={() => setActiveFilterTab('recent')}
                    className={`px-2.5 py-1 rounded text-[10px] font-bold transition-all flex items-center gap-0.5 ${
                      activeFilterTab === 'recent' ? 'bg-white text-[#007acc] shadow-sm' : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    <i className="fas fa-clock"></i>
                    {t('sessionManager.recent')}
                  </button>
                </div>

                <div className="flex items-center gap-1.5">
                  <div className="relative">
                    <button
                      onClick={() => {
                        if (selectedCategory !== 'All') {
                          const cat = getCategoryConfig(selectedCategory);
                          if (cat?.type === 'Redis') setIsRedisDialogOpen(true);
                          else if (cat?.type === 'SSH') setIsSSHDialogOpen(true);
                          else if (cat?.type === 'Kafka') setIsKafkaDialogOpen(true);
                          else if (cat?.type === 'ZooKeeper') setIsZooKeeperDialogOpen(true);
                          else if (cat?.type === 'Elastic') setIsElasticDialogOpen(true);
                          else if (cat?.type === 'Database') setIsDatabaseDialogOpen(true);
                          else if (cat?.type === 'HTTP') {
                            onOpenSession({
                              id: 'http-workspace',
                              name: t('sessionManager.apiWorkspace'),
                              clientType: 'HTTP',
                              icon: cat.icon,
                              color: cat.color,
                            });
                          }
                        } else {
                          setIsNewDropdownOpen(!isNewDropdownOpen);
                        }
                      }}
                      className="bg-[#007acc] text-white w-7 h-7 rounded-lg flex items-center justify-center hover:bg-[#005a9e] transition-all shadow-sm"
                    >
                      <i className="fas fa-plus text-xs"></i>
                    </button>

                    {isNewDropdownOpen && selectedCategory === 'All' && (
                      <div className="absolute right-0 mt-2 w-36 bg-white border border-gray-200 rounded-lg shadow-xl py-1 z-50 animate-in fade-in slide-in-from-top-1 duration-200">
                        {clientCategories.map(cat => (
                          <button
                            key={cat.type}
                            onClick={() => {
                              setIsNewDropdownOpen(false);
                              if (cat.type === 'Redis') setIsRedisDialogOpen(true);
                              else if (cat.type === 'SSH') setIsSSHDialogOpen(true);
                              else if (cat.type === 'Kafka') setIsKafkaDialogOpen(true);
                              else if (cat.type === 'ZooKeeper') setIsZooKeeperDialogOpen(true);
                              else if (cat.type === 'Elastic') setIsElasticDialogOpen(true);
                              else if (cat.type === 'Database') setIsDatabaseDialogOpen(true);
                              else if (cat.type === 'HTTP') {
                                onOpenSession({
                                  id: 'http-workspace',
                                  name: t('sessionManager.apiWorkspace'),
                                  clientType: 'HTTP',
                                  icon: cat.icon,
                                  color: cat.color,
                                });
                              }
                            }}
                            className="w-full text-left px-2.5 py-1.5 text-[11px] text-gray-600 hover:bg-[#e7f3ff] hover:text-[#007acc] transition-colors flex items-center gap-2"
                          >
                            <i className={`fas ${cat.icon} w-3 text-center`} style={{ color: cat.color }}></i>
                            {cat.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="relative">
                <i className="fas fa-search absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-[10px]"></i>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t('sessionManager.searchPlaceholder')}
                  className="bg-gray-50 text-gray-800 text-[11px] pl-7 pr-3 py-1.5 rounded-md border border-gray-200 focus:outline-none focus:ring-1 focus:ring-[#007acc] w-full transition-all"
                />
              </div>

              <div className="flex items-center gap-2 border-t border-gray-50 pt-2.5 overflow-x-auto scrollbar-hide">
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{t('sessionManager.environment')}:</span>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => setSelectedEnv(null)}
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1.5 border transition-all duration-200 ${
                        selectedEnv === null 
                          ? 'bg-[#e7f3ff] border-[#007acc] text-[#007acc] shadow-sm' 
                          : 'bg-white border-gray-100 text-gray-400 hover:border-gray-200 hover:text-gray-500'
                      }`}
                    >
                      {t('sessionManager.all')}
                    </button>
                    {[t('sessionManager.production'), t('sessionManager.testing'), t('sessionManager.development')].map(env => (
                      <button
                        key={env}
                        onClick={() => setSelectedEnv(selectedEnv === env ? null : env)}
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1.5 border transition-all duration-200 ${
                          selectedEnv === env 
                            ? 'bg-[#e7f3ff] border-[#007acc] text-[#007acc] shadow-sm' 
                            : 'bg-white border-gray-100 text-gray-400 hover:border-gray-200 hover:text-gray-500'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          env === '生产' ? 'bg-[#F53F3F]' : env === '测试' ? 'bg-[#F7BA1E]' : 'bg-[#00B42A]'
                        }`}></span>
                        {env}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* 会话列表 - 增加右侧间距确保不被截断，并隐藏滚动条 */}
            <div className="flex-1 overflow-y-auto p-2.5 bg-gray-50/20 scrollbar-hide">
              <div className="space-y-1.5">
                {filteredSessions.map(session => (
                  <div
                    key={session.id}
                    className="group bg-white border border-gray-200 rounded-lg p-2.5 hover:border-[#007acc] hover:shadow-sm transition-all cursor-pointer relative"
                    onClick={() => handleConnectSession(session)}
                  >
                    <div className="flex items-center justify-between relative z-10">
                      {/* 背景图标装饰 - 移入内部并单独控制溢出 */}
                      <div className="absolute inset-0 overflow-hidden rounded-lg pointer-events-none">
                        <div className="absolute top-1/2 -translate-y-1/2 -right-1 p-2 opacity-[0.04] group-hover:opacity-[0.08] transition-all">
                          <i className={`fas ${getCategoryConfig(session.clientType)?.icon} text-3xl`}></i>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <button 
                          onClick={(e) => handleToggleFavorite(e, session)}
                          className="p-1 -ml-1 hover:bg-gray-100 rounded-full transition-colors shrink-0 z-20"
                        >
                          <i className={`fas fa-star ${isStarred(session) ? 'text-yellow-400' : 'text-gray-100'} text-[11px]`}></i>
                        </button>
                        <i className={`fas ${getCategoryConfig(session.clientType)?.icon} text-[13px] shrink-0`} style={{ color: getCategoryConfig(session.clientType)?.color }}></i>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <h3 className="text-gray-800 font-bold text-[12px] truncate group-hover:text-[#007acc] transition-colors">{session.name}</h3>
                            <div className="relative z-20">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setShowEnvSelector(showEnvSelector === session.id ? null : session.id);
                                }}
                                className="flex items-center justify-center w-5 h-5 -mr-1 rounded-full hover:bg-gray-100 transition-all group/env"
                                title={t('sessionManager.clickToEditEnv')}
                              >
                                <span className={`w-2 h-2 rounded-full shrink-0 ${
                                  session.environment === t('sessionManager.production') ? 'bg-[#F53F3F]' : session.environment === t('sessionManager.testing') ? 'bg-[#F7BA1E]' : session.environment === t('sessionManager.development') ? 'bg-[#00B42A]' : 'bg-[#00B42A]'
                                } shadow-sm group-hover/env:scale-125 transition-transform`}></span>
                              </button>

                              {showEnvSelector === session.id && (
                                <div 
                                  className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 flex flex-row items-center gap-1 bg-white border border-gray-100 rounded-full shadow-2xl px-1.5 py-1 z-50 animate-in fade-in slide-in-from-bottom-2 duration-200"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {['生产', '测试', '开发'].map(env => (
                                    <button
                                      key={env}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleSetEnvironment(session, env);
                                      }}
                                      className={`px-2 py-1 text-[9px] font-bold rounded-full transition-all flex items-center gap-1 whitespace-nowrap ${
                                        session.environment === env 
                                          ? 'bg-[#e7f3ff] text-[#007acc]' 
                                          : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'
                                      }`}
                                    >
                                      <span className={`w-1 h-1 rounded-full ${
                                        env === '生产' ? 'bg-[#F53F3F]' : env === '测试' ? 'bg-[#F7BA1E]' : 'bg-[#00B42A]'
                                      }`}></span>
                                      {env}
                                    </button>
                                  ))}
                                  {/* 小箭头装饰 */}
                                  <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-white drop-shadow-[0_1px_0_rgba(0,0,0,0.05)]"></div>
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="text-[10px] font-mono text-gray-400 truncate">
                            {formatNodeInfo(session)}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity ml-2 shrink-0">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleEditSession(session); }}
                          className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                        >
                          <i className="fas fa-edit text-[10px]"></i>
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); openDeleteConfirm(session); }}
                          className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded"
                        >
                          <i className="fas fa-trash text-[10px]"></i>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {filteredSessions.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-gray-400 py-10">
                  <i className="fas fa-search text-2xl mb-2 opacity-20"></i>
                  <p className="text-[10px]">{t('sessionManager.noSessionsFound')}</p>
                </div>
              )}
            </div>

            {/* 底部信息栏 */}
            <div className="px-3 py-1.5 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
              <span className="text-[9px] text-gray-400">{t('sessionManager.totalSessions', { count: filteredSessions.length })}</span>
              <span className="text-[9px] text-gray-400">{t('sessionManager.doubleClickToConnect')}</span>
            </div>
          </div>
        </div>
      </div>


      {/* Redis 连接设置对话框 */}
      <RedisConnectionDialog
        isOpen={isRedisDialogOpen && (!editingSession || editingSession.clientType === 'Redis')}
        onClose={() => {
          setIsRedisDialogOpen(false);
          setEditingSession(null);
        }}
        onConfirm={handleRedisDialogConfirm}
        initialConfig={
          editingSession && editingSession.clientType === 'Redis'
            ? ({
                id: editingSession.id,
                name: editingSession.name || '',
                mode: editingSession.mode || 'standalone',
                host: editingSession.host || '127.0.0.1',
                port: editingSession.port || 6379,
                password: editingSession.password,
                username: editingSession.username,
                security: editingSession.security || 'none',
                defaultFilter: editingSession.defaultFilter || '*',
                namespaceSeparator: editingSession.namespaceSeparator || ':',
                connectionTimeout: editingSession.connectionTimeout || 60,
                executionTimeout: editingSession.executionTimeout || 60,
                databaseDiscoveryLimit: editingSession.databaseDiscoveryLimit || 20,
                modifyClusterRedirection: editingSession.modifyClusterRedirection || false,
                clusterNodes: editingSession.clusterNodes,
              } as RedisConnectionConfig)
            : undefined
        }
      />

      {/* SSH 连接设置对话框 */}
      <SSHConnectionDialog
        isOpen={isSSHDialogOpen && (!editingSession || editingSession.clientType === 'SSH')}
        onClose={() => {
          setIsSSHDialogOpen(false);
          setEditingSession(null);
        }}
        onConfirm={handleSSHDialogConfirm}
        initialConfig={
          editingSession && editingSession.clientType === 'SSH'
            ? ({
                id: editingSession.id,
                name: editingSession.name || '',
                host: editingSession.host || '',
                port: editingSession.port || 22,
                username: editingSession.username || '',
                authMethod: editingSession.authMethod || 'password',
                password: editingSession.password,
                privateKey: editingSession.privateKey,
                passphrase: editingSession.passphrase,
                downloadDir: editingSession.downloadDir,
                terminalSettings: editingSession.terminalSettings,
              } as SSHConnectionConfig)
            : undefined
        }
      />

      {/* Kafka 连接设置对话框 */}
      <KafkaConnectionDialog
        isOpen={isKafkaDialogOpen && (!editingSession || editingSession.clientType === 'Kafka')}
        onClose={() => {
          setIsKafkaDialogOpen(false);
          setEditingSession(null);
        }}
        onConfirm={handleKafkaDialogConfirm}
        initialConfig={
          editingSession && editingSession.clientType === 'Kafka'
            ? ({
                id: editingSession.id,
                name: editingSession.name || '',
                bootstrapServers: editingSession.bootstrapServers || [{ host: '127.0.0.1', port: 9092 }],
                clientId: editingSession.clientId,
                groupId: editingSession.groupId,
                securityProtocol: editingSession.securityProtocol || 'PLAINTEXT',
                saslMechanism: editingSession.saslMechanism,
                saslUsername: editingSession.saslUsername,
                saslPassword: editingSession.saslPassword,
                sslTruststoreLocation: editingSession.sslTruststoreLocation,
                sslTruststorePassword: editingSession.sslTruststorePassword,
                connectionTimeout: editingSession.connectionTimeout || 30,
                requestTimeout: editingSession.requestTimeout || 30,
                sessionTimeout: editingSession.sessionTimeout || 10,
                heartbeatInterval: editingSession.heartbeatInterval || 3,
                maxPollRecords: editingSession.maxPollRecords || 500,
              } as KafkaConnectionConfig)
            : undefined
        }
      />

      {/* ZooKeeper 连接设置对话框 */}
      <ZooKeeperConnectionDialog
        isOpen={isZooKeeperDialogOpen && (!editingSession || editingSession.clientType === 'ZooKeeper')}
        onClose={() => {
          setIsZooKeeperDialogOpen(false);
          setEditingSession(null);
        }}
        onConfirm={handleZooKeeperDialogConfirm}
        initialConfig={
          editingSession && editingSession.clientType === 'ZooKeeper'
            ? ({
                id: editingSession.id,
                name: editingSession.name || '',
                mode: editingSession.mode || 'standalone',
                host: editingSession.host || '127.0.0.1',
                port: editingSession.port || 2181,
                clusterNodes: editingSession.clusterNodes,
                connectionTimeout: editingSession.connectionTimeout || 10,
                sessionTimeout: editingSession.sessionTimeout || 10,
                readOnly: editingSession.readOnly || false,
              } as ZooKeeperConnectionConfig)
            : undefined
        }
      />

      <ElasticConnectionDialog
        isOpen={isElasticDialogOpen && (!editingSession || editingSession.clientType === 'Elastic')}
        onClose={() => {
          setIsElasticDialogOpen(false);
          setEditingSession(null);
        }}
        onConfirm={handleElasticDialogConfirm}
        initialConfig={
          editingSession && editingSession.clientType === 'Elastic'
            ? ({
                id: editingSession.id,
                name: editingSession.name || '',
                mode: editingSession.mode || 'standalone',
                protocol: editingSession.protocol || 'http',
                host: editingSession.host || '127.0.0.1',
                port: editingSession.port || 9200,
                nodes: editingSession.clusterNodes || [],
                authType: editingSession.authType || 'none',
                username: editingSession.username || '',
                password: editingSession.password || '',
                apiKey: editingSession.apiKey || '',
                defaultIndex: editingSession.defaultIndex || '',
                requestTimeout: editingSession.requestTimeout || 5,
                maxRetries: editingSession.maxRetries || 3,
                sniffOnStart: editingSession.sniffOnStart || false,
                sniffInterval: editingSession.sniffInterval || 0,
              } as ElasticConnectionConfig)
            : undefined
        }
      />

      {/* Database 连接设置对话框 */}
      <DatabaseConnectionDialog
        isOpen={isDatabaseDialogOpen && (!editingSession || editingSession.clientType === 'Database')}
        onClose={() => {
          setIsDatabaseDialogOpen(false);
          setEditingSession(null);
        }}
        onConfirm={handleDatabaseDialogConfirm}
        initialConfig={
          editingSession && editingSession.clientType === 'Database'
            ? ({
                id: editingSession.id,
                name: editingSession.name || '',
                databaseType: editingSession.databaseType || 'mysql',
                host: editingSession.host || (editingSession.databaseType === 'sqlite' ? 'localhost' : ''),
                port: editingSession.port || (editingSession.databaseType === 'mysql' ? 3306 : editingSession.databaseType === 'postgresql' ? 5432 : editingSession.databaseType === 'oracle' ? 1521 : 3306),
                username: editingSession.username || '',
                password: editingSession.password || '',
                databaseName: editingSession.databaseName || '',
                filePath: editingSession.filePath || '',
                additionalParams: editingSession.additionalParams || '',
                connectionTimeout: editingSession.connectionTimeout || 30,
                oracleConnectType: editingSession.oracleConnectType || 'service_name',
                oracleClientLibDir: editingSession.oracleClientLibDir || '',
              } as DatabaseConnectionConfig)
            : undefined
        }
      />

      {/* 删除会话确认对话框 */}
      <DeleteConfirmDialog
        open={deleteConfirmOpen}
        title={t('sessionManager.connection')}
        content={pendingDeleteSession?.name || ''}
        onConfirm={executeDeleteSession}
        onCancel={() => {
          setDeleteConfirmOpen(false);
          setPendingDeleteSession(null);
        }}
        isLoading={isDeleting}
      />
    </>
  );
}
