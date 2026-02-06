'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useLanguage } from '../../../../i18n/LanguageContext';
import { SFTPOperations, SFTPFileItem } from '@/app/lib/sftpOperations';
import { NewFolderDialog, DeleteConfirmDialog, RenameDialog } from './dialogs';
import SFTPPathBar from './SFTPPathBar';
import SFTPFileList from './SFTPFileList';
import SFTPToolbar from './SFTPToolbar';

interface SFTPModalProps {
  isOpen: boolean;
  onClose: () => void;
  connectionId: string;
  connectionName: string;
  onDownload?: (remotePath: string, fileName: string) => void;
}

export default function SFTPModal({
  isOpen,
  onClose,
  connectionId,
  connectionName,
  onDownload
}: SFTPModalProps) {
  const { t } = useLanguage();
  // State management
  const [currentPath, setCurrentPath] = useState('/');
  const [sftpFiles, setSftpFiles] = useState<SFTPFileItem[]>([]);
  const [sftpLoading, setSftpLoading] = useState(false);
  const [sftpError, setSftpError] = useState<string | null>(null);
  const [pathInput, setPathInput] = useState('/');
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [isNewFolderDialogOpen, setIsNewFolderDialogOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false);
  const [renameData, setRenameData] = useState<{ oldName: string, path: string, isDirectory: boolean } | null>(null);
  const [newItemName, setNewItemName] = useState('');
  const [isEditingPath, setIsEditingPath] = useState(false);
  
  const sftpOperations = useRef<SFTPOperations | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (!sftpOperations.current) {
        sftpOperations.current = new SFTPOperations(connectionId);
      }

      // Initialize default path
      if (currentPath === '' || currentPath === '/home') {
        const defaultPath = '/';
        setCurrentPath(defaultPath);
        setPathInput(defaultPath);
        loadSFTPFiles(defaultPath);
      } else {
        loadSFTPFiles(currentPath);
      }
    }
  }, [isOpen, connectionId]);

  // Load SFTP file list
  const loadSFTPFiles = async (pathOverride?: string) => {
    if (!sftpOperations.current) return;

    const targetPath = pathOverride || currentPath;
    setSftpLoading(true);
    setSftpError(null);

    try {
      const files = await sftpOperations.current.listDirectory(targetPath);
      setSelectedFiles(new Set());
      
      const sortedFiles = [...files].sort((a, b) => {
        if (a.type === 'directory' && b.type !== 'directory') return -1;
        if (a.type !== 'directory' && b.type === 'directory') return 1;
        return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
      });
      
      setSftpFiles(sortedFiles);
    } catch (error) {
      console.error('Failed to load SFTP files:', error);
      setSftpError(error instanceof Error ? error.message : 'Failed to load file list');
    } finally {
      setSftpLoading(false);
    }
  };

  // SFTP file click operation
  const handleFileClick = (file: SFTPFileItem) => {
    if (file.type === 'directory') {
      const newPath = currentPath === '/' 
        ? `/${file.name}` 
        : `${currentPath.endsWith('/') ? currentPath : currentPath + '/'}${file.name}`;
      
      setCurrentPath(newPath);
      setPathInput(newPath);
      loadSFTPFiles(newPath);
    }
  };

  const triggerDownload = (path: string, fileName: string) => {
    // Priority to onDownload function (implements direct download to local)
    if (onDownload) {
      onDownload(path, fileName);
      return;
    }

    if (!sftpOperations.current) return;
    const url = sftpOperations.current.downloadFile(path);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileDoubleClick = (file: SFTPFileItem) => {
    if (file.type === 'directory') {
      handleFileClick(file);
    } else if (file.type === 'file' && file.path) {
      triggerDownload(file.path, file.name);
    }
  };

  const handlePathClick = (path: string) => {
    const formattedPath = path.startsWith('/') ? path : '/' + path;
    setCurrentPath(formattedPath);
    setPathInput(formattedPath);
    loadSFTPFiles(formattedPath);
  };

  const handleGoBack = () => {
    if (currentPath === '/') return;
    const pathParts = currentPath.split('/').filter(p => p !== '');
    pathParts.pop();
    const parentPath = '/' + pathParts.join('/');
    setCurrentPath(parentPath);
    setPathInput(parentPath);
    loadSFTPFiles(parentPath);
  };

  const handleSFTPUpload = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.onchange = async (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (files && files.length > 0 && sftpOperations.current) {
        try {
          setSftpLoading(true);
          for (let i = 0; i < files.length; i++) {
            await sftpOperations.current.uploadFile(currentPath, files[i]);
          }
          loadSFTPFiles();
        } catch (error) {
          console.error('Upload file failed:', error);
          setSftpError(error instanceof Error ? error.message : 'Upload file failed');
        } finally {
          setSftpLoading(false);
        }
      }
    };
    input.click();
  };

  const handleSFTPDownload = () => {
    const filesToDownload = Array.from(selectedFiles).map(name => 
      sftpFiles.find(f => f.name === name)
    ).filter(f => f && f.type === 'file' && f.path);

    if (filesToDownload.length === 0) {
      alert(t('sftpModal.selectFilesToDownload'));
      return;
    }

    filesToDownload.forEach(file => {
      if (file && file.path) triggerDownload(file.path, file.name);
    });
  };

  const handleNewFolderSubmit = async () => {
    if (!newFolderName.trim()) return;
    if (sftpOperations.current) {
      try {
        setSftpLoading(true);
        const newPath = currentPath.endsWith('/') ? `${currentPath}${newFolderName}` : `${currentPath}/${newFolderName}`;
        await sftpOperations.current.createDirectory(newPath);
        setNewFolderName('');
        setIsNewFolderDialogOpen(false);
        loadSFTPFiles();
      } catch (error) {
        setSftpError(error instanceof Error ? error.message : t('sftpModal.createFolderFailed'));
      } finally {
        setSftpLoading(false);
      }
    }
  };

  const handleRenameSubmit = async () => {
    if (!newItemName.trim() || !renameData) return;
    if (newItemName === renameData.oldName) {
      setIsRenameDialogOpen(false);
      return;
    }
    if (sftpOperations.current) {
      try {
        setSftpLoading(true);
        const pathParts = renameData.path.split('/');
        pathParts.pop();
        const parentPath = pathParts.join('/');
        const newPath = parentPath === '' ? `/${newItemName}` : `${parentPath}/${newItemName}`;
        await sftpOperations.current.renameItem(renameData.path, newPath);
        setIsRenameDialogOpen(false);
        setRenameData(null);
        loadSFTPFiles(currentPath);
      } catch (error) {
        setSftpError(error instanceof Error ? error.message : t('sftpModal.renameFailed'));
      } finally {
        setSftpLoading(false);
      }
    }
  };

  const handleDeleteConfirm = async () => {
    try {
      setSftpLoading(true);
      setIsDeleteConfirmOpen(false);
      for (const fileName of selectedFiles) {
        const file = sftpFiles.find(f => f.name === fileName);
        if (file && file.path && sftpOperations.current) {
          await sftpOperations.current.deleteItem(file.path, file.type === 'directory');
        }
      }
      loadSFTPFiles(currentPath);
    } catch (error) {
      setSftpError(error instanceof Error ? error.message : t('sftpModal.batchDeleteFailed'));
    } finally {
      setSftpLoading(false);
    }
  };

  const toggleFileSelection = (fileName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedFiles(prev => {
      const newSelection = new Set(prev);
      if (newSelection.has(fileName)) newSelection.delete(fileName);
      else newSelection.add(fileName);
      return newSelection;
    });
  };

  const toggleSelectAll = () => {
    if (selectedFiles.size === sftpFiles.length) setSelectedFiles(new Set());
    else setSelectedFiles(new Set(sftpFiles.map(f => f.name)));
  };

  const handleRenameOpen = () => {
    const fileName = Array.from(selectedFiles)[0];
    const file = sftpFiles.find(f => f.name === fileName);
    if (file && file.path) {
      setRenameData({ oldName: file.name, path: file.path, isDirectory: file.type === 'directory' });
      setNewItemName(file.name);
      setIsRenameDialogOpen(true);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="sftp-modal fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 rounded-t-lg h-[75vh] z-50 transform translate-y-0 transition-transform duration-300 flex flex-col shadow-[0_-4px_20px_-5px_rgba(0,0,0,0.1)]">
        <div className="sftp-modal-header p-4 border-b border-gray-100 bg-white flex justify-between items-center flex-shrink-0 rounded-t-lg">
          <div className="sftp-modal-title text-base font-bold text-gray-800 flex items-center gap-2">
            <i className="fas fa-folder-open text-[#007acc]"></i>
            {t('sftpModal.sftpFileManager')} - {connectionName}
          </div>
          <button className="sftp-close-btn text-gray-400 hover:text-gray-600 w-8 h-8 rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors" onClick={onClose}>
            <i className="fas fa-times text-lg"></i>
          </button>
        </div>

        <div className="sftp-modal-content flex-grow flex flex-col p-4 bg-white min-h-0 overflow-hidden">
          <SFTPPathBar 
            currentPath={currentPath} 
            pathInput={pathInput} 
            setPathInput={setPathInput} 
            isEditingPath={isEditingPath} 
            setIsEditingPath={setIsEditingPath} 
            onPathClick={handlePathClick} 
            onGoBack={handleGoBack} 
            loading={sftpLoading} 
          />

          {sftpError && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-xs flex items-center gap-2 flex-shrink-0 animate-shake"><i className="fas fa-exclamation-circle"></i><strong>{t('sftpModal.error')}:</strong> {sftpError}</div>}
          {sftpLoading && <div className="mb-4 p-3 bg-blue-50 border border-blue-100 rounded-lg text-[#007acc] text-xs flex items-center gap-2 flex-shrink-0"><i className="fas fa-spinner fa-spin"></i> {t('sftpModal.loading')}</div>}

          <SFTPFileList 
            files={sftpFiles} 
            selectedFiles={selectedFiles} 
            onFileClick={handleFileClick} 
            onFileDoubleClick={handleFileDoubleClick} 
            onToggleSelection={toggleFileSelection} 
            onToggleSelectAll={toggleSelectAll} 
            loading={sftpLoading} 
          />
        </div>

        <SFTPToolbar 
          selectedCount={selectedFiles.size} 
          onUpload={handleSFTPUpload} 
          onDownload={handleSFTPDownload} 
          onNewFolder={() => { setNewFolderName(''); setIsNewFolderDialogOpen(true); }} 
          onRename={handleRenameOpen} 
          onDelete={() => setIsDeleteConfirmOpen(true)} 
          onRefresh={() => loadSFTPFiles()} 
          loading={sftpLoading} 
        />
      </div>

      <div className="modal-overlay fixed top-0 left-0 right-0 bottom-0 bg-black bg-opacity-70 z-40" onClick={onClose}></div>

      <NewFolderDialog isOpen={isNewFolderDialogOpen} onClose={() => setIsNewFolderDialogOpen(false)} onSubmit={handleNewFolderSubmit} folderName={newFolderName} setFolderName={setNewFolderName} loading={sftpLoading} />
      <DeleteConfirmDialog isOpen={isDeleteConfirmOpen} onClose={() => setIsDeleteConfirmOpen(false)} onConfirm={handleDeleteConfirm} selectedCount={selectedFiles.size} loading={sftpLoading} />
      <RenameDialog isOpen={isRenameDialogOpen} onClose={() => setIsRenameDialogOpen(false)} onSubmit={handleRenameSubmit} oldName={renameData?.oldName || ''} newName={newItemName} setNewName={setNewItemName} loading={sftpLoading} isDirectory={renameData?.isDirectory || false} />
    </>
  );
}
