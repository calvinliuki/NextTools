'use client';

import { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../../../i18n/LanguageContext';
import LocalDirectoryPicker from '../common/LocalDirectoryPicker';

interface SSHConnectionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (config: SSHConnectionConfig) => void;
  initialConfig?: SSHConnectionConfig;
}

interface ApiResponse {
  code: number;
  message: string;
  data: any;
}

export interface SSHConnectionConfig {
  id?: string;
  name: string;
  host: string;
  port: number;
  username: string;
  authMethod: 'password' | 'privateKey';
  password?: string;
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
}

export default function SSHConnectionDialog({
  isOpen,
  onClose,
  onConfirm,
  initialConfig,
}: SSHConnectionDialogProps) {
  const { t } = useLanguage();

  const [showPassword, setShowPassword] = useState(false);
  const [showPassphrase, setShowPassphrase] = useState(false);
  const [privateKeyMode, setPrivateKeyMode] = useState<'text' | 'file'>('text');

  // Connection settings
  const [name, setName] = useState(initialConfig?.name || '');
  const [host, setHost] = useState(initialConfig?.host || '');
  const [port, setPort] = useState(initialConfig?.port || 22);
  const [username, setUsername] = useState(initialConfig?.username || '');
  const [authMethod, setAuthMethod] = useState<'password' | 'privateKey'>(initialConfig?.authMethod || 'password');
  const [password, setPassword] = useState(initialConfig?.password || '');
  const [privateKey, setPrivateKey] = useState(initialConfig?.privateKey || '');
  const [passphrase, setPassphrase] = useState(initialConfig?.passphrase || '');
  const [downloadDir, setDownloadDir] = useState(initialConfig?.downloadDir || '');
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  // Terminal settings
  const [fontSize, setFontSize] = useState(initialConfig?.terminalSettings?.fontSize || 14);
  const [fontFamily, setFontFamily] = useState(initialConfig?.terminalSettings?.fontFamily || 'Consolas, "Liberation Mono", Menlo, Courier, monospace');
  const [fontWeight, setFontWeight] = useState(initialConfig?.terminalSettings?.fontWeight || 'normal');
  const [foreground, setForeground] = useState(initialConfig?.terminalSettings?.foreground || '#00ff00');
  const [background, setBackground] = useState(initialConfig?.terminalSettings?.background || '#1e1e1e');
  const [cursorColor, setCursorColor] = useState(initialConfig?.terminalSettings?.cursorColor || '#00ff00');

  // State management
  const [isTesting, setIsTesting] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [testMessage, setTestMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const colorOptions = [
    '#165DFF', // Blue
    '#F53F3F', // Red
    '#FF7D00', // Orange
    '#722ED1', // Purple
    '#00B42A', // Green
    '#A6AD16', // Yellow-green
    '#EB0AA4', // Pink
  ];

  // Reset form stable function definition
  const handleResetForm = useCallback(() => {
    setName('');
    setHost('');
    setPort(22);
    setUsername('');
    setAuthMethod('password');
    setPassword('');
    setPrivateKey('');
    setPassphrase('');
    setDownloadDir('');
    setFontSize(14);
    setFontFamily('Consolas, "Liberation Mono", Menlo, Courier, monospace');
    setFontWeight('normal');
    setForeground('#00ff00');
    setBackground('#1e1e1e');
    setCursorColor('#00ff00');
    setShowPassword(false);
    setShowPassphrase(false);
    setPrivateKeyMode('text');
    setTestMessage(null);
  }, []);

  useEffect(() => {
    if (initialConfig) {
      setName(initialConfig.name || '');
      setHost(initialConfig.host || '');
      setPort(initialConfig.port || 22);
      setUsername(initialConfig.username || '');
      setAuthMethod(initialConfig.authMethod || 'password');
      setPassword(initialConfig.password || '');
      setPrivateKey(initialConfig.privateKey || '');
      setPassphrase(initialConfig.passphrase || '');
      setDownloadDir(initialConfig.downloadDir || '');
      setFontSize(initialConfig.terminalSettings?.fontSize || 14);
      setFontFamily(initialConfig.terminalSettings?.fontFamily || 'Consolas, "Liberation Mono", Menlo, Courier, monospace');
      setFontWeight(initialConfig.terminalSettings?.fontWeight || 'normal');
      setForeground(initialConfig.terminalSettings?.foreground || '#d4d4d4');
      setBackground(initialConfig.terminalSettings?.background || '#1e1e1e');
      setCursorColor(initialConfig.terminalSettings?.cursorColor || '#d4d4d4');
    } else {
      handleResetForm();

      // Only when creating new and dialog is open, auto-fetch system download directory
      if (isOpen) {
        fetch('/api/ssh/system/downloads')
          .then(res => res.json())
          .then(result => {
            if (result.code === 200 && result.data.path) {
              setDownloadDir(result.data.path);
            }
          })
          .catch(err => console.error('Failed to fetch system download directory:', err));
      }
    }
  }, [handleResetForm, initialConfig, isOpen]);

  if (!isOpen) return null;

  const handleCancel = () => {
    handleResetForm();
    onClose();
  };

  const adjustNumber = (value: number, delta: number, min: number = 0, max: number = 65535) => {
    const newValue = value + delta;
    return Math.max(min, Math.min(max, newValue));
  };

  // Test connection
  const handleTestConnection = async () => {
    if (!host || !port || !username) {
      setTestMessage({ type: 'error', text: t('sshConnectionDialog.fillHostPortUsername') });
      return;
    }

    if (authMethod === 'password' && !password) {
      setTestMessage({ type: 'error', text: t('sshConnectionDialog.fillPassword') });
      return;
    }

    if (authMethod === 'privateKey' && !privateKey) {
      setTestMessage({ type: 'error', text: t('sshConnectionDialog.fillPrivateKey') });
      return;
    }

    setIsTesting(true);
    setTestMessage(null);

    try {
      const requestBody: any = {
        name: name || 'Test Connection',
        host,
        port,
        username,
        authMethod,
      };

      if (authMethod === 'password') {
        requestBody.password = password;
      } else {
        requestBody.privateKey = privateKey;
        if (passphrase) {
          requestBody.passphrase = passphrase;
        }
      }

      const response = await fetch('/api/ssh/connections/test', {
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
          text: result.message || t('sshConnectionDialog.connectionTestSuccess'),
        });
      } else {
        setTestMessage({
          type: 'error',
          text: result.message || t('sshConnectionDialog.connectionTestFailed'),
        });
      }
    } catch (error: any) {
      setTestMessage({
        type: 'error',
        text: `${t('sshConnectionDialog.requestFailed')}: ${error?.message || t('sshConnectionDialog.networkError')}`,
      });
    } finally {
      setIsTesting(false);
    }
  };

  // Create connection
  const handleCreateConnection = async () => {
    if (!name.trim()) {
      setTestMessage({ type: 'error', text: t('sshConnectionDialog.fillConnectionName') });
      return;
    }
    if (!host || !port || !username) {
      setTestMessage({ type: 'error', text: t('sshConnectionDialog.fillHostPortUsername') });
      return;
    }

    if (authMethod === 'password' && !password) {
      setTestMessage({ type: 'error', text: t('sshConnectionDialog.fillPassword') });
      return;
    }

    if (authMethod === 'privateKey' && !privateKey) {
      setTestMessage({ type: 'error', text: t('sshConnectionDialog.fillPrivateKey') });
      return;
    }

    setIsCreating(true);
    setTestMessage(null);

    try {
      const requestBody: any = {
        id: initialConfig?.id,
        name: name.trim(),
        host,
        port,
        username,
        authMethod,
        downloadDir,
        terminalSettings: {
          fontSize,
          fontFamily,
          fontWeight,
          foreground,
          background,
          cursorColor,
        }
      };

      if (authMethod === 'password') {
        requestBody.password = password;
      } else {
        requestBody.privateKey = privateKey;
        if (passphrase) {
          requestBody.passphrase = passphrase;
        }
      }

      const response = await fetch('/api/ssh/connections/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const result: ApiResponse = await response.json();

      if (result.code === 200) {
        const config: SSHConnectionConfig = {
          id: result.data?.id || initialConfig?.id,
          name,
          host,
          port,
          username,
          authMethod,
          downloadDir,
          password: authMethod === 'password' ? password : undefined,
          privateKey: authMethod === 'privateKey' ? privateKey : undefined,
          passphrase: authMethod === 'privateKey' ? passphrase : undefined,
          terminalSettings: {
            fontSize,
            fontFamily,
            fontWeight,
            foreground,
            background,
            cursorColor,
          }
        };
        onConfirm(config);
        handleResetForm();
        onClose();
      } else {
        setTestMessage({
          type: 'error',
          text: result.message || t('sshConnectionDialog.operationFailed'),
        });
      }
    } catch (error: any) {
      setTestMessage({
        type: 'error',
        text: `${t('sshConnectionDialog.requestFailed')}: ${error?.message || t('sshConnectionDialog.networkError')}`,
      });
    } finally {
      setIsCreating(false);
    }
  };

  // Handle private key file upload
  const handlePrivateKeyFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        setPrivateKey(content);
      };
      reader.readAsText(file);
    }
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
          className="bg-white rounded-lg shadow-[0_20px_60px_-12px_rgba(0,0,0,0.25)] w-[600px] h-[700px] max-h-[80vh] flex flex-col pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Title bar */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 bg-white rounded-t-lg">
            <h2 className="text-base font-semibold text-gray-900">{t('ssh.sshConnectionSettings')}</h2>
            <button
              onClick={handleCancel}
              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-md transition-all"
              title={t('sshConnectionDialog.close')}
            >
              <i className="fas fa-times text-xs"></i>
            </button>
          </div>

          {/* Content area */}
          <div className="flex-1 overflow-y-auto px-5 py-5 bg-gray-50">
            {/* Test connection message */}
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

            <div className="space-y-5">
              {/* Name */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  {t('sshConnectionDialog.connectionName')} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t('sshConnectionDialog.connectionName')}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#165DFF]/20 focus:border-[#165DFF] text-gray-900 placeholder:text-gray-400 transition-all"
                />
              </div>

              {/* Host address and port */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  {t('sshConnectionDialog.hostAddress')} <span className="text-red-500">*</span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={host}
                    onChange={(e) => setHost(e.target.value)}
                    placeholder={t('sshConnectionDialog.hostAddress')}
                    className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#165DFF]/20 focus:border-[#165DFF] text-gray-900 transition-all"
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
                        const val = parseInt(e.target.value) || 22;
                        setPort(Math.max(1, Math.min(65535, val)));
                      }}
                      className="w-20 px-2 py-2 text-sm text-center border-0 focus:outline-none focus:ring-2 focus:ring-[#165DFF]/20 text-gray-900 bg-transparent"
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

              {/* Username */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  {t('sshConnectionDialog.username')} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder={t('sshConnectionDialog.username')}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#165DFF]/20 focus:border-[#165DFF] text-gray-900 placeholder:text-gray-400 transition-all"
                />
              </div>

              {/* Default download directory */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  {t('sshConnectionDialog.defaultDownloadDir')} <span className="text-gray-400">({t('sshConnectionDialog.optional')})</span>
                </label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={downloadDir}
                      onChange={(e) => setDownloadDir(e.target.value)}
                      placeholder={t('sshConnectionDialog.downloadPath')}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#165DFF]/20 focus:border-[#165DFF] text-gray-900 placeholder:text-gray-400 transition-all pl-8"
                    />
                    <i className="fas fa-download absolute left-3 top-2.5 text-gray-400 text-xs"></i>
                  </div>
                  <button
                    onClick={() => setIsPickerOpen(true)}
                    className="p-2 text-gray-500 hover:text-[#165DFF] hover:bg-gray-100 border border-gray-200 rounded-md transition-all flex-shrink-0"
                    title={t('sshConnectionDialog.selectDirectory')}
                  >
                    <i className="fas fa-folder-open text-sm"></i>
                  </button>
                </div>
                <p className="mt-1 text-[10px] text-gray-500 italic">
                  * {t('sshConnectionDialog.defaultDownloadDirHint')}
                </p>
              </div>

              <LocalDirectoryPicker 
                isOpen={isPickerOpen}
                onClose={() => setIsPickerOpen(false)}
                onSelect={(path) => {
                  setDownloadDir(path);
                  setIsPickerOpen(false);
                }}
                initialPath={downloadDir}
              />

              {/* Authentication method */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-2.5">
                  {t('sshConnectionDialog.authMethod')} <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { value: 'password' as const, label: t('sshConnectionDialog.password'), icon: 'fa-lock' },
                    { value: 'privateKey' as const, label: t('sshConnectionDialog.privateKey'), icon: 'fa-key' },
                  ].map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setAuthMethod(option.value)}
                      className={`p-3 rounded-md border-2 transition-all flex flex-col items-center gap-2 ${
                        authMethod === option.value
                          ? 'border-[#165DFF] bg-[#165DFF]/5 text-[#165DFF]'
                          : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <i className={`fas ${option.icon} text-base`}></i>
                      <span className="text-xs font-medium">{option.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Password authentication */}
              {authMethod === 'password' && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">
                    {t('sshConnectionDialog.password')} <span className="text-red-500">*</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={t('sshConnectionDialog.password')}
                      className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#165DFF]/20 focus:border-[#165DFF] text-gray-900 placeholder:text-gray-400 transition-all"
                    />
                    <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={showPassword}
                        onChange={(e) => setShowPassword(e.target.checked)}
                        className="w-3.5 h-3.5 text-[#165DFF] border-gray-300 rounded focus:ring-[#165DFF]"
                      />
                      <span>{t('ssh.showPassword')}</span>
                    </label>
                  </div>
                </div>
              )}

              {/* Private key authentication */}
              {authMethod === 'privateKey' && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-2.5">
                      {t('sshConnectionDialog.privateKeyInputMethod')}
                    </label>
                    <div className="flex gap-3">
                      {[
                        { value: 'text' as const, label: t('sshConnectionDialog.pasteContent') },
                        { value: 'file' as const, label: t('sshConnectionDialog.uploadFile') },
                      ].map((option) => (
                        <button
                          key={option.value}
                          onClick={() => setPrivateKeyMode(option.value)}
                          className={`flex-1 px-3 py-1.5 text-xs rounded-md transition-all border ${
                            privateKeyMode === option.value
                              ? 'border-[#165DFF] bg-[#165DFF]/5 text-[#165DFF]'
                              : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                          }`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="text-xs text-gray-500 mt-1">
                    <i className="fas fa-info-circle mr-1"></i>
                    {t('sshConnectionDialog.privateKeyHint')}
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">
                      {t('sshConnectionDialog.privateKey')} <span className="text-red-500">*</span>
                    </label>
                    <div className="text-[10px] text-gray-500 mb-1">
                      {t('sshConnectionDialog.privateKeyTip')}
                    </div>
                    {privateKeyMode === 'text' ? (
                      <textarea
                        value={privateKey}
                        onChange={(e) => setPrivateKey(e.target.value)}
                        placeholder={t('sshConnectionDialog.privateKey')}
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#165DFF]/20 focus:border-[#165DFF] text-gray-900 placeholder:text-gray-400 transition-all font-mono text-[11px] h-20"
                      />
                    ) : (
                      <div className="border-2 border-dashed border-gray-300 rounded-md p-3 text-center hover:border-[#165DFF] hover:bg-[#165DFF]/5 transition-all">
                        <input
                          type="file"
                          onChange={handlePrivateKeyFileUpload}
                          className="hidden"
                          id="privateKeyFile"
                          accept=".pem,.key,.ppk,.rsa,.pkcs8,.der,.p12"
                        />
                        <label htmlFor="privateKeyFile" className="cursor-pointer flex flex-col items-center gap-1">
                          <i className="fas fa-cloud-upload-alt text-[#165DFF] text-lg"></i>
                          <span className="text-xs text-gray-600">{t('ssh.dragDropKey')}</span>
                          <span className="text-[10px] text-gray-400">{t('ssh.supportedFormats')}</span>
                          <span className="text-[10px] text-red-400">{t('ssh.unsupportedFormat')}</span>
                        </label>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">
                      {t('sshConnectionDialog.passphrase')} <span className="text-gray-400">({t('sshConnectionDialog.optional')})</span>
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type={showPassphrase ? 'text' : 'password'}
                        value={passphrase}
                        onChange={(e) => setPassphrase(e.target.value)}
                        placeholder={t('sshConnectionDialog.passphrase')}
                        className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#165DFF]/20 focus:border-[#165DFF] text-gray-900 placeholder:text-gray-400 transition-all"
                      />
                      <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={showPassphrase}
                          onChange={(e) => setShowPassphrase(e.target.checked)}
                          className="w-3.5 h-3.5 text-[#165DFF] border-gray-300 rounded focus:ring-[#165DFF]"
                        />
                        <span>{t('ssh.show')}</span>
                      </label>
                    </div>
                  </div>
                </>
              )}

              {/* Terminal display settings */}
              <div className="pt-4 border-t border-gray-200">
                <h3 className="text-sm font-semibold text-gray-900 mb-4">{t('ssh.terminalDisplaySettings')}</h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    {/* Font size */}
                    <div>
                      <label className="block text-[11px] font-medium text-gray-500 mb-1.5 uppercase tracking-wider">
                        {t('sshConnectionDialog.fontSize')}
                      </label>
                      <div className="flex items-center gap-3">
                        <input
                          type="range"
                          min="10"
                          max="24"
                          step="1"
                          value={fontSize}
                          onChange={(e) => setFontSize(parseInt(e.target.value))}
                          className="flex-1 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#165DFF]"
                        />
                        <span className="text-xs text-gray-600 tabular-nums w-8 text-right">{fontSize}px</span>
                      </div>
                    </div>

                    {/* Font color */}
                    <div>
                      <label className="block text-[11px] font-medium text-gray-500 mb-1.5 uppercase tracking-wider">
                        {t('sshConnectionDialog.fontColor')}
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={foreground}
                          onChange={(e) => setForeground(e.target.value)}
                          className="w-8 h-8 rounded border border-gray-200 p-0.5 bg-white cursor-pointer"
                        />
                        <input
                          type="text"
                          value={foreground}
                          onChange={(e) => setForeground(e.target.value)}
                          className="flex-1 px-2 py-1 text-xs border border-gray-200 rounded bg-white text-gray-700 font-mono"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {/* Background color */}
                    <div>
                      <label className="block text-[11px] font-medium text-gray-500 mb-1.5 uppercase tracking-wider">
                        {t('sshConnectionDialog.backgroundColor')}
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={background}
                          onChange={(e) => setBackground(e.target.value)}
                          className="w-8 h-8 rounded border border-gray-200 p-0.5 bg-white cursor-pointer"
                        />
                        <input
                          type="text"
                          value={background}
                          onChange={(e) => setBackground(e.target.value)}
                          className="flex-1 px-2 py-1 text-xs border border-gray-200 rounded bg-white text-gray-700 font-mono"
                        />
                      </div>
                    </div>

                    {/* Cursor color */}
                    <div>
                      <label className="block text-[11px] font-medium text-gray-500 mb-1.5 uppercase tracking-wider">
                        {t('sshConnectionDialog.cursorColor')}
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={cursorColor}
                          onChange={(e) => setCursorColor(e.target.value)}
                          className="w-8 h-8 rounded border border-gray-200 p-0.5 bg-white cursor-pointer"
                        />
                        <input
                          type="text"
                          value={cursorColor}
                          onChange={(e) => setCursorColor(e.target.value)}
                          className="flex-1 px-2 py-1 text-xs border border-gray-200 rounded bg-white text-gray-700 font-mono"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Font family and weight */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-medium text-gray-500 mb-1.5 uppercase tracking-wider">
                        {t('sshConnectionDialog.fontFamily')}
                      </label>
                      <select
                        value={fontFamily}
                        onChange={(e) => setFontFamily(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#165DFF]/20 focus:border-[#165DFF] text-gray-900 appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%23666%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E')] bg-[length:16px_16px] bg-[right_12px_center] bg-no-repeat"
                      >
                        <option value='Consolas, "Liberation Mono", Menlo, Courier, monospace'>Consolas {t('sshConnectionDialog.recommended')}</option>
                        <option value='"Fira Code", monospace'>Fira Code</option>
                        <option value='"Source Code Pro", monospace'>Source Code Pro</option>
                        <option value='"Ubuntu Mono", monospace'>Ubuntu Mono</option>
                        <option value='Menlo, Monaco, "Courier New", monospace'>System Mono</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-gray-500 mb-1.5 uppercase tracking-wider">
                        {t('sshConnectionDialog.fontWeight')}
                      </label>
                      <select
                        value={fontWeight}
                        onChange={(e) => setFontWeight(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#165DFF]/20 focus:border-[#165DFF] text-gray-900 appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%23666%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E')] bg-[length:16px_16px] bg-[right_12px_center] bg-no-repeat"
                      >
                        <option value="normal">{t('sshConnectionDialog.normal')} (Normal)</option>
                        <option value="bold">{t('sshConnectionDialog.bold')} (Bold)</option>
                        <option value="100">100 ({t('sshConnectionDialog.thin')})</option>
                        <option value="300">300 ({t('sshConnectionDialog.light')})</option>
                        <option value="500">500 ({t('sshConnectionDialog.medium')})</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom buttons */}
          <div className="flex items-center justify-between px-5 py-3.5 border-t border-gray-100 bg-white rounded-b-lg">
            <button
              onClick={handleTestConnection}
              disabled={isTesting || isCreating}
              className="px-3 py-1.5 text-xs text-gray-600 hover:text-gray-800 hover:bg-gray-50 rounded-md transition-all flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <i className={`fas ${isTesting ? 'fa-spinner fa-spin' : 'fa-wrench'} text-xs`}></i>
              {isTesting ? t('sshConnectionDialog.testing') : t('sshConnectionDialog.test')}
            </button>
            <div className="flex items-center gap-2.5">
              <button
                onClick={handleCancel}
                className="px-4 py-1.5 text-sm text-gray-700 hover:bg-gray-50 rounded-md transition-all"
              >
                {t('sshConnectionDialog.cancel')}
              </button>
              <button
                onClick={handleCreateConnection}
                disabled={!name.trim() || isCreating || isTesting}
                className="px-4 py-1.5 text-sm font-medium bg-[#165DFF] text-white rounded-md hover:bg-[#0E42BD] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow flex items-center gap-2"
              >
                {isCreating && <i className="fas fa-spinner fa-spin text-xs"></i>}
                {isCreating ? t('sshConnectionDialog.saving') : t('sshConnectionDialog.confirm')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
