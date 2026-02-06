'use client';

import { useState, useEffect } from 'react';
import { useLanguage } from '../../../i18n/LanguageContext';

interface RedisConnectionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (config: RedisConnectionConfig) => void;
  initialConfig?: RedisConnectionConfig;
}

interface ApiResponse {
  code: number;
  message: string;
  data: any;
}

export interface ClusterNode {
  host: string;
  port: number;
}

export interface RedisConnectionConfig {
  id?: string;
  name: string;
  mode: 'standalone' | 'cluster';
  host: string; // Used for standalone mode
  port: number; // Used for standalone mode
  clusterNodes?: ClusterNode[]; // Used for cluster mode
  password?: string;
  username?: string;
  security: 'none' | 'ssl' | 'ssh';
  // Advanced settings
  defaultFilter: string;
  namespaceSeparator: string;
  connectionTimeout: number;
  executionTimeout: number;
  databaseDiscoveryLimit: number;
  modifyClusterRedirection: boolean;
}

export default function RedisConnectionDialog({
  isOpen,
  onClose,
  onConfirm,
  initialConfig,
}: RedisConnectionDialogProps) {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<'connection' | 'advanced'>('connection');
  const [showPassword, setShowPassword] = useState(false);
  
  // Connection settings
  const [name, setName] = useState(initialConfig?.name || '');
  const [mode, setMode] = useState<'standalone' | 'cluster'>(initialConfig?.mode || 'standalone');
  const [host, setHost] = useState(initialConfig?.host || '127.0.0.1');
  const [port, setPort] = useState(initialConfig?.port || 6379);
  const [clusterNodes, setClusterNodes] = useState<ClusterNode[]>(initialConfig?.clusterNodes || [{ host: '127.0.0.1', port: 6379 }]);
  const [password, setPassword] = useState(initialConfig?.password || '');
  const [username, setUsername] = useState(initialConfig?.username || '');
  const [security, setSecurity] = useState<'none' | 'ssl' | 'ssh'>(initialConfig?.security || 'none');
  
  // Advanced settings
  const [defaultFilter, setDefaultFilter] = useState(initialConfig?.defaultFilter || '*');
  const [namespaceSeparator, setNamespaceSeparator] = useState(initialConfig?.namespaceSeparator || ':');
  const [connectionTimeout, setConnectionTimeout] = useState(initialConfig?.connectionTimeout || 60);
  const [executionTimeout, setExecutionTimeout] = useState(initialConfig?.executionTimeout || 60);
  const [databaseDiscoveryLimit, setDatabaseDiscoveryLimit] = useState(initialConfig?.databaseDiscoveryLimit || 20);
  const [modifyClusterRedirection, setModifyClusterRedirection] = useState(initialConfig?.modifyClusterRedirection || false);
  
  // Use useEffect to handle initialConfig changes
  useEffect(() => {
    if (initialConfig) {
      setName(initialConfig.name || '');
      setMode(initialConfig.mode || 'standalone');
      setHost(initialConfig.host || '127.0.0.1');
      setPort(initialConfig.port || 6379);
      setClusterNodes(initialConfig.clusterNodes || [{ host: '127.0.0.1', port: 6379 }]);
      setPassword(initialConfig.password || '');
      setUsername(initialConfig.username || '');
      setSecurity(initialConfig.security || 'none');
      setDefaultFilter(initialConfig.defaultFilter || '*');
      setNamespaceSeparator(initialConfig.namespaceSeparator || ':');
      setConnectionTimeout(initialConfig.connectionTimeout || 60);
      setExecutionTimeout(initialConfig.executionTimeout || 60);
      setDatabaseDiscoveryLimit(initialConfig.databaseDiscoveryLimit || 20);
      setModifyClusterRedirection(initialConfig.modifyClusterRedirection || false);
    } else {
      // Reset to default values
      setName('');
      setMode('standalone');
      setHost('127.0.0.1');
      setPort(6379);
      setClusterNodes([{ host: '127.0.0.1', port: 6379 }]);
      setPassword('');
      setUsername('');
      setSecurity('none');
      setDefaultFilter('*');
      setNamespaceSeparator(':');
      setConnectionTimeout(60);
      setExecutionTimeout(60);
      setDatabaseDiscoveryLimit(20);
      setModifyClusterRedirection(false);
    }
  }, [initialConfig]);
  
  // State management
  const [isTesting, setIsTesting] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [testMessage, setTestMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  if (!isOpen) return null;

  const handleCancel = () => {
    handleResetForm();
    onClose();
  };

  const adjustNumber = (value: number, delta: number, min: number = 0, max: number = 9999) => {
    const newValue = value + delta;
    return Math.max(min, Math.min(max, newValue));
  };

  // Test connection
  const handleTestConnection = async () => {
    if (mode === 'standalone' && (!host || !port)) {
      setTestMessage({ type: 'error', text: t('redisConnectionDialog.fillAddressPort') });
      return;
    }
    if (mode === 'cluster' && clusterNodes.length === 0) {
      setTestMessage({ type: 'error', text: t('redisConnectionDialog.addAtLeastOneNode') });
      return;
    }

    setIsTesting(true);
    setTestMessage(null);

    try {
      const requestBody: any = {
        name: name || t('redisConnectionDialog.testConnection'),
        mode,
        password: password || '',
        username: username || '',
        securityMode: security,
        defaultFilter,
        namespaceSeparator,
        connectionTimeout,
        executionTimeout,
        dbScanLimit: databaseDiscoveryLimit,
        clusterRedirect: modifyClusterRedirection,
      };

      if (mode === 'standalone') {
        requestBody.host = host;
        requestBody.port = port;
      } else if (mode === 'cluster') {
        requestBody.clusterNodes = clusterNodes;
      }

      const response = await fetch('/api/redis/connections/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const result: ApiResponse = await response.json();

      if (result.code === 200) {
        setTestMessage({
          type: 'success',
          text: `${result.message} - ${result.data?.connectionInfo || ''} ${result.data?.serverVersion ? `(${t('redisConnectionDialog.version')}: ${result.data.serverVersion})` : ''}`,
        });
      } else {
        setTestMessage({
          type: 'error',
          text: result.message || t('redisConnectionDialog.testFailed'),
        });
      }
    } catch (error: any) {
      setTestMessage({
        type: 'error',
        text: `${t('redisConnectionDialog.requestFailed')}：${error?.message || t('redisConnectionDialog.networkError')}`,
      });
    } finally {
      setIsTesting(false);
    }
  };

  // Create connection
  const handleCreateConnection = async () => {
    if (!name.trim()) {
      setTestMessage({ type: 'error', text: t('redisConnectionDialog.fillName') });
      return;
    }

    setIsCreating(true);
    setTestMessage(null);

    try {
      const requestBody: any = {
        id: initialConfig?.id,
        name: name.trim(),
        mode,
        password: password || '',
        username: username || '',
        securityMode: security,
        defaultFilter,
        namespaceSeparator,
        connectionTimeout,
        executionTimeout,
        dbScanLimit: databaseDiscoveryLimit,
        clusterRedirect: modifyClusterRedirection,
      };

      if (mode === 'standalone') {
        requestBody.host = host;
        requestBody.port = port;
      } else if (mode === 'cluster') {
        requestBody.clusterNodes = clusterNodes;
      }

      const response = await fetch('/api/redis/connections/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const result: ApiResponse = await response.json();

      if (result.code === 200) {
        // Create or edit successful, call onConfirm
        const config: RedisConnectionConfig = {
          id: result.data?.id || initialConfig?.id,
          name,
          mode,
          host,
          port,
          clusterNodes: mode === 'cluster' ? clusterNodes : undefined,
          password: password || undefined,
          username: username || undefined,
          security,
          defaultFilter,
          namespaceSeparator,
          connectionTimeout,
          executionTimeout,
          databaseDiscoveryLimit,
          modifyClusterRedirection,
        };
        onConfirm(config);
        // Reset form
        handleResetForm();
        onClose();
      } else {
        setTestMessage({
          type: 'error',
          text: result.message || t('redisConnectionDialog.operationFailed'),
        });
      }
    } catch (error: any) {
      setTestMessage({
        type: 'error',
        text: `${t('redisConnectionDialog.requestFailed')}：${error?.message || t('redisConnectionDialog.networkError')}`,
      });
    } finally {
      setIsCreating(false);
    }
  };

  // Reset form
  const handleResetForm = () => {
    setName('');
    setMode('standalone');
    setHost('127.0.0.1');
    setPort(6379);
    setClusterNodes([{ host: '127.0.0.1', port: 6379 }]);
    setPassword('');
    setUsername('');
    setSecurity('none');
    setDefaultFilter('*');
    setNamespaceSeparator(':');
    setConnectionTimeout(60);
    setExecutionTimeout(60);
    setDatabaseDiscoveryLimit(20);
    setModifyClusterRedirection(false);
    setTestMessage(null);
  };

  return (
    <>
      {/* Overlay */}
      <div 
        className="fixed inset-0 z-50 transition-opacity bg-black/30"
        onClick={handleCancel}
      ></div>
      
      {/* Dialog */}
      <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
        <div 
          className="bg-white rounded-lg shadow-[0_20px_60px_-12px_rgba(0,0,0,0.25)] w-[600px] h-[650px] max-h-[80vh] flex flex-col pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Title bar */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 bg-white rounded-t-lg">
            <h2 className="text-base font-semibold text-gray-900">{t('redisConnectionDialog.newConnection')}</h2>
            <button
              onClick={handleCancel}
              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-md transition-all"
              title={t('redisConnectionDialog.close')}
            >
              <i className="fas fa-times text-xs"></i>
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-100 bg-white">
            <button
              onClick={() => setActiveTab('connection')}
              className={`px-5 py-2.5 text-sm font-medium transition-all relative ${
                activeTab === 'connection'
                  ? 'text-[#007acc]'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {t('redisConnectionDialog.connectionSettings')}
              {activeTab === 'connection' && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#007acc]"></span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('advanced')}
              className={`px-5 py-2.5 text-sm font-medium transition-all relative ${
                activeTab === 'advanced'
                  ? 'text-[#007acc]'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {t('redisConnectionDialog.advancedSettings')}
              {activeTab === 'advanced' && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#007acc]"></span>
              )}
            </button>
          </div>

          {/* Content area */}
          <div className="flex-1 overflow-y-auto px-5 py-5 bg-gray-50 min-h-[450px]">
            {/* Test connection message prompt */}
            {testMessage && (
              <div className={`mb-4 p-3 rounded-md text-sm ${
                testMessage.type === 'success' 
                  ? 'bg-green-50 text-green-700 border border-green-200' 
                  : 'bg-red-50 text-red-700 border border-red-200'
              }`}>
                <div className="flex items-center gap-2">
                  <i className={`fas ${testMessage.type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}`}></i>
                  <span>{testMessage.text}</span>
                </div>
              </div>
            )}
            {activeTab === 'connection' ? (
              <div className="space-y-5">
                {/* Name */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">
                    {t('redisConnectionDialog.name')}
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t('redisConnectionDialog.connectionName')}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#007acc]/20 focus:border-[#007acc] text-gray-900 placeholder:text-gray-400 transition-all"
                  />
                </div>

                {/* Connection mode */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-2.5">
                    {t('redisConnectionDialog.connectionMode')}
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { value: 'standalone' as const, label: t('redisConnectionDialog.standalone'), icon: 'fa-server' },
                      { value: 'cluster' as const, label: t('redisConnectionDialog.cluster'), icon: 'fa-sitemap' },
                    ].map((option) => (
                      <button
                        key={option.value}
                        onClick={() => setMode(option.value)}
                        className={`p-3 rounded-md border-2 transition-all flex flex-col items-center gap-2 ${
                          mode === option.value
                            ? 'border-[#007acc] bg-[#007acc]/5 text-[#007acc]'
                            : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        <i className={`fas ${option.icon} text-base`}></i>
                        <span className="text-xs font-medium">{option.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Standalone mode address and port */}
                {mode === 'standalone' && (
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">
                      {t('redisConnectionDialog.address')}
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={host}
                        onChange={(e) => setHost(e.target.value)}
                        className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#007acc]/20 focus:border-[#007acc] text-gray-900 transition-all"
                      />
                      <span className="text-gray-400 text-sm">:</span>
                      <div className="flex items-center border border-gray-200 rounded-md bg-white overflow-hidden">
                        <button
                          onClick={() => setPort(adjustNumber(port, -1, 1, 65535))}
                          className="px-2.5 py-2 text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors"
                        >
                          <i className="fas fa-minus text-xs"></i>
                        </button>
                        <input
                          type="number"
                          value={port}
                          onChange={(e) => {
                            const val = parseInt(e.target.value) || 6379;
                            setPort(Math.max(1, Math.min(65535, val)));
                          }}
                          className="w-20 px-2 py-2 text-sm text-center border-0 focus:outline-none focus:ring-2 focus:ring-[#007acc]/20 text-gray-900 bg-transparent"
                          min="1"
                          max="65535"
                        />
                        <button
                          onClick={() => setPort(adjustNumber(port, 1, 1, 65535))}
                          className="px-2.5 py-2 text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors"
                        >
                          <i className="fas fa-plus text-xs"></i>
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Cluster mode node list */}
                {mode === 'cluster' && (
                  <div>
                    <div className="flex items-center justify-between mb-2.5">
                      <label className="block text-xs font-medium text-gray-600">
                        {t('redisConnectionDialog.clusterNodes')}
                      </label>
                      <button
                        onClick={() => setClusterNodes([...clusterNodes, { host: '127.0.0.1', port: 6379 }])}
                        className="text-xs text-[#007acc] hover:text-[#005a9e] flex items-center gap-1 transition-colors"
                      >
                        <i className="fas fa-plus text-xs"></i>
                        {t('redisConnectionDialog.addNode')}
                      </button>
                    </div>
                    <div className="space-y-2.5">
                      {clusterNodes.map((node, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <input
                            type="text"
                            value={node.host}
                            onChange={(e) => {
                              const newNodes = [...clusterNodes];
                              newNodes[idx].host = e.target.value;
                              setClusterNodes(newNodes);
                            }}
                            placeholder={t('redisConnectionDialog.hostAddress')}
                            className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#007acc]/20 focus:border-[#007acc] text-gray-900 placeholder:text-gray-400 transition-all"
                          />
                          <span className="text-gray-400 text-sm">:</span>
                          <input
                            type="number"
                            value={node.port}
                            onChange={(e) => {
                              const newNodes = [...clusterNodes];
                              newNodes[idx].port = parseInt(e.target.value) || 6379;
                              setClusterNodes(newNodes);
                            }}
                            className="w-24 px-3 py-2 text-sm border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#007acc]/20 focus:border-[#007acc] text-gray-900 transition-all"
                            min="1"
                            max="65535"
                          />
                          <button
                            onClick={() => setClusterNodes(clusterNodes.filter((_, i) => i !== idx))}
                            disabled={clusterNodes.length === 1}
                            className="px-2.5 py-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <i className="fas fa-trash text-xs"></i>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Password */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">
                    {t('redisConnectionDialog.passwordLabel')}
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={t('redisConnectionDialog.password')}
                      className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#007acc]/20 focus:border-[#007acc] text-gray-900 placeholder:text-gray-400 transition-all"
                    />
                    <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={showPassword}
                        onChange={(e) => setShowPassword(e.target.checked)}
                        className="w-3.5 h-3.5 text-[#007acc] border-gray-300 rounded focus:ring-[#007acc]"
                      />
                      <span>{t('redisConnectionDialog.showPassword')}</span>
                    </label>
                  </div>
                </div>

                {/* Username */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">
                    {t('redisConnectionDialog.usernameLabel')}
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder={t('redisConnectionDialog.username')}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#007acc]/20 focus:border-[#007acc] text-gray-900 placeholder:text-gray-400 transition-all"
                  />
                </div>

                {/* Security */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-2.5">
                    {t('redisConnectionDialog.security')}
                  </label>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2.5 cursor-pointer group">
                      <input
                        type="radio"
                        name="security"
                        value="none"
                        checked={security === 'none'}
                        onChange={() => setSecurity('none')}
                        className="w-4 h-4 text-[#007acc] border-gray-300 focus:ring-[#007acc]"
                      />
                      <span className="text-sm text-gray-700 group-hover:text-gray-900">{t('redisConnectionDialog.none')}</span>
                    </label>
                    <label className="flex items-center gap-2.5 cursor-pointer group">
                      <input
                        type="radio"
                        name="security"
                        value="ssl"
                        checked={security === 'ssl'}
                        onChange={() => setSecurity('ssl')}
                        className="w-4 h-4 text-[#007acc] border-gray-300 focus:ring-[#007acc]"
                      />
                      <span className="text-sm text-gray-700 group-hover:text-gray-900">{t('redisConnectionDialog.ssl')}</span>
                    </label>
                    <label className="flex items-center gap-2.5 cursor-pointer group">
                      <input
                        type="radio"
                        name="security"
                        value="ssh"
                        checked={security === 'ssh'}
                        onChange={() => setSecurity('ssh')}
                        className="w-4 h-4 text-[#007acc] border-gray-300 focus:ring-[#007acc]"
                      />
                      <span className="text-sm text-gray-700 group-hover:text-gray-900">{t('redisConnectionDialog.ssh')}</span>
                    </label>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                {/* Key loading */}
                <div>
                  <h3 className="text-xs font-semibold text-gray-700 mb-3">{t('redisConnectionDialog.keyLoad')}</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1.5">
                        {t('redisConnectionDialog.defaultFilter')}:
                      </label>
                      <input
                        type="text"
                        value={defaultFilter}
                        onChange={(e) => setDefaultFilter(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#007acc]/20 focus:border-[#007acc] text-gray-900 transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1.5">
                        {t('redisConnectionDialog.namespaceSeparator')}:
                      </label>
                      <input
                        type="text"
                        value={namespaceSeparator}
                        onChange={(e) => setNamespaceSeparator(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#007acc]/20 focus:border-[#007acc] text-gray-900 transition-all"
                      />
                    </div>
                  </div>
                </div>

                {/* Set timeout and limits */}
                <div>
                  <h3 className="text-xs font-semibold text-gray-700 mb-3">{t('redisConnectionDialog.timeoutLimits')}</h3>
                  <div className="flex flex-wrap gap-4">
                    <div className="flex-1 min-w-[180px]">
                      <label className="block text-xs font-medium text-gray-600 mb-1.5">
                        {t('redisConnectionDialog.connectionTimeout')}({t('redisConnectionDialog.seconds')}):
                      </label>
                      <div className="flex items-center border border-gray-200 rounded-md bg-white overflow-hidden w-32">
                        <button
                          onClick={() => setConnectionTimeout(adjustNumber(connectionTimeout, -1, 1))}
                          className="px-2.5 py-2 text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors"
                        >
                          <i className="fas fa-minus text-xs"></i>
                        </button>
                        <input
                          type="number"
                          value={connectionTimeout}
                          onChange={(e) => {
                            const val = parseInt(e.target.value) || 60;
                            setConnectionTimeout(Math.max(1, val));
                          }}
                          className="flex-1 px-2 py-2 text-sm text-center border-0 focus:outline-none focus:ring-2 focus:ring-[#007acc]/20 text-gray-900 bg-transparent"
                          min="1"
                        />
                        <button
                          onClick={() => setConnectionTimeout(adjustNumber(connectionTimeout, 1, 1))}
                          className="px-2.5 py-2 text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors"
                        >
                          <i className="fas fa-plus text-xs"></i>
                        </button>
                      </div>
                    </div>
                    <div className="flex-1 min-w-[180px]">
                      <label className="block text-xs font-medium text-gray-600 mb-1.5">
                        {t('redisConnectionDialog.executionTimeout')}({t('redisConnectionDialog.seconds')}):
                      </label>
                      <div className="flex items-center border border-gray-200 rounded-md bg-white overflow-hidden w-32">
                        <button
                          onClick={() => setExecutionTimeout(adjustNumber(executionTimeout, -1, 1))}
                          className="px-2.5 py-2 text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors"
                        >
                          <i className="fas fa-minus text-xs"></i>
                        </button>
                        <input
                          type="number"
                          value={executionTimeout}
                          onChange={(e) => {
                            const val = parseInt(e.target.value) || 60;
                            setExecutionTimeout(Math.max(1, val));
                          }}
                          className="flex-1 px-2 py-2 text-sm text-center border-0 focus:outline-none focus:ring-2 focus:ring-[#007acc]/20 text-gray-900 bg-transparent"
                          min="1"
                        />
                        <button
                          onClick={() => setExecutionTimeout(adjustNumber(executionTimeout, 1, 1))}
                          className="px-2.5 py-2 text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors"
                        >
                          <i className="fas fa-plus text-xs"></i>
                        </button>
                      </div>
                    </div>
                    <div className="flex-1 min-w-[180px]">
                      <label className="block text-xs font-medium text-gray-600 mb-1.5">
                        {t('redisConnectionDialog.databaseDiscoveryLimit')}:
                      </label>
                      <div className="flex items-center border border-gray-200 rounded-md bg-white overflow-hidden w-32">
                        <button
                          onClick={() => setDatabaseDiscoveryLimit(adjustNumber(databaseDiscoveryLimit, -1, 1))}
                          className="px-2.5 py-2 text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors"
                        >
                          <i className="fas fa-minus text-xs"></i>
                        </button>
                        <input
                          type="number"
                          value={databaseDiscoveryLimit}
                          onChange={(e) => {
                            const val = parseInt(e.target.value) || 20;
                            setDatabaseDiscoveryLimit(Math.max(1, val));
                          }}
                          className="flex-1 px-2 py-2 text-sm text-center border-0 focus:outline-none focus:ring-2 focus:ring-[#007acc]/20 text-gray-900 bg-transparent"
                          min="1"
                        />
                        <button
                          onClick={() => setDatabaseDiscoveryLimit(adjustNumber(databaseDiscoveryLimit, 1, 1))}
                          className="px-2.5 py-2 text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors"
                        >
                          <i className="fas fa-plus text-xs"></i>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Cluster */}
                <div>
                  <h3 className="text-xs font-semibold text-gray-700 mb-3">{t('redisConnectionDialog.cluster')}</h3>
                  <label className="flex items-center gap-2.5 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={modifyClusterRedirection}
                      onChange={(e) => setModifyClusterRedirection(e.target.checked)}
                      className="w-4 h-4 text-[#007acc] border-gray-300 rounded focus:ring-[#007acc]"
                    />
                    <span className="text-sm text-gray-700 group-hover:text-gray-900">{t('redisConnectionDialog.modifyClusterRedirect')}:</span>
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* Bottom buttons */}
          <div className="flex items-center justify-between px-5 py-3.5 border-t border-gray-100 bg-white rounded-b-lg">
            <div className="flex items-center gap-2.5">
              <button
                onClick={handleTestConnection}
                disabled={isTesting || isCreating}
                className="px-3 py-1.5 text-xs text-gray-600 hover:text-gray-800 hover:bg-gray-50 rounded-md transition-all flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <i className={`fas ${isTesting ? 'fa-spinner fa-spin' : 'fa-wrench'} text-xs`}></i>
                {isTesting ? t('redisConnectionDialog.testing') : t('redisConnectionDialog.testConnection')}
              </button>
              <button
                onClick={() => {
                  // Quick start guide
                  console.log(t('redisConnectionDialog.quickStartGuide'));
                }}
                className="px-3 py-1.5 text-xs text-gray-600 hover:text-gray-800 hover:bg-gray-50 rounded-md transition-all flex items-center gap-1.5"
              >
                <i className="fas fa-question-circle text-xs"></i>
                {t('redisConnectionDialog.quickStartGuide')}
              </button>
            </div>
            <div className="flex items-center gap-2.5">
              <button
                onClick={handleCancel}
                className="px-4 py-1.5 text-sm text-gray-700 hover:bg-gray-50 rounded-md transition-all"
              >
                {t('redisConnectionDialog.cancel')}
              </button>
              <button
                onClick={handleCreateConnection}
                disabled={!name.trim() || isCreating || isTesting}
                className="px-4 py-1.5 text-sm font-medium bg-[#007acc] text-white rounded-md hover:bg-[#005a9e] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow flex items-center gap-2"
              >
                {isCreating && <i className="fas fa-spinner fa-spin text-xs"></i>}
                {isCreating ? t('redisConnectionDialog.creating') : t('redisConnectionDialog.confirm')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
