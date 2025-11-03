import { motion, type Variants } from 'framer-motion'
import * as React from 'react'
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import type { ButtonSize, ButtonVariant, LoadingState } from '../../../types/ui'

// 按钮动画变体
const buttonVariants: Variants = {
    initial: { scale: 1 },
    hover: { scale: 1.02 },
    tap: { scale: 0.98 },
    disabled: { scale: 1, opacity: 0.6 }
}

// 加载动画变体
const spinnerVariants: Variants = {
    animate: {
        rotate: 360,
        transition: {
            duration: 1,
            repeat: Infinity,
            ease: "linear"
        }
    }
}

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'size'> {
    /** 按钮变体样式 */
    variant?: ButtonVariant
    /** 按钮尺寸 */
    size?: ButtonSize
    /** 加载状态 */
    loading?: boolean
    /** 加载状态类型 */
    loadingState?: LoadingState
    /** 禁用状态 */
    disabled?: boolean
    /** 图标（左侧） */
    icon?: ReactNode
    /** 图标（右侧） */
    iconRight?: ReactNode
    /** 是否为图标按钮 */
    iconOnly?: boolean
    /** 是否为块级按钮 */
    block?: boolean
    /** 是否为圆形按钮 */
    round?: boolean
    /** 自定义类名 */
    className?: string
    /** 子元素 */
    children?: ReactNode
    /** 点击事件 */
    onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void
}

// 工具函数：组合类名
const combineClasses = (...classes: (string | undefined | false)[]): string => {
    return classes.filter(Boolean).join(' ')
}

/**
 * 通用按钮组件
 * 
 * 特性：
 * - 多种变体样式（primary, secondary, outline, ghost, success, warning, error）
 * - 多种尺寸（sm, md, lg, xl）
 * - 加载状态支持
 * - 图标支持（左侧、右侧、仅图标）
 * - 动画效果
 * - 无障碍支持
 * - 响应式设计
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(({
    variant = 'primary',
    size = 'md',
    loading = false,
    loadingState = 'idle',
    disabled = false,
    icon,
    iconRight,
    iconOnly = false,
    block = false,
    round = false,
    className,
    children,
    onClick,
    ...props
}, ref) => {
    const isDisabled = disabled || loading
    const showLoading = loading || loadingState === 'loading'

    // 基础样式类
    const baseClasses = combineClasses(
        // 基础样式
        'inline-flex items-center justify-center font-medium transition-all duration-200',
        'focus:outline-none focus:ring-2 focus:ring-offset-2',
        'select-none cursor-pointer',

        // 尺寸样式
        size === 'sm' && 'px-2 py-1 text-xs gap-1',
        size === 'md' && 'px-3 py-1.5 text-sm gap-1.5',
        size === 'lg' && 'px-4 py-2 text-base gap-2',
        size === 'xl' && 'px-6 py-3 text-lg gap-2.5',

        // 圆角样式
        (!round && !iconOnly) && 'rounded-md',
        (round || iconOnly) && 'rounded-full',

        // 图标按钮样式
        iconOnly && size === 'sm' && 'w-8 h-8 p-0',
        iconOnly && size === 'md' && 'w-9 h-9 p-0',
        iconOnly && size === 'lg' && 'w-10 h-10 p-0',
        iconOnly && size === 'xl' && 'w-12 h-12 p-0',

        // 块级按钮
        block && 'w-full',

        // 禁用状态
        isDisabled && 'cursor-not-allowed opacity-60',
        !isDisabled && 'cursor-pointer'
    )

    // 变体样式类
    const variantClasses = combineClasses(
        // Primary
        variant === 'primary' && !isDisabled && 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500 active:bg-blue-800',
        variant === 'primary' && isDisabled && 'bg-blue-400 text-white',

        // Secondary
        variant === 'secondary' && !isDisabled && 'bg-gray-600 text-white hover:bg-gray-700 focus:ring-gray-500 active:bg-gray-800',
        variant === 'secondary' && isDisabled && 'bg-gray-400 text-white',

        // Outline
        variant === 'outline' && !isDisabled && 'border-2 border-blue-600 text-blue-600 hover:bg-blue-50 focus:ring-blue-500 active:bg-blue-100 dark:hover:bg-blue-900/20 dark:active:bg-blue-900/30',
        variant === 'outline' && isDisabled && 'border-2 border-gray-300 text-gray-400',

        // Ghost
        variant === 'ghost' && !isDisabled && 'text-gray-700 hover:bg-gray-100 focus:ring-gray-500 active:bg-gray-200 dark:text-gray-300 dark:hover:bg-gray-800 dark:active:bg-gray-700',
        variant === 'ghost' && isDisabled && 'text-gray-400',

        // Success
        variant === 'success' && !isDisabled && 'bg-green-600 text-white hover:bg-green-700 focus:ring-green-500 active:bg-green-800',
        variant === 'success' && isDisabled && 'bg-green-400 text-white',

        // Warning
        variant === 'warning' && !isDisabled && 'bg-yellow-600 text-white hover:bg-yellow-700 focus:ring-yellow-500 active:bg-yellow-800',
        variant === 'warning' && isDisabled && 'bg-yellow-400 text-white',

        // Error
        variant === 'error' && !isDisabled && 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500 active:bg-red-800',
        variant === 'error' && isDisabled && 'bg-red-400 text-white'
    )

    // 处理点击事件
    const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
        if (isDisabled) {
            event.preventDefault()
            return
        }
        onClick?.(event)
    }

    // 渲染加载图标
    const renderLoadingIcon = () => {
        const sizeClass = size === 'sm' ? 'w-3 h-3' :
            size === 'md' ? 'w-4 h-4' :
                size === 'lg' ? 'w-5 h-5' : 'w-6 h-6'

        return React.createElement(motion.div, {
            variants: spinnerVariants,
            animate: "animate",
            className: combineClasses(
                'border-2 border-current border-t-transparent rounded-full',
                sizeClass
            )
        })
    }

    // 渲染图标
    const renderIcon = (iconElement: ReactNode) => {
        if (!iconElement) return null

        const sizeClass = size === 'sm' ? 'text-xs' :
            size === 'md' ? 'text-sm' :
                size === 'lg' ? 'text-base' : 'text-lg'

        return React.createElement('span', {
            className: combineClasses('flex items-center justify-center', sizeClass)
        }, iconElement)
    }

    const buttonContent = []

    // 左侧图标或加载图标
    if (showLoading) {
        buttonContent.push(renderLoadingIcon())
    } else if (icon) {
        buttonContent.push(renderIcon(icon))
    }

    // 按钮文本
    if (!iconOnly && children) {
        buttonContent.push(
            React.createElement('span', {
                key: 'text',
                className: combineClasses(
                    'truncate',
                    showLoading && !icon && !iconRight && 'opacity-0'
                )
            }, children)
        )
    }

    // 右侧图标
    if (!showLoading && iconRight) {
        buttonContent.push(renderIcon(iconRight))
    }

    return React.createElement(motion.button, {
        ref,
        className: combineClasses(baseClasses, variantClasses, className),
        variants: buttonVariants,
        initial: "initial",
        whileHover: !isDisabled ? "hover" : "disabled",
        whileTap: !isDisabled ? "tap" : "disabled",
        animate: isDisabled ? "disabled" : "initial",
        disabled: isDisabled,
        onClick: handleClick,
        'aria-disabled': isDisabled,
        'aria-busy': showLoading,
        ...(props as any)
    }, ...buttonContent)
})

Button.displayName = 'Button'

// ============================================================================
// ButtonGroup 组件
// ============================================================================

export interface ButtonGroupProps {
    /** 子元素 */
    children: ReactNode
    /** 排列方向 */
    orientation?: 'horizontal' | 'vertical'
    /** 自定义类名 */
    className?: string
    /** 自定义样式 */
    style?: React.CSSProperties
}

/**
 * 按钮组组件
 * 
 * 特性：
 * - 支持水平和垂直排列
 * - 自动处理按钮间距和圆角
 */
export const ButtonGroup = forwardRef<HTMLDivElement, ButtonGroupProps>(({
    children,
    orientation = 'horizontal',
    className,
    style,
    ...props
}, ref) => {
    const baseClasses = combineClasses(
        'inline-flex',
        orientation === 'horizontal' ? 'flex-row' : 'flex-col',
        '[&>*:not(:first-child):not(:last-child)]:rounded-none',
        orientation === 'horizontal' && '[&>*:not(:first-child)]:border-l-0 [&>*:not(:first-child)]:ml-0',
        orientation === 'horizontal' && '[&>*:first-child]:rounded-r-none [&>*:last-child]:rounded-l-none',
        orientation === 'vertical' && '[&>*:not(:first-child)]:border-t-0 [&>*:not(:first-child)]:mt-0',
        orientation === 'vertical' && '[&>*:first-child]:rounded-b-none [&>*:last-child]:rounded-t-none'
    )

    return React.createElement('div', {
        ref,
        className: combineClasses(baseClasses, className),
        style,
        role: 'group',
        ...props
    }, children)
})

ButtonGroup.displayName = 'ButtonGroup'

// 导出按钮组件和相关类型
export default Button