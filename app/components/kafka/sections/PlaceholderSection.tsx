'use client';

import { useLanguage } from '../../../../i18n/LanguageContext';

interface PlaceholderSectionProps {
  title: string;
}

export default function PlaceholderSection({ title }: PlaceholderSectionProps) {
  const { t } = useLanguage();
  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold capitalize">{title}</h2>
      </div>
      <div className="p-12 rounded-xl bg-white border border-[#E5E6EB] shadow-sm text-center">
        <div className="text-4xl mb-3 opacity-50">🛠️</div>
        <div className="text-base font-medium mb-1">
          {title.charAt(0).toUpperCase() + title.slice(1)} {t('kafka.developmentModuleSuffix')}
        </div>
        <div className="text-xs text-[#86909C]">{t('kafka.schemaRegistryInfo')}</div>
      </div>
    </div>
  );
}
