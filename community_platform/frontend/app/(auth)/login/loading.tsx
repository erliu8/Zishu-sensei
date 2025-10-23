import { Skeleton } from '@/shared/components/ui/skeleton';

/**
 * 登录页面加载状态
 */
export default function LoginLoading() {
  return (
    <div className="space-y-6">
      {/* 页面标题骨架 */}
      <div className="space-y-2 text-center">
        <Skeleton className="h-9 w-48 mx-auto" />
        <Skeleton className="h-5 w-64 mx-auto" />
      </div>

      {/* 表单骨架 */}
      <div className="space-y-4">
        {/* 邮箱字段 */}
        <div className="space-y-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-10 w-full" />
        </div>

        {/* 密码字段 */}
        <div className="space-y-2">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-10 w-full" />
        </div>

        {/* 记住我 & 忘记密码 */}
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-24" />
        </div>

        {/* 登录按钮 */}
        <Skeleton className="h-10 w-full" />
      </div>

      {/* 分隔线 */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <Skeleton className="h-px w-full" />
        </div>
      </div>

      {/* 社交登录按钮 */}
      <div className="grid gap-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>

      {/* 注册链接 */}
      <Skeleton className="h-4 w-48 mx-auto" />
    </div>
  );
}

