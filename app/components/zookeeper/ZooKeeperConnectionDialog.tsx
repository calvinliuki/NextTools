'use client';

import { useEffect, useState } from 'react';
import { useLanguage } from '@/i18n/LanguageContext';

export interface ZooKeeperConnectionConfig {
  id?: string;
  name: string;
  mode?: 'standalone' | 'cluster';
  host?: string;
  port?: number;
  clusterNodes?: Array<{ host: string; port: number }>;
  connectionTimeout: number;
  sessionTimeout: number;
  readOnly?: boolean;
}

interface ApiResponse {
  code: number;
  message: string;
  data: any;
}

interface ZooKeeperConnectionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (config: ZooKeeperConnectionConfig) => void;
  initialConfig?: ZooKeeperConnectionConfig;
}

export default function ZooKeeperConnectionDialog({
  isOpen,
  onClose,
  onConfirm,
  initialConfig,
}: ZooKeeperConnectionDialogProps) {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<'connection' | 'advanced'>('connection');
  const [name, setName] = useState(initialConfig?.name || '');
  const [mode, setMode] = useState<ZooKeeperConnectionConfig['mode']>(initialConfig?.mode || 'standalone');
  const [host, setHost] = useState(initialConfig?.host || '127.0.0.1');
  const [port, setPort] = useState(initialConfig?.port || 2181);
  const [clusterNodes, setClusterNodes] = useState<Array<{ host: string; port: number }>>(
    initialConfig?.clusterNodes || [{ host: '127.0.0.1', port: 2181 }]
  );
  const [connectionTimeout, setConnectionTimeout] = useState(initialConfig?.connectionTimeout || 10);
  const [sessionTimeout, setSessionTimeout] = useState(initialConfig?.sessionTimeout || 10);
  const [readOnly, setReadOnly] = useState(initialConfig?.readOnly || false);
  const [isTesting, setIsTesting] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [testMessage, setTestMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (initialConfig) {
      setName(initialConfig.name || '');
      setMode(initialConfig.mode || 'standalone');
      setHost(initialConfig.host || '127.0.0.1');
      setPort(initialConfig.port || 2181);
      setClusterNodes(initialConfig.clusterNodes || [{ host: '127.0.0.1', port: 2181 }]);
      setConnectionTimeout(initialConfig.connectionTimeout || 10);
      setSessionTimeout(initialConfig.sessionTimeout || 10);
      setReadOnly(initialConfig.readOnly || false);
    } else {
      setName('');
      setMode('standalone');
      setHost('127.0.0.1');
      setPort(2181);
      setClusterNodes([{ host: '127.0.0.1', port: 2181 }]);
      setConnectionTimeout(10);
      setSessionTimeout(10);
      setReadOnly(false);
    }
  }, [initialConfig]);

  if (!isOpen) return null;

  const handleCancel = () => {
    handleResetForm();
    onClose();
  };

  const handleResetForm = () => {
    setName('');
    setMode('standalone');
    setHost('127.0.0.1');
    setPort(2181);
    setClusterNodes([{ host: '127.0.0.1', port: 2181 }]);
    setConnectionTimeout(10);
    setSessionTimeout(10);
    setReadOnly(false);
    setTestMessage(null);
  };

  const handleTestConnection = async () => {
    if (mode === 'standalone' && !host.trim()) {
      setTestMessage({ type: 'error', text: t('zooKeeperConnectionDialog.fillHostAddress') });
      return;
    }

    if (mode === 'cluster' && clusterNodes.length === 0) {
      setTestMessage({ type: 'error', text: t('zooKeeperConnectionDialog.addAtLeastOneNode') });
      return;
    }

    setIsTesting(true);
    setTestMessage(null);

    try {
      const response = await fetch('/api/zookeeper/connections/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          host: host.trim(),
          port,
          clusterNodes,
          connectionTimeout,
        }),
      });
      const result: ApiResponse = await response.json();

      if (result.code === 200) {
        setTestMessage({ type: 'success', text: result.message || t('zooKeeperConnectionDialog.connectionTestSuccess') });
      } else {
        setTestMessage({ type: 'error', text: result.message || t('zooKeeperConnectionDialog.connectionTestFailed') });
      }
    } catch (error: any) {
      setTestMessage({ type: 'error', text: `${t('zooKeeperConnectionDialog.requestFailed')}${error?.message || t('zooKeeperConnectionDialog.networkError')}` });
    } finally {
      setIsTesting(false);
    }
  };

  const handleCreateConnection = async () => {
    if (!name.trim()) {
      setTestMessage({ type: 'error', text: t('zooKeeperConnectionDialog.fillConnectionName') });
      return;
    }

    if (mode === 'standalone' && !host.trim()) {
      setTestMessage({ type: 'error', text: t('zooKeeperConnectionDialog.fillHostAddress') });
      return;
    }

    if (mode === 'cluster' && clusterNodes.length === 0) {
      setTestMessage({ type: 'error', text: t('zooKeeperConnectionDialog.addAtLeastOneNode') });
      return;
    }

    setIsCreating(true);
    setTestMessage(null);

    try {
      const response = await fetch('/api/zookeeper/connections/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: initialConfig?.id,
          name: name.trim(),
          mode,
          host: host.trim(),
          port,
          clusterNodes,
          connectionTimeout,
          sessionTimeout,
          readOnly,
        }),
      });

      const result: ApiResponse = await response.json();

      if (result.code === 200) {
        onConfirm({
          id: result.data?.id || initialConfig?.id,
          name: name.trim(),
          mode,
          host: host.trim(),
          port,
          clusterNodes,
          connectionTimeout,
          sessionTimeout,
          readOnly,
        });
        handleResetForm();
        onClose();
      } else {
        setTestMessage({ type: 'error', text: result.message || t('zooKeeperConnectionDialog.operationFailed') });
      }
    } catch (error: any) {
      setTestMessage({ type: 'error', text: `${t('zooKeeperConnectionDialog.requestFailed')}${error?.message || t('zooKeeperConnectionDialog.networkError')}` });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 z-50 transition-opacity bg-black/30"
        onClick={handleCancel}
      ></div>

      <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
        <div
          className="bg-white rounded-lg shadow-[0_20px_60px_-12px_rgba(0,0,0,0.25)] w-[600px] h-[520px] max-h-[80vh] flex flex-col pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 bg-white rounded-t-lg">
            <h2 className="text-base font-semibold text-gray-900">{t('zooKeeperConnectionDialog.title')}</h2>
            <button
              onClick={handleCancel}
              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-md transition-all"
              title={t('zooKeeperConnectionDialog.close')}
            >
              <i className="fas fa-times text-xs"></i>
            </button>
          </div>

          <div className="flex border-b border-gray-100 bg-white">
            <button
              onClick={() => setActiveTab('connection')}
              className={`px-5 py-2.5 text-sm font-medium transition-all relative ${
                activeTab === 'connection'
                  ? 'text-[#007acc]'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {t('zooKeeperConnectionDialog.connectionTab')}
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
              {t('zooKeeperConnectionDialog.advancedTab')}
              {activeTab === 'advanced' && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#007acc]"></span>
              )}
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-5 bg-gray-50 min-h-[340px]">
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
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">{t('zooKeeperConnectionDialog.connectionName')}</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t('zooKeeperConnectionDialog.placeholderConnectionName')}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#007acc]/20 focus:border-[#007acc] text-gray-900 placeholder:text-gray-400 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">{t('zooKeeperConnectionDialog.connectionMode')}</label>
                  <select
                    value={mode}
                    onChange={(e) => setMode(e.target.value as ZooKeeperConnectionConfig['mode'])}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#007acc]/20 focus:border-[#007acc] text-gray-900 appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%23666%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E')] bg-[length:16px_16px] bg-[right_12px_center] bg-no-repeat"
                  >
                    <option value="standalone">{t('zooKeeperConnectionDialog.standalone')}</option>
                    <option value="cluster">{t('zooKeeperConnectionDialog.cluster')}</option>
                  </select>
                </div>

                {mode === 'standalone' ? (
                  <>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1.5">{t('zooKeeperConnectionDialog.host')}</label>
                      <input
                        type="text"
                        value={host}
                        onChange={(e) => setHost(e.target.value)}
                        placeholder={t('zooKeeperConnectionDialog.placeholderHostAddress')}
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#007acc]/20 focus:border-[#007acc] text-gray-900 placeholder:text-gray-400 transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1.5">{t('zooKeeperConnectionDialog.port')}</label>
                      <input
                        type="number"
                        value={port}
                        onChange={(e) => setPort(parseInt(e.target.value) || 2181)}
                        className="w-32 px-3 py-2 text-sm border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#007acc]/20 focus:border-[#007acc] text-gray-900 transition-all"
                        min="1"
                        max="65535"
                      />
                    </div>
                  </>
                ) : (
                  <div>
                    <div className="flex items-center justify-between mb-2.5">
                      <label className="block text-xs font-medium text-gray-600">
                        {t('zooKeeperConnectionDialog.clusterNodes')}
                      </label>
                      <button
                        onClick={() => setClusterNodes([...clusterNodes, { host: '127.0.0.1', port: 2181 }])}
                        className="text-xs text-[#007acc] hover:text-[#005a9e] flex items-center gap-1 transition-colors"
                      >
                        <i className="fas fa-plus text-xs"></i>
                        {t('zooKeeperConnectionDialog.addNode')}
                      </button>
                    </div>
                    <div className="space-y-2.5">
                      {clusterNodes.map((server, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <input
                            type="text"
                            value={server.host}
                            onChange={(e) => {
                              const newServers = [...clusterNodes];
                              newServers[idx].host = e.target.value;
                              setClusterNodes(newServers);
                            }}
                            placeholder={t('zooKeeperConnectionDialog.placeholderIpAddressOrDomain')}
                            className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#007acc]/20 focus:border-[#007acc] text-gray-900 placeholder:text-gray-400 transition-all"
                          />
                          <span className="text-gray-400 text-sm">:</span>
                          <input
                            type="number"
                            value={server.port}
                            onChange={(e) => {
                              const newServers = [...clusterNodes];
                              newServers[idx].port = parseInt(e.target.value) || 2181;
                              setClusterNodes(newServers);
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

                <label className="flex items-center gap-2 text-xs text-gray-600">
                  <input
                    type="checkbox"
                    checked={readOnly}
                    onChange={(e) => setReadOnly(e.target.checked)}
                    className="w-3.5 h-3.5 text-[#007acc] border-gray-300 rounded focus:ring-[#007acc]"
                  />
                  {t('zooKeeperConnectionDialog.readOnly')}
                </label>
              </div>
            ) : (
              <div className="space-y-5">
                <div>
                  <h3 className="text-xs font-semibold text-gray-700 mb-3">{t('zooKeeperConnectionDialog.timeoutSettings')}</h3>
                  <div className="flex flex-wrap gap-4">
                    <div className="flex-1 min-w-[180px]">
                      <label className="block text-xs font-medium text-gray-600 mb-1.5">{t('zooKeeperConnectionDialog.connectionTimeout')}</label>
                      <input
                        type="number"
                        value={connectionTimeout}
                        onChange={(e) => setConnectionTimeout(Math.max(1, parseInt(e.target.value) || 10))}
                        className="w-32 px-3 py-2 text-sm text-center border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#007acc]/20 text-gray-900"
                        min="1"
                      />
                    </div>
                    <div className="flex-1 min-w-[180px]">
                      <label className="block text-xs font-medium text-gray-600 mb-1.5">{t('zooKeeperConnectionDialog.sessionTimeout')}</label>
                      <input
                        type="number"
                        value={sessionTimeout}
                        onChange={(e) => setSessionTimeout(Math.max(1, parseInt(e.target.value) || 10))}
                        className="w-32 px-3 py-2 text-sm text-center border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#007acc]/20 text-gray-900"
                        min="1"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between px-5 py-3.5 border-t border-gray-100 bg-white rounded-b-lg">
            <div className="flex items-center gap-2.5">
              <button
                onClick={handleTestConnection}
                disabled={isTesting || isCreating}
                className="px-3 py-1.5 text-xs text-gray-600 hover:text-gray-800 hover:bg-gray-50 rounded-md transition-all flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <i className={`fas ${isTesting ? 'fa-spinner fa-spin' : 'fa-wrench'} text-xs`}></i>
                {isTesting ? t('zooKeeperConnectionDialog.testing') : t('zooKeeperConnectionDialog.testConnection')}
              </button>
            </div>
            <div className="flex items-center gap-2.5">
              <button
                onClick={handleCancel}
                className="px-4 py-1.5 text-sm text-gray-700 hover:bg-gray-50 rounded-md transition-all"
              >
                {t('zooKeeperConnectionDialog.cancel')}
              </button>
              <button
                onClick={handleCreateConnection}
                disabled={!name.trim() || isCreating || isTesting}
                className="px-4 py-1.5 text-sm font-medium bg-[#007acc] text-white rounded-md hover:bg-[#005a9e] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow flex items-center gap-2"
              >
                {isCreating && <i className="fas fa-spinner fa-spin text-xs"></i>}
                {isCreating ? t('zooKeeperConnectionDialog.creating') : t('zooKeeperConnectionDialog.confirm')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
