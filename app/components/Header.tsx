'use client';

import { useState, useEffect } from 'react';
import { useLanguage } from '../../i18n/LanguageContext';
import LanguageSwitcher from './LanguageSwitcher';

export default function Header() {
  const [isFullscreen, setIsFullscreen] = useState(true);
  const [isElectron, setIsElectron] = useState(false);
  const { t } = useLanguage();

  // 监听 Electron 全屏状态
  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).electronAPI?.onFullscreenChange) {
      setIsElectron(true);
      // 默认假设非全屏（窗口模式）
      setIsFullscreen(false);
      (window as any).electronAPI.onFullscreenChange((fullscreen: boolean) => {
        setIsFullscreen(fullscreen);
      });
    }
  }, []);

  return (
    <header className="shadow-sm sticky top-0 z-40 transition-all duration-300" style={{ backgroundColor: 'var(--bg-primary)', borderBottom: '1px solid var(--border-primary)' }}>
      <div className="container mx-auto px-4 py-3 flex items-center justify-between">
        <div className={`flex items-center space-x-2 transition-all duration-300 ${isElectron && !isFullscreen ? 'ml-20' : 'ml-4'}`}>
          <div className="w-10 h-10 rounded-lg bg-gradient-primary flex items-center justify-center text-white">
            <i className="fas fa-wrench text-xl"></i>
          </div>
          <h1 className="text-[clamp(1.2rem,3vw,1.5rem)] font-bold" style={{ color: 'var(--text-primary)' }}>
            {t('header.title')}
          </h1>
          <span className="hidden md:inline-block text-xs px-2 py-0.5 bg-[#165DFF]/10 text-[#165DFF] rounded-full">
            {t('header.subtitle')}
          </span>
        </div>
        <div className="flex items-center space-x-4">
          <LanguageSwitcher />
        </div>
      </div>
    </header>
  );
}
