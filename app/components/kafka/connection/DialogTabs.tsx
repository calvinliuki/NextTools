'use client';

import { useLanguage } from '../../../../i18n/LanguageContext';

interface DialogTabsProps {
  activeTab: 'connection' | 'advanced';
  setActiveTab: (value: 'connection' | 'advanced') => void;
}

export default function DialogTabs({ activeTab, setActiveTab }: DialogTabsProps) {
  const { t } = useLanguage();
  return (
    <div className="flex border-b border-gray-100 bg-white">
      <button
        onClick={() => setActiveTab('connection')}
        className={`px-5 py-2.5 text-sm font-medium transition-all relative ${
          activeTab === 'connection'
            ? 'text-[#007acc]'
            : 'text-gray-500 hover:text-gray-700'
        }`}
      >
        {t('kafka.connectionSettings')}
        {activeTab === 'connection' && (
          <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#007acc]"></span>
        )}
      </button>
      <button
        onClick={() => setActiveTab('advanced')}
        className={`px-5 py-2.5 text-sm font-medium transition-all relative ${
          activeTab === 'advanced'
            ? 'text-[#007acc]'
            : 'text-gray-500 hover:text-gray-700'
        }`}
      >
        {t('kafka.advancedSettings')}
        {activeTab === 'advanced' && (
          <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#007acc]"></span>
        )}
      </button>
    </div>
  );
}
