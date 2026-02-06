'use client';

interface ToolCardProps {
  name: string;
  description: string;
  tags: string[];
  icon: string;
  gradient: string;
  iconColor: string;
  onClick?: () => void;
}

import { useLanguage } from '../../i18n/LanguageContext';

export default function ToolCard({
  name,
  description,
  tags,
  icon,
  gradient,
  iconColor,
  onClick,
}: ToolCardProps) {
  const { t } = useLanguage();
  return (
    <div
      className="rounded-xl shadow-md overflow-hidden card-hover cursor-pointer transition-all hover:shadow-xl border border-transparent hover:border-[#165DFF]/20 group flex flex-col h-full"
      onClick={onClick}
      style={{ backgroundColor: 'var(--bg-primary)' }}
    >
      <div className={`h-36 ${gradient} flex items-center justify-center relative overflow-hidden`}>
        {/* 背景装饰 */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl group-hover:bg-white/20 transition-all"></div>
        <div className="relative z-10 w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-lg transform group-hover:scale-110 transition-transform duration-300">
          <i className={`fas ${icon} text-2xl ${iconColor}`}></i>
        </div>
      </div>
      <div className="p-5 flex flex-col flex-grow">
        <h3 className="text-lg font-bold mb-2 flex items-center" style={{ color: 'var(--text-primary)' }}>
          <span>{name}</span>
        </h3>
        <p className="text-sm mb-4 line-clamp-2 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          {description}
        </p>
        
        {/* 功能标签 */}
        <div className="flex flex-wrap gap-1.5 mb-6 mt-auto">
          {tags.map((tag, idx) => (
            <span 
              key={idx} 
              className="text-[10px] px-2 py-0.5 rounded-md border" 
              style={{ 
                color: 'var(--text-secondary)', 
                borderColor: 'var(--border-primary)',
                backgroundColor: 'rgba(78, 89, 105, 0.05)'
              }}
            >
              {tag}
            </span>
          ))}
        </div>
        
        <div className="flex items-center justify-between pt-4 border-t" style={{ borderColor: 'var(--border-primary)' }}>
          <span className="text-sm font-medium text-[#165DFF] group-hover:translate-x-1 transition-transform">{t('tools.redis.enterNow') || '立即进入'}</span>
          <i className="fas fa-arrow-right text-xs text-[#165DFF] transform group-hover:translate-x-1 transition-transform"></i>
        </div>
      </div>
    </div>
  );
}
