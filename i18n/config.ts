// i18n 配置文件
export const DEFAULT_LOCALE = 'zh-CN';
export const SUPPORTED_LOCALES = ['zh-CN', 'en'] as const;
export type Locale = typeof SUPPORTED_LOCALES[number];

export const LOCALE_CONFIG: Record<Locale, { name: string; flag: string }> = {
  'zh-CN': { name: '中文', flag: '🇨🇳' },
  en: { name: 'English', flag: '🇺🇸' },
};

// 从浏览器语言检测默认语言
export function detectDefaultLocale(): Locale {
  if (typeof window !== 'undefined') {
    const browserLang = window.navigator.language;
    if (browserLang.startsWith('zh')) {
      return 'zh-CN';
    } else if (browserLang.startsWith('en')) {
      return 'en';
    }
  }
  // 服务器端渲染时，默认返回中文
  return DEFAULT_LOCALE;
}