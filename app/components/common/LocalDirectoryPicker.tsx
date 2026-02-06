'use client';

import { useState, useEffect } from 'react';
import { useLanguage } from '../../../i18n/LanguageContext';

interface LocalDirectoryPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (path: string) => void;
  initialPath?: string;
}

export default function LocalDirectoryPicker({
  isOpen,
  onClose,
  onSelect,
  initialPath
}: LocalDirectoryPickerProps) {
  const { t } = useLanguage();
  const [currentPath, setCurrentPath] = useState('');
  const [parentPath, setParentPath] = useState('');
  const [directories, setDirectories] = useState<{ name: string; path: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadDirectories(initialPath || '');
    }
  }, [isOpen, initialPath]);

  const loadDirectories = async (path: string) => {
    setLoading(true);
    setError(null);
    try {
      const url = new URL('/api/system/list-dir', window.location.origin);
      if (path) url.searchParams.set('path', path);
      
      const res = await fetch(url.toString());
      const result = await res.json();
      
      if (result.code === 200) {
        setCurrentPath(result.data.currentPath);
        setParentPath(result.data.parentPath);
        setDirectories(result.data.directories);
      } else {
        setError(result.message);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-[100] bg-black/50 transition-opacity" onClick={onClose}></div>
      <div className="fixed inset-0 z-[101] flex items-center justify-center pointer-events-none p-4">
        <div 
          className="bg-white rounded-lg shadow-2xl w-full max-w-lg h-[500px] flex flex-col pointer-events-auto overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <i className="fas fa-folder-open text-[#165DFF]"></i>
              {t('localDirectoryPicker.selectLocalDownloadDir')}
            </h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
              <i className="fas fa-times text-xs"></i>
            </button>
          </div>

          {/* Current Path Input */}
          <div className="px-4 py-2 bg-gray-50 border-b border-gray-100 flex items-center gap-2">
            <button 
                onClick={() => {
                    if (parentPath && parentPath !== currentPath) {
                        loadDirectories(parentPath);
                    }
                }}
                disabled={!parentPath || parentPath === currentPath}
                className="p-1.5 hover:bg-gray-200 rounded text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                title={t('localDirectoryPicker.up')}
            >
                <i className="fas fa-arrow-up text-xs"></i>
            </button>
            <input 
              type="text" 
              value={currentPath}
              readOnly
              className="flex-1 px-2 py-1 text-xs bg-white border border-gray-200 rounded focus:outline-none"
            />
          </div>

          {/* Directory List */}
          <div className="flex-1 overflow-y-auto p-2">
            {loading ? (
              <div className="flex items-center justify-center h-full text-gray-400 text-xs gap-2">
                <i className="fas fa-spinner fa-spin"></i> {t('localDirectoryPicker.loading')}
              </div>
            ) : error ? (
              <div className="flex items-center justify-center h-full text-red-500 text-xs gap-2 p-4 text-center">
                <i className="fas fa-exclamation-circle"></i> {error}
              </div>
            ) : (
              <div className="space-y-0.5">
                {directories.map((dir) => (
                  <div 
                    key={dir.path}
                    onClick={() => loadDirectories(dir.path)}
                    className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-100 rounded cursor-pointer group"
                  >
                    <i className="fas fa-folder text-yellow-500 text-sm"></i>
                    <span className="text-xs text-gray-700 truncate">{dir.name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-3 border-t border-gray-100 bg-white flex justify-end gap-2">
            <button 
              onClick={onClose}
              className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded transition-all"
            >
              {t('localDirectoryPicker.cancel')}
            </button>
            <button 
              onClick={() => onSelect(currentPath)}
              className="px-4 py-1.5 text-xs font-medium bg-[#165DFF] text-white rounded hover:bg-[#0E42BD] transition-all"
            >
              {t('localDirectoryPicker.selectCurrentDir')}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
