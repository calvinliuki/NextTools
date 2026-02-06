'use client';

import { useLanguage } from '@/i18n/LanguageContext';

interface KafkaHeaderProps {
  connectionName: string;
  clusterInfo: any;
}

export default function KafkaHeader({ connectionName, clusterInfo }: KafkaHeaderProps) {
  const { t } = useLanguage();
  return (
    <header className="h-14 flex items-center justify-between px-6 bg-white border-b border-[#E5E6EB] shadow-sm">
      <div>
        <div className="font-medium text-base">{t('kafka.kafkaClusterConsole')}</div>
        <div className="text-xs text-[#86909C]">{t('kafka.realTimeMonitoring')}</div>
      </div>
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#E5E6EB] bg-[#F9FAFB]">
        <div className="w-2 h-2 rounded-full bg-[#00B42A]"></div>
        <div className="text-xs">
          <div className="font-medium">{connectionName}</div>
          <div className="text-[#86909C]">{clusterInfo ? `${clusterInfo.brokers} brokers` : 'Connecting...'}</div>
        </div>
      </div>
    </header>
  );
}
