/**
 * Modal 组件类型定义
 */

import { ReactNode } from 'react'

/**
 * 模态框尺寸
 */
export type ModalSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'full'

/**
 * 模态框动画类型
 */
export type ModalAnimation = 'fade' | 'scale' | 'slide-up' | 'slide-down' | 'slide-left' | 'slide-right'

/**
 * Modal 组件属性
 */
export interface ModalProps {
  /** 是否显示模态框 */
  open: boolean
  
  /** 关闭回调 */
  onClose: () => void
  
  /** 模态框标题 */
  title?: ReactNode
  
  /** 模态框内容 */
  children: ReactNode
  
  /** 底部操作区 */
  footer?: ReactNode
  
  /** 模态框尺寸 */
  size?: ModalSize
  
  /** 动画类型 */
  animation?: ModalAnimation
  
  /** 是否显示关闭按钮 */
  showCloseButton?: boolean
  
  /** 是否点击遮罩层关闭 */
  closeOnOverlayClick?: boolean
  
  /** 是否按 ESC 键关闭 */
  closeOnEsc?: boolean
  
  /** 是否显示遮罩层 */
  showOverlay?: boolean
  
  /** 遮罩层透明度 (0-1) */
  overlayOpacity?: number
  
  /** 是否居中显示 */
  centered?: boolean
  
  /** 自定义类名 */
  className?: string
  
  /** 自定义遮罩层类名 */
  overlayClassName?: string
  
  /** 自定义内容区类名 */
  contentClassName?: string
  
  /** 打开时的回调 */
  onOpen?: () => void
  
  /** 关闭动画结束后的回调 */
  onAfterClose?: () => void
  
  /** 是否禁用滚动穿透 */
  lockScroll?: boolean
  
  /** z-index 值 */
  zIndex?: number
  
  /** 是否全屏 */
  fullScreen?: boolean
  
  /** 自定义头部 */
  header?: ReactNode
  
  /** 是否显示头部分割线 */
  showHeaderDivider?: boolean
  
  /** 是否显示底部分割线 */
  showFooterDivider?: boolean
  
  /** 自定义 aria-labelledby */
  'aria-labelledby'?: string
  
  /** 自定义 aria-describedby */
  'aria-describedby'?: string
}

/**
 * Modal 内部状态
 */
export interface ModalState {
  /** 是否正在显示 */
  isVisible: boolean
  
  /** 是否正在动画中 */
  isAnimating: boolean
}

