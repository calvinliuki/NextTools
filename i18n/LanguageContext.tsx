'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Locale, detectDefaultLocale } from './config';
import zhCNCommon from './locales/zh-CN/common.json';
import enCommon from './locales/en/common.json';

// 类型定义
// 定义嵌套路径类型
// 首先定义每个顶级键的类型
type HomeKeys = keyof typeof zhCNCommon.home;
type ToolsKeys = keyof typeof zhCNCommon.tools;
type FeaturesKeys = keyof typeof zhCNCommon.features;
type HeaderKeys = keyof typeof zhCNCommon.header;
type FooterKeys = keyof typeof zhCNCommon.footer;

// 为嵌套对象定义路径类型
// 例如: 'tools.redis.name'
type NestedKeys<T, Prefix extends string = ''> = {
  [K in keyof T]: K extends string
    ? T[K] extends string
      ? `${Prefix}${K}`
      : T[K] extends object
        ? `${Prefix}${K}` | NestedKeys<T[K], `${Prefix}${K}.`>
        : `${Prefix}${K}`
    : never;
}[keyof T];

type SafeKeyOf<T, K extends PropertyKey> = K extends keyof T ? keyof T[K] : never;

type TranslationKeys = 
  | NestedKeys<typeof zhCNCommon> 
  | NestedKeys<typeof enCommon>
  | `${'redis' | 'streamKeyDetail' | 'database' | 'sessionManager' | 'databaseConnectionDialog' | 'databaseTab' | 'redisTab' | 'kafka' | 'ssh' | 'postman' | 'workspace' | 'redisConnectionDialog' | 'localDirectoryPicker' | 'elasticTab' | 'sshConnectionDialog' | 'sftpPathBar' | 'renameDialog' | 'newFolderDialog'}.${string}`;

interface LanguageContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: <T extends TranslationKeys>(key: T, options?: { [key: string]: any }) => string;
}

// 创建上下文
const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

// 翻译函数
const getNestedValue = (obj: any, path: string): string => {
  return path.split('.').reduce((current, key) => current?.[key] || '', obj);
};

// 翻译替换函数，支持插值
const interpolate = (template: string, options?: { [key: string]: any }): string => {
  if (!options) return template;
  
  let result = template;
  Object.keys(options).forEach(key => {
    const regex = new RegExp(`{{${key}}}`, 'g');
    result = result.replace(regex, options[key]);
  });
  return result;
};

// 语言提供者组件
export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [locale, setLocale] = useState<Locale>('zh-CN');

  // 初始化语言设置
  useEffect(() => {
    // 尝试从 localStorage 读取保存的语言设置
    const savedLocale = localStorage.getItem('locale') as Locale | null;
    if (savedLocale && ['zh-CN', 'en'].includes(savedLocale)) {
      setLocale(savedLocale);
    } else {
      // 检测系统语言
      const detectedLocale = detectDefaultLocale();
      setLocale(detectedLocale);
    }
  }, []);

  // 当语言改变时，保存到 localStorage 并更新 html lang 属性
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('locale', locale);
      document.documentElement.lang = locale === 'zh-CN' ? 'zh-CN' : 'en';
    }
  }, [locale]);

  // 翻译函数
  const t = <T extends TranslationKeys>(key: T, options?: { [key: string]: any }): string => {
    let translation = '';
    
    if (locale === 'zh-CN') {
      translation = getNestedValue(zhCNCommon, key as string);
    } else {
      translation = getNestedValue(enCommon, key as string);
    }
    
    // 如果找不到翻译，则尝试在另一种语言中查找作为备用
    if (!translation && locale === 'zh-CN') {
      translation = getNestedValue(enCommon, key as string);
    } else if (!translation) {
      translation = getNestedValue(zhCNCommon, key as string);
    }
    
    // 应用插值
    return interpolate(translation, options) || key as string;
  };

  const value = {
    locale,
    setLocale,
    t
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};

// 自定义 Hook
export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};

// 高阶组件 - 为类组件提供语言上下文
export const withLanguage = <P extends object>(
  Component: React.ComponentType<P & LanguageContextType>
): React.FC<Omit<P, keyof LanguageContextType>> => {
  return (props: Omit<P, keyof LanguageContextType>) => (
    <LanguageProvider>
      <Component {...props as P} {...useLanguage()} />
    </LanguageProvider>
  );
};