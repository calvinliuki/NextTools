import React from 'react';
import { useLanguage } from '@/i18n/LanguageContext';

interface DeleteConfirmDialogProps {
  open: boolean;
  title: string; // Content name to be deleted, such as "collection", "request", "field", "member", "data item"
  content: string; // Specific content to be deleted, such as collection name or request name
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

const DeleteConfirmDialog: React.FC<DeleteConfirmDialogProps> = ({
  open,
  title,
  content,
  onConfirm,
  onCancel,
  isLoading = false,
}) => {
  const { t } = useLanguage();
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-black/20 flex items-center justify-center z-50"
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-lg shadow p-5 w-80 max-w-full"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Title section */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-800 flex items-center gap-2">
            <i className="fas fa-trash text-red-500"></i>
            {t('deleteConfirmDialog.confirmDelete')}
          </h2>
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
          >
            <i className="fas fa-times text-lg"></i>
          </button>
        </div>

        {/* Confirmation message */}
        <p className="text-gray-700 mb-6 text-sm">
          {t('deleteConfirmDialog.willDelete')}{title}：<span className="font-semibold text-gray-900 break-words">{content}</span>
          {t('deleteConfirmDialog.cannotUndo')}
        </p>

        {/* Button group */}
        <div className="flex gap-2 justify-end">
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="px-3 py-1.5 text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors disabled:opacity-50"
          >
            {t('deleteConfirmDialog.cancel')}
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="px-3 py-1.5 text-sm text-white bg-red-500 hover:bg-red-600 rounded-md transition-colors disabled:opacity-50 flex items-center gap-1"
          >
            <i className="fas fa-trash text-xs"></i>
            {t('deleteConfirmDialog.delete')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeleteConfirmDialog;