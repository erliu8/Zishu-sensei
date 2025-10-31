/**
 * 国际化布局组件
 * 处理动态语言路由
 */

import { notFound } from 'next/navigation';
import { ReactNode } from 'react';
import { isValidLocale } from '@/infrastructure/i18n/config';

export interface LocaleLayoutProps {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}

/**
 * 动态语言路由布局
 */
export default async function LocaleLayout({
  children,
  params,
}: LocaleLayoutProps) {
  const { locale } = await params;
  
  // 验证语言参数是否有效
  if (!isValidLocale(locale)) {
    notFound();
  }

  return (
    <div className="locale-layout" data-locale={locale}>
      {children}
    </div>
  );
}

/**
 * 生成静态参数
 */
export async function generateStaticParams() {
  return [
    { locale: 'zh-CN' },
    { locale: 'en-US' },
    { locale: 'ja-JP' },
  ];
}
