'use client';

import React from 'react';

interface SFTPToolbarProps {
  selectedCount: number;
  onUpload: () => void;
  onDownload: () => void;
  onNewFolder: () => void;
  onRename: () => void;
  onDelete: () => void;
  onRefresh: () => void;
  loading: boolean;
}

export default function SFTPToolbar({
  selectedCount,
  onUpload,
  onDownload,
  onNewFolder,
  onRename,
  onDelete,
  onRefresh,
  loading
}: SFTPToolbarProps) {
  return (
    <div className="sftp-modal-toolbar p-3 border-t border-gray-100 flex gap-2.5 bg-white flex-shrink-0 rounded-b-lg">
      <button 
        className="px-3 py-1.5 border border-gray-200 rounded-md bg-white text-gray-700 text-xs font-medium hover:bg-gray-50 hover:border-gray-300 transition-all flex items-center gap-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed" 
        onClick={onUpload} 
        disabled={loading}
      >
        <i className="fas fa-cloud-upload-alt text-[#007acc]"></i> 上传
      </button>
      <button 
        className="px-3 py-1.5 border border-gray-200 rounded-md bg-white text-gray-700 text-xs font-medium hover:bg-gray-50 hover:border-gray-300 transition-all flex items-center gap-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed" 
        onClick={onDownload} 
        disabled={loading || selectedCount === 0}
      >
        <i className="fas fa-cloud-download-alt text-[#007acc]"></i> 下载 ({selectedCount})
      </button>
      <button 
        className="px-3 py-1.5 border border-gray-200 rounded-md bg-white text-gray-700 text-xs font-medium hover:bg-gray-50 hover:border-gray-300 transition-all flex items-center gap-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed" 
        onClick={onNewFolder} 
        disabled={loading}
      >
        <i className="fas fa-folder-plus text-yellow-500"></i> 新建
      </button>
      <button 
        className="px-3 py-1.5 border border-gray-200 rounded-md bg-white text-gray-700 text-xs font-medium hover:bg-gray-50 hover:border-gray-300 transition-all flex items-center gap-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed" 
        onClick={onRename} 
        disabled={loading || selectedCount !== 1}
        title={selectedCount !== 1 ? "请选中单个文件进行重命名" : "重命名"}
      >
        <i className="fas fa-edit text-blue-500"></i> 重命名
      </button>
      <button 
        className="px-3 py-1.5 border border-red-100 rounded-md bg-red-50 text-red-600 text-xs font-medium hover:bg-red-100 transition-all flex items-center gap-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed" 
        onClick={onDelete} 
        disabled={loading || selectedCount === 0}
      >
        <i className="fas fa-trash-alt"></i> 删除 ({selectedCount})
      </button>
      <div className="flex-grow"></div>
      <button 
        className="px-4 py-1.5 bg-[#007acc] hover:bg-[#005a9e] text-white rounded-md text-xs font-bold transition-all flex items-center gap-2 shadow-md disabled:opacity-50" 
        onClick={onRefresh} 
        disabled={loading}
      >
        <i className={`fas fa-sync-alt ${loading ? 'fa-spin' : ''}`}></i> 刷新
      </button>
    </div>
  );
}
