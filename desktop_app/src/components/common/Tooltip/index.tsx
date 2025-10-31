/**
 * Tooltip 提示组件
 * 
 * 功能特性：
 * - 多方向支持（上、下、左、右、自动）
 * - 延迟显示/隐藏
 * - 多种触发方式（hover, click, focus）
 * - 自定义样式和内容
 * - 箭头指示器
 * - 自动定位调整
 */

import React, { useState, useRef, useEffect, useCallback, useMemo, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import './styles.css'

/**
 * Tooltip 位置
 */
export type TooltipPlacement = 
  | 'top' 
  | 'top-start' 
  | 'top-end'
  | 'bottom' 
  | 'bottom-start' 
  | 'bottom-end'
  | 'left' 
  | 'left-start' 
  | 'left-end'
  | 'right' 
  | 'right-start' 
  | 'right-end'
  | 'auto'

/**
 * 触发方式
 */
export type TooltipTrigger = 'hover' | 'click' | 'focus' | 'manual'

/**
 * Tooltip 组件属性
 */
export interface TooltipProps {
  /** 提示内容 */
  content: React.ReactNode
  
  /** 子元素 */
  children: React.ReactElement
  
  /** 显示位置 */
  placement?: TooltipPlacement
  
  /** 触发方式 */
  trigger?: TooltipTrigger
  
  /** 是否显示箭头 */
  showArrow?: boolean
  
  /** 显示延迟（毫秒） */
  showDelay?: number
  
  /** 隐藏延迟（毫秒） */
  hideDelay?: number
  
  /** 手动控制显示 */
  open?: boolean
  
  /** 是否禁用 */
  disabled?: boolean
  
  /** 自定义类名 */
  className?: string
  
  /** 自定义内容类名 */
  contentClassName?: string
  
  /** 偏移量 [x, y] */
  offset?: [number, number]
  
  /** z-index */
  zIndex?: number
  
  /** 打开回调 */
  onOpenChange?: (open: boolean) => void
}

/**
 * Tooltip 组件
 */
export const Tooltip: React.FC<TooltipProps> = ({
  content,
  children,
  placement = 'top',
  trigger = 'hover',
  showArrow = true,
  showDelay = 200,
  hideDelay = 0,
  open: controlledOpen,
  disabled = false,
  className = '',
  contentClassName = '',
  offset = [0, 8],
  zIndex = 9999,
  onOpenChange,
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [position, setPosition] = useState({ top: 0, left: 0 })
  const [actualPlacement, setActualPlacement] = useState<TooltipPlacement>(placement)
  
  const triggerRef = useRef<HTMLElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const showTimeoutRef = useRef<NodeJS.Timeout>()
  const hideTimeoutRef = useRef<NodeJS.Timeout>()
  const updatePositionTimeoutRef = useRef<NodeJS.Timeout>()

  // 受控模式
  const visible = controlledOpen !== undefined ? controlledOpen : isOpen

  // 稳定化 offset 引用，避免无限循环
  const stableOffset = useMemo(() => offset, [offset[0], offset[1]])

  // 计算位置 - 使用防抖和优化的依赖
  const updatePosition = useCallback(() => {
    if (!triggerRef.current || !tooltipRef.current || !visible) return

    // 清除之前的防抖定时器
    if (updatePositionTimeoutRef.current) {
      clearTimeout(updatePositionTimeoutRef.current)
    }

    // 防抖执行位置更新
    updatePositionTimeoutRef.current = setTimeout(() => {
      if (!triggerRef.current || !tooltipRef.current) return

      const triggerRect = triggerRef.current.getBoundingClientRect()
      const tooltipRect = tooltipRef.current.getBoundingClientRect()
      const [offsetX, offsetY] = stableOffset

      let top = 0
      let left = 0
      let finalPlacement = placement

      // 自动选择位置
      if (placement === 'auto') {
        const spaceTop = triggerRect.top
        const spaceBottom = window.innerHeight - triggerRect.bottom
        const spaceLeft = triggerRect.left
        const spaceRight = window.innerWidth - triggerRect.right

        if (spaceTop >= tooltipRect.height + offsetY) {
          finalPlacement = 'top'
        } else if (spaceBottom >= tooltipRect.height + offsetY) {
          finalPlacement = 'bottom'
        } else if (spaceRight >= tooltipRect.width + offsetX) {
          finalPlacement = 'right'
        } else if (spaceLeft >= tooltipRect.width + offsetX) {
          finalPlacement = 'left'
        } else {
          finalPlacement = 'bottom'
        }
      }

      // 计算位置
      switch (finalPlacement) {
        case 'top':
        case 'top-start':
        case 'top-end':
          top = triggerRect.top - tooltipRect.height - offsetY
          left = finalPlacement === 'top-start'
            ? triggerRect.left
            : finalPlacement === 'top-end'
            ? triggerRect.right - tooltipRect.width
            : triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2
          break

        case 'bottom':
        case 'bottom-start':
        case 'bottom-end':
          top = triggerRect.bottom + offsetY
          left = finalPlacement === 'bottom-start'
            ? triggerRect.left
            : finalPlacement === 'bottom-end'
            ? triggerRect.right - tooltipRect.width
            : triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2
          break

        case 'left':
        case 'left-start':
        case 'left-end':
          top = finalPlacement === 'left-start'
            ? triggerRect.top
            : finalPlacement === 'left-end'
            ? triggerRect.bottom - tooltipRect.height
            : triggerRect.top + triggerRect.height / 2 - tooltipRect.height / 2
          left = triggerRect.left - tooltipRect.width - offsetX
          break

        case 'right':
        case 'right-start':
        case 'right-end':
          top = finalPlacement === 'right-start'
            ? triggerRect.top
            : finalPlacement === 'right-end'
            ? triggerRect.bottom - tooltipRect.height
            : triggerRect.top + triggerRect.height / 2 - tooltipRect.height / 2
          left = triggerRect.right + offsetX
          break
      }

      // 边界检测
      const margin = 8
      if (left < margin) left = margin
      if (left + tooltipRect.width > window.innerWidth - margin) {
        left = window.innerWidth - tooltipRect.width - margin
      }
      if (top < margin) top = margin
      if (top + tooltipRect.height > window.innerHeight - margin) {
        top = window.innerHeight - tooltipRect.height - margin
      }

      // 只在位置真正变化时才更新状态
      setPosition(prev => {
        if (Math.abs(prev.top - top) > 1 || Math.abs(prev.left - left) > 1) {
          return { top, left }
        }
        return prev
      })

      setActualPlacement(prev => prev !== finalPlacement ? finalPlacement : prev)
    }, 0)
  }, [placement, stableOffset, visible])

  // 显示 tooltip
  const show = useCallback(() => {
    if (disabled) return
    
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current)
    }

    showTimeoutRef.current = setTimeout(() => {
      setIsOpen(true)
      onOpenChange?.(true)
    }, showDelay)
  }, [disabled, showDelay, onOpenChange])

  // 隐藏 tooltip
  const hide = useCallback(() => {
    if (showTimeoutRef.current) {
      clearTimeout(showTimeoutRef.current)
    }

    hideTimeoutRef.current = setTimeout(() => {
      setIsOpen(false)
      onOpenChange?.(false)
    }, hideDelay)
  }, [hideDelay, onOpenChange])

  // 初始位置更新 - 使用 useLayoutEffect 确保同步更新
  useLayoutEffect(() => {
    if (visible) {
      updatePosition()
    }
  }, [visible, updatePosition])

  // 保存 updatePosition 的最新引用，避免闭包问题
  const updatePositionRef = useRef(updatePosition)
  updatePositionRef.current = updatePosition

  // 事件监听器管理 - 分离出来避免循环依赖
  useEffect(() => {
    if (!visible) return

    // 使用 ref 引用最新的 updatePosition 函数
    const handleScroll = () => updatePositionRef.current()
    const handleResize = () => updatePositionRef.current()

    // 添加事件监听器
    window.addEventListener('scroll', handleScroll, true)
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('scroll', handleScroll, true)
      window.removeEventListener('resize', handleResize)
    }
  }, [visible])

  // 清理所有定时器
  useEffect(() => {
    return () => {
      if (showTimeoutRef.current) clearTimeout(showTimeoutRef.current)
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current)
      if (updatePositionTimeoutRef.current) clearTimeout(updatePositionTimeoutRef.current)
    }
  }, [])

  // 事件处理 - 使用 useCallback 优化性能
  const handleMouseEnter = useCallback(() => {
    if (trigger === 'hover') show()
  }, [trigger, show])

  const handleMouseLeave = useCallback(() => {
    if (trigger === 'hover') hide()
  }, [trigger, hide])

  const handleClick = useCallback(() => {
    if (trigger === 'click') {
      if (visible) {
        hide()
      } else {
        show()
      }
    }
  }, [trigger, visible, show, hide])

  const handleFocus = useCallback(() => {
    if (trigger === 'focus') show()
  }, [trigger, show])

  const handleBlur = useCallback(() => {
    if (trigger === 'focus') hide()
  }, [trigger, hide])

  // 克隆子元素并添加事件 - 使用 useMemo 优化性能
  const triggerElement = useMemo(() => {
    return React.cloneElement(children, {
      ref: triggerRef,
      onMouseEnter: handleMouseEnter,
      onMouseLeave: handleMouseLeave,
      onClick: handleClick,
      onFocus: handleFocus,
      onBlur: handleBlur,
    })
  }, [children, handleMouseEnter, handleMouseLeave, handleClick, handleFocus, handleBlur])

  return (
    <>
      {triggerElement}
      {visible && content && !disabled && createPortal(
        <div
          ref={tooltipRef}
          className={`tooltip ${className}`}
          style={{
            position: 'fixed',
            top: `${position.top}px`,
            left: `${position.left}px`,
            zIndex,
          }}
          role="tooltip"
        >
          <div className={`tooltip-content tooltip-${actualPlacement} ${contentClassName}`}>
            {content}
            {showArrow && <div className="tooltip-arrow" />}
          </div>
        </div>,
        document.body
      )}
    </>
  )
}

/**
 * 简化版 Tooltip - 仅支持文本内容
 */
export const SimpleTooltip: React.FC<{
  text: string
  children: React.ReactElement
  placement?: TooltipPlacement
}> = ({ text, children, placement = 'top' }) => {
  return (
    <Tooltip content={text} placement={placement}>
      {children}
    </Tooltip>
  )
}

export default Tooltip

