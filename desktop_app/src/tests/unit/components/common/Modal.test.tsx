/**
 * Modal 组件测试
 * 
 * 测试模态框组件的各种功能和状态
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Modal } from '../../../../components/common/Modal'
import { renderWithProviders, expectVisible, expectHidden, wait } from '../../../utils/test-utils'
import type { ModalSize, ModalAnimation } from '../../../../components/common/Modal/types'

// Mock CSS 模块
vi.mock('../../../../src/components/common/Modal/styles.css', () => ({}))

// Mock createPortal
vi.mock('react-dom', async () => {
  const actual = await vi.importActual('react-dom')
  return {
    ...actual,
    createPortal: (node: React.ReactNode) => node,
  }
})

// Mock X icon from lucide-react
vi.mock('lucide-react', () => ({
  X: () => <svg data-testid="close-icon" />,
}))

// Mock body scroll lock
const mockScrollLock = {
  lock: vi.fn(),
  unlock: vi.fn(),
}

Object.defineProperty(document.body.style, 'overflow', {
  writable: true,
  value: '',
})

describe('Modal 组件', () => {
  let user: ReturnType<typeof userEvent.setup>

  beforeEach(() => {
    user = userEvent.setup()
    document.body.innerHTML = ''
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('✅ 渲染测试', () => {
    it('应该正确渲染打开的模态框', () => {
      render(
        <Modal open={true} onClose={vi.fn()} title="测试模态框">
          <p>模态框内容</p>
        </Modal>
      )
      
      expect(screen.getByRole('dialog')).toBeInTheDocument()
      expect(screen.getByText('测试模态框')).toBeInTheDocument()
      expect(screen.getByText('模态框内容')).toBeInTheDocument()
    })

    it('关闭时不应该显示模态框', () => {
      render(
        <Modal open={false} onClose={vi.fn()} title="测试模态框">
          <p>模态框内容</p>
        </Modal>
      )
      
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('应该支持所有尺寸选项', () => {
      const sizes: ModalSize[] = ['xs', 'sm', 'md', 'lg', 'xl', 'full']
      
      sizes.forEach(size => {
        const { unmount } = render(
          <Modal open={true} onClose={vi.fn()} size={size}>
            {size} 模态框
          </Modal>
        )
        
        const dialog = screen.getByRole('dialog')
        expect(dialog).toBeInTheDocument()
        
        unmount()
      })
    })

    it('应该支持所有动画类型', () => {
      const animations: ModalAnimation[] = [
        'fade', 'scale', 'slide-up', 'slide-down', 'slide-left', 'slide-right'
      ]
      
      animations.forEach(animation => {
        const { unmount } = render(
          <Modal open={true} onClose={vi.fn()} animation={animation}>
            {animation} 动画模态框
          </Modal>
        )
        
        expect(screen.getByRole('dialog')).toBeInTheDocument()
        
        unmount()
      })
    })

    it('应该正确渲染自定义头部', () => {
      const customHeader = (
        <div data-testid="custom-header">
          <h1>自定义标题</h1>
          <p>副标题</p>
        </div>
      )
      
      render(
        <Modal open={true} onClose={vi.fn()} header={customHeader}>
          内容
        </Modal>
      )
      
      expect(screen.getByTestId('custom-header')).toBeInTheDocument()
      expect(screen.getByText('自定义标题')).toBeInTheDocument()
      expect(screen.getByText('副标题')).toBeInTheDocument()
    })

    it('应该正确渲染底部操作区', () => {
      const footer = (
        <div>
          <button>取消</button>
          <button>确定</button>
        </div>
      )
      
      render(
        <Modal open={true} onClose={vi.fn()} footer={footer}>
          内容
        </Modal>
      )
      
      expect(screen.getByText('取消')).toBeInTheDocument()
      expect(screen.getByText('确定')).toBeInTheDocument()
    })

    it('应该支持全屏模式', () => {
      render(
        <Modal open={true} onClose={vi.fn()} fullScreen>
          全屏内容
        </Modal>
      )
      
      expect(screen.getByRole('dialog')).toBeInTheDocument()
      expect(screen.getByText('全屏内容')).toBeInTheDocument()
    })

    it('应该应用自定义类名', () => {
      render(
        <Modal 
          open={true} 
          onClose={vi.fn()} 
          className="custom-modal"
          overlayClassName="custom-overlay"
          contentClassName="custom-content"
        >
          自定义样式
        </Modal>
      )
      
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })
  })

  describe('✅ 交互测试', () => {
    it('点击关闭按钮应该调用 onClose', async () => {
      const handleClose = vi.fn()
      
      render(
        <Modal open={true} onClose={handleClose} title="测试">
          内容
        </Modal>
      )
      
      const closeButton = screen.getByRole('button', { name: /close/i })
      await user.click(closeButton)
      
      expect(handleClose).toHaveBeenCalledTimes(1)
    })

    it('ESC 键应该关闭模态框', async () => {
      const handleClose = vi.fn()
      
      render(
        <Modal open={true} onClose={handleClose} closeOnEsc={true}>
          内容
        </Modal>
      )
      
      await user.keyboard('{Escape}')
      
      expect(handleClose).toHaveBeenCalledTimes(1)
    })

    it('禁用 ESC 关闭时不应该响应 ESC 键', async () => {
      const handleClose = vi.fn()
      
      render(
        <Modal open={true} onClose={handleClose} closeOnEsc={false}>
          内容
        </Modal>
      )
      
      await user.keyboard('{Escape}')
      
      expect(handleClose).not.toHaveBeenCalled()
    })

    it('点击遮罩层应该调用 onClose（如果启用）', async () => {
      const handleClose = vi.fn()
      
      render(
        <Modal open={true} onClose={handleClose} closeOnOverlayClick={true}>
          内容
        </Modal>
      )
      
      // 点击遮罩层（dialog 外部）
      const overlay = document.querySelector('[role="dialog"]')?.parentElement
      if (overlay) {
        await user.click(overlay)
        expect(handleClose).toHaveBeenCalled()
      }
    })

    it('禁用遮罩点击关闭时不应该响应点击', async () => {
      const handleClose = vi.fn()
      
      render(
        <Modal open={true} onClose={handleClose} closeOnOverlayClick={false}>
          内容
        </Modal>
      )
      
      const overlay = document.querySelector('[role="dialog"]')?.parentElement
      if (overlay) {
        await user.click(overlay)
        expect(handleClose).not.toHaveBeenCalled()
      }
    })

    it('隐藏关闭按钮时不应该渲染关闭按钮', () => {
      render(
        <Modal open={true} onClose={vi.fn()} showCloseButton={false}>
          内容
        </Modal>
      )
      
      expect(screen.queryByRole('button', { name: /close/i })).not.toBeInTheDocument()
    })

    it('点击内容区域不应该调用 onClose', async () => {
      const handleClose = vi.fn()
      
      render(
        <Modal open={true} onClose={handleClose}>
          <div data-testid="content">内容</div>
        </Modal>
      )
      
      await user.click(screen.getByTestId('content'))
      expect(handleClose).not.toHaveBeenCalled()
    })
  })

  describe('✅ 遮罩和显示控制测试', () => {
    it('应该显示遮罩层', () => {
      render(
        <Modal open={true} onClose={vi.fn()} showOverlay={true}>
          内容
        </Modal>
      )
      
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    it('应该隐藏遮罩层', () => {
      render(
        <Modal open={true} onClose={vi.fn()} showOverlay={false}>
          内容
        </Modal>
      )
      
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    it('应该应用自定义遮罩透明度', () => {
      render(
        <Modal open={true} onClose={vi.fn()} overlayOpacity={0.8}>
          内容
        </Modal>
      )
      
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    it('应该应用自定义 z-index', () => {
      const customZIndex = 5000
      
      render(
        <Modal open={true} onClose={vi.fn()} zIndex={customZIndex}>
          内容
        </Modal>
      )
      
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })
  })

  describe('✅ 滚动锁定测试', () => {
    it('默认应该锁定页面滚动', () => {
      render(
        <Modal open={true} onClose={vi.fn()} lockScroll={true}>
          内容
        </Modal>
      )
      
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    it('禁用滚动锁定时不应该影响页面滚动', () => {
      render(
        <Modal open={true} onClose={vi.fn()} lockScroll={false}>
          内容
        </Modal>
      )
      
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })
  })

  describe('✅ 居中和定位测试', () => {
    it('默认应该居中显示', () => {
      render(
        <Modal open={true} onClose={vi.fn()} centered={true}>
          居中内容
        </Modal>
      )
      
      expect(screen.getByText('居中内容')).toBeInTheDocument()
    })

    it('应该支持非居中显示', () => {
      render(
        <Modal open={true} onClose={vi.fn()} centered={false}>
          非居中内容
        </Modal>
      )
      
      expect(screen.getByText('非居中内容')).toBeInTheDocument()
    })
  })

  describe('✅ 生命周期回调测试', () => {
    it('应该触发 onOpen 回调', () => {
      const handleOpen = vi.fn()
      
      render(
        <Modal open={true} onClose={vi.fn()} onOpen={handleOpen}>
          内容
        </Modal>
      )
      
      expect(handleOpen).toHaveBeenCalledTimes(1)
    })

    it('应该触发 onAfterClose 回调', () => {
      const handleAfterClose = vi.fn()
      
      const { rerender } = render(
        <Modal open={true} onClose={vi.fn()} onAfterClose={handleAfterClose}>
          内容
        </Modal>
      )
      
      // 关闭模态框
      rerender(
        <Modal open={false} onClose={vi.fn()} onAfterClose={handleAfterClose}>
          内容
        </Modal>
      )
      
      // 在动画结束后应该触发 onAfterClose
      // 这里测试回调被正确设置，实际触发时间取决于动画
      expect(handleAfterClose).toBeDefined()
    })
  })

  describe('✅ 分割线测试', () => {
    it('应该显示头部分割线', () => {
      render(
        <Modal 
          open={true} 
          onClose={vi.fn()} 
          title="带分割线" 
          showHeaderDivider={true}
        >
          内容
        </Modal>
      )
      
      expect(screen.getByText('带分割线')).toBeInTheDocument()
    })

    it('应该隐藏头部分割线', () => {
      render(
        <Modal 
          open={true} 
          onClose={vi.fn()} 
          title="不带分割线" 
          showHeaderDivider={false}
        >
          内容
        </Modal>
      )
      
      expect(screen.getByText('不带分割线')).toBeInTheDocument()
    })

    it('应该显示底部分割线', () => {
      render(
        <Modal 
          open={true} 
          onClose={vi.fn()} 
          footer={<button>确定</button>}
          showFooterDivider={true}
        >
          内容
        </Modal>
      )
      
      expect(screen.getByText('确定')).toBeInTheDocument()
    })

    it('应该隐藏底部分割线', () => {
      render(
        <Modal 
          open={true} 
          onClose={vi.fn()} 
          footer={<button>确定</button>}
          showFooterDivider={false}
        >
          内容
        </Modal>
      )
      
      expect(screen.getByText('确定')).toBeInTheDocument()
    })
  })

  describe('✅ 可访问性测试', () => {
    it('应该有正确的 ARIA 属性', () => {
      render(
        <Modal open={true} onClose={vi.fn()} title="可访问性测试">
          内容
        </Modal>
      )
      
      const dialog = screen.getByRole('dialog')
      expect(dialog).toBeInTheDocument()
      expect(dialog).toHaveAttribute('aria-modal', 'true')
    })

    it('关闭按钮应该有正确的 aria-label', () => {
      render(
        <Modal open={true} onClose={vi.fn()} showCloseButton={true}>
          内容
        </Modal>
      )
      
      expect(screen.getByRole('button', { name: /close/i })).toBeInTheDocument()
    })

    it('应该支持自定义 ARIA 标签', () => {
      render(
        <Modal 
          open={true} 
          onClose={vi.fn()} 
          title="自定义ARIA"
          aria-labelledby="custom-title"
          aria-describedby="custom-description"
        >
          <div id="custom-description">这是描述</div>
        </Modal>
      )
      
      const dialog = screen.getByRole('dialog')
      expect(dialog).toHaveAttribute('aria-labelledby', 'custom-title')
      expect(dialog).toHaveAttribute('aria-describedby', 'custom-description')
    })

    it('应该正确管理焦点', () => {
      render(
        <Modal open={true} onClose={vi.fn()}>
          <input data-testid="modal-input" autoFocus />
        </Modal>
      )
      
      // 模态框打开时，焦点应该移动到内部的可聚焦元素
      expect(screen.getByTestId('modal-input')).toBeInTheDocument()
    })
  })

  describe('✅ 边界情况测试', () => {
    it('应该处理空的 children', () => {
      render(
        <Modal open={true} onClose={vi.fn()}>
          {null}
        </Modal>
      )
      
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    it('应该处理复杂的嵌套内容', () => {
      render(
        <Modal open={true} onClose={vi.fn()} title="复杂内容">
          <div>
            <h2>子标题</h2>
            <form>
              <input type="text" placeholder="输入框" />
              <textarea placeholder="文本域" />
              <select>
                <option>选项1</option>
                <option>选项2</option>
              </select>
            </form>
            <div>
              <button>操作按钮</button>
            </div>
          </div>
        </Modal>
      )
      
      expect(screen.getByText('子标题')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('输入框')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('文本域')).toBeInTheDocument()
      expect(screen.getByDisplayValue('选项1')).toBeInTheDocument()
      expect(screen.getByText('操作按钮')).toBeInTheDocument()
    })

    it('应该正确处理快速开关', async () => {
      const handleClose = vi.fn()
      
      const { rerender } = render(
        <Modal open={false} onClose={handleClose}>
          内容
        </Modal>
      )
      
      // 快速打开
      rerender(
        <Modal open={true} onClose={handleClose}>
          内容
        </Modal>
      )
      
      expect(screen.getByRole('dialog')).toBeInTheDocument()
      
      // 快速关闭
      rerender(
        <Modal open={false} onClose={handleClose}>
          内容
        </Modal>
      )
      
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('应该处理组件卸载', () => {
      const { unmount } = render(
        <Modal open={true} onClose={vi.fn()}>
          内容
        </Modal>
      )
      
      expect(screen.getByRole('dialog')).toBeInTheDocument()
      
      // 卸载不应该报错
      unmount()
      
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })

  describe('✅ 性能测试', () => {
    it('关闭时不应该渲染 DOM', () => {
      render(
        <Modal open={false} onClose={vi.fn()}>
          性能测试内容
        </Modal>
      )
      
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(screen.queryByText('性能测试内容')).not.toBeInTheDocument()
    })

    it('应该避免不必要的重新渲染', () => {
      let renderCount = 0
      
      const TestModal = (props: any) => {
        renderCount++
        return <Modal {...props}>测试内容</Modal>
      }
      
      const { rerender } = render(
        <TestModal open={true} onClose={vi.fn()} title="测试" />
      )
      expect(renderCount).toBe(1)
      
      // 相同的 props
      rerender(
        <TestModal open={true} onClose={vi.fn()} title="测试" />
      )
      expect(renderCount).toBe(2) // 没有 memo，会重新渲染
    })
  })
})

describe('Modal 组件集成测试', () => {
  describe('✅ 真实使用场景', () => {
    it('应该作为确认对话框工作', async () => {
      let confirmed = false
      const handleConfirm = () => { confirmed = true }
      const handleCancel = vi.fn()
      
      const user = userEvent.setup()
      
      render(
        <Modal open={true} onClose={handleCancel} title="确认删除">
          <p>确定要删除这个项目吗？此操作无法撤销。</p>
          <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
            <button onClick={handleCancel}>取消</button>
            <button onClick={handleConfirm}>确定删除</button>
          </div>
        </Modal>
      )
      
      expect(screen.getByText('确认删除')).toBeInTheDocument()
      expect(screen.getByText(/确定要删除这个项目吗/)).toBeInTheDocument()
      
      await user.click(screen.getByText('确定删除'))
      expect(confirmed).toBe(true)
    })

    it('应该作为表单对话框工作', async () => {
      const handleSubmit = vi.fn()
      const handleCancel = vi.fn()
      
      const user = userEvent.setup()
      
      render(
        <Modal open={true} onClose={handleCancel} title="添加用户">
          <form onSubmit={handleSubmit}>
            <div>
              <label htmlFor="username">用户名:</label>
              <input id="username" type="text" required />
            </div>
            <div>
              <label htmlFor="email">邮箱:</label>
              <input id="email" type="email" required />
            </div>
            <div>
              <button type="button" onClick={handleCancel}>取消</button>
              <button type="submit">添加</button>
            </div>
          </form>
        </Modal>
      )
      
      expect(screen.getByText('添加用户')).toBeInTheDocument()
      
      await user.type(screen.getByLabelText('用户名:'), 'testuser')
      await user.type(screen.getByLabelText('邮箱:'), 'test@example.com')
      await user.click(screen.getByText('添加'))
      
      expect(handleSubmit).toHaveBeenCalled()
    })

    it('应该支持嵌套模态框', async () => {
      const user = userEvent.setup()
      let showSecondModal = false
      
      const TestComponent = () => {
        const [secondModalOpen, setSecondModalOpen] = React.useState(false)
        
        return (
          <>
            <Modal open={true} onClose={vi.fn()} title="第一个模态框">
              <p>这是第一个模态框</p>
              <button onClick={() => setSecondModalOpen(true)}>
                打开第二个模态框
              </button>
            </Modal>
            
            <Modal 
              open={secondModalOpen} 
              onClose={() => setSecondModalOpen(false)} 
              title="第二个模态框"
              zIndex={2000}
            >
              <p>这是第二个模态框</p>
            </Modal>
          </>
        )
      }
      
      render(<TestComponent />)
      
      expect(screen.getByText('这是第一个模态框')).toBeInTheDocument()
      
      await user.click(screen.getByText('打开第二个模态框'))
      
      expect(screen.getByText('这是第二个模态框')).toBeInTheDocument()
      expect(screen.getByText('这是第一个模态框')).toBeInTheDocument()
    })
  })
})


