/**
 * 测试页面 - 验证国际化路由
 */

import { notFound } from 'next/navigation';
import { isValidLocale } from '@/infrastructure/i18n/config';

export interface TestPageProps {
  params: Promise<{ locale: string }>;
}

export default async function TestPage({ params }: TestPageProps) {
  const { locale } = await params;
  
  if (!isValidLocale(locale)) {
    notFound();
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">国际化路由测试成功！</h1>
        <p className="text-xl text-muted-foreground mb-4">
          当前语言: <span className="font-mono bg-gray-100 px-2 py-1 rounded">{locale}</span>
        </p>
        <p className="text-green-600">
          ✅ /zh-CN 路由现在可以正常工作了
        </p>
      </div>
    </div>
  );
}
