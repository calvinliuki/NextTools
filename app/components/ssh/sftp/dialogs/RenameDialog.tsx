'use client';

import React from 'react';
import { useLanguage } from '../../../../../i18n/LanguageContext';

interface RenameDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: () => void;
  oldName: string;
  newName: string;
  setNewName: (name: string) => void;
  loading: boolean;
  isDirectory: boolean;
}

export default function RenameDialog({
  isOpen,
  onClose,
  onSubmit,
  oldName,
  newName,
  setNewName,
  loading,
  isDirectory
}: RenameDialogProps) {
  const { t } = useLanguage();
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60]" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-[400px] max-w-[90vw] overflow-hidden transform transition-all animate-scale-in" onClick={(e) => e.stopPropagation()}>
        {/* Title */}
        <div className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <i className="fas fa-edit text-blue-500"></i>
            {t('sshRenameDialog.title')}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100"
          >
            <i className="fas fa-times text-lg"></i>
          </button>
        </div>
        {/* Form content */}
        <div className="p-6">
          <div className="mb-4">
            <p className="text-sm text-gray-500 mb-1">{t('sshRenameDialog.originalName')}:</p>
            <p className="text-sm font-medium text-gray-800 break-all">{oldName}</p>
          </div>
          <div className="space-y-1">
            <label className="block text-sm font-semibold text-gray-700 mb-2">{t('sshRenameDialog.newName')} <span className="text-red-500">{t('sshRenameDialog.required')}</span></label>
            <div className="relative flex items-center">
              <i className="fas fa-edit absolute left-3 text-gray-400"></i>
              <input 
                type="text" 
                value={newName} 
                onChange={(e) => setNewName(e.target.value)} 
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    onSubmit();
                  }
                }}
                className="w-full bg-gray-50 border border-gray-200 rounded-lg pl-9 pr-4 py-3 text-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-[#007acc]/20 focus:border-[#007acc] transition-all" 
                placeholder={t('renameDialog.enterNewName')}
                autoFocus 
              />
            </div>
          </div>
        </div>
        {/* Bottom action bar */}
        <div className="bg-gray-50 px-6 py-4 flex justify-end gap-3 border-t border-gray-100">
          <button
            onClick={onClose}
            className="px-5 py-2 text-sm font-bold text-gray-600 hover:text-gray-800 transition-colors bg-white border border-gray-200 rounded-md hover:bg-gray-50"
          >
            {t('sshRenameDialog.cancel')}
          </button>
          <button
            onClick={onSubmit}
            disabled={loading || !newName.trim() || newName === oldName}
            className="px-6 py-2 bg-[#007acc] hover:bg-[#005a9e] text-white text-sm font-bold rounded-md transition-all shadow-md active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loading ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-check"></i>}
            {t('sshRenameDialog.confirm')}
          </button>
        </div>
      </div>
    </div>
  );
}
