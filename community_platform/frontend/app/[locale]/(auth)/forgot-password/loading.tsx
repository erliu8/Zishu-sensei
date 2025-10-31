import { Skeleton } from '@/shared/components/ui/skeleton';

/**
 * 忘记密码页面加载状态
 */
export default function ForgotPasswordLoading() {
  return (
    <div className="space-y-6">
      {/* 标题和说明文字骨架 */}
      <div className="space-y-2 text-center">
        <Skeleton className="h-7 w-32 mx-auto" />
        <Skeleton className="h-4 w-80 mx-auto" />
      </div>

      {/* 表单骨架 */}
      <div className="space-y-4">
        {/* 邮箱字段 */}
        <div className="space-y-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-3 w-56" />
        </div>

        {/* 提交按钮 */}
        <Skeleton className="h-10 w-full" />

        {/* 返回登录按钮 */}
        <Skeleton className="h-10 w-full" />
      </div>
    </div>
  );
}

