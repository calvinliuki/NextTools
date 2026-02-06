'use client';

import { useState, useEffect } from 'react';
import { useLanguage } from '../../../../i18n/LanguageContext';

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

interface DatabaseConnectionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (config: DatabaseConnectionConfig) => void;
  initialConfig?: DatabaseConnectionConfig;
}

export default function DatabaseConnectionDialog({
  isOpen,
  onClose,
  onConfirm,
  initialConfig,
}: DatabaseConnectionDialogProps) {
  const { t } = useLanguage();
  const [config, setConfig] = useState<DatabaseConnectionConfig>({
    name: '',
    databaseType: 'mysql',
    host: 'localhost',
    port: 3306,
    username: '',
    password: '',
    databaseName: '',
    filePath: '',
    additionalParams: '',
    connectionTimeout: 30,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  // Use useEffect to respond to initialConfig changes
  useEffect(() => {
    if (isOpen && initialConfig) {
      setConfig({
        name: initialConfig.name || '',
        databaseType: initialConfig.databaseType || 'mysql',
        host: initialConfig.host || (initialConfig.databaseType === 'sqlite' ? 'localhost' : ''),
        port: initialConfig.port || (initialConfig.databaseType === 'mysql' ? 3306 : initialConfig.databaseType === 'postgresql' ? 5432 : 3306),
        username: initialConfig.username || '',
        password: initialConfig.password || '',
        databaseName: initialConfig.databaseName || '',
        filePath: initialConfig.filePath || '',
        additionalParams: initialConfig.additionalParams || '',
        connectionTimeout: initialConfig.connectionTimeout || 30,
        id: initialConfig.id, // Preserve id
      });
    } else if (isOpen && !initialConfig?.id) {
      setConfig({
        name: '',
        databaseType: 'mysql',
        host: 'localhost',
        port: 3306,
        username: '',
        password: '',
        databaseName: '',
        filePath: '',
        additionalParams: '',
        connectionTimeout: 30,
      });
    }
  }, [initialConfig, isOpen]);

  const handleChange = (field: keyof DatabaseConnectionConfig, value: any) => {
    setConfig(prev => ({ ...prev, [field]: value }));
    // Clear error for this field
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!config.name.trim()) {
      newErrors.name = t('databaseConnectionDialog.requiredConnectionName');
    }

    if (config.databaseType !== 'sqlite') {
      if (!config.host?.trim()) {
        newErrors.host = t('databaseConnectionDialog.requiredHostAddress');
      }
      if (!config.port || config.port <= 0) {
        newErrors.port = t('databaseConnectionDialog.invalidPort');
      }
    } else {
      if (!config.filePath?.trim()) {
        newErrors.filePath = t('databaseConnectionDialog.requiredDatabaseFilePath');
      }
    }

    if (!config.username && config.databaseType !== 'sqlite') {
      newErrors.username = t('databaseConnectionDialog.requiredUsername');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleTestConnection = async () => {
    if (!validate()) return;
    
    setIsTesting(true);
    setTestResult(null);
    
    try {
      // Send test connection request
      const response = await fetch('/api/database/connections/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config),
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setTestResult({ success: true, message: data.message || t('databaseConnectionDialog.testSuccess') });
      } else {
        setTestResult({ success: false, message: data.message || t('databaseConnectionDialog.testFailed') });
      }
    } catch (error: any) {
      setTestResult({ success: false, message: error.message || t('databaseConnectionDialog.networkError') });
    } finally {
      setIsTesting(false);
    }
  };

  const handleConfirm = async () => {
    if (!validate()) return;

    setIsSaving(true);
    setTestResult(null);

    try {
      const response = await fetch('/api/database/connections/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config),
      });

      const result = await response.json();

      if (result.code === 200) {
        onConfirm({
          ...config,
          id: result.data?.id || config.id
        });
        handleClose();
      } else {
        setTestResult({ success: false, message: result.message || t('databaseConnectionDialog.saveFailed') });
      }
    } catch (error: any) {
      setTestResult({ success: false, message: `${t('databaseConnectionDialog.saveFailed')}：${error?.message || t('databaseConnectionDialog.connectionError')}` });
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    setErrors({});
    setTestResult(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-50 transition-opacity bg-black/30"
        onClick={handleClose}
      ></div>

      <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
        <div
          className="bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all w-full max-w-2xl pointer-events-auto"
          onClick={e => e.stopPropagation()}
        >
          <form onSubmit={(e) => { e.preventDefault(); handleConfirm(); }}>
          <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <div className="w-full">
              <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4 px-4">
                {initialConfig?.id ? t('databaseConnectionDialog.titleEdit') : t('databaseConnectionDialog.titleNew')}
              </h3>
              
              <div className="mt-2 space-y-4 px-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('databaseConnectionDialog.connectionName')} *</label>
                    <input
                      type="text"
                      value={config.name}
                      onChange={(e) => handleChange('name', e.target.value)}
                      className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${errors.name ? 'border-red-500' : 'border-gray-300'}`}
                      placeholder={t('databaseConnectionDialog.placeholderConnectionName')}
                    />
                    {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('databaseConnectionDialog.databaseType')} *</label>
                    <select
                      value={config.databaseType}
                      onChange={(e) => handleChange('databaseType', e.target.value as any)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="mysql">MySQL</option>
                      <option value="postgresql">PostgreSQL</option>
                      <option value="sqlite">SQLite</option>
                    </select>
                  </div>
                </div>

                {config.databaseType !== 'sqlite' ? (
                  <>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="col-span-1">
                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('databaseConnectionDialog.port')} *</label>
                        <input
                          type="number"
                          value={config.port || ''}
                          onChange={(e) => handleChange('port', e.target.value ? Number(e.target.value) : undefined)}
                          className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${errors.port ? 'border-red-500' : 'border-gray-300'}`}
                          placeholder={t('databaseConnectionDialog.placeholderPort')}
                        />
                        {errors.port && <p className="mt-1 text-sm text-red-600">{errors.port}</p>}
                      </div>
                      
                      <div className="col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('databaseConnectionDialog.hostAddress')} *</label>
                        <input
                          type="text"
                          value={config.host || ''}
                          onChange={(e) => handleChange('host', e.target.value)}
                          className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${errors.host ? 'border-red-500' : 'border-gray-300'}`}
                          placeholder={t('databaseConnectionDialog.placeholderHostAddress')}
                        />
                        {errors.host && <p className="mt-1 text-sm text-red-600">{errors.host}</p>}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('databaseConnectionDialog.databaseFilePath')} *</label>
                    <input
                      type="text"
                      value={config.filePath || ''}
                      onChange={(e) => handleChange('filePath', e.target.value)}
                      className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${errors.filePath ? 'border-red-500' : 'border-gray-300'}`}
                      placeholder={t('databaseConnectionDialog.placeholderDatabaseFilePath')}
                    />
                    {errors.filePath && <p className="mt-1 text-sm text-red-600">{errors.filePath}</p>}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('databaseConnectionDialog.username')} *</label>
                    <input
                      type="text"
                      value={config.username || ''}
                      onChange={(e) => handleChange('username', e.target.value)}
                      className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${errors.username ? 'border-red-500' : 'border-gray-300'}`}
                      placeholder={t('databaseConnectionDialog.placeholderUsername')}
                    />
                    {errors.username && <p className="mt-1 text-sm text-red-600">{errors.username}</p>}
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('databaseConnectionDialog.password')}</label>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        value={config.password || ''}
                        onChange={(e) => handleChange('password', e.target.value)}
                        className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        placeholder={t('databaseConnectionDialog.placeholderPassword')}
                      />
                      <button
                        type="button"
                        className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-500 hover:text-gray-700"
                        onClick={() => setShowPassword(!showPassword)}
                        aria-label={showPassword ? t('databaseConnectionDialog.hidePassword') : t('databaseConnectionDialog.showPassword')}
                      >
                        {showPassword ? (
                          <i className="fas fa-eye-slash text-sm"></i>
                        ) : (
                          <i className="fas fa-eye text-sm"></i>
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('databaseConnectionDialog.databaseName')}
                  </label>
                  <input
                    type="text"
                    value={config.databaseName || ''}
                    onChange={(e) => handleChange('databaseName', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder={t('databaseConnectionDialog.placeholderDatabaseName')}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('databaseConnectionDialog.additionalParams')}</label>
                  <input
                    type="text"
                    value={config.additionalParams || ''}
                    onChange={(e) => handleChange('additionalParams', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder={t('databaseConnectionDialog.placeholderAdditionalParams')}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('databaseConnectionDialog.connectionTimeout')} (Seconds)</label>
                  <input
                    type="number"
                    value={config.connectionTimeout || ''}
                    onChange={(e) => handleChange('connectionTimeout', e.target.value ? Number(e.target.value) : undefined)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder={t('databaseConnectionDialog.placeholderConnectionTimeout')}
                  />
                </div>
                
                {/* Test result display area */}
                {testResult && (
                  <div className={`p-3 rounded-md text-sm ${
                    testResult.success ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
                  }`}>
                    <div className="flex items-center gap-2">
                      <i className={`fas ${testResult.success ? 'fa-check-circle' : 'fa-exclamation-circle'}`}></i>
                      <span>{testResult.message}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          <div className="bg-gray-50 px-4 py-3 sm:px-10 flex flex-row justify-between items-center">
            <div>
              <button
                type="button"
                disabled={isTesting}
                onClick={handleTestConnection}
                className="inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-gray-200 text-base font-medium text-gray-700 hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:w-auto sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isTesting ? (
                  <span className="flex items-center">
                    <i className="fas fa-spinner fa-spin mr-2"></i>
                    {t('databaseConnectionDialog.testing')}
                  </span>
                ) : (
                  <span>{t('databaseConnectionDialog.testConnection')}</span>
                )}
              </button>
            </div>
            <div className="flex flex-row gap-3">
              <button
                type="button"
                className="inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:w-auto sm:text-sm"
                onClick={handleClose}
              >
                {t('databaseConnectionDialog.cancel')}
              </button>
              <button
                type="submit"
                disabled={isSaving || isTesting}
                className="inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:w-auto sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? (
                  <span className="flex items-center">
                    <i className="fas fa-spinner fa-spin mr-2"></i>
                    {t('databaseConnectionDialog.saving')}
                  </span>
                ) : (
                  t('databaseConnectionDialog.confirm')
                )}
              </button>
            </div>
          </div>
          </form>
        </div>
      </div>
    </>
  );
}
