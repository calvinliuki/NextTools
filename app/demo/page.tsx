'use client';

import { useLanguage } from '../../i18n/LanguageContext';
import Link from 'next/link';

export default function DemoPage() {
  const { locale, setLocale, t } = useLanguage();

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-md p-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800">国际化演示</h1>
          <Link href="/" className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
            返回首页
          </Link>
        </div>
        
        <div className="mb-6">
          <label className="block text-gray-700 mb-2">语言切换：</label>
          <select 
            value={locale} 
            onChange={(e) => setLocale(e.target.value as 'zh-CN' | 'en')}
            className="border border-gray-300 rounded px-3 py-2"
          >
            <option value="zh-CN">🇨🇳 中文</option>
            <option value="en">🇺🇸 English</option>
          </select>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="border border-gray-200 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4 text-blue-600">首页标题</h2>
            <p className="text-gray-700">{t('home.title')}</p>
          </div>
          
          <div className="border border-gray-200 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4 text-blue-600">首页描述</h2>
            <p className="text-gray-700">{t('home.description')}</p>
          </div>
          
          <div className="border border-gray-200 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4 text-blue-600">Redis客户端</h2>
            <p className="text-gray-700">{t('tools.redis.name')}</p>
            <p className="text-gray-600 text-sm mt-2">{t('tools.redis.description')}</p>
          </div>
          
          <div className="border border-gray-200 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4 text-blue-600">欢迎信息</h2>
            <p className="text-gray-700">{t('home.welcome')}</p>
          </div>
          
          <div className="border border-gray-200 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4 text-blue-600">开始使用按钮</h2>
            <p className="text-gray-700">{t('home.startBtn')}</p>
          </div>
          
          <div className="border border-gray-200 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4 text-blue-600">特性标题</h2>
            <p className="text-gray-700">{t('home.featuresTitle')}</p>
          </div>
        </div>
        
        <div className="mt-8 p-4 bg-blue-50 rounded-lg">
          <h3 className="font-medium text-blue-800 mb-2">当前语言环境: {locale}</h3>
          <p className="text-blue-600">
            您可以通过右上角的语言切换器或此页面的下拉菜单来切换语言。
            所有页面元素都将根据所选语言进行更新。
          </p>
        </div>
      </div>
    </div>
  );
}