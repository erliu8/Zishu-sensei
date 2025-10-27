/**
 * Tooltip 组件测试
 * 
 * 测试提示框的多方向显示、触发方式、定位计算等功能
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Tooltip, SimpleTooltip } from '../../../../components/common/Tooltip'
import { renderWithProviders, expectVisible, expectHidden, wait } from '../../../utils/test-utils'
import type { TooltipPlacement, TooltipTrigger } from '../../../../components/common/Tooltip'

// Mock CSS 模块
vi.mock('../../../../src/components/common/Tooltip/styles.css', () => ({}))

// Mock createPortal
vi.mock('react-dom', async () => {
  const actual = await vi.importActual('react-dom')
  return {
    ...actual,
    createPortal: (node: React.ReactNode) => node,
  }
})

// Mock getBoundingClientRect
const mockGetBoundingClientRect = (rect: Partial<DOMRect>) => ({
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  width: 0,
  height: 0,
  x: 0,
  y: 0,
  toJSON: () => {},
  ...rect,
})

describe('Tooltip 组件', () => {
  let user: ReturnType<typeof userEvent.setup>

  beforeEach(() => {
    user = userEvent.setup()
    
    // Mock getBoundingClientRect for positioning tests
    Element.prototype.getBoundingClientRect = vi.fn(() => 
      mockGetBoundingClientRect({
        top: 100,
        left: 100,
        right: 200,
        bottom: 150,
        width: 100,
        height: 50,
      })
    )

    // Mock window dimensions
    Object.defineProperty(window, 'innerWidth', { value: 1920, writable: true })
    Object.defineProperty(window, 'innerHeight', { value: 1080, writable: true })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('✅ 渲染测试', () => {
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

    it('应该支持受控模式', () => {
      const { rerender } = render(
        <Tooltip content="提示内容" open={false}>
          <button>触发按钮</button>
        </Tooltip>
      )
      
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
      
      rerender(
        <Tooltip content="提示内容" open={true}>
          <button>触发按钮</button>
        </Tooltip>
      )
      
      expect(screen.getByRole('tooltip')).toBeInTheDocument()
      expect(screen.getByText('提示内容')).toBeInTheDocument()
    })

    it('禁用状态不应该显示 tooltip', async () => {
      render(
        <Tooltip content="提示内容" disabled>
          <button>触发按钮</button>
        </Tooltip>
      )
      
      await user.hover(screen.getByRole('button'))
      await wait(300)
      
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
    })
  })

  describe('✅ 触发方式测试', () => {
    it('hover 触发应该正常工作', async () => {
      render(
        <Tooltip content="Hover提示" trigger="hover" showDelay={0} hideDelay={0}>
          <button>Hover按钮</button>
        </Tooltip>
      )
      
      const button = screen.getByRole('button')
      
      // 鼠标进入
      await user.hover(button)
      await waitFor(() => {
        expect(screen.getByText('Hover提示')).toBeInTheDocument()
      })
      
      // 鼠标离开
      await user.unhover(button)
      await waitFor(() => {
        expect(screen.queryByText('Hover提示')).not.toBeInTheDocument()
      })
    })

    it('click 触发应该正常工作', async () => {
      render(
        <Tooltip content="Click提示" trigger="click" showDelay={0} hideDelay={0}>
          <button>Click按钮</button>
        </Tooltip>
      )
      
      const button = screen.getByRole('button')
      
      // 第一次点击 - 显示
      await user.click(button)
      await waitFor(() => {
        expect(screen.getByText('Click提示')).toBeInTheDocument()
      })
      
      // 第二次点击 - 隐藏
      await user.click(button)
      await waitFor(() => {
        expect(screen.queryByText('Click提示')).not.toBeInTheDocument()
      })
    })

    it('focus 触发应该正常工作', async () => {
      render(
        <Tooltip content="Focus提示" trigger="focus" showDelay={0} hideDelay={0}>
          <button>Focus按钮</button>
        </Tooltip>
      )
      
      const button = screen.getByRole('button')
      
      // 聚焦
      await user.click(button) // 这会同时触发focus
      await waitFor(() => {
        expect(screen.getByText('Focus提示')).toBeInTheDocument()
      })
      
      // 失焦
      await user.tab() // 移动焦点
      await waitFor(() => {
        expect(screen.queryByText('Focus提示')).not.toBeInTheDocument()
      })
    })

    it('manual 触发应该通过 open 属性控制', () => {
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
      
      expect(screen.getByText('Manual提示')).toBeInTheDocument()
    })
  })

  describe('✅ 位置和对齐测试', () => {
    it('应该支持所有位置选项', () => {
      const placements: TooltipPlacement[] = [
        'top', 'top-start', 'top-end',
        'bottom', 'bottom-start', 'bottom-end',
        'left', 'left-start', 'left-end',
        'right', 'right-start', 'right-end',
        'auto'
      ]
      
      placements.forEach(placement => {
        const { unmount } = render(
          <Tooltip content={`${placement}提示`} placement={placement} open={true}>
            <button>{placement}按钮</button>
          </Tooltip>
        )
        
        expect(screen.getByText(`${placement}提示`)).toBeInTheDocument()
        expect(document.querySelector(`.tooltip-content`)).toBeInTheDocument()
        
        unmount()
      })
    })

    it('应该正确设置 tooltip 位置样式', () => {
      render(
        <Tooltip content="Top提示" placement="top" open={true}>
          <button>按钮</button>
        </Tooltip>
      )
      
      const tooltip = document.querySelector('.tooltip') as HTMLElement
      expect(tooltip).toHaveStyle({ 
        position: 'fixed',
        zIndex: '9999' 
      })
    })

    it('应该应用自定义 z-index', () => {
      const customZIndex = 5000
      render(
        <Tooltip content="提示" zIndex={customZIndex} open={true}>
          <button>按钮</button>
        </Tooltip>
      )
      
      const tooltip = document.querySelector('.tooltip') as HTMLElement
      expect(tooltip).toHaveStyle({ zIndex: customZIndex.toString() })
    })

    it('应该应用偏移量', () => {
      render(
        <Tooltip content="提示" offset={[10, 20]} open={true}>
          <button>按钮</button>
        </Tooltip>
      )
      
      expect(document.querySelector('.tooltip')).toBeInTheDocument()
      // 偏移量计算在 updatePosition 函数中，这里主要测试不会报错
    })
  })

  describe('✅ 延迟和时间控制测试', () => {
    it('应该支持显示延迟', async () => {
      const showDelay = 200
      
      render(
        <Tooltip content="延迟提示" showDelay={showDelay} hideDelay={0}>
          <button>延迟按钮</button>
        </Tooltip>
      )
      
      const button = screen.getByRole('button')
      
      // 触发hover
      await user.hover(button)
      
      // 立即检查 - 不应该显示
      expect(screen.queryByText('延迟提示')).not.toBeInTheDocument()
      
      // 等待延迟时间后检查 - 应该显示
      await waitFor(
        () => {
          expect(screen.getByText('延迟提示')).toBeInTheDocument()
        },
        { timeout: showDelay + 100 }
      )
    })

    it('应该支持隐藏延迟', async () => {
      const hideDelay = 200
      
      render(
        <Tooltip content="隐藏延迟提示" showDelay={0} hideDelay={hideDelay}>
          <button>隐藏延迟按钮</button>
        </Tooltip>
      )
      
      const button = screen.getByRole('button')
      
      // 显示tooltip
      await user.hover(button)
      await waitFor(() => {
        expect(screen.getByText('隐藏延迟提示')).toBeInTheDocument()
      })
      
      // 触发隐藏
      await user.unhover(button)
      
      // 立即检查 - 仍应该显示
      expect(screen.getByText('隐藏延迟提示')).toBeInTheDocument()
      
      // 等待延迟时间后检查 - 应该隐藏
      await waitFor(
        () => {
          expect(screen.queryByText('隐藏延迟提示')).not.toBeInTheDocument()
        },
        { timeout: hideDelay + 100 }
      )
    })

    it('快速hover应该取消隐藏延迟', async () => {
      render(
        <Tooltip content="快速Hover提示" showDelay={0} hideDelay={200}>
          <button>快速Hover按钮</button>
        </Tooltip>
      )
      
      const button = screen.getByRole('button')
      
      // 显示tooltip
      await user.hover(button)
      await waitFor(() => {
        expect(screen.getByText('快速Hover提示')).toBeInTheDocument()
      })
      
      // 离开
      await user.unhover(button)
      
      // 快速重新进入（在隐藏延迟之前）
      await wait(50)
      await user.hover(button)
      
      // 应该仍然显示
      await wait(250)
      expect(screen.getByText('快速Hover提示')).toBeInTheDocument()
    })
  })

  describe('✅ 内容和样式测试', () => {
    it('应该支持 React 节点作为内容', () => {
      const complexContent = (
        <div>
          <strong>重要提示</strong>
          <p>这是一个复杂的提示内容</p>
        </div>
      )
      
      render(
        <Tooltip content={complexContent} open={true}>
          <button>复杂内容按钮</button>
        </Tooltip>
      )
      
      expect(screen.getByText('重要提示')).toBeInTheDocument()
      expect(screen.getByText('这是一个复杂的提示内容')).toBeInTheDocument()
    })

    it('应该显示箭头指示器', () => {
      render(
        <Tooltip content="带箭头提示" showArrow={true} open={true}>
          <button>带箭头按钮</button>
        </Tooltip>
      )
      
      expect(document.querySelector('.tooltip-arrow')).toBeInTheDocument()
    })

    it('应该隐藏箭头指示器', () => {
      render(
        <Tooltip content="无箭头提示" showArrow={false} open={true}>
          <button>无箭头按钮</button>
        </Tooltip>
      )
      
      expect(document.querySelector('.tooltip-arrow')).not.toBeInTheDocument()
    })

    it('应该应用自定义类名', () => {
      const customClass = 'custom-tooltip-class'
      const customContentClass = 'custom-content-class'
      
      render(
        <Tooltip 
          content="自定义样式提示" 
          className={customClass}
          contentClassName={customContentClass}
          open={true}
        >
          <button>自定义样式按钮</button>
        </Tooltip>
      )
      
      const tooltip = document.querySelector('.tooltip')
      const content = document.querySelector('.tooltip-content')
      
      expect(tooltip).toHaveClass(customClass)
      expect(content).toHaveClass(customContentClass)
    })
  })

  describe('✅ 事件回调测试', () => {
    it('应该触发 onOpenChange 回调', async () => {
      const handleOpenChange = vi.fn()
      
      render(
        <Tooltip 
          content="回调提示" 
          onOpenChange={handleOpenChange}
          showDelay={0}
          hideDelay={0}
        >
          <button>回调按钮</button>
        </Tooltip>
      )
      
      const button = screen.getByRole('button')
      
      // 显示
      await user.hover(button)
      await waitFor(() => {
        expect(handleOpenChange).toHaveBeenCalledWith(true)
      })
      
      // 隐藏
      await user.unhover(button)
      await waitFor(() => {
        expect(handleOpenChange).toHaveBeenCalledWith(false)
      })
    })

    it('受控模式下不应该内部管理状态', async () => {
      const handleOpenChange = vi.fn()
      
      render(
        <Tooltip 
          content="受控提示" 
          open={false}
          onOpenChange={handleOpenChange}
          trigger="click"
        >
          <button>受控按钮</button>
        </Tooltip>
      )
      
      // 点击不应该自动显示tooltip（因为是受控的）
      await user.click(screen.getByRole('button'))
      expect(screen.queryByText('受控提示')).not.toBeInTheDocument()
      expect(handleOpenChange).toHaveBeenCalledWith(true)
    })
  })

  describe('✅ 边界情况测试', () => {
    it('应该处理空的内容', () => {
      render(
        <Tooltip content="" open={true}>
          <button>空内容按钮</button>
        </Tooltip>
      )
      
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
    })

    it('应该处理 null 内容', () => {
      render(
        <Tooltip content={null} open={true}>
          <button>Null内容按钮</button>
        </Tooltip>
      )
      
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
    })

    it('应该处理 undefined 内容', () => {
      render(
        <Tooltip content={undefined} open={true}>
          <button>Undefined内容按钮</button>
        </Tooltip>
      )
      
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
    })

    it('应该正确处理组件卸载', () => {
      const { unmount } = render(
        <Tooltip content="测试提示" open={true}>
          <button>测试按钮</button>
        </Tooltip>
      )
      
      expect(screen.getByText('测试提示')).toBeInTheDocument()
      
      // 卸载不应该报错
      unmount()
      
      expect(screen.queryByText('测试提示')).not.toBeInTheDocument()
    })
  })

  describe('✅ 自动定位测试', () => {
    beforeEach(() => {
      // Mock getBoundingClientRect 返回接近边界的位置
      Element.prototype.getBoundingClientRect = vi.fn(() => 
        mockGetBoundingClientRect({
          top: 50,  // 接近顶部
          left: 50, // 接近左边
          right: 150,
          bottom: 100,
          width: 100,
          height: 50,
        })
      )
    })

    it('auto 位置应该选择最佳位置', () => {
      render(
        <Tooltip content="自动定位提示" placement="auto" open={true}>
          <button>自动定位按钮</button>
        </Tooltip>
      )
      
      expect(document.querySelector('.tooltip')).toBeInTheDocument()
      // 具体的位置计算逻辑在实际组件中，这里主要测试不会报错
    })

    it('应该监听窗口滚动和resize事件', () => {
      const addEventListenerSpy = vi.spyOn(window, 'addEventListener')
      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener')
      
      const { unmount } = render(
        <Tooltip content="事件监听提示" open={true}>
          <button>事件监听按钮</button>
        </Tooltip>
      )
      
      expect(addEventListenerSpy).toHaveBeenCalledWith('scroll', expect.any(Function), true)
      expect(addEventListenerSpy).toHaveBeenCalledWith('resize', expect.any(Function))
      
      unmount()
      
      expect(removeEventListenerSpy).toHaveBeenCalledWith('scroll', expect.any(Function), true)
      expect(removeEventListenerSpy).toHaveBeenCalledWith('resize', expect.any(Function))
    })
  })
})

describe('SimpleTooltip 组件', () => {
  let user: ReturnType<typeof userEvent.setup>

  beforeEach(() => {
    user = userEvent.setup()
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
      })
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
      })
    })

    it('应该处理空的文本', async () => {
      render(
        <SimpleTooltip text="">
          <button>空文本按钮</button>
        </SimpleTooltip>
      )
      
      const button = screen.getByRole('button')
      
      await user.hover(button)
      await wait(300)
      
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
    })
  })
})

describe('Tooltip 组件集成测试', () => {
  let user: ReturnType<typeof userEvent.setup>

  beforeEach(() => {
    user = userEvent.setup()
  })

  describe('✅ 真实使用场景', () => {
    it('应该在表单字段上提供帮助信息', async () => {
      render(
        <form>
          <Tooltip content="请输入您的用户名，长度在3-20个字符之间">
            <label>
              用户名:
              <input type="text" name="username" />
            </label>
          </Tooltip>
        </form>
      )
      
      const label = screen.getByText('用户名:')
      
      await user.hover(label)
      await waitFor(() => {
        expect(screen.getByText(/请输入您的用户名/)).toBeInTheDocument()
      })
    })

    it('应该在按钮上提供操作说明', async () => {
      render(
        <div>
          <Tooltip content="点击删除选中的项目，此操作无法撤销">
            <button disabled>删除</button>
          </Tooltip>
        </div>
      )
      
      const button = screen.getByRole('button')
      
      await user.hover(button)
      await waitFor(() => {
        expect(screen.getByText(/点击删除选中的项目/)).toBeInTheDocument()
      })
    })

    it('应该在图标按钮上提供功能说明', async () => {
      render(
        <div>
          <SimpleTooltip text="设置">
            <button aria-label="设置">⚙️</button>
          </SimpleTooltip>
        </div>
      )
      
      const button = screen.getByLabelText('设置')
      
      await user.hover(button)
      await waitFor(() => {
        expect(screen.getByText('设置')).toBeInTheDocument()
      })
    })
  })

  describe('✅ 可访问性测试', () => {
    it('应该有正确的 ARIA 属性', () => {
      render(
        <Tooltip content="可访问性提示" open={true}>
          <button>可访问性按钮</button>
        </Tooltip>
      )
      
      const tooltip = screen.getByRole('tooltip')
      expect(tooltip).toBeInTheDocument()
    })

    it('应该支持键盘导航', async () => {
      render(
        <Tooltip content="键盘导航提示" trigger="focus">
          <button>键盘导航按钮</button>
        </Tooltip>
      )
      
      const button = screen.getByRole('button')
      
      // Tab 键聚焦
      await user.tab()
      expect(button).toHaveFocus()
      
      await waitFor(() => {
        expect(screen.getByText('键盘导航提示')).toBeInTheDocument()
      })
    })

    it('应该支持屏幕阅读器', () => {
      render(
        <Tooltip content="屏幕阅读器友好的提示" open={true}>
          <button>屏幕阅读器按钮</button>
        </Tooltip>
      )
      
      const tooltip = screen.getByRole('tooltip')
      expect(tooltip).toHaveTextContent('屏幕阅读器友好的提示')
    })
  })

  describe('✅ 性能测试', () => {
    it('应该在不需要时避免渲染DOM', () => {
      render(
        <Tooltip content="性能测试提示">
          <button>性能测试按钮</button>
        </Tooltip>
      )
      
      // 初始状态不应该渲染tooltip DOM
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
      expect(document.querySelector('.tooltip')).not.toBeInTheDocument()
    })

    it('应该正确清理事件监听器', () => {
      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener')
      
      const { unmount } = render(
        <Tooltip content="清理测试提示" open={true}>
          <button>清理测试按钮</button>
        </Tooltip>
      )
      
      unmount()
      
      // 应该清理滚动和resize监听器
      expect(removeEventListenerSpy).toHaveBeenCalled()
    })
  })
})
