import { LoadingSpinner } from '@/shared/components/ui/loading-spinner';

/**
 * 根级别加载状态
 */
export default function Loading() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <LoadingSpinner size="lg" label="加载中..." />
    </div>
  );
}

