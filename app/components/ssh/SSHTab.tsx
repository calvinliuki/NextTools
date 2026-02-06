'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { connectionDataManager } from '@/lib/connectionCache';
import { useLanguage } from '@/i18n/LanguageContext';
import { SFTPModal } from './sftp';
import TerminalPanel from './TerminalPanel';

interface SSHTabProps {
  connectionId: string;
  connectionName: string;
}

const SSHTab = React.forwardRef<{ closeConnection: () => void }, SSHTabProps>(({ connectionId, connectionName }, ref) => {
  // Define Refs
  const { t } = useLanguage();
  const terminalRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const terminalRefInstance = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const isManuallyClosingRef = useRef(false);
  const hasInitializedRef = useRef(false);
  const currentPathRef = useRef<string>('~');
  const inputBufferRef = useRef<string>('');
  const connectionConfigRef = useRef<any>(null); // Store connection configuration

  // Expose close WebSocket method to parent component
  React.useImperativeHandle(ref, () => ({
    closeConnection: () => {
      isManuallyClosingRef.current = true;
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.close();
      }
    },
  }), []);

  // Load connection configuration
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const response = await fetch(`/api/ssh/connections/all`);
        const result = await response.json();
        if (result.code === 200 && result.data) {
          const config = result.data.find((conn: any) => conn.id === connectionId);
          connectionConfigRef.current = config;
          console.log(t('sshTab.configLoaded'), config?.downloadDir);
        }
      } catch (error) {
        console.error(t('sshTab.loadConfigFailed'), error);
      }
    };
    loadConfig();
  }, [connectionId, t]);

  // State management
  const [isConnected, setIsConnected] = useState(false);
  const [isSFTPModalOpen, setIsSFTPModalOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState('');
  const [downloadStatus, setDownloadStatus] = useState<{show: boolean, msg: string, success?: boolean}>({show: false, msg: ''});

  // Update time
  useEffect(() => {
    const updateTime = () => {
      setCurrentTime(new Date().toLocaleTimeString('zh-CN', { hour12: false }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Download trigger function
  const triggerDownload = async (remotePath: string, localFileName: string) => {
    // Get latest configuration from Ref to get download directory
    const allSSHConnections = connectionDataManager.getSSHConnections();
    const connection = allSSHConnections.find(conn => conn.id === connectionId);
    const downloadDir = connectionConfigRef.current?.downloadDir || connection?.downloadDir;
    
    if (downloadDir) {
      const isWindows = downloadDir.includes('\\');
      const separator = isWindows ? '\\' : '/';
      const localFilePath = downloadDir.endsWith(separator) 
        ? `${downloadDir}${localFileName}` 
        : `${downloadDir}${separator}${localFileName}`;
        
      setDownloadStatus({show: true, msg: t('sshTab.downloading', {fileName: localFileName})});
      
      try {
        const res = await fetch('/api/ssh/sftp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            connectionId,
            action: 'download-to-local',
            path: remotePath,
            localPath: localFilePath
          })
        });
        const result = await res.json();
        if (result.success) {
          setDownloadStatus({show: true, msg: t('sshTab.downloadSuccess', {filePath: localFilePath}), success: true});
          setTimeout(() => setDownloadStatus({show: false, msg: ''}), 5000);
        } else {
          setDownloadStatus({show: true, msg: t('sshTab.downloadFailed', {error: result.error}), success: false});
          setTimeout(() => setDownloadStatus({show: false, msg: ''}), 5000);
        }
      } catch (err: any) {
        setDownloadStatus({show: true, msg: t('sshTab.downloadError', {message: err.message}), success: false});
        setTimeout(() => setDownloadStatus({show: false, msg: ''}), 5000);
      }
    } else {
      setDownloadStatus({show: true, msg: t('sshTab.noDownloadDirectory'), success: false});
      setTimeout(() => setDownloadStatus({show: false, msg: ''}), 3000);
      
      const downloadUrl = `/api/ssh/sftp?connectionId=${connectionId}&path=${encodeURIComponent(remotePath)}`;
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = localFileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  // Initialize terminal and connection
  useEffect(() => {
    if (hasInitializedRef.current) return;
    hasInitializedRef.current = true;
    
    if (!terminalRef.current) return;

    // 获取连接配置
    const allSSHConnections = connectionDataManager.getSSHConnections();
    const connection = allSSHConnections.find(conn => conn.id === connectionId);
    const termSettings = connection?.terminalSettings;

    // 创建终端实例
    const term = new Terminal({
      cursorBlink: true,
      cursorStyle: 'block',
      cursorWidth: 1,
      fontSize: termSettings?.fontSize || 14,
      fontFamily: termSettings?.fontFamily || 'Consolas, "Courier New", monospace',
      fontWeight: termSettings?.fontWeight as any || 'normal',
      lineHeight: 1.0,
      theme: {
        background: termSettings?.background || '#1e1e1e',
        foreground: termSettings?.foreground || '#d4d4d4',
        cursor: termSettings?.cursorColor || '#d4d4d4',
      },
      convertEol: false,
      scrollOnUserInput: true,
      scrollback: 5000,
      allowProposedApi: true,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(terminalRef.current);
    fitAddon.fit();
    
    // Monitor resize
    const handleTerminalResize = () => {
      const { cols, rows } = term;
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'resize', cols, rows }));
      }
    };
    term.onResize(handleTerminalResize);

    const handleResize = () => fitAddon.fit();
    window.addEventListener('resize', handleResize);

    terminalRefInstance.current = term;
    fitAddonRef.current = fitAddon;

    // Connect SSH
    const connectToSSH = () => {
      try {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.host;
        const wsUrl = `${protocol}//${host}/api/ssh?connectionId=${connectionId}`;
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          setIsConnected(true);
          ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }));
        };

        ws.onmessage = (event) => {
          if (typeof event.data === 'string') {
            const data = event.data;
            
            // Handle __PWD_RESPONSE__ message (supports messages that may be mixed with other content)
            if (data.includes('__PWD_RESPONSE__')) {
              // Extract path: find content after __PWD_RESPONSE__
              const match = data.match(/__PWD_RESPONSE__([^\s\r\n]+)/);
              if (match) {
                const path = match[1];
                const actualPath = path === 'null' ? null : path;
                
                if ((window as any)._pendingPwdCallback) {
                  (window as any)._pendingPwdCallback(actualPath);
                  (window as any)._pendingPwdCallback = null;
                }
              }
              return; // Do not display in terminal
            }
            
            // --- Frontend filter: discard any content with control markers to prevent leakage to terminal ---
            if (data.includes('__CONTROL__') || data.includes('{"type":"get-pwd"}')) {
              return;
            }

            // Try to parse as JSON control message
            try {
              const msg = JSON.parse(data);
              if (msg.type === 'pwd-result') {
                // PWD result, do not display in terminal, process directly
                if ((window as any)._pendingPwdCallback) {
                  (window as any)._pendingPwdCallback(msg.path);
                  (window as any)._pendingPwdCallback = null;
                }
                return; // Do not display in terminal
              }
            } catch (e) {
              // Not JSON, continue
            }
            
            term.write(data);
          } else {
            const reader = new FileReader();
            reader.onload = () => term.write(reader.result as string);
            reader.readAsText(event.data);
          }
        };

        ws.onclose = () => {
          setIsConnected(false);
          if (!isManuallyClosingRef.current) {
            term.writeln(`\r\n${t('sshTab.connectionClosed')}`);
          }
        };

        term.onData((data) => {
          if (data === '\x1b') term.clearSelection?.();
          
          // 追踪用户输入来检测命令
          if (data === '\r') {
            // 从终端当前行提取完整命令（包括 Tab 补全的内容）
            const buffer = term.buffer.active;
            const cursorY = buffer.cursorY;
            const cursorX = buffer.cursorX;
            const line = buffer.getLine(cursorY + buffer.baseY);
            let fullLineText = '';
            if (line) {
              // 使用 cursorX 来确定实际输入的结束位置
              fullLineText = line.translateToString(false, 0, cursorX).trim();
            }
            
            // 提取命令部分（去掉提示符，如 [root@localhost data]# 或 user@host:~$ ）
            let command = '';
            // 匹配 CentOS 格式: [user@host path]# command
            const centosMatch = fullLineText.match(/\]\s*[#$]\s*(.*)$/);
            // 匹配 Ubuntu 格式: user@host:path$ command
            const ubuntuMatch = fullLineText.match(/[#$]\s*(.*)$/);
            
            if (centosMatch) {
              command = centosMatch[1].trim();
            } else if (ubuntuMatch) {
              command = ubuntuMatch[1].trim();
            } else {
              // Fallback to input buffer
              command = inputBufferRef.current.trim();
            }
            
            console.log(t('sshTab.commandParsing'), {
              fullLineText,
              cursorX,
              cursorY,
              command,
              inputBuffer: inputBufferRef.current
            });
            
            // 1. Intercept sz command for simulated download
            if (command.startsWith('sz ')) {
              const fileName = command.substring(3).trim();
              if (fileName) {
                // First priority: pop up download prompt UI immediately
                setDownloadStatus({show: true, msg: t('sshTab.preparingDownload', {fileName})});
                
                // Second priority: clear local buffer to prevent character residue
                inputBufferRef.current = '';

                // Third priority: asynchronously execute server-side reset and path retrieval
                if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                  // Send Ctrl+C to interrupt sz command
                  wsRef.current.send('\x03');
                  
                  // Key fix: delay sending terminal reset sequence to ensure sz exits completely before terminal state recovery
                  setTimeout(() => {
                    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                      // Send enter to get new prompt and clean terminal state
                      wsRef.current.send('\r');
                      // Send enter again to ensure terminal is fully ready (fix for first command ineffective issue)
                      setTimeout(() => {
                        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                          wsRef.current.send('\r');
                        }
                      }, 100);
                    }
                  }, 150);
                }
                
                const buildFullPath = (): Promise<string | null> => {
                  return new Promise((resolve) => {
                    if (fileName.startsWith('/')) {
                      resolve(fileName);
                      return;
                    }
                    
                    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                      const ws = wsRef.current;
                      (window as any)._pendingPwdCallback = (path: string | null) => {
                        if (path) {
                          const fullPath = path.endsWith('/') ? `${path}${fileName}` : `${path}/${fileName}`;
                          resolve(fullPath);
                        } else {
                          if (currentPathRef.current && currentPathRef.current.startsWith('/')) {
                            const path = currentPathRef.current;
                            resolve(path.endsWith('/') ? `${path}${fileName}` : `${path}/${fileName}`);
                          } else {
                            resolve(null);
                          }
                        }
                      };
                      // 使用带前缀的控制消息
                      ws.send('__CONTROL__' + JSON.stringify({ type: 'get-pwd' }));
                      
                      setTimeout(() => {
                        if ((window as any)._pendingPwdCallback) {
                          const cb = (window as any)._pendingPwdCallback;
                          (window as any)._pendingPwdCallback = null;
                          cb(null);
                        }
                      }, 3000);
                    } else {
                      resolve(null);
                    }
                  });
                };

                buildFullPath().then(fullPath => {
                  if (fullPath) {
                    triggerDownload(fullPath, fileName);
                  } else {
                    setDownloadStatus({show: true, msg: t('sshTab.unableToGetFilePath'), success: false});
                    setTimeout(() => setDownloadStatus({show: false, msg: ''}), 3000);
                  }
                });
                
                return;
              }
            }

            // 2. Send normal enter and check if it's a cd command
            if (ws.readyState === WebSocket.OPEN) ws.send(data);
            
            if (command.startsWith('cd ')) {
              const targetPath = command.substring(3).trim();
              // Simple path handling
              if (targetPath === '~' || targetPath === '') {
                currentPathRef.current = '~';
              } else if (targetPath.startsWith('/')) {
                currentPathRef.current = targetPath;
              } else if (targetPath === '..') {
                // Return to parent directory
                const parts = currentPathRef.current.split('/').filter(p => p);
                parts.pop();
                currentPathRef.current = parts.length > 0 ? '/' + parts.join('/') : '/';
              } else {
                // Relative path
                currentPathRef.current = currentPathRef.current === '/' 
                  ? '/' + targetPath 
                  : currentPathRef.current + '/' + targetPath;
              }
            }
            inputBufferRef.current = '';
          } else {
            // Normal character, send to server and record to buffer
            if (ws.readyState === WebSocket.OPEN) ws.send(data);
            
            if (data === '\x7f') {
              // Backspace key
              inputBufferRef.current = inputBufferRef.current.slice(0, -1);
            } else if (data >= ' ' && data <= '~') {
              // Printable characters
              inputBufferRef.current += data;
            }
          }
        });
      } catch (error) {
        console.error(t('sshTab.connectSSHFailed'), error);
      }
    };

    connectToSSH();

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [connectionId, t]);

  return (
    <div className="relative w-full h-full">
      <TerminalPanel 
        terminalRef={terminalRef} 
        isConnected={isConnected} 
        currentTime={currentTime} 
        onOpenSFTP={() => setIsSFTPModalOpen(true)} 
        connectionId={connectionId}
        onGetCurrentPath={() => currentPathRef.current}
      />

      {downloadStatus.show && (
        <div className={`absolute top-4 right-4 z-50 px-4 py-2 rounded shadow-lg flex items-center space-x-2 border animate-in fade-in slide-in-from-top-2 ${
          downloadStatus.success === true ? 'bg-green-100 border-green-200 text-green-800' : 
          downloadStatus.success === false ? 'bg-red-100 border-red-200 text-red-800' : 
          'bg-blue-100 border-blue-200 text-blue-800'
        }`}>
          {downloadStatus.success === undefined && (
            <svg className="animate-spin h-4 w-4 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          )}
          <span className="text-sm font-medium">{downloadStatus.msg}</span>
        </div>
      )}
      
      <SFTPModal 
        isOpen={isSFTPModalOpen} 
        onClose={() => setIsSFTPModalOpen(false)} 
        connectionId={connectionId} 
        connectionName={connectionName} 
        onDownload={triggerDownload}
      />
    </div>
  );
});

SSHTab.displayName = 'SSHTab';

export default SSHTab;
