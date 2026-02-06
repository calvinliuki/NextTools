'use client';

import React from 'react';
import { useLanguage } from '../../../../i18n/LanguageContext';

interface SFTPPathBarProps {
  currentPath: string;
  pathInput: string;
  setPathInput: (path: string) => void;
  isEditingPath: boolean;
  setIsEditingPath: (editing: boolean) => void;
  onPathClick: (path: string) => void;
  onGoBack: () => void;
  loading: boolean;
}

export default function SFTPPathBar({
  currentPath,
  pathInput,
  setPathInput,
  isEditingPath,
  setIsEditingPath,
  onPathClick,
  onGoBack,
  loading
}: SFTPPathBarProps) {
  const { t } = useLanguage();
  return (
    <div className="sftp-path bg-gray-50 rounded-lg border border-gray-200 p-1.5 mb-4 flex items-center gap-1.5 flex-shrink-0 shadow-sm overflow-hidden">
      <button 
        className="w-8 h-8 flex items-center justify-center text-gray-500 hover:text-[#007acc] hover:bg-white rounded-md transition-all flex-shrink-0" 
        onClick={onGoBack} 
        disabled={currentPath === '/' || loading}
      >
        <i className="fas fa-arrow-up text-sm"></i>
      </button>
      <div className="flex-1 min-w-0 bg-white border border-gray-200 rounded-md flex items-center overflow-hidden">
        {!isEditingPath ? (
          <div 
            className="flex-1 flex items-center px-2 py-1.5 overflow-x-auto no-scrollbar cursor-text min-h-[32px]" 
            onClick={() => setIsEditingPath(true)}
          >
            <i className="fas fa-folder text-yellow-500 mr-2 text-xs flex-shrink-0"></i>
            <div className="flex items-center text-xs text-gray-600 whitespace-nowrap">
              <span 
                className={`hover:text-[#007acc] hover:underline cursor-pointer px-1.5 rounded flex items-center h-6 ${currentPath === '/' ? 'font-bold text-gray-800' : ''}`} 
                onClick={(e) => { e.stopPropagation(); onPathClick('/'); }}
              >
                /
              </span>
              {currentPath.split('/').filter(p => p).map((part, i, arr) => (
                <React.Fragment key={i}>
                  <span 
                    className={`hover:text-[#007acc] hover:underline cursor-pointer px-1 rounded flex items-center h-6 ${i === arr.length - 1 ? 'font-bold text-gray-800' : ''}`} 
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      onPathClick('/' + arr.slice(0, i + 1).join('/')); 
                    }}
                  >
                    {part}
                  </span>
                  {i < arr.length - 1 && <span className="mx-0.5 text-gray-300">/</span>}
                </React.Fragment>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center">
            <input 
              type="text" 
              value={pathInput} 
              onChange={(e) => setPathInput(e.target.value)} 
              onBlur={() => setTimeout(() => setIsEditingPath(false), 200)} 
              onKeyPress={(e) => { 
                if (e.key === 'Enter') { 
                  onPathClick(pathInput); 
                  setIsEditingPath(false); 
                } 
              }} 
              placeholder={t('sftpPathBar.enterPath')}
              className="w-full bg-transparent px-3 py-1.5 text-gray-700 text-xs focus:outline-none" 
              autoFocus 
            />
          </div>
        )}
        <button 
          className="w-8 h-8 flex items-center justify-center bg-gray-50 text-gray-400 hover:text-[#007acc] hover:bg-gray-100 transition-colors border-l border-gray-100 flex-shrink-0" 
          onClick={(e) => { 
            e.stopPropagation(); 
            onPathClick(pathInput); 
            setIsEditingPath(false); 
          }} 
          disabled={loading} 
          title={t('sftpPathBar.goToPath')}
        >
          <i className="fas fa-arrow-right text-xs"></i>
        </button>
      </div>
    </div>
  );
}
