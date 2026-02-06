'use client';

import { useLanguage } from '../../../../i18n/LanguageContext';
import { ClusterNode, KafkaConnectionConfig } from './types';

interface ConnectionSettingsFormProps {
  name: string;
  setName: (value: string) => void;
  bootstrapServers: ClusterNode[];
  setBootstrapServers: (value: ClusterNode[]) => void;
  clientId: string;
  setClientId: (value: string) => void;
  groupId: string;
  setGroupId: (value: string) => void;
  securityProtocol: KafkaConnectionConfig['securityProtocol'];
  setSecurityProtocol: (value: KafkaConnectionConfig['securityProtocol']) => void;
  saslMechanism: KafkaConnectionConfig['saslMechanism'];
  setSaslMechanism: (value: KafkaConnectionConfig['saslMechanism']) => void;
  saslUsername: string;
  setSaslUsername: (value: string) => void;
  saslPassword: string;
  setSaslPassword: (value: string) => void;
  sslTruststoreLocation: string;
  setSslTruststoreLocation: (value: string) => void;
  sslTruststorePassword: string;
  setSslTruststorePassword: (value: string) => void;
  showPassword: boolean;
  setShowPassword: (value: boolean) => void;
}

export default function ConnectionSettingsForm({
  name,
  setName,
  bootstrapServers,
  setBootstrapServers,
  clientId,
  setClientId,
  groupId,
  setGroupId,
  securityProtocol,
  setSecurityProtocol,
  saslMechanism,
  setSaslMechanism,
  saslUsername,
  setSaslUsername,
  saslPassword,
  setSaslPassword,
  sslTruststoreLocation,
  setSslTruststoreLocation,
  sslTruststorePassword,
  setSslTruststorePassword,
  showPassword,
  setShowPassword,
}: ConnectionSettingsFormProps) {
  const { t } = useLanguage();
  const needsSaslConfig = securityProtocol.includes('SASL');
  const needsSslConfig = securityProtocol.includes('SSL');

  return (
    <div className="space-y-5">
      {/* 名字 */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1.5">
          {t('kafka.connectionName')}
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('databaseConnectionDialog.placeholderConnectionName')}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#007acc]/20 focus:border-[#007acc] text-gray-900 placeholder:text-gray-400 transition-all"
        />
      </div>

      {/* Bootstrap 服务器 */}
      <div>
        <div className="flex items-center justify-between mb-2.5">
          <label className="block text-xs font-medium text-gray-600">
            {t('kafka.bootstrapServers')}
          </label>
          <button
            onClick={() => setBootstrapServers([...bootstrapServers, { host: '127.0.0.1', port: 9092 }])}
            className="text-xs text-[#007acc] hover:text-[#005a9e] flex items-center gap-1 transition-colors"
          >
            <i className="fas fa-plus text-xs"></i>
            {t('kafka.addServer')}
          </button>
        </div>
        <div className="space-y-2.5">
          {bootstrapServers.map((server, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <input
                type="text"
                value={server.host}
                onChange={(e) => {
                  const newServers = [...bootstrapServers];
                  newServers[idx].host = e.target.value;
                  setBootstrapServers(newServers);
                }}
                placeholder={t('kafka.ipOrDomain')}
                className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#007acc]/20 focus:border-[#007acc] text-gray-900 placeholder:text-gray-400 transition-all"
              />
              <span className="text-gray-400 text-sm">:</span>
              <input
                type="number"
                value={server.port}
                onChange={(e) => {
                  const newServers = [...bootstrapServers];
                  newServers[idx].port = parseInt(e.target.value) || 9092;
                  setBootstrapServers(newServers);
                }}
                className="w-24 px-3 py-2 text-sm border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#007acc]/20 focus:border-[#007acc] text-gray-900 transition-all"
                min="1"
                max="65535"
              />
              <button
                onClick={() => setBootstrapServers(bootstrapServers.filter((_, i) => i !== idx))}
                disabled={bootstrapServers.length === 1}
                className="px-2.5 py-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <i className="fas fa-trash text-xs"></i>
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Client ID */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1.5">
          {t('kafka.clientId')} <span className="text-gray-400">({t('databaseConnectionDialog.optional')})</span>
        </label>
        <input
          type="text"
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
          placeholder={t('kafka.clientIdentifier')}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#007acc]/20 focus:border-[#007acc] text-gray-900 placeholder:text-gray-400 transition-all"
        />
      </div>

      {/* Group ID */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1.5">
          {t('kafka.consumerGroupId')} <span className="text-gray-400">({t('databaseConnectionDialog.optional')})</span>
        </label>
        <input
          type="text"
          value={groupId}
          onChange={(e) => setGroupId(e.target.value)}
          placeholder={t('kafka.consumerGroupIdPlaceholder')}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#007acc]/20 focus:border-[#007acc] text-gray-900 placeholder:text-gray-400 transition-all"
        />
      </div>

      {/* 安全协议 */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-2.5">
          {t('kafka.securityProtocol')}
        </label>
        <select
          value={securityProtocol}
          onChange={(e) => setSecurityProtocol(e.target.value as KafkaConnectionConfig['securityProtocol'])}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#007acc]/20 focus:border-[#007acc] text-gray-900 appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%23666%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E')] bg-[length:16px_16px] bg-[right_12px_center] bg-no-repeat"
        >
          <option value="PLAINTEXT">{t('kafka.plaintextNoEncryption')}</option>
          <option value="SSL">SSL / TLS</option>
          <option value="SASL_PLAINTEXT">{t('kafka.saslPlaintext')}</option>
          <option value="SASL_SSL">{t('kafka.saslSslRecommended')}</option>
        </select>
      </div>

      {/* SASL 认证配置 */}
      {needsSaslConfig && (
        <>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2.5">
              {t('kafka.saslMechanism')}
            </label>
            <select
              value={saslMechanism}
              onChange={(e) => setSaslMechanism(e.target.value as KafkaConnectionConfig['saslMechanism'])}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#007acc]/20 focus:border-[#007acc] text-gray-900 appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%23666%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E')] bg-[length:16px_16px] bg-[right_12px_center] bg-no-repeat"
            >
              <option value="PLAIN">PLAIN</option>
              <option value="SCRAM-SHA-256">SCRAM-SHA-256</option>
              <option value="SCRAM-SHA-512">SCRAM-SHA-512</option>
              <option value="GSSAPI">{t('kafka.gssapiKerberos')}</option>
            </select>
            <div className="text-[10px] text-gray-500 mt-1">
              <i className="fas fa-info-circle mr-1"></i>
              {t('kafka.plainAuthDescription')}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">
              {t('kafka.saslUsername')}
            </label>
            <input
              type="text"
              value={saslUsername}
              onChange={(e) => setSaslUsername(e.target.value)}
              placeholder={t('kafka.saslUsernamePlaceholder')}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#007acc]/20 focus:border-[#007acc] text-gray-900 placeholder:text-gray-400 transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">
              {t('kafka.saslPassword')}
            </label>
            <div className="flex items-center gap-2">
              <input
                type={showPassword ? 'text' : 'password'}
                value={saslPassword}
                onChange={(e) => setSaslPassword(e.target.value)}
                placeholder={t('kafka.saslPasswordPlaceholder')}
                className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#007acc]/20 focus:border-[#007acc] text-gray-900 placeholder:text-gray-400 transition-all"
              />
              <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer whitespace-nowrap">
                <input
                  type="checkbox"
                  checked={showPassword}
                  onChange={(e) => setShowPassword(e.target.checked)}
                  className="w-3.5 h-3.5 text-[#007acc] border-gray-300 rounded focus:ring-[#007acc]"
                />
                <span>{t('ssh.showPassword')}</span>
              </label>
            </div>
          </div>
        </>
      )}

      {/* SSL 证书配置 */}
      {needsSslConfig && (
        <>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">
              {t('kafka.sslTruststorePath')} <span className="text-gray-400">({t('databaseConnectionDialog.optional')})</span>
            </label>
            <input
              type="text"
              value={sslTruststoreLocation}
              onChange={(e) => setSslTruststoreLocation(e.target.value)}
              placeholder={t('kafka.sslTruststorePathPlaceholder')}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#007acc]/20 focus:border-[#007acc] text-gray-900 placeholder:text-gray-400 transition-all font-mono"
            />
            <div className="text-[10px] text-gray-500 mt-1">
              <i className="fas fa-info-circle mr-1"></i>
              {t('kafka.windowsPathNote')}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">
              {t('kafka.sslTruststorePassword')} <span className="text-gray-400">({t('databaseConnectionDialog.optional')})</span>
            </label>
            <input
              type={showPassword ? 'text' : 'password'}
              value={sslTruststorePassword}
              onChange={(e) => setSslTruststorePassword(e.target.value)}
              placeholder={t('kafka.sslTruststorePasswordPlaceholder')}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#007acc]/20 focus:border-[#007acc] text-gray-900 placeholder:text-gray-400 transition-all"
            />
            <div className="text-[10px] text-gray-500 mt-1">
              <i className="fas fa-info-circle mr-1"></i>
              {t('kafka.defaultPasswordNote')}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
