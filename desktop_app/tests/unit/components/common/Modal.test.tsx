/**
 * Modal 组件测试
 * 
 * 测试模态框组件的各种功能
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// Mock Modal 组件
const Modal = ({ 
  isOpen, 
  onClose, 
  title, 
  children, 
  footer,
  size = 'medium',
  closeOnEsc = true,
  closeOnOverlayClick = true,
  showCloseButton = true,
  ...props 
}: any) => {
  if (!isOpen) return null

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (closeOnOverlayClick && e.target === e.currentTarget) {
      onClose()
    }
  }

  const handleEscKey = (e: KeyboardEvent) => {
    if (closeOnEsc && e.key === 'Escape') {
      onClose()
    }
  }

  React.useEffect(() => {
    if (closeOnEsc) {
      document.addEventListener('keydown', handleEscKey as any)
      return () => document.removeEventListener('keydown', handleEscKey as any)
    }
  }, [closeOnEsc, onClose])

  return (
    <div 
      data-testid="modal-overlay" 
      className="modal-overlay" 
      onClick={handleOverlayClick}
    >
      <div 
        data-testid="modal-content" 
        className={`modal-content modal-${size}`}
        {...props}
      >
        {(title || showCloseButton) && (
          <div className="modal-header">
            {title && <h2 data-testid="modal-title">{title}</h2>}
            {showCloseButton && (
              <button 
                onClick={onClose} 
                data-testid="modal-close-button"
                aria-label="关闭"
              >
                ×
              </button>
            )}
          </div>
        )}
        <div className="modal-body" data-testid="modal-body">
          {children}
        </div>
        {footer && (
          <div className="modal-footer" data-testid="modal-footer">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

describe('Modal 组件', () => {
  describe('渲染', () => {
    it('打开时应该显示模态框', () => {
      render(
        <Modal isOpen={true} onClose={vi.fn()} title="测试模态框">
          <p>模态框内容</p>
        </Modal>
      )
      
      expect(screen.getByTestId('modal-overlay')).toBeInTheDocument()
      expect(screen.getByTestId('modal-content')).toBeInTheDocument()
      expect(screen.getByText('测试模态框')).toBeInTheDocument()
      expect(screen.getByText('模态框内容')).toBeInTheDocument()
    })

    it('关闭时不应该显示模态框', () => {
      render(
        <Modal isOpen={false} onClose={vi.fn()} title="测试模态框">
          <p>模态框内容</p>
        </Modal>
      )
      
      expect(screen.queryByTestId('modal-overlay')).not.toBeInTheDocument()
    })

    it('应该渲染标题', () => {
      render(
        <Modal isOpen={true} onClose={vi.fn()} title="测试标题">
          内容
        </Modal>
      )
      
      expect(screen.getByTestId('modal-title')).toHaveTextContent('测试标题')
    })

    it('应该渲染内容', () => {
      render(
        <Modal isOpen={true} onClose={vi.fn()}>
          <div>测试内容</div>
        </Modal>
      )
      
      const body = screen.getByTestId('modal-body')
      expect(within(body).getByText('测试内容')).toBeInTheDocument()
    })

    it('应该渲染页脚', () => {
      render(
        <Modal 
          isOpen={true} 
          onClose={vi.fn()}
          footer={<button>确定</button>}
        >
          内容
        </Modal>
      )
      
      expect(screen.getByTestId('modal-footer')).toBeInTheDocument()
      expect(screen.getByText('确定')).toBeInTheDocument()
    })

    it('应该支持不同的尺寸', () => {
      const { rerender } = render(
        <Modal isOpen={true} onClose={vi.fn()} size="small">
          内容
        </Modal>
      )
      
      expect(screen.getByTestId('modal-content')).toHaveClass('modal-small')
      
      rerender(
        <Modal isOpen={true} onClose={vi.fn()} size="large">
          内容
        </Modal>
      )
      
      expect(screen.getByTestId('modal-content')).toHaveClass('modal-large')
    })
  })

  describe('交互', () => {
    it('点击关闭按钮应该调用 onClose', async () => {
      const handleClose = vi.fn()
      const user = userEvent.setup()
      
      render(
        <Modal isOpen={true} onClose={handleClose} title="测试">
          内容
        </Modal>
      )
      
      await user.click(screen.getByTestId('modal-close-button'))
      expect(handleClose).toHaveBeenCalledTimes(1)
    })

    it('点击遮罩层应该调用 onClose（如果启用）', async () => {
      const handleClose = vi.fn()
      const user = userEvent.setup()
      
      render(
        <Modal 
          isOpen={true} 
          onClose={handleClose}
          closeOnOverlayClick={true}
        >
          内容
        </Modal>
      )
      
      await user.click(screen.getByTestId('modal-overlay'))
      expect(handleClose).toHaveBeenCalled()
    })

    it('点击遮罩层不应该调用 onClose（如果禁用）', async () => {
      const handleClose = vi.fn()
      const user = userEvent.setup()
      
      render(
        <Modal 
          isOpen={true} 
          onClose={handleClose}
          closeOnOverlayClick={false}
        >
          内容
        </Modal>
      )
      
      await user.click(screen.getByTestId('modal-overlay'))
      expect(handleClose).not.toHaveBeenCalled()
    })

    it('点击内容区域不应该调用 onClose', async () => {
      const handleClose = vi.fn()
      const user = userEvent.setup()
      
      render(
        <Modal isOpen={true} onClose={handleClose}>
          内容
        </Modal>
      )
      
      await user.click(screen.getByTestId('modal-content'))
      expect(handleClose).not.toHaveBeenCalled()
    })

    it('不显示关闭按钮时不应该渲染关闭按钮', () => {
      render(
        <Modal 
          isOpen={true} 
          onClose={vi.fn()}
          showCloseButton={false}
        >
          内容
        </Modal>
      )
      
      expect(screen.queryByTestId('modal-close-button')).not.toBeInTheDocument()
    })
  })

  describe('样式', () => {
    it('应该应用正确的 CSS 类名', () => {
      render(
        <Modal isOpen={true} onClose={vi.fn()} size="large">
          内容
        </Modal>
      )
      
      expect(screen.getByTestId('modal-overlay')).toHaveClass('modal-overlay')
      expect(screen.getByTestId('modal-content')).toHaveClass('modal-content', 'modal-large')
    })
  })

  describe('可访问性', () => {
    it('关闭按钮应该有 aria-label', () => {
      render(
        <Modal isOpen={true} onClose={vi.fn()}>
          内容
        </Modal>
      )
      
      expect(screen.getByLabelText('关闭')).toBeInTheDocument()
    })

    it('应该支持 role 属性', () => {
      render(
        <Modal isOpen={true} onClose={vi.fn()} role="dialog">
          内容
        </Modal>
      )
      
      expect(screen.getByTestId('modal-content')).toHaveAttribute('role', 'dialog')
    })
  })
})

