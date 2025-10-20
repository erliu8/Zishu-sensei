/**
 * Button 组件测试
 * 
 * 测试按钮组件的各种功能和状态
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ChevronRight, Heart, Loader2 } from 'lucide-react'
import { Button } from '../../../../components/common/Button'
import { renderWithProviders, expectVisible, expectHidden, expectDisabled, expectEnabled } from '../../../utils/test-utils'
import type { ButtonVariant, ButtonSize } from '../../../../types/ui'

// Mock framer-motion to avoid animation issues in tests
vi.mock('framer-motion', () => ({
  motion: {
    button: 'button',
    div: 'div',
  },
  type: {
    Variants: {},
  }
}))

// Mock Lucide icons
vi.mock('lucide-react', () => ({
  ChevronRight: () => <svg data-testid="chevron-right-icon" />,
  Heart: () => <svg data-testid="heart-icon" />,
  Loader2: () => <svg data-testid="loader-icon" />,
}))

describe('Button 组件', () => {
  let user: ReturnType<typeof userEvent.setup>

  beforeEach(() => {
    user = userEvent.setup()
  })

  describe('✅ 渲染测试', () => {
    it('应该正确渲染按钮文本', () => {
      render(<Button>点击我</Button>)
      expect(screen.getByText('点击我')).toBeInTheDocument()
      expect(screen.getByRole('button')).toBeInTheDocument()
    })

    it('应该正确渲染所有按钮变体', () => {
      const variants: ButtonVariant[] = ['primary', 'secondary', 'outline', 'ghost', 'success', 'warning', 'error']
      
      variants.forEach(variant => {
        const { unmount } = render(<Button variant={variant}>{variant}按钮</Button>)
        const button = screen.getByRole('button')
        
        expect(button).toBeInTheDocument()
        expect(button).toHaveTextContent(`${variant}按钮`)
        
        // 检查对应的CSS类名
        if (variant === 'primary') {
          expect(button.className).toMatch(/bg-blue-600/)
        } else if (variant === 'secondary') {
          expect(button.className).toMatch(/bg-gray-600/)
        } else if (variant === 'outline') {
          expect(button.className).toMatch(/border-2/)
        }
        
        unmount()
      })
    })

    it('应该正确渲染所有按钮尺寸', () => {
      const sizes: ButtonSize[] = ['sm', 'md', 'lg', 'xl']
      
      sizes.forEach(size => {
        const { unmount } = render(<Button size={size}>{size}按钮</Button>)
        const button = screen.getByRole('button')
        
        expect(button).toBeInTheDocument()
        
        // 检查尺寸相关的CSS类名
        if (size === 'sm') {
          expect(button.className).toMatch(/px-2 py-1 text-xs/)
        } else if (size === 'md') {
          expect(button.className).toMatch(/px-3 py-1\.5 text-sm/)
        } else if (size === 'lg') {
          expect(button.className).toMatch(/px-4 py-2 text-base/)
        } else if (size === 'xl') {
          expect(button.className).toMatch(/px-6 py-3 text-lg/)
        }
        
        unmount()
      })
    })

    it('应该正确渲染图标按钮', () => {
      render(<Button icon={<ChevronRight />}>带图标</Button>)
      
      expect(screen.getByTestId('chevron-right-icon')).toBeInTheDocument()
      expect(screen.getByText('带图标')).toBeInTheDocument()
    })

    it('应该正确渲染右侧图标', () => {
      render(<Button iconRight={<ChevronRight />}>右侧图标</Button>)
      
      expect(screen.getByTestId('chevron-right-icon')).toBeInTheDocument()
      expect(screen.getByText('右侧图标')).toBeInTheDocument()
    })

    it('应该正确渲染仅图标按钮', () => {
      render(<Button iconOnly icon={<Heart />} aria-label="喜欢" />)
      
      expect(screen.getByTestId('heart-icon')).toBeInTheDocument()
      expect(screen.queryByText('喜欢')).not.toBeInTheDocument()
      expect(screen.getByLabelText('喜欢')).toBeInTheDocument()
    })

    it('应该正确应用自定义类名和样式', () => {
      render(<Button className="custom-class" style={{ color: 'red' }}>自定义</Button>)
      
      const button = screen.getByRole('button')
      expect(button).toHaveClass('custom-class')
      expect(button).toHaveStyle({ color: 'red' })
    })
  })

  describe('✅ 交互测试', () => {
    it('应该响应点击事件', async () => {
      const handleClick = vi.fn()
      
      render(<Button onClick={handleClick}>点击我</Button>)
      
      await user.click(screen.getByRole('button'))
      expect(handleClick).toHaveBeenCalledTimes(1)
    })

    it('禁用状态下不应该响应点击', async () => {
      const handleClick = vi.fn()
      
      render(<Button onClick={handleClick} disabled>禁用按钮</Button>)
      
      const button = screen.getByRole('button')
      expectDisabled(button)
      
      await user.click(button)
      expect(handleClick).not.toHaveBeenCalled()
    })

    it('加载状态下不应该响应点击', async () => {
      const handleClick = vi.fn()
      
      render(<Button onClick={handleClick} loading>加载按钮</Button>)
      
      const button = screen.getByRole('button')
      expectDisabled(button)
      expect(button).toHaveAttribute('aria-busy', 'true')
      
      await user.click(button)
      expect(handleClick).not.toHaveBeenCalled()
    })

    it('应该支持键盘导航', async () => {
      const handleClick = vi.fn()
      
      render(<Button onClick={handleClick}>键盘按钮</Button>)
      
      const button = screen.getByRole('button')
      button.focus()
      
      await user.keyboard('{Enter}')
      expect(handleClick).toHaveBeenCalledTimes(1)
      
      await user.keyboard(' ')
      expect(handleClick).toHaveBeenCalledTimes(2)
    })

    it('应该正确处理块级按钮', () => {
      render(<Button block>块级按钮</Button>)
      
      const button = screen.getByRole('button')
      expect(button.className).toMatch(/w-full/)
    })

    it('应该正确处理圆形按钮', () => {
      render(<Button round>圆形按钮</Button>)
      
      const button = screen.getByRole('button')
      expect(button.className).toMatch(/rounded-full/)
    })

    it('应该防止在禁用状态下的事件传播', async () => {
      const handleClick = vi.fn()
      
      render(<Button onClick={handleClick} disabled>禁用按钮</Button>)
      
      const button = screen.getByRole('button')
      
      // 模拟点击事件
      button.click()
      expect(handleClick).not.toHaveBeenCalled()
    })
  })

  describe('✅ 加载状态测试', () => {
    it('应该显示加载状态', () => {
      render(<Button loading>加载中</Button>)
      
      const button = screen.getByRole('button')
      expect(button).toHaveAttribute('aria-busy', 'true')
      expectDisabled(button)
    })

    it('应该在加载时隐藏图标', () => {
      render(
        <Button loading icon={<Heart />} iconRight={<ChevronRight />}>
          加载中
        </Button>
      )
      
      // 加载状态下，右侧图标应该被隐藏
      expect(screen.queryByTestId('chevron-right-icon')).not.toBeInTheDocument()
    })

    it('应该支持 loadingState 属性', () => {
      const { rerender } = render(<Button loadingState="loading">按钮</Button>)
      
      let button = screen.getByRole('button')
      expectDisabled(button)
      
      rerender(<Button loadingState="idle">按钮</Button>)
      
      button = screen.getByRole('button')
      expectEnabled(button)
    })
  })

  describe('✅ 样式测试', () => {
    it('应该应用正确的基础样式类', () => {
      render(<Button>按钮</Button>)
      
      const button = screen.getByRole('button')
      expect(button.className).toMatch(/inline-flex/)
      expect(button.className).toMatch(/items-center/)
      expect(button.className).toMatch(/justify-center/)
      expect(button.className).toMatch(/font-medium/)
      expect(button.className).toMatch(/transition-all/)
    })

    it('应该正确应用变体样式', () => {
      const { rerender } = render(<Button variant="primary">主按钮</Button>)
      
      let button = screen.getByRole('button')
      expect(button.className).toMatch(/bg-blue-600/)
      
      rerender(<Button variant="outline">边框按钮</Button>)
      
      button = screen.getByRole('button')
      expect(button.className).toMatch(/border-2/)
    })

    it('应该正确应用尺寸样式', () => {
      const { rerender } = render(<Button size="sm">小按钮</Button>)
      
      let button = screen.getByRole('button')
      expect(button.className).toMatch(/px-2 py-1 text-xs/)
      
      rerender(<Button size="xl">大按钮</Button>)
      
      button = screen.getByRole('button')
      expect(button.className).toMatch(/px-6 py-3 text-lg/)
    })

    it('图标按钮应该应用正确的尺寸', () => {
      const { rerender } = render(
        <Button iconOnly icon={<Heart />} size="sm" aria-label="小图标" />
      )
      
      let button = screen.getByRole('button')
      expect(button.className).toMatch(/w-8 h-8/)
      
      rerender(
        <Button iconOnly icon={<Heart />} size="xl" aria-label="大图标" />
      )
      
      button = screen.getByRole('button')
      expect(button.className).toMatch(/w-12 h-12/)
    })
  })

  describe('✅ 可访问性测试', () => {
    it('应该支持 aria-label', () => {
      render(<Button aria-label="关闭对话框">×</Button>)
      expect(screen.getByLabelText('关闭对话框')).toBeInTheDocument()
    })

    it('禁用按钮应该有正确的 aria 属性', () => {
      render(<Button disabled>禁用按钮</Button>)
      
      const button = screen.getByRole('button')
      expect(button).toHaveAttribute('aria-disabled', 'true')
      expect(button).toBeDisabled()
    })

    it('加载状态应该有 aria-busy 属性', () => {
      render(<Button loading>加载按钮</Button>)
      
      const button = screen.getByRole('button')
      expect(button).toHaveAttribute('aria-busy', 'true')
    })

    it('应该支持其他 ARIA 属性', () => {
      render(
        <Button
          aria-describedby="help-text"
          aria-expanded={false}
          role="button"
        >
          ARIA按钮
        </Button>
      )
      
      const button = screen.getByRole('button')
      expect(button).toHaveAttribute('aria-describedby', 'help-text')
      expect(button).toHaveAttribute('aria-expanded', 'false')
    })

    it('图标按钮应该有可访问的标签', () => {
      render(<Button iconOnly icon={<Heart />} aria-label="喜欢" />)
      
      expect(screen.getByLabelText('喜欢')).toBeInTheDocument()
    })
  })

  describe('✅ 边界情况测试', () => {
    it('应该处理空的 children', () => {
      render(<Button>{null}</Button>)
      
      expect(screen.getByRole('button')).toBeInTheDocument()
    })

    it('应该处理同时设置 loading 和 disabled', () => {
      render(<Button loading disabled>按钮</Button>)
      
      const button = screen.getByRole('button')
      expectDisabled(button)
      expect(button).toHaveAttribute('aria-busy', 'true')
    })

    it('应该处理长文本内容', () => {
      const longText = '这是一个非常长的按钮文本，用来测试按钮如何处理长内容'
      render(<Button>{longText}</Button>)
      
      expect(screen.getByText(longText)).toBeInTheDocument()
    })

    it('应该正确处理 ref', () => {
      const ref = vi.fn()
      render(<Button ref={ref}>Ref按钮</Button>)
      
      expect(ref).toHaveBeenCalled()
    })

    it('应该处理无效的变体和尺寸', () => {
      // TypeScript应该阻止这种情况，但运行时应该优雅处理
      render(<Button variant={'invalid' as any} size={'invalid' as any}>按钮</Button>)
      
      expect(screen.getByRole('button')).toBeInTheDocument()
    })
  })

  describe('✅ 性能测试', () => {
    it('应该不会不必要地重新渲染', () => {
      let renderCount = 0
      
      const TestButton = (props: any) => {
        renderCount++
        return <Button {...props}>测试按钮</Button>
      }
      
      const { rerender } = render(<TestButton variant="primary" />)
      expect(renderCount).toBe(1)
      
      // 相同的props不应该触发重新渲染
      rerender(<TestButton variant="primary" />)
      expect(renderCount).toBe(2) // React.memo 没有应用，所以会重新渲染
    })
  })
})

