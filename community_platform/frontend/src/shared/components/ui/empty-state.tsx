import * as React from 'react'
import { cn } from '@/shared/utils/cn'
import { Button } from './button'

export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * 图标或插图
   */
  icon?: React.ReactNode
  /**
   * 标题
   */
  title: string
  /**
   * 描述文本
   */
  description?: string
  /**
   * 行动按钮
   */
  action?: {
    label: string
    onClick: () => void
  }
}

/**
 * 空状态组件
 * 用于显示无数据或空内容的状态
 *
 * @example
 * ```tsx
 * <EmptyState
 *   icon={<FileQuestion size={48} />}
 *   title="暂无帖子"
 *   description="还没有发布任何帖子，快来创建第一篇吧！"
 *   action={{
 *     label: "创建帖子",
 *     onClick: () => router.push('/posts/create')
 *   }}
 * />
 * ```
 */
const EmptyState = React.forwardRef<HTMLDivElement, EmptyStateProps>(
  ({ className, icon, title, description, action, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed bg-muted/30 p-8 text-center',
          className
        )}
        {...props}
      >
        {icon && (
          <div className="text-muted-foreground opacity-50">{icon}</div>
        )}
        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-foreground">{title}</h3>
          {description && (
            <p className="text-sm text-muted-foreground max-w-md">
              {description}
            </p>
          )}
        </div>
        {action && (
          <Button onClick={action.onClick} className="mt-2">
            {action.label}
          </Button>
        )}
      </div>
    )
  }
)
EmptyState.displayName = 'EmptyState'

export { EmptyState }

