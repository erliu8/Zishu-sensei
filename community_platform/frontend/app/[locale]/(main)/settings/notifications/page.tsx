'use client';

import React from 'react';
import { NotificationPreferences } from '@/features/notification/components';

export default function NotificationSettingsPage() {
  return (
    <div className="container max-w-3xl py-8">
      {/* 头部 */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold">通知设置</h1>
        <p className="text-muted-foreground mt-2">
          管理您的通知偏好和设置
        </p>
      </div>

      {/* 设置表单 */}
      <NotificationPreferences />
    </div>
  );
}

