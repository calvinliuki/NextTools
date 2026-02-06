import { LanguageProvider } from '../i18n/LanguageContext';
import type { Metadata } from "next";
import "./globals.css";
import { getDynamicMetadata } from './_utils/getMetadata';

// 注意：由于Next.js限制，动态语言标签需要通过客户端组件更新
export async function generateMetadata(): Promise<Metadata> {
  const meta = await getDynamicMetadata();
  return {
    title: meta.title,
    description: meta.description,
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://cdn.bootcdn.net/ajax/libs/font-awesome/6.4.0/css/all.min.css"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased">
        <LanguageProvider>
          {/* 关闭 React Strict Mode 以避免双重渲染 */}
          {children}
        </LanguageProvider>
      </body>
    </html>
  );
}
