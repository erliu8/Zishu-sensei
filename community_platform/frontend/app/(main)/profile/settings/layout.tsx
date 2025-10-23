/**
 * 设置页面布局
 * @route /profile/settings/*
 */

'use client';

import { usePathname, useRouter } from 'next/navigation';
import { Card } from '@/shared/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import { User, Lock, Settings as SettingsIcon } from 'lucide-react';

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const tabs = [
    { value: 'profile', label: '个人资料', icon: User, path: '/profile/settings/profile' },
    { value: 'security', label: '安全设置', icon: Lock, path: '/profile/settings/security' },
    { value: 'preferences', label: '偏好设置', icon: SettingsIcon, path: '/profile/settings/preferences' },
  ];

  const currentTab = pathname?.split('/').pop() || 'profile';

  const handleTabChange = (value: string) => {
    const tab = tabs.find((t) => t.value === value);
    if (tab) {
      router.push(tab.path);
    }
  };

  return (
    <div className="container mx-auto py-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* 页面头部 */}
        <div>
          <h1 className="text-3xl font-bold">设置</h1>
          <p className="text-muted-foreground mt-2">管理你的账号设置和偏好</p>
        </div>

        {/* 标签导航 */}
        <Tabs value={currentTab} onValueChange={handleTabChange}>
          <TabsList className="grid w-full grid-cols-3">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <TabsTrigger key={tab.value} value={tab.value} className="flex items-center gap-2">
                  <Icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{tab.label}</span>
                </TabsTrigger>
              );
            })}
          </TabsList>
        </Tabs>

        {/* 内容区域 */}
        <Card className="p-6">{children}</Card>
      </div>
    </div>
  );
}

