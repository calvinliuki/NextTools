'use client';

import { useLanguage } from '../../../../i18n/LanguageContext';

interface AdvancedSettingsFormProps {
  connectionTimeout: number;
  setConnectionTimeout: (value: number) => void;
  requestTimeout: number;
  setRequestTimeout: (value: number) => void;
  sessionTimeout: number;
  setSessionTimeout: (value: number) => void;
  heartbeatInterval: number;
  setHeartbeatInterval: (value: number) => void;
  maxPollRecords: number;
  setMaxPollRecords: (value: number) => void;
}

export default function AdvancedSettingsForm({
  connectionTimeout,
  setConnectionTimeout,
  requestTimeout,
  setRequestTimeout,
  sessionTimeout,
  setSessionTimeout,
  heartbeatInterval,
  setHeartbeatInterval,
  maxPollRecords,
  setMaxPollRecords,
}: AdvancedSettingsFormProps) {
  const { t } = useLanguage();
  const adjustNumber = (value: number, delta: number, min: number = 1, max: number = 9999) => {
    const newValue = value + delta;
    return Math.max(min, Math.min(max, newValue));
  };

  return (
    <div className="space-y-5">
      {/* 超时设置 */}
      <div>
        <h3 className="text-xs font-semibold text-gray-700 mb-3">{t('kafka.timeoutSettings')}</h3>
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[180px]">
            <label className="block text-xs font-medium text-gray-600 mb-1.5">
              {t('databaseConnectionDialog.connectionTimeout')}:
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
                  const val = parseInt(e.target.value) || 30;
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
              {t('kafka.requestTimeoutSeconds')}
            </label>
            <div className="flex items-center border border-gray-200 rounded-md bg-white overflow-hidden w-32">
              <button
                onClick={() => setRequestTimeout(adjustNumber(requestTimeout, -1, 1))}
                className="px-2.5 py-2 text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors"
              >
                <i className="fas fa-minus text-xs"></i>
              </button>
              <input
                type="number"
                value={requestTimeout}
                onChange={(e) => {
                  const val = parseInt(e.target.value) || 30;
                  setRequestTimeout(Math.max(1, val));
                }}
                className="flex-1 px-2 py-2 text-sm text-center border-0 focus:outline-none focus:ring-2 focus:ring-[#007acc]/20 text-gray-900 bg-transparent"
                min="1"
              />
              <button
                onClick={() => setRequestTimeout(adjustNumber(requestTimeout, 1, 1))}
                className="px-2.5 py-2 text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors"
              >
                <i className="fas fa-plus text-xs"></i>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 消费者设置 */}
      <div>
        <h3 className="text-xs font-semibold text-gray-700 mb-3">{t('kafka.consumerSettings')}</h3>
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[180px]">
            <label className="block text-xs font-medium text-gray-600 mb-1.5">
              {t('kafka.sessionTimeoutSeconds')}
            </label>
            <div className="flex items-center border border-gray-200 rounded-md bg-white overflow-hidden w-32">
              <button
                onClick={() => setSessionTimeout(adjustNumber(sessionTimeout, -1, 1))}
                className="px-2.5 py-2 text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors"
              >
                <i className="fas fa-minus text-xs"></i>
              </button>
              <input
                type="number"
                value={sessionTimeout}
                onChange={(e) => {
                  const val = parseInt(e.target.value) || 10;
                  setSessionTimeout(Math.max(1, val));
                }}
                className="flex-1 px-2 py-2 text-sm text-center border-0 focus:outline-none focus:ring-2 focus:ring-[#007acc]/20 text-gray-900 bg-transparent"
                min="1"
              />
              <button
                onClick={() => setSessionTimeout(adjustNumber(sessionTimeout, 1, 1))}
                className="px-2.5 py-2 text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors"
              >
                <i className="fas fa-plus text-xs"></i>
              </button>
            </div>
          </div>
          <div className="flex-1 min-w-[180px]">
            <label className="block text-xs font-medium text-gray-600 mb-1.5">
              {t('kafka.heartbeatIntervalSeconds')}
            </label>
            <div className="flex items-center border border-gray-200 rounded-md bg-white overflow-hidden w-32">
              <button
                onClick={() => setHeartbeatInterval(adjustNumber(heartbeatInterval, -1, 1))}
                className="px-2.5 py-2 text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors"
              >
                <i className="fas fa-minus text-xs"></i>
              </button>
              <input
                type="number"
                value={heartbeatInterval}
                onChange={(e) => {
                  const val = parseInt(e.target.value) || 3;
                  setHeartbeatInterval(Math.max(1, val));
                }}
                className="flex-1 px-2 py-2 text-sm text-center border-0 focus:outline-none focus:ring-2 focus:ring-[#007acc]/20 text-gray-900 bg-transparent"
                min="1"
              />
              <button
                onClick={() => setHeartbeatInterval(adjustNumber(heartbeatInterval, 1, 1))}
                className="px-2.5 py-2 text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors"
              >
                <i className="fas fa-plus text-xs"></i>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 消费设置 */}
      <div>
        <h3 className="text-xs font-semibold text-gray-700 mb-3">{t('kafka.consumptionSettings')}</h3>
        <div className="flex-1 min-w-[180px]">
          <label className="block text-xs font-medium text-gray-600 mb-1.5">
            {t('kafka.maxPollRecords')}
          </label>
          <div className="flex items-center border border-gray-200 rounded-md bg-white overflow-hidden w-32">
            <button
              onClick={() => setMaxPollRecords(adjustNumber(maxPollRecords, -10, 1))}
              className="px-2.5 py-2 text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors"
            >
              <i className="fas fa-minus text-xs"></i>
            </button>
            <input
              type="number"
              value={maxPollRecords}
              onChange={(e) => {
                const val = parseInt(e.target.value) || 500;
                setMaxPollRecords(Math.max(1, val));
              }}
              className="flex-1 px-2 py-2 text-sm text-center border-0 focus:outline-none focus:ring-2 focus:ring-[#007acc]/20 text-gray-900 bg-transparent"
              min="1"
            />
            <button
              onClick={() => setMaxPollRecords(adjustNumber(maxPollRecords, 10, 1))}
              className="px-2.5 py-2 text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors"
            >
              <i className="fas fa-plus text-xs"></i>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
