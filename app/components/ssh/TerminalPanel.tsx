'use client';

import React, { useState, useEffect } from 'react';
import { useLanguage } from '@/i18n/LanguageContext';

interface TerminalPanelProps {
  terminalRef: React.RefObject<HTMLDivElement | null>;
  isConnected: boolean;
  currentTime: string;
  onOpenSFTP: () => void;
  connectionId: string;
  onGetCurrentPath?: () => string;
}

export default function TerminalPanel({
  terminalRef,
  isConnected,
  currentTime,
  onOpenSFTP,
  connectionId,
  onGetCurrentPath
}: TerminalPanelProps) {
  const { t } = useLanguage();
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [currentPath, setCurrentPath] = useState('~');

  // Get current working directory
  useEffect(() => {
    if (onGetCurrentPath) {
      const path = onGetCurrentPath();
      if (path) {
        setCurrentPath(path);
      }
    }
  }, [onGetCurrentPath]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;

    setIsUploading(true);
    setUploadStatus(null);

    // Get latest current path
    const uploadPath = onGetCurrentPath ? onGetCurrentPath() : currentPath;

    try {
      const uploadPromises = files.map(async (file) => {
        const formData = new FormData();
        formData.append('connectionId', connectionId);
        formData.append('path', uploadPath); // Upload to current working directory
        formData.append('file', file);

        const response = await fetch('/api/ssh/sftp', {
          method: 'PUT',
          body: formData,
        });

        const result = await response.json();
        if (!result.success) {
          throw new Error(result.error || t('terminalPanel.uploadFailed'));
        }
        return result;
      });

      await Promise.all(uploadPromises);
      setUploadStatus({ 
        type: 'success', 
        message: t('terminalPanel.uploadSuccess', { count: files.length, path: uploadPath })
      });
      
      // Auto-hide notification after 3 seconds
      setTimeout(() => setUploadStatus(null), 3000);
    } catch (error) {
      setUploadStatus({ 
        type: 'error', 
        message: error instanceof Error ? error.message : t('terminalPanel.uploadFailed')
      });
      
      // Auto-hide error message after 5 seconds
      setTimeout(() => setUploadStatus(null), 5000);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="app-container h-full w-full flex flex-col overflow-hidden bg-gray-50">
      {/* Terminal Panel */}
      <div 
        className="terminal-panel flex-1 flex flex-col bg-[#1e1e1e] min-h-0 relative shadow-inner"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div 
          ref={terminalRef as any} 
          className="flex-1 p-0 overflow-hidden"
          style={{ 
            width: '100%',
            height: '100%',
            backgroundColor: '#1e1e1e'
          }} 
        />
        
        {/* Drag and drop upload overlay */}
        {isDragging && (
          <div className="absolute inset-0 bg-black bg-opacity-5 backdrop-blur-[2px] flex items-center justify-center z-50 pointer-events-none">
            <div className="bg-white rounded-lg shadow-lg border-2 border-dashed border-[#007acc] p-6 flex flex-col items-center gap-3 min-w-[280px]">
              <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center">
                <i className="fas fa-cloud-upload-alt text-3xl text-[#007acc]"></i>
              </div>
              <div className="text-sm font-medium text-gray-800">{t('terminalPanel.dragDropText')}</div>
              <div className="text-xs text-gray-500 bg-gray-50 px-3 py-1.5 rounded border border-gray-200">
                <i className="fas fa-folder text-[#007acc] mr-1.5"></i>
                {currentPath}
              </div>
            </div>
          </div>
        )}

        {/* Upload progress hint */}
        {isUploading && (
          <div className="absolute top-4 right-4 bg-blue-500 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 z-50 animate-pulse">
            <i className="fas fa-spinner fa-spin text-lg"></i>
            <span className="font-medium">{t('terminalPanel.uploading')}</span>
          </div>
        )}

        {/* Upload status hint */}
        {uploadStatus && (
          <div className={`absolute top-4 right-4 px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 z-50 ${
            uploadStatus.type === 'success' 
              ? 'bg-green-500 text-white' 
              : 'bg-red-500 text-white'
          }`}>
            <i className={`fas ${uploadStatus.type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'} text-lg`}></i>
            <span className="font-medium">{uploadStatus.message}</span>
          </div>
        )}
      </div>

      {/* Bottom status bar */}
      <div className="status-bar flex items-center flex-shrink-0 px-4 py-1.5 bg-white border-t border-gray-200 text-gray-600 text-[11px] font-medium shadow-sm">
        <div className="status-item flex items-center mr-4 group">
          <i className={`fas fa-circle ${isConnected ? 'text-green-500 animate-pulse' : 'text-red-500'} text-[8px] mr-2`}></i>
          <span className="group-hover:text-gray-900 transition-colors">{isConnected ? t('terminalPanel.connected') : t('terminalPanel.disconnected')}</span>
        </div>

        <div className="status-separator w-px h-3 bg-gray-200 mx-2"></div>

        <div className="status-item flex items-center mr-4 group">
          <i className="far fa-clock mr-2 text-gray-400 group-hover:text-[#007acc]"></i>
          <span className="group-hover:text-gray-900 transition-colors">{currentTime}</span>
        </div>

        <div className="status-separator w-px h-3 bg-gray-200 mx-2"></div>

        <div className="status-item flex items-center mr-4 group">
          <i className="fas fa-code mr-2 text-gray-400 group-hover:text-[#007acc]"></i>
          <span className="group-hover:text-gray-900 transition-colors">UTF-8</span>
        </div>

        <div className="status-actions ml-auto flex items-center gap-2">
          <button 
            className="px-4 py-1 rounded-md text-[11px] flex items-center gap-2 bg-white border border-gray-200 hover:border-[#007acc] hover:text-[#007acc] text-gray-700 font-bold transition-all shadow-sm active:scale-95 cursor-pointer"
            onClick={onOpenSFTP}
          >
            <i className="fas fa-folder-open text-yellow-500"></i>
            {t('terminalPanel.sfptFileManager')}
          </button>
        </div>
      </div>
    </div>
  );
}
