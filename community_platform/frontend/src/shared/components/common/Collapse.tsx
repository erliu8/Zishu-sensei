/**
 * Collapse 折叠组件
 * 带动画的内容折叠和展开
 */

import React, { useRef, useEffect, useState } from 'react'
import { cn } from '@/shared/utils'

export interface CollapseProps extends React.HTMLAttributes<HTMLDivElement> {
  /** 是否展开 */
  isOpen: boolean
  /** 动画持续时间(ms) */
  duration?: number
  /** 禁用动画 */
  disableAnimation?: boolean
  /** 动画时机函数 */
  easing?: string
  /** 展开时的回调 */
  onOpen?: () => void
  /** 折叠时的回调 */
  onClose?: () => void
  /** 动画开始时的回调 */
  onAnimationStart?: () => void
  /** 动画结束时的回调 */
  onAnimationEnd?: () => void
}

export const Collapse = React.forwardRef<HTMLDivElement, CollapseProps>(
  (
    {
      children,
      className,
      isOpen,
      duration = 300,
      disableAnimation = false,
      easing = 'cubic-bezier(0.4, 0, 0.2, 1)',
      onOpen,
      onClose,
      onAnimationStart,
      onAnimationEnd,
      style,
      ...props
    },
    ref
  ) => {
    const contentRef = useRef<HTMLDivElement>(null)
    const [height, setHeight] = useState<number | 'auto'>(isOpen ? 'auto' : 0)
    const prevIsOpenRef = useRef(isOpen)

    useEffect(() => {
      const contentEl = contentRef.current
      if (!contentEl) return

      const handleTransitionEnd = () => {
        onAnimationEnd?.()
        if (isOpen) {
          setHeight('auto')
          onOpen?.()
        } else {
          onClose?.()
        }
      }

      contentEl.addEventListener('transitionend', handleTransitionEnd)
      return () => contentEl.removeEventListener('transitionend', handleTransitionEnd)
    }, [isOpen, onOpen, onClose, onAnimationEnd])

    useEffect(() => {
      const contentEl = contentRef.current
      if (!contentEl || disableAnimation) {
        setHeight(isOpen ? 'auto' : 0)
        return
      }

      // 只有当 isOpen 状态发生变化时才执行动画
      if (prevIsOpenRef.current !== isOpen) {
        onAnimationStart?.()

        if (isOpen) {
          // 展开动画
          const scrollHeight = contentEl.scrollHeight
          setHeight(0)
          requestAnimationFrame(() => {
            setHeight(scrollHeight)
          })
        } else {
          // 折叠动画
          const scrollHeight = contentEl.scrollHeight
          setHeight(scrollHeight)
          requestAnimationFrame(() => {
            setHeight(0)
          })
        }

        prevIsOpenRef.current = isOpen
      }
    }, [isOpen, disableAnimation, onAnimationStart])

    const transitionStyle = disableAnimation
      ? {}
      : {
          transition: `height ${duration}ms ${easing}`,
          overflow: 'hidden',
        }

    return (
      <div
        ref={ref}
        className={cn('transition-all', className)}
        style={{
          ...transitionStyle,
          height: height === 'auto' ? 'auto' : `${height}px`,
          ...style,
        }}
        {...props}
      >
        <div ref={contentRef}>
          {children}
        </div>
      </div>
    )
  }
)

Collapse.displayName = 'Collapse'

// 使用示例的辅助组件
export interface CollapsibleProps {
  /** 触发器内容 */
  trigger: React.ReactNode
  /** 折叠内容 */
  children: React.ReactNode
  /** 默认是否展开 */
  defaultOpen?: boolean
  /** 受控的展开状态 */
  open?: boolean
  /** 状态变化回调 */
  onOpenChange?: (open: boolean) => void
  /** 自定义类名 */
  className?: string
  /** 触发器类名 */
  triggerClassName?: string
  /** 内容类名 */
  contentClassName?: string
}

export const Collapsible: React.FC<CollapsibleProps> = ({
  trigger,
  children,
  defaultOpen = false,
  open,
  onOpenChange,
  className,
  triggerClassName,
  contentClassName,
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  const controlledOpen = open !== undefined ? open : isOpen
  const handleToggle = () => {
    const newOpen = !controlledOpen
    if (open === undefined) {
      setIsOpen(newOpen)
    }
    onOpenChange?.(newOpen)
  }

  return (
    <div className={cn('w-full', className)}>
      <div
        className={cn(
          'cursor-pointer select-none',
          triggerClassName
        )}
        onClick={handleToggle}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            handleToggle()
          }
        }}
      >
        {trigger}
      </div>
      <Collapse isOpen={controlledOpen} className={contentClassName}>
        {children}
      </Collapse>
    </div>
  )
}

Collapsible.displayName = 'Collapsible'
