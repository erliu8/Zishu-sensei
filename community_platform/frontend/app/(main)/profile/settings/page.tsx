/**
 * 设置页面默认路由
 * @route /profile/settings
 * 重定向到个人资料设置页
 */

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { LoadingSpinner } from '@/shared/components/ui/loading-spinner';

export default function SettingsPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/profile/settings/profile');
  }, [router]);

  return (
    <div className="flex items-center justify-center py-12">
      <LoadingSpinner size="lg" />
    </div>
  );
}

