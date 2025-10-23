import { Skeleton } from '@/shared/components/ui/skeleton';

export default function VerifyEmailLoading() {
  return (
    <div className="space-y-6">
      {/* 图标 */}
      <div className="flex justify-center">
        <Skeleton className="h-16 w-16 rounded-full" />
      </div>

      {/* 标题 */}
      <div className="space-y-2 text-center">
        <Skeleton className="h-6 w-48 mx-auto" />
        <Skeleton className="h-4 w-64 mx-auto" />
      </div>

      {/* 内容 */}
      <div className="space-y-3">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    </div>
  );
}

