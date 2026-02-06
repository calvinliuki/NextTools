'use client';

import { useLanguage } from '../../i18n/LanguageContext';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

export default function ClientLayoutWrapper({ children }: { children: React.ReactNode }) {
  const { locale } = useLanguage();
  const pathname = usePathname();

  useEffect(() => {
    // 更新 HTML lang 属性
    document.documentElement.lang = locale === 'zh-CN' ? 'zh-CN' : 'en';
    
    // 可选：在这里可以根据语言环境动态更新页面标题和描述
    // 例如，通过调用一个函数来更新页面标题
  }, [locale, pathname]); // 添加 pathname 作为依赖，确保在路由变化时也能更新

  return <>{children}</>;
}