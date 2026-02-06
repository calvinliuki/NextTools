'use client';

import React from 'react';
import { useLanguage } from '../../../../i18n/LanguageContext';
import { SFTPFileItem } from '@/app/lib/sftpOperations';

interface SFTPFileListProps {
  files: SFTPFileItem[];
  selectedFiles: Set<string>;
  onFileClick: (file: SFTPFileItem) => void;
  onFileDoubleClick: (file: SFTPFileItem) => void;
  onToggleSelection: (fileName: string, e: React.MouseEvent) => void;
  onToggleSelectAll: () => void;
  loading: boolean;
}

export default function SFTPFileList({
  files,
  selectedFiles,
  onFileClick,
  onFileDoubleClick,
  onToggleSelection,
  onToggleSelectAll,
  loading
}: SFTPFileListProps) {
  const { t } = useLanguage();
  return (
    <div className="sftp-file-list border border-gray-200 rounded-lg flex flex-col flex-grow min-h-0 overflow-hidden shadow-sm bg-white">
      <div className="file-header grid grid-cols-12 gap-1 bg-gray-50 p-3 text-xs font-bold text-gray-600 border-b border-gray-200 flex-shrink-0 uppercase tracking-wider">
        <div className="col-span-1 flex items-center justify-center">
          <input 
            type="checkbox" 
            className="w-4 h-4 rounded border-gray-300 text-[#007acc] focus:ring-[#007acc] cursor-pointer" 
            checked={files.length > 0 && selectedFiles.size === files.length} 
            onChange={onToggleSelectAll} 
          />
        </div>
        <div className="col-span-1"></div>
        <div className="col-span-5">{t('ssh.fileName')}</div>
        <div className="col-span-2">{t('ssh.fileSize')}</div>
        <div className="col-span-3 text-right pr-4">{t('ssh.modifiedTime')}</div>
      </div>
      <div className="file-list-body flex-grow overflow-auto scrollbar-thin scrollbar-thumb-gray-200 scrollbar-track-transparent">
        {files.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <i className="fas fa-folder-open text-5xl mb-4 opacity-20"></i>
            <p>{t('ssh.noFiles')}</p>
          </div>
        )}
        {files.map((file, index) => (
          <div 
            key={index} 
            className={`file-item grid grid-cols-12 gap-1 p-3 text-sm cursor-pointer border-b border-gray-50 transition-colors group ${selectedFiles.has(file.name) ? 'bg-blue-50/50' : 'hover:bg-gray-50'}`} 
            onClick={() => onFileClick(file)} 
            onDoubleClick={() => onFileDoubleClick(file)}
          >
            <div className="col-span-1 flex items-center justify-center">
              <input 
                type="checkbox" 
                className="w-4 h-4 rounded border-gray-300 text-[#007acc] focus:ring-[#007acc] cursor-pointer" 
                checked={selectedFiles.has(file.name)} 
                onChange={(e) => onToggleSelection(file.name, e as any)} 
                onClick={(e) => e.stopPropagation()} 
              />
            </div>
            <div className="file-icon col-span-1 flex items-center justify-center">
              {file.type === 'directory' ? (
                <i className="fas fa-folder text-yellow-400 text-lg"></i>
              ) : file.type === 'link' ? (
                <i className="fas fa-link text-cyan-500"></i>
              ) : (
                <i className="fas fa-file text-gray-400"></i>
              )}
            </div>
            <div className={`file-name col-span-5 truncate ${file.type === 'directory' ? 'font-semibold text-gray-800' : 'text-gray-700'}`}>
              {file.name}
            </div>
            <div className="file-size col-span-2 text-gray-500 text-xs flex items-center">
              {file.size}
            </div>
            <div className="file-modified col-span-3 text-gray-400 text-xs flex items-center justify-end pr-4 italic">
              {file.modified}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
