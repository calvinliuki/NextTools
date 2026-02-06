'use client';

import { useState, useEffect } from 'react';
import { useLanguage } from '@/i18n/LanguageContext';
import ConnectionSettingsForm from './connection/ConnectionSettingsForm';
import AdvancedSettingsForm from './connection/AdvancedSettingsForm';
import DialogTabs from './connection/DialogTabs';
import DialogFooter from './connection/DialogFooter';
import type { ApiResponse, KafkaConnectionConfig, ClusterNode } from './connection/types';

export type { KafkaConnectionConfig, ClusterNode } from './connection/types';

interface KafkaConnectionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (config: KafkaConnectionConfig) => void;
  initialConfig?: KafkaConnectionConfig;
}

export default function KafkaConnectionDialog({
  isOpen,
  onClose,
  onConfirm,
  initialConfig,
}: KafkaConnectionDialogProps) {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<'connection' | 'advanced'>('connection');
  const [showPassword, setShowPassword] = useState(false);

  // 连接设置
  const [name, setName] = useState(initialConfig?.name || '');
  const [bootstrapServers, setBootstrapServers] = useState<ClusterNode[]>(
    initialConfig?.bootstrapServers || [{ host: '127.0.0.1', port: 9092 }]
  );
  const [clientId, setClientId] = useState(initialConfig?.clientId || 'next_tools_client');
  const [groupId, setGroupId] = useState(initialConfig?.groupId || 'next_tools_group');
  const [securityProtocol, setSecurityProtocol] = useState<KafkaConnectionConfig['securityProtocol']>(
    initialConfig?.securityProtocol || 'PLAINTEXT'
  );
  const [saslMechanism, setSaslMechanism] = useState<KafkaConnectionConfig['saslMechanism']>(
    initialConfig?.saslMechanism || 'PLAIN'
  );
  const [saslUsername, setSaslUsername] = useState(initialConfig?.saslUsername || '');
  const [saslPassword, setSaslPassword] = useState(initialConfig?.saslPassword || '');
  const [sslTruststoreLocation, setSslTruststoreLocation] = useState(initialConfig?.sslTruststoreLocation || '');
  const [sslTruststorePassword, setSslTruststorePassword] = useState(initialConfig?.sslTruststorePassword || '');

  // 高级设置
  const [connectionTimeout, setConnectionTimeout] = useState(initialConfig?.connectionTimeout || 30);
  const [requestTimeout, setRequestTimeout] = useState(initialConfig?.requestTimeout || 30);
  const [sessionTimeout, setSessionTimeout] = useState(initialConfig?.sessionTimeout || 10);
  const [heartbeatInterval, setHeartbeatInterval] = useState(initialConfig?.heartbeatInterval || 3);
  const [maxPollRecords, setMaxPollRecords] = useState(initialConfig?.maxPollRecords || 500);

  // 状态管理
  const [isTesting, setIsTesting] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [testMessage, setTestMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (initialConfig) {
      setName(initialConfig.name || '');
      setBootstrapServers(initialConfig.bootstrapServers || [{ host: '127.0.0.1', port: 9092 }]);
      setClientId(initialConfig.clientId || 'next_tools_client');
      setGroupId(initialConfig.groupId || 'next_tools_group');
      setSecurityProtocol(initialConfig.securityProtocol || 'PLAINTEXT');
      setSaslMechanism(initialConfig.saslMechanism || 'PLAIN');
      setSaslUsername(initialConfig.saslUsername || '');
      setSaslPassword(initialConfig.saslPassword || '');
      setConnectionTimeout(initialConfig.connectionTimeout || 30);
      setRequestTimeout(initialConfig.requestTimeout || 30);
      setSessionTimeout(initialConfig.sessionTimeout || 10);
      setHeartbeatInterval(initialConfig.heartbeatInterval || 3);
      setMaxPollRecords(initialConfig.maxPollRecords || 500);
    } else {
      // 重置为默认值
      setName('');
      setBootstrapServers([{ host: '127.0.0.1', port: 9092 }]);
      setClientId('next_tools_client');
      setGroupId('next_tools_group');
      setSecurityProtocol('PLAINTEXT');
      setSaslMechanism('PLAIN');
      setSaslUsername('');
      setSaslPassword('');
      setSslTruststoreLocation('');
      setSslTruststorePassword('');
      setConnectionTimeout(30);
      setRequestTimeout(30);
      setSessionTimeout(10);
      setHeartbeatInterval(3);
      setMaxPollRecords(500);
    }
  }, [initialConfig]);

  if (!isOpen) return null;

  const handleCancel = () => {
    handleResetForm();
    onClose();
  };

  const buildRequestBody = (overrideName?: string) => ({
    id: initialConfig?.id,
    name: overrideName || name || t('kafka.testConnection'),
    bootstrapServers,
    clientId: clientId || '',
    groupId: groupId || '',
    securityProtocol,
    saslMechanism: securityProtocol.includes('SASL') ? saslMechanism : '',
    saslUsername: securityProtocol.includes('SASL') ? saslUsername || '' : '',
    saslPassword: securityProtocol.includes('SASL') ? saslPassword || '' : '',
    sslTruststoreLocation: securityProtocol.includes('SSL') ? sslTruststoreLocation : '',
    sslTruststorePassword: securityProtocol.includes('SSL') ? sslTruststorePassword : '',
    connectionTimeout,
    requestTimeout,
    sessionTimeout,
    heartbeatInterval,
    maxPollRecords,
  });

  // 测试连接
  const handleTestConnection = async () => {
    if (bootstrapServers.length === 0) {
      setTestMessage({ type: 'error', text: '请添加至少一个 Bootstrap 服务器' });
      return;
    }

    setIsTesting(true);
    setTestMessage(null);

    try {
      const response = await fetch('/api/kafka/connections/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(buildRequestBody()),
      });

      const result: ApiResponse = await response.json();

      if (result.code === 200) {
        setTestMessage({
          type: 'success',
          text: result.message || t('kafka.connectionTestSuccess'),
        });
      } else {
        setTestMessage({
          type: 'error',
          text: result.message || t('kafka.connectionTestFailed'),
        });
      }
    } catch (error: any) {
      setTestMessage({
        type: 'error',
        text: `请求失败：${error?.message || t('kafka.networkError')}`,
      });
    } finally {
      setIsTesting(false);
    }
  };

  // 创建连接
  const handleCreateConnection = async () => {
    if (!name.trim()) {
      setTestMessage({ type: 'error', text: t('kafka.fillConnectionName') });
      return;
    }

    if (bootstrapServers.length === 0) {
      setTestMessage({ type: 'error', text: '请添加至少一个 Bootstrap 服务器' });
      return;
    }

    setIsCreating(true);
    setTestMessage(null);

    try {
      const response = await fetch('/api/kafka/connections/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(buildRequestBody(name.trim())),
      });

      const result: ApiResponse = await response.json();

      if (result.code === 200) {
        const config: KafkaConnectionConfig = {
          id: result.data?.id || initialConfig?.id,
          name,
          bootstrapServers,
          clientId: clientId || undefined,
          groupId: groupId || undefined,
          securityProtocol,
          saslMechanism: securityProtocol.includes('SASL') ? saslMechanism : undefined,
          saslUsername: securityProtocol.includes('SASL') ? saslUsername || undefined : undefined,
          saslPassword: securityProtocol.includes('SASL') ? saslPassword || undefined : undefined,
          sslTruststoreLocation: securityProtocol.includes('SSL') ? sslTruststoreLocation : undefined,
          sslTruststorePassword: securityProtocol.includes('SSL') ? sslTruststorePassword : undefined,
          connectionTimeout,
          requestTimeout,
          sessionTimeout,
          heartbeatInterval,
          maxPollRecords,
        };
        onConfirm(config);
        handleResetForm();
        onClose();
      } else {
        setTestMessage({
          type: 'error',
          text: result.message || t('kafka.operationFailed'),
        });
      }
    } catch (error: any) {
      setTestMessage({
        type: 'error',
        text: `请求失败：${error?.message || t('kafka.networkError')}`,
      });
    } finally {
      setIsCreating(false);
    }
  };

  // 重置表单
  const handleResetForm = () => {
    setName('');
    setBootstrapServers([{ host: '127.0.0.1', port: 9092 }]);
    setClientId('next_tools_client');
    setGroupId('next_tools_group');
    setSecurityProtocol('PLAINTEXT');
    setSaslMechanism('PLAIN');
    setSaslUsername('');
    setSaslPassword('');
    setSslTruststoreLocation('');
    setSslTruststorePassword('');
    setConnectionTimeout(30);
    setRequestTimeout(30);
    setSessionTimeout(10);
    setHeartbeatInterval(3);
    setMaxPollRecords(500);
    setTestMessage(null);
    setShowPassword(false);
  };

  return (
    <>
      {/* 遮罩层 */}
      <div
        className="fixed inset-0 z-50 transition-opacity bg-black/30"
        onClick={handleCancel}
      ></div>

      {/* 对话框 */}
      <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
        <div
          className="bg-white rounded-lg shadow-[0_20px_60px_-12px_rgba(0,0,0,0.25)] w-[600px] h-[650px] max-h-[80vh] flex flex-col pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* 标题栏 */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 bg-white rounded-t-lg">
            <h2 className="text-base font-semibold text-gray-900">{t('kafka.connectionSettings')}</h2>
            <button
              onClick={handleCancel}
              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-md transition-all"
              title={t('kafka.close')}
            >
              <i className="fas fa-times text-xs"></i>
            </button>
          </div>

          {/* 标签页 */}
          <DialogTabs activeTab={activeTab} setActiveTab={setActiveTab} />

          {/* 内容区域 */}
          <div className="flex-1 overflow-y-auto px-5 py-5 bg-gray-50 min-h-[450px]">
            {/* 测试连接消息提示 */}
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
              <ConnectionSettingsForm
                name={name}
                setName={setName}
                bootstrapServers={bootstrapServers}
                setBootstrapServers={setBootstrapServers}
                clientId={clientId}
                setClientId={setClientId}
                groupId={groupId}
                setGroupId={setGroupId}
                securityProtocol={securityProtocol}
                setSecurityProtocol={setSecurityProtocol}
                saslMechanism={saslMechanism}
                setSaslMechanism={setSaslMechanism}
                saslUsername={saslUsername}
                setSaslUsername={setSaslUsername}
                saslPassword={saslPassword}
                setSaslPassword={setSaslPassword}
                sslTruststoreLocation={sslTruststoreLocation}
                setSslTruststoreLocation={setSslTruststoreLocation}
                sslTruststorePassword={sslTruststorePassword}
                setSslTruststorePassword={setSslTruststorePassword}
                showPassword={showPassword}
                setShowPassword={setShowPassword}
              />
            ) : (
              <AdvancedSettingsForm
                connectionTimeout={connectionTimeout}
                setConnectionTimeout={setConnectionTimeout}
                requestTimeout={requestTimeout}
                setRequestTimeout={setRequestTimeout}
                sessionTimeout={sessionTimeout}
                setSessionTimeout={setSessionTimeout}
                heartbeatInterval={heartbeatInterval}
                setHeartbeatInterval={setHeartbeatInterval}
                maxPollRecords={maxPollRecords}
                setMaxPollRecords={setMaxPollRecords}
              />
            )}
          </div>

          {/* 底部按钮 */}
          <DialogFooter
            isTesting={isTesting}
            isCreating={isCreating}
            isConfirmDisabled={!name.trim() || isCreating || isTesting}
            onTestConnection={handleTestConnection}
            onCancel={handleCancel}
            onConfirm={handleCreateConnection}
          />
        </div>
      </div>
    </>
  );
}
