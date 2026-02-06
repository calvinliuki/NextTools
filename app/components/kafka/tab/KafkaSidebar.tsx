'use client';

import { KafkaSection, KafkaSidebarItem } from './types';

interface KafkaSidebarProps {
  items: KafkaSidebarItem[];
  activeSection: KafkaSection;
  onSelect: (section: KafkaSection) => void;
  connectionName: string;
  clusterInfo: any;
}

export default function KafkaSidebar({
  items,
  activeSection,
  onSelect,
  connectionName,
  clusterInfo,
}: KafkaSidebarProps) {
  return (
    <aside className="w-[230px] bg-white border-r border-[#E5E6EB] p-4 flex flex-col gap-4 shadow-sm">
      <div className="flex items-center gap-2.5 pb-4 border-b border-[#E5E6EB]">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center shadow-md">
          <span className="text-base font-bold text-white">K</span>
        </div>
        <div>
          <div className="font-semibold text-sm">Kafka Console</div>
          <div className="text-[10px] text-[#86909C] uppercase tracking-wide">Control Center</div>
        </div>
      </div>

      <div>
        <div className="text-[10px] font-semibold uppercase tracking-wider text-[#86909C] mb-2 px-2">Navigation</div>
        <div className="flex flex-col gap-0.5">
          {items.map((item) => (
            <button
              key={item.id}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center gap-2 transition-all ${
                activeSection === item.id
                  ? 'bg-[#E8F3FF] text-[#165DFF] font-medium'
                  : 'text-[#4E5969] hover:bg-[#F2F3F5] hover:text-[#1D2129]'
              }`}
              onClick={() => onSelect(item.id)}
            >
              <span className="text-base">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="mt-auto pt-4 border-t border-[#E5E6EB]">
        <div className="px-3 py-2 rounded-lg bg-[#F2F3F5] text-xs">
          <div className="text-[#165DFF] font-medium mb-1">{connectionName}</div>
          <div className="text-[#86909C]">
            {clusterInfo ? `${clusterInfo.brokers} brokers • ${clusterInfo.topics} topics` : 'Loading...'}
          </div>
        </div>
      </div>
    </aside>
  );
}
