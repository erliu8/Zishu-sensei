/**
 * Modal 模态框组件
 * 
 * 功能特性：
 * - 多种尺寸支持
 * - 多种动画效果
 * - 遮罩层可配置
 * - 键盘快捷键支持
 * - 滚动锁定
 * - 可访问性支持
 */

import React, { useEffect, useRef, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import type { ModalProps, ModalState } from './types'
import './styles.css'

/**
 * Modal 组件
 */
export const Modal: React.FC<ModalProps> = ({
  open,
  onClose,
  title,
  children,
  footer,
  size = 'md',
  animation = 'scale',
  showCloseButton = true,
  closeOnOverlayClick = true,
  closeOnEsc = true,
  showOverlay = true,
  overlayOpacity = 0.5,
  centered = true,
  className = '',
  overlayClassName = '',
  contentClassName = '',
  onOpen,
  onAfterClose,
  lockScroll = true,
  zIndex = 1000,
  fullScreen = false,
  header,
  showHeaderDivider = true,
  showFooterDivider = true,
  'aria-labelledby': ariaLabelledby,
  'aria-describedby': ariaDescribedby
}) => {
  const [state, setState] = useState<ModalState>({
    isVisible: false,
    isAnimating: false,
  })
  
  const contentRef = useRef<HTMLDivElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const previousActiveElement = useRef<HTMLElement | null>(null)

  // 处理打开/关闭
  useEffect(() => {
    if (open) {
      // 保存当前焦点元素
      previousActiveElement.current = document.activeElement as HTMLElement
      
      setState({ isVisible: true, isAnimating: true })
      
      // 动画开始后的回调
      setTimeout(() => {
        setState(prev => ({ ...prev, isAnimating: false }))
        onOpen?.()
        
        // 聚焦到模态框
        contentRef.current?.focus()
      }, 50)
      
      // 锁定滚动
      if (lockScroll) {
        document.body.style.overflow = 'hidden'
      }
    } else if (state.isVisible) {
      // 立即隐藏 DOM，不等待动画
      setState({ isVisible: false, isAnimating: false })
      onAfterClose?.()
      
      // 恢复焦点
      previousActiveElement.current?.focus()
      
      // 解锁滚动
      if (lockScroll) {
        document.body.style.overflow = ''
      }
    }
  }, [open, lockScroll, onOpen, onAfterClose])

  // ESC 键关闭
  useEffect(() => {
    if (!closeOnEsc || !state.isVisible) return

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [closeOnEsc, state.isVisible, onClose])

  // 遮罩层点击关闭
  const handleOverlayClick = useCallback((e: React.MouseEvent) => {
    if (closeOnOverlayClick && e.target === e.currentTarget) {
      onClose()
    }
  }, [closeOnOverlayClick, onClose])

  // 阻止内容区点击冒泡
  const handleContentClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
  }, [])

  // 如果不可见，不渲染
  if (!state.isVisible) return null

  // 尺寸类名映射
  const sizeClassName = fullScreen ? 'modal-content-full' : `modal-content-${size}`
  
  // 动画类名
  const animationClassName = `modal-animation-${animation}`
  
  // 状态类名
  const stateClassName = open && !state.isAnimating ? 'modal-open' : 'modal-closing'

  const modalContent = (
    <div
      className={`modal-overlay ${overlayClassName} ${stateClassName}`}
      ref={overlayRef}
      onClick={handleOverlayClick}
      style={{
        zIndex,
        backgroundColor: showOverlay ? `rgba(0, 0, 0, ${overlayOpacity})` : 'transparent',
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby={ariaLabelledby || (title ? 'modal-title' : undefined)}
      aria-describedby={ariaDescribedby}
    >
      <div
        className={`modal-container ${centered ? 'modal-centered' : ''}`}
      >
        <div
          ref={contentRef}
          className={`modal-content ${sizeClassName} ${animationClassName} ${className}`}
          onClick={handleContentClick}
          tabIndex={-1}
          role="document"
        >
          {/* 头部 */}
          {(title || header || showCloseButton) && (
            <div className={`modal-header ${showHeaderDivider ? 'modal-header-divider' : ''}`}>
              {header || (
                <>
                  {title && (
                    <h2 id="modal-title" className="modal-title">
                      {title}
                    </h2>
                  )}
                  {showCloseButton && (
                    <button
                      className="modal-close-button"
                      onClick={onClose}
                      aria-label="关闭"
                      title="Close"
                      type="button"
                    >
                      <X size={20} />
                    </button>
                  )}
                </>
              )}
            </div>
          )}

          {/* 内容区 */}
          <div className={`modal-body ${contentClassName}`}>
            {children}
          </div>

          {/* 底部 */}
          {footer && (
            <div className={`modal-footer ${showFooterDivider ? 'modal-footer-divider' : ''}`}>
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>
  )

  // 使用 Portal 渲染到 body
  return createPortal(modalContent, document.body)
}

/**
 * Modal 确认对话框
 */
export const ModalConfirm: React.FC<{
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title?: string
  message: string
  confirmText?: string
  cancelText?: string
  confirmVariant?: 'primary' | 'destructive'
}> = ({
  open,
  onClose,
  onConfirm,
  title = '确认',
  message,
  confirmText = '确定',
  cancelText = '取消',
  confirmVariant = 'primary',
}) => {
  const handleConfirm = () => {
    onConfirm()
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <div className="modal-confirm-footer">
          <button
            className="modal-button modal-button-secondary"
            onClick={onClose}
            type="button"
          >
            {cancelText}
          </button>
          <button
            className={`modal-button modal-button-${confirmVariant}`}
            onClick={handleConfirm}
            type="button"
          >
            {confirmText}
          </button>
        </div>
      }
    >
      <p className="modal-confirm-message">{message}</p>
    </Modal>
  )
}

export default Modal
export type { ModalProps, ModalSize, ModalAnimation } from './types'

