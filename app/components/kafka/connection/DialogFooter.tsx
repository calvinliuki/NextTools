'use client';

import { useLanguage } from '../../../../i18n/LanguageContext';

interface DialogFooterProps {
  isTesting: boolean;
  isCreating: boolean;
  isConfirmDisabled: boolean;
  onTestConnection: () => void;
  onCancel: () => void;
  onConfirm: () => void;
}

export default function DialogFooter({
  isTesting,
  isCreating,
  isConfirmDisabled,
  onTestConnection,
  onCancel,
  onConfirm,
}: DialogFooterProps) {
  const { t } = useLanguage();
  return (
    <div className="flex items-center justify-between px-5 py-3.5 border-t border-gray-100 bg-white rounded-b-lg">
      <div className="flex items-center gap-2.5">
        <button
          onClick={onTestConnection}
          disabled={isTesting || isCreating}
          className="px-3 py-1.5 text-xs text-gray-600 hover:text-gray-800 hover:bg-gray-50 rounded-md transition-all flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <i className={`fas ${isTesting ? 'fa-spinner fa-spin' : 'fa-wrench'} text-xs`}></i>
          {isTesting ? t('kafka.creating') : t('kafka.testConnection')}
        </button>
        <button
          onClick={() => {
            console.log(t('kafka.quickStartGuide'));
          }}
          className="px-3 py-1.5 text-xs text-gray-600 hover:text-gray-800 hover:bg-gray-50 rounded-md transition-all flex items-center gap-1.5"
        >
          <i className="fas fa-question-circle text-xs"></i>
          {t('kafka.quickStartGuide')}
        </button>
      </div>
      <div className="flex items-center gap-2.5">
        <button
          onClick={onCancel}
          className="px-4 py-1.5 text-sm text-gray-700 hover:bg-gray-50 rounded-md transition-all"
        >
          {t('kafka.cancelButton')}
        </button>
        <button
          onClick={onConfirm}
          disabled={isConfirmDisabled}
          className="px-4 py-1.5 text-sm font-medium bg-[#007acc] text-white rounded-md hover:bg-[#005a9e] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow flex items-center gap-2"
        >
          {isCreating && <i className="fas fa-spinner fa-spin text-xs"></i>}
          {isCreating ? t('kafka.creating') : t('kafka.createButton')}
        </button>
      </div>
    </div>
  );
}
