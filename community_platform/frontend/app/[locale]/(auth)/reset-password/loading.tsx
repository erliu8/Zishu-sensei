import { Skeleton } from '@/shared/components/ui/skeleton';

/**
 * 重置密码页面加载状态
 */
export default function ResetPasswordLoading() {
  return (
    <div className="space-y-6">
      {/* 标题和说明文字骨架 */}
      <div className="space-y-2 text-center">
        <Skeleton className="h-7 w-32 mx-auto" />
        <Skeleton className="h-4 w-48 mx-auto" />
      </div>

      {/* 表单骨架 */}
      <div className="space-y-4">
        {/* 新密码字段 */}
        <div className="space-y-2">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-3 w-56" />
        </div>

        {/* 确认新密码字段 */}
        <div className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-10 w-full" />
        </div>

        {/* 密码要求提示 */}
        <div className="space-y-2">
          <Skeleton className="h-16 w-full" />
        </div>

        {/* 重置按钮 */}
        <Skeleton className="h-10 w-full" />

        {/* 返回登录按钮 */}
        <Skeleton className="h-10 w-full" />
      </div>
    </div>
  );
}

