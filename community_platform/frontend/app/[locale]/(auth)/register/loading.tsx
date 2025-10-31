import { Skeleton } from '@/shared/components/ui/skeleton';

/**
 * 注册页面加载状态
 */
export default function RegisterLoading() {
  return (
    <div className="space-y-6">
      {/* 页面标题骨架 */}
      <div className="space-y-2 text-center">
        <Skeleton className="h-9 w-32 mx-auto" />
        <Skeleton className="h-5 w-72 mx-auto" />
      </div>

      {/* 表单骨架 */}
      <div className="space-y-4">
        {/* 用户名字段 */}
        <div className="space-y-2">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-3 w-64" />
        </div>

        {/* 邮箱字段 */}
        <div className="space-y-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-10 w-full" />
        </div>

        {/* 密码字段 */}
        <div className="space-y-2">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-3 w-48" />
        </div>

        {/* 确认密码字段 */}
        <div className="space-y-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-10 w-full" />
        </div>

        {/* 同意条款 */}
        <div className="flex items-start space-x-3">
          <Skeleton className="h-4 w-4 mt-0.5" />
          <Skeleton className="h-4 w-64" />
        </div>

        {/* 注册按钮 */}
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

      {/* 登录链接 */}
      <Skeleton className="h-4 w-40 mx-auto" />
    </div>
  );
}

