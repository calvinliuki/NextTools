'use client';

import { useLanguage } from '../../../../i18n/LanguageContext';

interface DeleteTopicDialogProps {
  isOpen: boolean;
  topicName: string | null;
  onClose: () => void;
  onConfirm: () => void;
}

export default function DeleteTopicDialog({
  isOpen,
  topicName,
  onClose,
  onConfirm,
}: DeleteTopicDialogProps) {
  const { t } = useLanguage();
  if (!isOpen || !topicName) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-50 transition-opacity bg-black/30"
        onClick={onClose}
      ></div>

      <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
        <div
          className="bg-white rounded-lg shadow-[0_20px_60px_-12px_rgba(0,0,0,0.25)] w-[420px] flex flex-col pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 bg-white rounded-t-lg">
            <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <i className="fas fa-trash text-red-500"></i>
              {t('kafka.deleteTopicDialogTitle')}
            </h2>
            <button
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-md transition-all"
              title={t('elasticTab.close')}
            >
              <i className="fas fa-times text-xs"></i>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-5 bg-gray-50 min-h-[120px]">
            <p className="text-gray-700 mb-2 text-sm">
              {t('kafka.deleteTopicConfirmation')}<span className="font-semibold text-gray-900 break-words">{topicName}</span>
            </p>
            <p className="text-gray-500 text-xs">
              {t('kafka.deleteTopicWarning')}
            </p>
          </div>

          <div className="flex items-center justify-end px-5 py-3.5 border-t border-gray-100 bg-white rounded-b-lg">
            <div className="flex items-center gap-2.5">
              <button
                onClick={onClose}
                className="px-4 py-1.5 text-sm text-gray-700 hover:bg-gray-50 rounded-md transition-all"
              >
                {t('kafka.cancelButton')}
              </button>
              <button
                className="px-4 py-1.5 text-sm font-medium bg-red-500 text-white rounded-md hover:bg-red-600 transition-all flex items-center gap-2"
                onClick={onConfirm}
              >
                <i className="fas fa-trash text-xs"></i>
                {t('kafka.deleteTopicButton')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
