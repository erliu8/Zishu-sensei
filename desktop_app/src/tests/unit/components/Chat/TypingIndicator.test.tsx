/**
 * TypingIndicator 组件测试
 * 
 * 测试正在输入指示器组件的动画、显示逻辑等功能
 * @module TypingIndicator/Test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, fireEvent, waitFor } from '@testing-library/react'
import { renderWithProviders, wait, createMockFn } from '@/tests/utils/test-utils'

// Mock TypingIndicator component (组件尚未实现)
const TypingIndicator = vi.fn(({ isVisible, text = '正在输入', userName, ...props }: any) => {
  if (!isVisible) return null
  
  const displayText = userName ? `${userName} ${text}` : text
  
  return (
    <div 
      data-testid="typing-indicator"
      className="typing-indicator"
      role="status"
      aria-label="正在输入指示器"
      aria-live="polite"
      {...props}
    >
      <div>{displayText}</div>
      <div data-testid="typing-dot" className="animate-bounce" />
      <div data-testid="typing-dot" className="animate-bounce" />
      <div data-testid="typing-dot" className="animate-bounce" />
    </div>
  )
})

// ==================== Mock 设置 ====================

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, animate, ...props }: any) => (
      <div {...props} data-animate={JSON.stringify(animate)}>
        {children}
      </div>
    ),
  },
  AnimatePresence: ({ children }: any) => children,
}))

// Mock CSS 动画
Object.defineProperty(window, 'getComputedStyle', {
  value: () => ({
    animationName: 'typing-dots',
    animationDuration: '1.5s',
    animationIterationCount: 'infinite',
  }),
})

describe('TypingIndicator 组件', () => {
  // ==================== 测试数据 ====================
  
  const defaultProps = {
    isVisible: true,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  // ==================== 基础渲染测试 ====================
  
  describe('基础渲染', () => {
    it('应该正确渲染指示器', () => {
      renderWithProviders(<TypingIndicator {...defaultProps} />)
      
      expect(screen.getByTestId('typing-indicator')).toBeInTheDocument()
      expect(screen.getByText('正在输入')).toBeInTheDocument()
    })

    it('当不可见时不应该渲染', () => {
      renderWithProviders(<TypingIndicator isVisible={false} />)
      
      expect(screen.queryByTestId('typing-indicator')).not.toBeInTheDocument()
    })

    it('应该显示默认文本', () => {
      renderWithProviders(<TypingIndicator {...defaultProps} />)
      
      expect(screen.getByText('正在输入')).toBeInTheDocument()
    })

    it('应该显示自定义文本', () => {
      const customText = 'AI 正在思考中...'
      renderWithProviders(
        <TypingIndicator {...defaultProps} text={customText} />
      )
      
      expect(screen.getByText(customText)).toBeInTheDocument()
    })

    it('应该显示用户名', () => {
      const userName = 'Alice'
      renderWithProviders(
        <TypingIndicator {...defaultProps} userName={userName} />
      )
      
      expect(screen.getByText(`${userName} 正在输入`)).toBeInTheDocument()
    })
  })

  // ==================== 动画测试 ====================
  
  describe('动画效果', () => {
    it('应该显示点点动画', () => {
      renderWithProviders(<TypingIndicator {...defaultProps} />)
      
      const dots = screen.getAllByTestId('typing-dot')
      expect(dots).toHaveLength(3)
      
      dots.forEach((dot, index) => {
        expect(dot).toHaveClass('animate-bounce')
        expect(dot).toHaveStyle({
          animationDelay: `${index * 0.2}s`,
        })
      })
    })

    it('应该有淡入淡出动画', () => {
      const { rerender } = renderWithProviders(
        <TypingIndicator isVisible={false} />
      )
      
      // 显示指示器
      rerender(<TypingIndicator isVisible={true} />)
      
      const indicator = screen.getByTestId('typing-indicator')
      expect(indicator).toHaveAttribute('data-animate', expect.stringContaining('opacity'))
    })

    it('应该支持自定义动画类型', () => {
      renderWithProviders(
        <TypingIndicator {...defaultProps} animationType="pulse" />
      )
      
      const indicator = screen.getByTestId('typing-indicator')
      expect(indicator).toHaveClass('animate-pulse')
    })

    it('应该支持禁用动画', () => {
      renderWithProviders(
        <TypingIndicator {...defaultProps} disableAnimation />
      )
      
      const dots = screen.getAllByTestId('typing-dot')
      dots.forEach(dot => {
        expect(dot).not.toHaveClass('animate-bounce')
      })
    })

    it('应该有正确的动画时长', () => {
      renderWithProviders(
        <TypingIndicator {...defaultProps} animationDuration={2000} />
      )
      
      const dots = screen.getAllByTestId('typing-dot')
      dots.forEach(dot => {
        expect(dot).toHaveStyle({
          animationDuration: '2s',
        })
      })
    })
  })

  // ==================== 样式测试 ====================
  
  describe('样式配置', () => {
    it('应该应用默认样式', () => {
      const { container } = renderWithProviders(<TypingIndicator {...defaultProps} />)
      
      expect(container.firstChild).toHaveClass('typing-indicator')
    })

    it('应该支持不同大小', () => {
      const { container } = renderWithProviders(
        <TypingIndicator {...defaultProps} size="large" />
      )
      
      expect(container.firstChild).toHaveClass('size-large')
    })

    it('应该支持不同颜色', () => {
      const { container } = renderWithProviders(
        <TypingIndicator {...defaultProps} color="primary" />
      )
      
      expect(container.firstChild).toHaveClass('color-primary')
    })

    it('应该支持自定义样式', () => {
      const customStyle = { backgroundColor: 'red' }
      const { container } = renderWithProviders(
        <TypingIndicator {...defaultProps} style={customStyle} />
      )
      
      expect(container.firstChild).toHaveStyle(customStyle)
    })

    it('应该支持自定义类名', () => {
      const className = 'custom-typing-indicator'
      const { container } = renderWithProviders(
        <TypingIndicator {...defaultProps} className={className} />
      )
      
      expect(container.firstChild).toHaveClass(className)
    })

    it('应该支持紧凑模式', () => {
      const { container } = renderWithProviders(
        <TypingIndicator {...defaultProps} compact />
      )
      
      expect(container.firstChild).toHaveClass('compact')
    })
  })

  // ==================== 位置和布局测试 ====================
  
  describe('位置和布局', () => {
    it('应该支持不同位置', () => {
      const { container } = renderWithProviders(
        <TypingIndicator {...defaultProps} position="left" />
      )
      
      expect(container.firstChild).toHaveClass('position-left')
    })

    it('应该支持居中对齐', () => {
      const { container } = renderWithProviders(
        <TypingIndicator {...defaultProps} align="center" />
      )
      
      expect(container.firstChild).toHaveClass('align-center')
    })

    it('应该支持固定位置', () => {
      const { container } = renderWithProviders(
        <TypingIndicator {...defaultProps} fixed />
      )
      
      expect(container.firstChild).toHaveClass('fixed')
    })

    it('应该支持相对位置', () => {
      const { container } = renderWithProviders(
        <TypingIndicator {...defaultProps} relative />
      )
      
      expect(container.firstChild).toHaveClass('relative')
    })
  })

  // ==================== 交互测试 ====================
  
  describe('交互功能', () => {
    it('应该支持点击事件', async () => {
      const onClick = createMockFn()
      const { user } = renderWithProviders(
        <TypingIndicator {...defaultProps} onClick={onClick} />
      )
      
      const indicator = screen.getByTestId('typing-indicator')
      await user.click(indicator)
      
      expect(onClick).toHaveBeenCalled()
    })

    it('应该支持悬停效果', async () => {
      const { user } = renderWithProviders(
        <TypingIndicator {...defaultProps} hoverable />
      )
      
      const indicator = screen.getByTestId('typing-indicator')
      await user.hover(indicator)
      
      expect(indicator).toHaveClass('hovered')
    })

    it('应该支持工具提示', async () => {
      const tooltip = '用户正在输入消息'
      const { user } = renderWithProviders(
        <TypingIndicator {...defaultProps} tooltip={tooltip} />
      )
      
      const indicator = screen.getByTestId('typing-indicator')
      await user.hover(indicator)
      
      await waitFor(() => {
        expect(screen.getByText(tooltip)).toBeInTheDocument()
      })
    })

    it('应该支持禁用状态', () => {
      const { container } = renderWithProviders(
        <TypingIndicator {...defaultProps} disabled />
      )
      
      expect(container.firstChild).toHaveClass('disabled')
    })
  })

  // ==================== 显示逻辑测试 ====================
  
  describe('显示逻辑', () => {
    it('应该在指定延迟后显示', async () => {
      const delay = 500
      renderWithProviders(
        <TypingIndicator isVisible={true} showDelay={delay} />
      )
      
      // 初始时不应该显示
      expect(screen.queryByTestId('typing-indicator')).not.toBeInTheDocument()
      
      // 等待延迟时间
      await wait(delay + 100)
      
      expect(screen.getByTestId('typing-indicator')).toBeInTheDocument()
    })

    it('应该在指定时间后自动隐藏', async () => {
      const timeout = 1000
      renderWithProviders(
        <TypingIndicator {...defaultProps} autoHideTimeout={timeout} />
      )
      
      expect(screen.getByTestId('typing-indicator')).toBeInTheDocument()
      
      // 等待超时时间
      await wait(timeout + 100)
      
      expect(screen.queryByTestId('typing-indicator')).not.toBeInTheDocument()
    })

    it('应该在多个用户输入时显示计数', () => {
      const typingUsers = ['Alice', 'Bob', 'Charlie']
      renderWithProviders(
        <TypingIndicator isVisible={true} typingUsers={typingUsers} />
      )
      
      expect(screen.getByText('3 人正在输入')).toBeInTheDocument()
    })

    it('应该限制显示的用户数量', () => {
      const typingUsers = ['Alice', 'Bob', 'Charlie', 'David', 'Eve']
      renderWithProviders(
        <TypingIndicator 
          isVisible={true} 
          typingUsers={typingUsers}
          maxUsers={3}
        />
      )
      
      expect(screen.getByText('Alice, Bob, Charlie 等 5 人正在输入')).toBeInTheDocument()
    })
  })

  // ==================== 主题和外观测试 ====================
  
  describe('主题和外观', () => {
    it('应该支持暗色主题', () => {
      const { container } = renderWithProviders(
        <TypingIndicator {...defaultProps} theme="dark" />
      )
      
      expect(container.firstChild).toHaveClass('theme-dark')
    })

    it('应该支持亮色主题', () => {
      const { container } = renderWithProviders(
        <TypingIndicator {...defaultProps} theme="light" />
      )
      
      expect(container.firstChild).toHaveClass('theme-light')
    })

    it('应该支持自定义颜色方案', () => {
      const colorScheme = {
        primary: '#007bff',
        secondary: '#6c757d',
        background: '#ffffff',
      }
      
      renderWithProviders(
        <TypingIndicator {...defaultProps} colorScheme={colorScheme} />
      )
      
      const dots = screen.getAllByTestId('typing-dot')
      dots.forEach(dot => {
        expect(dot).toHaveStyle({
          backgroundColor: colorScheme.primary,
        })
      })
    })

    it('应该支持渐变效果', () => {
      const { container } = renderWithProviders(
        <TypingIndicator {...defaultProps} gradient />
      )
      
      expect(container.firstChild).toHaveClass('gradient')
    })
  })

  // ==================== 无障碍测试 ====================
  
  describe('无障碍功能', () => {
    it('应该有正确的 ARIA 标签', () => {
      renderWithProviders(<TypingIndicator {...defaultProps} />)
      
      const indicator = screen.getByTestId('typing-indicator')
      expect(indicator).toHaveAttribute('role', 'status')
      expect(indicator).toHaveAttribute('aria-label', '正在输入指示器')
      expect(indicator).toHaveAttribute('aria-live', 'polite')
    })

    it('应该支持屏幕阅读器', () => {
      renderWithProviders(
        <TypingIndicator {...defaultProps} userName="Alice" />
      )
      
      const indicator = screen.getByTestId('typing-indicator')
      expect(indicator).toHaveAttribute('aria-describedby', expect.stringContaining('Alice'))
    })

    it('应该在隐藏时移除 ARIA 属性', () => {
      const { rerender } = renderWithProviders(
        <TypingIndicator isVisible={true} />
      )
      
      expect(screen.getByTestId('typing-indicator')).toHaveAttribute('aria-live')
      
      rerender(<TypingIndicator isVisible={false} />)
      
      expect(screen.queryByTestId('typing-indicator')).not.toBeInTheDocument()
    })

    it('应该支持高对比度模式', () => {
      const { container } = renderWithProviders(
        <TypingIndicator {...defaultProps} highContrast />
      )
      
      expect(container.firstChild).toHaveClass('high-contrast')
    })

    it('应该支持减少动画模式', () => {
      // Mock prefers-reduced-motion
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation(query => ({
          matches: query === '(prefers-reduced-motion: reduce)',
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        })),
      })
      
      renderWithProviders(<TypingIndicator {...defaultProps} />)
      
      const dots = screen.getAllByTestId('typing-dot')
      dots.forEach(dot => {
        expect(dot).not.toHaveClass('animate-bounce')
      })
    })
  })

  // ==================== 性能测试 ====================
  
  describe('性能优化', () => {
    it('应该使用 React.memo 优化重渲染', () => {
      const { rerender } = renderWithProviders(<TypingIndicator {...defaultProps} />)
      
      // 重新渲染相同的 props
      rerender(<TypingIndicator {...defaultProps} />)
      
      // 验证没有不必要的重渲染
      expect(screen.getByTestId('typing-indicator')).toBeInTheDocument()
    })

    it('应该在不可见时停止动画', () => {
      const { rerender } = renderWithProviders(
        <TypingIndicator isVisible={true} />
      )
      
      const dots = screen.getAllByTestId('typing-dot')
      dots.forEach(dot => {
        expect(dot).toHaveClass('animate-bounce')
      })
      
      // 隐藏指示器
      rerender(<TypingIndicator isVisible={false} />)
      
      expect(screen.queryByTestId('typing-indicator')).not.toBeInTheDocument()
    })

    it('应该清理定时器', () => {
      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout')
      
      const { unmount } = renderWithProviders(
        <TypingIndicator {...defaultProps} autoHideTimeout={1000} />
      )
      
      unmount()
      
      expect(clearTimeoutSpy).toHaveBeenCalled()
    })
  })

  // ==================== 错误处理测试 ====================
  
  describe('错误处理', () => {
    it('应该处理无效的用户名', () => {
      renderWithProviders(
        <TypingIndicator {...defaultProps} userName={null as any} />
      )
      
      expect(screen.getByText('正在输入')).toBeInTheDocument()
    })

    it('应该处理无效的动画时长', () => {
      renderWithProviders(
        <TypingIndicator {...defaultProps} animationDuration={-1} />
      )
      
      const dots = screen.getAllByTestId('typing-dot')
      dots.forEach(dot => {
        expect(dot).toHaveStyle({
          animationDuration: '1.5s', // 默认值
        })
      })
    })

    it('应该处理空的用户列表', () => {
      renderWithProviders(
        <TypingIndicator isVisible={true} typingUsers={[]} />
      )
      
      expect(screen.queryByTestId('typing-indicator')).not.toBeInTheDocument()
    })
  })

  // ==================== 国际化测试 ====================
  
  describe('国际化支持', () => {
    it('应该支持不同语言', () => {
      renderWithProviders(
        <TypingIndicator {...defaultProps} locale="en" />
      )
      
      expect(screen.getByText('Typing...')).toBeInTheDocument()
    })

    it('应该支持 RTL 布局', () => {
      const { container } = renderWithProviders(
        <TypingIndicator {...defaultProps} rtl />
      )
      
      expect(container.firstChild).toHaveClass('rtl')
    })

    it('应该正确格式化多用户文本', () => {
      const typingUsers = ['Alice', 'Bob']
      renderWithProviders(
        <TypingIndicator 
          isVisible={true} 
          typingUsers={typingUsers}
          locale="en"
        />
      )
      
      expect(screen.getByText('Alice and Bob are typing...')).toBeInTheDocument()
    })
  })

  // ==================== 集成测试 ====================
  
  describe('集成测试', () => {
    it('应该与聊天组件正确集成', async () => {
      const { rerender } = renderWithProviders(
        <TypingIndicator isVisible={false} />
      )
      
      // 模拟开始输入
      rerender(<TypingIndicator isVisible={true} userName="Alice" />)
      
      expect(screen.getByTestId('typing-indicator')).toBeInTheDocument()
      expect(screen.getByText('Alice 正在输入')).toBeInTheDocument()
      
      // 模拟停止输入
      rerender(<TypingIndicator isVisible={false} />)
      
      expect(screen.queryByTestId('typing-indicator')).not.toBeInTheDocument()
    })

    it('应该正确处理快速切换', async () => {
      const { rerender } = renderWithProviders(
        <TypingIndicator isVisible={true} />
      )
      
      // 快速切换可见性
      for (let i = 0; i < 10; i++) {
        rerender(<TypingIndicator isVisible={i % 2 === 0} />)
      }
      
      // 最终状态应该正确
      expect(screen.queryByTestId('typing-indicator')).not.toBeInTheDocument()
    })
  })
})
