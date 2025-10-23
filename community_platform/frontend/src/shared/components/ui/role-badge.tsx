import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { Shield, User } from 'lucide-react'
import { cn } from '@/shared/utils/cn'

/**
 * 用户角色类型
 * - user: 普通用户
 * - admin: 社区管理员
 */
export type UserRole = 'user' | 'admin'

const roleBadgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors',
  {
    variants: {
      role: {
        user: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        admin:
          'bg-gradient-to-r from-primary to-secondary text-primary-foreground shadow-md hover:shadow-lg',
      },
      size: {
        sm: 'px-2 py-0.5 text-2xs',
        default: 'px-2.5 py-0.5 text-xs',
        lg: 'px-3 py-1 text-sm',
      },
    },
    defaultVariants: {
      role: 'user',
      size: 'default',
    },
  }
)

export interface RoleBadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof roleBadgeVariants> {
  /**
   * 是否显示图标
   * @default true
   */
  showIcon?: boolean
  /**
   * 自定义文本（如果不提供，将使用默认的角色名称）
   */
  label?: string
}

/**
 * 角色徽章组件
 * 用于显示用户角色（普通用户或管理员）
 *
 * @example
 * ```tsx
 * <RoleBadge role="admin" />
 * <RoleBadge role="user" showIcon={false} />
 * <RoleBadge role="admin" label="超级管理员" />
 * ```
 */
const RoleBadge = React.forwardRef<HTMLDivElement, RoleBadgeProps>(
  (
    { className, role = 'user', size, showIcon = true, label, ...props },
    ref
  ) => {
    // 默认角色标签
    const defaultLabels: Record<UserRole, string> = {
      user: '用户',
      admin: '管理员',
    }

    // 角色图标
    const roleIcons: Record<UserRole, React.ReactNode> = {
      user: <User className="h-3 w-3" />,
      admin: <Shield className="h-3 w-3" />,
    }

    const displayLabel = label || defaultLabels[role || 'user']
    const icon = role ? roleIcons[role] : null

    return (
      <div
        ref={ref}
        className={cn(roleBadgeVariants({ role, size }), className)}
        role="status"
        aria-label={`角色: ${displayLabel}`}
        {...props}
      >
        {showIcon && icon}
        <span>{displayLabel}</span>
      </div>
    )
  }
)
RoleBadge.displayName = 'RoleBadge'

export { RoleBadge, roleBadgeVariants }

