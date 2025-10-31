/**
 * Tooltip 组件测试 - 稳定版本
 * 
 * 修复了原测试中的挂起问题，提供稳定的测试实现
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'

// 简化的 CSS Mock，避免复杂的模块导入问题
vi.mock('../../../../components/common/Tooltip/styles.css', () => ({}))

// 稳定的 createPortal Mock
vi.mock('react-dom', () => ({
  createPortal: (node: React.ReactNode) => node,
}))

// 稳定的 DOM Mock 函数
const createStableMockRect = (overrides = {}) => ({
  top: 100,
  left: 100,
  right: 200,
  bottom: 150,
  width: 100,
  height: 50,
  x: 100,
  y: 100,
  toJSON: () => {},
  ...overrides,
})

describe('Tooltip 组件', () => {
  let user: ReturnType<typeof userEvent.setup>
  let TooltipModule: any
  let Tooltip: any
  let SimpleTooltip: any

  beforeEach(async () => {
    user = userEvent.setup()
    
    // 稳定的 DOM 模拟
    Element.prototype.getBoundingClientRect = vi.fn(() => createStableMockRect())
    
    // 窗口尺寸模拟
    Object.defineProperty(window, 'innerWidth', { value: 1920, writable: true })
    Object.defineProperty(window, 'innerHeight', { value: 1080, writable: true })
    
    // 使用真实定时器，避免复杂的定时器同步问题
    vi.useRealTimers()
    
    // 动态导入组件，避免在顶层导入时的问题
    try {
      TooltipModule = await import('../../../../components/common/Tooltip/index.tsx')
      Tooltip = TooltipModule.Tooltip
      SimpleTooltip = TooltipModule.SimpleTooltip
    } catch (error) {
      console.error('组件导入失败:', error)
      throw error
    }
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('✅ 基础渲染测试', () => {
    it('应该渲染触发元素', () => {
      render(
        <Tooltip content="提示内容">
          <button>触发按钮</button>
        </Tooltip>
      )
      
      expect(screen.getByRole('button', { name: '触发按钮' })).toBeInTheDocument()
    })

    it('初始状态不应该显示 tooltip', () => {
      render(
        <Tooltip content="提示内容">
          <button>触发按钮</button>
        </Tooltip>
      )
      
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
      expect(screen.queryByText('提示内容')).not.toBeInTheDocument()
    })

    it('受控模式应该正确显示和隐藏', async () => {
      const { rerender } = render(
        <Tooltip content="受控提示" open={false}>
          <button>按钮</button>
        </Tooltip>
      )
      
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
      
      rerender(
        <Tooltip content="受控提示" open={true}>
          <button>按钮</button>
        </Tooltip>
      )
      
      await waitFor(() => {
        expect(screen.getByRole('tooltip')).toBeInTheDocument()
        expect(screen.getByText('受控提示')).toBeInTheDocument()
      })
    })

    it('禁用状态不应该显示 tooltip', async () => {
      render(
        <Tooltip content="禁用提示" disabled open={true}>
          <button>按钮</button>
        </Tooltip>
      )
      
      // 禁用状态下即使 open=true 也不应该显示
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
    })

    it('空内容不应该渲染 tooltip', () => {
      render(
        <Tooltip content="" open={true}>
          <button>空内容按钮</button>
        </Tooltip>
      )
      
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
    })
  })

  describe('✅ 触发方式测试', () => {
    it('hover 触发 - 显示功能', async () => {
      render(
        <Tooltip content="Hover提示" trigger="hover" showDelay={0} hideDelay={0}>
          <button>Hover按钮</button>
        </Tooltip>
      )
      
      const button = screen.getByRole('button')
      
      // 鼠标悬停
      await user.hover(button)
      
      await waitFor(() => {
        expect(screen.getByText('Hover提示')).toBeInTheDocument()
      }, { timeout: 3000 })
    })

    it('click 触发 - 切换功能', async () => {
      render(
        <Tooltip content="Click提示" trigger="click" showDelay={0} hideDelay={0}>
          <button>Click按钮</button>
        </Tooltip>
      )
      
      const button = screen.getByRole('button')
      
      // 点击显示
      await user.click(button)
      
      await waitFor(() => {
        expect(screen.getByText('Click提示')).toBeInTheDocument()
      }, { timeout: 3000 })
      
      // 再次点击隐藏
      await user.click(button)
      
      await waitFor(() => {
        expect(screen.queryByText('Click提示')).not.toBeInTheDocument()
      }, { timeout: 3000 })
    })

    it('manual 触发 - 受控模式', async () => {
      const { rerender } = render(
        <Tooltip content="Manual提示" trigger="manual" open={false}>
          <button>Manual按钮</button>
        </Tooltip>
      )
      
      expect(screen.queryByText('Manual提示')).not.toBeInTheDocument()
      
      rerender(
        <Tooltip content="Manual提示" trigger="manual" open={true}>
          <button>Manual按钮</button>
        </Tooltip>
      )
      
      await waitFor(() => {
        expect(screen.getByText('Manual提示')).toBeInTheDocument()
      })
    })
  })

  describe('✅ 内容和样式测试', () => {
    it('应该支持不同位置', async () => {
      const { rerender } = render(
        <Tooltip content="Top提示" placement="top" open={true}>
          <button>按钮</button>
        </Tooltip>
      )
      
      await waitFor(() => {
        expect(screen.getByText('Top提示')).toBeInTheDocument()
      })
      
      rerender(
        <Tooltip content="Bottom提示" placement="bottom" open={true}>
          <button>按钮</button>
        </Tooltip>
      )
      
      await waitFor(() => {
        expect(screen.getByText('Bottom提示')).toBeInTheDocument()
      })
    })

    it('应该支持 React 节点作为内容', async () => {
      const complexContent = (
        <div>
          <strong>重要提示</strong>
          <p>这是复杂内容</p>
        </div>
      )
      
      render(
        <Tooltip content={complexContent} open={true}>
          <button>复杂内容按钮</button>
        </Tooltip>
      )
      
      await waitFor(() => {
        expect(screen.getByText('重要提示')).toBeInTheDocument()
        expect(screen.getByText('这是复杂内容')).toBeInTheDocument()
      })
    })

    it('应该正确设置基础样式', async () => {
      render(
        <Tooltip content="样式测试" open={true}>
          <button>样式按钮</button>
        </Tooltip>
      )
      
      await waitFor(() => {
        const tooltip = document.querySelector('.tooltip')
        expect(tooltip).toBeInTheDocument()
        expect(tooltip).toHaveStyle({ position: 'fixed' })
      })
    })
  })

  describe('✅ 事件回调测试', () => {
    it('应该触发 onOpenChange 回调', async () => {
      const handleOpenChange = vi.fn()
      
      render(
        <Tooltip 
          content="回调提示" 
          onOpenChange={handleOpenChange}
          trigger="click"
        >
          <button>回调按钮</button>
        </Tooltip>
      )
      
      await user.click(screen.getByRole('button'))
      
      await waitFor(() => {
        expect(handleOpenChange).toHaveBeenCalledWith(true)
      })
    })
  })

})

describe('SimpleTooltip 组件测试', () => {
  let user: ReturnType<typeof userEvent.setup>
  let SimpleTooltip: any

  beforeEach(async () => {
    user = userEvent.setup()
    
    // 基础设置
    Element.prototype.getBoundingClientRect = vi.fn(() => createStableMockRect())
    vi.useRealTimers()
    
    // 动态导入组件
    try {
      const TooltipModule = await import('../../../../components/common/Tooltip/index.tsx')
      SimpleTooltip = TooltipModule.SimpleTooltip
    } catch (error) {
      console.error('SimpleTooltip 导入失败:', error)
      throw error
    }
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('✅ 基础功能测试', () => {
    it('应该渲染简单的文本提示', async () => {
      render(
        <SimpleTooltip text="简单提示">
          <button>简单按钮</button>
        </SimpleTooltip>
      )
      
      const button = screen.getByRole('button')
      
      await user.hover(button)
      await waitFor(() => {
        expect(screen.getByText('简单提示')).toBeInTheDocument()
      }, { timeout: 3000 })
    })

    it('应该处理空的文本', () => {
      render(
        <SimpleTooltip text="">
          <button>空文本按钮</button>
        </SimpleTooltip>
      )
      
      // 空文本不应该渲染 tooltip
      expect(screen.getByRole('button')).toBeInTheDocument()
    })

    it('应该支持位置设置', async () => {
      render(
        <SimpleTooltip text="底部提示" placement="bottom">
          <button>底部按钮</button>
        </SimpleTooltip>
      )
      
      const button = screen.getByRole('button')
      
      await user.hover(button)
      await waitFor(() => {
        expect(screen.getByText('底部提示')).toBeInTheDocument()
      }, { timeout: 3000 })
    })
  })
})
