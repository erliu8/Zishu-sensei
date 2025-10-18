/**
 * Button 组件测试
 * 
 * 测试按钮组件的各种功能和状态
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// Mock Button 组件
const Button = ({ 
  children, 
  onClick, 
  disabled = false, 
  variant = 'primary',
  size = 'medium',
  loading = false,
  ...props 
}: any) => (
  <button 
    onClick={onClick} 
    disabled={disabled || loading}
    data-testid="button"
    data-variant={variant}
    data-size={size}
    className={`btn btn-${variant} btn-${size} ${loading ? 'loading' : ''}`}
    {...props}
  >
    {loading ? '加载中...' : children}
  </button>
)

describe('Button 组件', () => {
  describe('渲染', () => {
    it('应该正确渲染按钮文本', () => {
      render(<Button>点击我</Button>)
      expect(screen.getByText('点击我')).toBeInTheDocument()
    })

    it('应该能够渲染不同的按钮变体', () => {
      const { rerender } = render(<Button variant="primary">主要按钮</Button>)
      expect(screen.getByTestId('button')).toHaveAttribute('data-variant', 'primary')

      rerender(<Button variant="secondary">次要按钮</Button>)
      expect(screen.getByTestId('button')).toHaveAttribute('data-variant', 'secondary')

      rerender(<Button variant="danger">危险按钮</Button>)
      expect(screen.getByTestId('button')).toHaveAttribute('data-variant', 'danger')
    })

    it('应该能够渲染不同的按钮大小', () => {
      const { rerender } = render(<Button size="small">小按钮</Button>)
      expect(screen.getByTestId('button')).toHaveAttribute('data-size', 'small')

      rerender(<Button size="medium">中按钮</Button>)
      expect(screen.getByTestId('button')).toHaveAttribute('data-size', 'medium')

      rerender(<Button size="large">大按钮</Button>)
      expect(screen.getByTestId('button')).toHaveAttribute('data-size', 'large')
    })
  })

  describe('交互', () => {
    it('应该响应点击事件', async () => {
      const handleClick = vi.fn()
      const user = userEvent.setup()
      
      render(<Button onClick={handleClick}>点击我</Button>)
      
      await user.click(screen.getByText('点击我'))
      expect(handleClick).toHaveBeenCalledTimes(1)
    })

    it('禁用状态下不应该响应点击', async () => {
      const handleClick = vi.fn()
      const user = userEvent.setup()
      
      render(<Button onClick={handleClick} disabled>点击我</Button>)
      
      await user.click(screen.getByText('点击我'))
      expect(handleClick).not.toHaveBeenCalled()
      expect(screen.getByTestId('button')).toBeDisabled()
    })

    it('加载状态下不应该响应点击', async () => {
      const handleClick = vi.fn()
      const user = userEvent.setup()
      
      render(<Button onClick={handleClick} loading>点击我</Button>)
      
      expect(screen.getByText('加载中...')).toBeInTheDocument()
      await user.click(screen.getByTestId('button'))
      expect(handleClick).not.toHaveBeenCalled()
    })
  })

  describe('样式', () => {
    it('应该应用正确的 CSS 类名', () => {
      render(<Button variant="primary" size="large">按钮</Button>)
      const button = screen.getByTestId('button')
      
      expect(button).toHaveClass('btn')
      expect(button).toHaveClass('btn-primary')
      expect(button).toHaveClass('btn-large')
    })

    it('加载状态应该应用加载类名', () => {
      render(<Button loading>按钮</Button>)
      expect(screen.getByTestId('button')).toHaveClass('loading')
    })
  })

  describe('可访问性', () => {
    it('应该支持 aria-label', () => {
      render(<Button aria-label="关闭对话框">×</Button>)
      expect(screen.getByLabelText('关闭对话框')).toBeInTheDocument()
    })

    it('禁用按钮应该有正确的 aria 属性', () => {
      render(<Button disabled>按钮</Button>)
      expect(screen.getByTestId('button')).toHaveAttribute('disabled')
    })
  })
})

// ButtonGroup 组件测试
describe('ButtonGroup 组件', () => {
  const ButtonGroup = ({ children, ...props }: any) => (
    <div className="button-group" data-testid="button-group" {...props}>
      {children}
    </div>
  )

  it('应该渲染多个按钮', () => {
    render(
      <ButtonGroup>
        <Button>按钮1</Button>
        <Button>按钮2</Button>
        <Button>按钮3</Button>
      </ButtonGroup>
    )
    
    expect(screen.getByTestId('button-group')).toBeInTheDocument()
    expect(screen.getByText('按钮1')).toBeInTheDocument()
    expect(screen.getByText('按钮2')).toBeInTheDocument()
    expect(screen.getByText('按钮3')).toBeInTheDocument()
  })

  it('应该应用正确的样式', () => {
    render(
      <ButtonGroup>
        <Button>按钮1</Button>
        <Button>按钮2</Button>
      </ButtonGroup>
    )
    
    expect(screen.getByTestId('button-group')).toHaveClass('button-group')
  })
})

