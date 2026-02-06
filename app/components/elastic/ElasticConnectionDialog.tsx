'use client';

import { useEffect, useState } from 'react';
import { useLanguage } from '../../../i18n/LanguageContext';

export interface ElasticConnectionConfig {
  id?: string;
  name: string;
  mode?: 'standalone' | 'cluster';
  protocol?: 'http' | 'https';
  host?: string;
  port?: number;
  nodes?: Array<{ host: string; port: number }>;
  authType?: 'none' | 'basic' | 'apiKey';
  username?: string;
  password?: string;
  apiKey?: string;
  defaultIndex?: string;
  requestTimeout?: number;
  maxRetries?: number;
  sniffOnStart?: boolean;
  sniffInterval?: number;
}

interface ApiResponse {
  code: number;
  message: string;
  data: any;
}

interface ElasticConnectionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (config: ElasticConnectionConfig) => void;
  initialConfig?: ElasticConnectionConfig;
}

export default function ElasticConnectionDialog({
  isOpen,
  onClose,
  onConfirm,
  initialConfig,
}: ElasticConnectionDialogProps) {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<'connection' | 'advanced'>('connection');
  const [name, setName] = useState(initialConfig?.name || '');
  const [mode, setMode] = useState<ElasticConnectionConfig['mode']>(initialConfig?.mode || 'standalone');
  const [protocol, setProtocol] = useState<ElasticConnectionConfig['protocol']>(initialConfig?.protocol || 'http');
  const [host, setHost] = useState(initialConfig?.host || '127.0.0.1');
  const [port, setPort] = useState(initialConfig?.port || 9200);
  const [nodes, setNodes] = useState<Array<{ host: string; port: number }>>(
    initialConfig?.nodes || [{ host: '127.0.0.1', port: 9200 }]
  );
  const [authType, setAuthType] = useState<ElasticConnectionConfig['authType']>(initialConfig?.authType || 'none');
  const [username, setUsername] = useState(initialConfig?.username || '');
  const [password, setPassword] = useState(initialConfig?.password || '');
  const [apiKey, setApiKey] = useState(initialConfig?.apiKey || '');
  const [defaultIndex, setDefaultIndex] = useState(initialConfig?.defaultIndex || '');
  const [requestTimeout, setRequestTimeout] = useState(initialConfig?.requestTimeout || 5);
  const [maxRetries, setMaxRetries] = useState(initialConfig?.maxRetries || 3);
  const [sniffOnStart, setSniffOnStart] = useState(initialConfig?.sniffOnStart || false);
  const [sniffInterval, setSniffInterval] = useState(initialConfig?.sniffInterval || 0);
  const [isTesting, setIsTesting] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [testMessage, setTestMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (initialConfig) {
      setName(initialConfig.name || '');
      setMode(initialConfig.mode || 'standalone');
      setProtocol(initialConfig.protocol || 'http');
      setHost(initialConfig.host || '127.0.0.1');
      setPort(initialConfig.port || 9200);
      setNodes(initialConfig.nodes || [{ host: '127.0.0.1', port: 9200 }]);
      setAuthType(initialConfig.authType || 'none');
      setUsername(initialConfig.username || '');
      setPassword(initialConfig.password || '');
      setApiKey(initialConfig.apiKey || '');
      setDefaultIndex(initialConfig.defaultIndex || '');
      setRequestTimeout(initialConfig.requestTimeout || 5);
      setMaxRetries(initialConfig.maxRetries || 3);
      setSniffOnStart(initialConfig.sniffOnStart || false);
      setSniffInterval(initialConfig.sniffInterval || 0);
    } else {
      setName('');
      setMode('standalone');
      setProtocol('http');
      setHost('127.0.0.1');
      setPort(9200);
      setNodes([{ host: '127.0.0.1', port: 9200 }]);
      setAuthType('none');
      setUsername('');
      setPassword('');
      setApiKey('');
      setDefaultIndex('');
      setRequestTimeout(5);
      setMaxRetries(3);
      setSniffOnStart(false);
      setSniffInterval(0);
    }
  }, [initialConfig]);

  if (!isOpen) return null;

  const handleCancel = () => {
    setTestMessage(null);
    onClose();
  };

  const buildRequestBody = (overrideName?: string) => ({
    id: initialConfig?.id,
    name: overrideName || name || t('elasticConnectionDialog.testConnection'),
    mode,
    protocol,
    host: host.trim(),
    port,
    nodes: mode === 'cluster' ? nodes : [],
    authType,
    username,
    password,
    apiKey,
    defaultIndex,
    requestTimeout,
    maxRetries,
    sniffOnStart,
    sniffInterval,
  });

  const handleTestConnection = async () => {
    if (mode === 'cluster') {
      if (!nodes.length) {
        setTestMessage({ type: 'error', text: t('elasticConnectionDialog.addAtLeastOneNode') });
        return;
      }
    } else {
      if (!host.trim()) {
        setTestMessage({ type: 'error', text: t('elasticConnectionDialog.fillHostAddress') });
        return;
      }
      if (!port || port < 1 || port > 65535) {
        setTestMessage({ type: 'error', text: t('elasticConnectionDialog.fillPort') });
        return;
      }
    }

    setIsTesting(true);
    setTestMessage(null);
    try {
      const response = await fetch('/api/elastic/connections/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildRequestBody(t('elasticConnectionDialog.testConnection'))),
      });
      const result: ApiResponse = await response.json();
      if (result.code === 200) {
        const cluster = result.data?.clusterName ? ` (${result.data.clusterName})` : '';
        const version = result.data?.version ? ` v${result.data.version}` : '';
        setTestMessage({ type: 'success', text: `${t('elasticConnectionDialog.connectionTestSuccess')}${cluster}${version}` });
      } else {
        setTestMessage({ type: 'error', text: result.message || t('elasticConnectionDialog.connectionTestFailed') });
      }
    } catch (error: any) {
      setTestMessage({ type: 'error', text: `${t('elasticConnectionDialog.operationFailed')}：${error?.message || t('elasticConnectionDialog.networkError')}` });
    } finally {
      setIsTesting(false);
    }
  };

  const handleCreateConnection = async () => {
    if (!name.trim()) {
      setTestMessage({ type: 'error', text: t('elasticConnectionDialog.fillConnectionName') });
      return;
    }
    if (mode === 'cluster') {
      if (!nodes.length) {
        setTestMessage({ type: 'error', text: t('elasticConnectionDialog.addAtLeastOneNode') });
        return;
      }
    } else {
      if (!host.trim()) {
        setTestMessage({ type: 'error', text: t('elasticConnectionDialog.fillHostAddress') });
        return;
      }
      if (!port || port < 1 || port > 65535) {
        setTestMessage({ type: 'error', text: t('elasticConnectionDialog.fillPort') });
        return;
      }
    }

    setIsCreating(true);
    setTestMessage(null);
    try {
      const response = await fetch('/api/elastic/connections/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildRequestBody()),
      });
      const result: ApiResponse = await response.json();
      if (result.code === 200) {
        onConfirm({
          id: result.data?.id || initialConfig?.id,
          name: name.trim(),
          mode,
          protocol,
          host: host.trim(),
          port,
          nodes,
          authType,
          username,
          password,
          apiKey,
          defaultIndex,
          requestTimeout,
          maxRetries,
          sniffOnStart,
          sniffInterval,
        });
        setTestMessage(null);
        onClose();
      } else {
        setTestMessage({ type: 'error', text: result.message || t('elasticConnectionDialog.operationFailed') });
      }
    } catch (error: any) {
      setTestMessage({ type: 'error', text: `${t('elasticConnectionDialog.operationFailed')}：${error?.message || t('elasticConnectionDialog.networkError')}` });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 transition-opacity bg-black/30" onClick={handleCancel}></div>

      <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
        <div
          className="bg-white rounded-lg shadow-[0_20px_60px_-12px_rgba(0,0,0,0.25)] w-[620px] h-[520px] max-h-[80vh] flex flex-col pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 bg-white rounded-t-lg">
            <h2 className="text-base font-semibold text-gray-900">{t('elasticConnectionDialog.title')}</h2>
            <button
              onClick={handleCancel}
              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-md transition-all"
              title={t('elasticConnectionDialog.close')}
            >
              <i className="fas fa-times text-xs"></i>
            </button>
          </div>

          <div className="flex border-b border-gray-100 bg-white">
            <button
              onClick={() => setActiveTab('connection')}
              className={`px-5 py-2.5 text-sm font-medium transition-all relative ${
                activeTab === 'connection'
                  ? 'text-[#165DFF] border-b-2 border-[#165DFF]'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {t('elasticConnectionDialog.connectionTab')}
            </button>
            <button
              onClick={() => setActiveTab('advanced')}
              className={`px-5 py-2.5 text-sm font-medium transition-all relative ${
                activeTab === 'advanced'
                  ? 'text-[#165DFF] border-b-2 border-[#165DFF]'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {t('elasticConnectionDialog.advancedTab')}
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {activeTab === 'connection' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">{t('elasticConnectionDialog.connectionName')} *</label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                    placeholder={t('elasticConnectionDialog.exampleConnectionName')}
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">{t('elasticConnectionDialog.protocol')}</label>
                    <select
                      value={protocol}
                      onChange={(e) => setProtocol(e.target.value as ElasticConnectionConfig['protocol'])}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                    >
                      <option value="http">http</option>
                      <option value="https">https</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">{t('elasticConnectionDialog.defaultIndex')}</label>
                    <input
                      value={defaultIndex}
                      onChange={(e) => setDefaultIndex(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                      placeholder={t('elasticConnectionDialog.exampleDefaultIndex')}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">{t('elasticConnectionDialog.connectionMode')}</label>
                    <select
                      value={mode}
                      onChange={(e) => setMode(e.target.value as ElasticConnectionConfig['mode'])}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                    >
                      <option value="standalone">{t('elasticConnectionDialog.standalone')}</option>
                      <option value="cluster">{t('elasticConnectionDialog.cluster')}</option>
                    </select>
                  </div>
                </div>

                {mode === 'standalone' ? (
                  <div className="grid grid-cols-3 gap-4">
                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">{t('elasticConnectionDialog.host')} *</label>
                      <input
                        value={host}
                        onChange={(e) => setHost(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                        placeholder={t('elasticConnectionDialog.exampleHost')}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">{t('elasticConnectionDialog.port')} *</label>
                      <input
                        type="number"
                        value={port}
                        onChange={(e) => setPort(Number(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                        placeholder={t('elasticConnectionDialog.examplePort')}
                      />
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">{t('elasticConnectionDialog.clusterNodes')} *</label>
                    <div className="space-y-2">
                      {nodes.map((node, index) => (
                        <div key={`${node.host}-${index}`} className="flex gap-2">
                          <input
                            value={node.host}
                            onChange={(e) => {
                              const next = [...nodes];
                              next[index] = { ...next[index], host: e.target.value };
                              setNodes(next);
                            }}
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
                            placeholder={t('elasticConnectionDialog.nodeAddressPlaceholder')}
                          />
                          <input
                            type="number"
                            value={node.port}
                            onChange={(e) => {
                              const next = [...nodes];
                              next[index] = { ...next[index], port: Number(e.target.value) };
                              setNodes(next);
                            }}
                            className="w-28 px-3 py-2 border border-gray-300 rounded-md text-sm"
                            placeholder={t('elasticConnectionDialog.nodePortPlaceholder')}
                          />
                          <button
                            onClick={() => setNodes(nodes.filter((_, idx) => idx !== index))}
                            className="px-2 text-red-500"
                            disabled={nodes.length === 1}
                            title={t('elasticConnectionDialog.removeNode')}
                          >
                            <i className="fas fa-times"></i>
                          </button>
                        </div>
                      ))}
                      <button
                        onClick={() => setNodes([...nodes, { host: '', port: 9200 }])}
                        className="w-full px-3 py-2 border border-dashed border-gray-300 rounded-md text-sm text-gray-600 hover:text-[#00B42A]"
                      >
                        <i className="fas fa-plus mr-1"></i>{t('elasticConnectionDialog.addNode')}
                      </button>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">{t('elasticConnectionDialog.authenticationType')}</label>
                  <select
                    value={authType}
                    onChange={(e) => setAuthType(e.target.value as ElasticConnectionConfig['authType'])}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  >
                    <option value="none">{t('elasticConnectionDialog.noAuth')}</option>
                    <option value="basic">{t('elasticConnectionDialog.basicAuth')}</option>
                    <option value="apiKey">{t('elasticConnectionDialog.apiKeyAuth')}</option>
                  </select>
                </div>

                {authType === 'basic' && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">{t('elasticConnectionDialog.username')}</label>
                      <input
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">{t('elasticConnectionDialog.password')}</label>
                      <input
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        type="password"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                      />
                    </div>
                  </div>
                )}

                {authType === 'apiKey' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">{t('elasticConnectionDialog.apiKey')}</label>
                    <input
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                      placeholder={t('elasticConnectionDialog.apiKeyPlaceholder')}
                    />
                  </div>
                )}
              </>
            )}

            {activeTab === 'advanced' && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">{t('elasticConnectionDialog.requestTimeout')}</label>
                    <input
                      type="number"
                      value={requestTimeout}
                      onChange={(e) => setRequestTimeout(Number(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">{t('elasticConnectionDialog.maxRetries')}</label>
                    <input
                      type="number"
                      value={maxRetries}
                      onChange={(e) => setMaxRetries(Number(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={sniffOnStart}
                      onChange={(e) => setSniffOnStart(e.target.checked)}
                    />
                    {t('elasticConnectionDialog.sniffOnStart')}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">{t('elasticConnectionDialog.sniffInterval')}</label>
                    <input
                      type="number"
                      value={sniffInterval}
                      onChange={(e) => setSniffInterval(Number(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                      disabled={!sniffOnStart}
                    />
                  </div>
                </div>
                <p className="text-xs text-gray-500">
                  {t('elasticConnectionDialog.connectionDescription')}
                </p>
              </>
            )}
          </div>

          {testMessage && (
            <div className={`mx-5 mb-3 rounded-md px-4 py-2 text-sm ${
              testMessage.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'
            }`}>
              {testMessage.text}
            </div>
          )}

          <div className="px-5 py-3 border-t border-gray-100 bg-gray-50 rounded-b-lg flex justify-between">
            <button
              onClick={handleTestConnection}
              disabled={isTesting}
              className="px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-md transition-colors disabled:opacity-50"
            >
              {isTesting ? t('elasticConnectionDialog.testing') : t('elasticConnectionDialog.testConnection')}
            </button>
            <div className="flex gap-2">
              <button
                onClick={handleCancel}
                className="px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-md transition-colors"
              >
                {t('elasticConnectionDialog.cancel')}
              </button>
              <button
                onClick={handleCreateConnection}
                disabled={isCreating}
                className="px-4 py-2 text-sm text-white bg-[#00B42A] hover:bg-[#009A29] rounded-md transition-colors disabled:opacity-50"
              >
                {isCreating ? t('elasticConnectionDialog.saving') : t('elasticConnectionDialog.saveConnection')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
