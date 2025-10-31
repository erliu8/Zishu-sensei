/**
 * Packaging Loading
 * 打包页面加载状态
 */

import { LoadingSpinner } from '@/shared/components/ui/loading-spinner';

export default function PackagingLoading() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <LoadingSpinner size="lg" />
    </div>
  );
}

