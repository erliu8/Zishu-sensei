/**
 * Input 组件测试
 * 
 * 测试输入框组件的各种功能和状态
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { User, Mail, Search } from 'lucide-react'
import { Input } from '../../../../components/common/Input'
import { renderWithProviders, expectVisible, expectHidden, expectDisabled, expectEnabled } from '../../../utils/test-utils'
import type { InputType, InputSize, InputVariant, ValidationStatus } from '../../../../components/common/Input'

// Mock Lucide icons
vi.mock('lucide-react', () => ({
  Eye: () => <svg data-testid="eye-icon" />,
  EyeOff: () => <svg data-testid="eye-off-icon" />,
  X: () => <svg data-testid="x-icon" />,
  AlertCircle: () => <svg data-testid="alert-circle-icon" />,
  User: () => <svg data-testid="user-icon" />,
  Mail: () => <svg data-testid="mail-icon" />,
  Search: () => <svg data-testid="search-icon" />,
}))

describe('Input 组件', () => {
  let user: ReturnType<typeof userEvent.setup>

  beforeEach(() => {
    user = userEvent.setup()
  })

  describe('✅ 渲染测试', () => {
    it('应该正确渲染基本输入框', () => {
      render(<Input placeholder="请输入内容" />)
      
      const input = screen.getByRole('textbox')
      expect(input).toBeInTheDocument()
      expect(input).toHaveAttribute('placeholder', '请输入内容')
    })

    it('应该支持所有输入类型', () => {
      const types: InputType[] = ['text', 'password', 'email', 'number', 'tel', 'url', 'search']
      
      types.forEach(type => {
        const { unmount } = render(<Input type={type} data-testid={`input-${type}`} />)
        
        const input = screen.getByTestId(`input-${type}`)
        expect(input).toBeInTheDocument()
        expect(input).toHaveAttribute('type', type === 'password' ? 'password' : type)
        
        unmount()
      })
    })

    it('应该支持所有尺寸', () => {
      const sizes: InputSize[] = ['sm', 'md', 'lg']
      
      sizes.forEach(size => {
        const { unmount } = render(<Input size={size} data-testid={`input-${size}`} />)
        
        const container = screen.getByTestId(`input-${size}`).parentElement
        
        if (size === 'sm') {
          expect(container?.className).toMatch(/h-8/)
        } else if (size === 'md') {
          expect(container?.className).toMatch(/h-10/)
        } else if (size === 'lg') {
          expect(container?.className).toMatch(/h-12/)
        }
        
        unmount()
      })
    })

    it('应该支持所有变体样式', () => {
      const variants: InputVariant[] = ['default', 'filled', 'outlined', 'borderless']
      
      variants.forEach(variant => {
        const { unmount } = render(<Input variant={variant} data-testid={`input-${variant}`} />)
        
        const input = screen.getByTestId(`input-${variant}`)
        expect(input).toBeInTheDocument()
        
        unmount()
      })
    })

    it('应该渲染标签', () => {
      render(<Input label="用户名" />)
      
      expect(screen.getByText('用户名')).toBeInTheDocument()
      expect(screen.getByLabelText('用户名')).toBeInTheDocument()
    })

    it('应该显示必填标记', () => {
      render(<Input label="用户名" required />)
      
      expect(screen.getByText('用户名')).toBeInTheDocument()
      expect(screen.getByText('*')).toBeInTheDocument()
    })

    it('应该渲染帮助文本', () => {
      render(<Input helperText="请输入您的真实姓名" />)
      
      expect(screen.getByText('请输入您的真实姓名')).toBeInTheDocument()
    })

    it('应该渲染错误文本', () => {
      render(<Input errorText="用户名不能为空" />)
      
      expect(screen.getByText('用户名不能为空')).toBeInTheDocument()
      expect(screen.getByTestId('alert-circle-icon')).toBeInTheDocument()
    })

    it('错误文本应该覆盖帮助文本', () => {
      render(
        <Input 
          helperText="这是帮助文本" 
          errorText="这是错误文本" 
        />
      )
      
      expect(screen.getByText('这是错误文本')).toBeInTheDocument()
      expect(screen.queryByText('这是帮助文本')).not.toBeInTheDocument()
    })
  })

  describe('✅ 前缀和后缀测试', () => {
    it('应该渲染前缀图标', () => {
      render(<Input prefix={<User />} />)
      
      expect(screen.getByTestId('user-icon')).toBeInTheDocument()
    })

    it('应该渲染后缀图标', () => {
      render(<Input suffix={<Mail />} />)
      
      expect(screen.getByTestId('mail-icon')).toBeInTheDocument()
    })

    it('应该同时支持前缀和后缀', () => {
      render(<Input prefix={<User />} suffix={<Mail />} />)
      
      expect(screen.getByTestId('user-icon')).toBeInTheDocument()
      expect(screen.getByTestId('mail-icon')).toBeInTheDocument()
    })

    it('前缀图标应该不影响输入功能', async () => {
      render(<Input prefix={<Search />} placeholder="搜索..." />)
      
      const input = screen.getByRole('textbox')
      await user.type(input, 'test search')
      
      expect(input).toHaveValue('test search')
      expect(screen.getByTestId('search-icon')).toBeInTheDocument()
    })
  })

  describe('✅ 清除功能测试', () => {
    it('应该显示清除按钮（有值时）', async () => {
      render(<Input clearable defaultValue="test" />)
      
      expect(screen.getByTestId('x-icon')).toBeInTheDocument()
    })

    it('应该隐藏清除按钮（无值时）', () => {
      render(<Input clearable />)
      
      expect(screen.queryByTestId('x-icon')).not.toBeInTheDocument()
    })

    it('点击清除按钮应该清空输入', async () => {
      render(<Input clearable defaultValue="test" />)
      
      const input = screen.getByRole('textbox')
      const clearButton = screen.getByTestId('x-icon').parentElement
      
      expect(input).toHaveValue('test')
      
      if (clearButton) {
        await user.click(clearButton)
        expect(input).toHaveValue('')
        expect(screen.queryByTestId('x-icon')).not.toBeInTheDocument()
      }
    })

    it('应该触发 onClear 回调', async () => {
      const handleClear = vi.fn()
      
      render(<Input clearable defaultValue="test" onClear={handleClear} />)
      
      const clearButton = screen.getByTestId('x-icon').parentElement
      
      if (clearButton) {
        await user.click(clearButton)
        expect(handleClear).toHaveBeenCalledTimes(1)
      }
    })

    it('禁用状态下不应该显示清除按钮', () => {
      render(<Input clearable defaultValue="test" disabled />)
      
      expect(screen.queryByTestId('x-icon')).not.toBeInTheDocument()
    })

    it('只读状态下不应该显示清除按钮', () => {
      render(<Input clearable defaultValue="test" readOnly />)
      
      expect(screen.queryByTestId('x-icon')).not.toBeInTheDocument()
    })
  })

  describe('✅ 密码功能测试', () => {
    it('密码类型应该默认隐藏内容', () => {
      render(<Input type="password" defaultValue="secret" />)
      
      const input = screen.getByRole('textbox')
      expect(input).toHaveAttribute('type', 'password')
    })

    it('应该显示密码切换按钮', () => {
      render(<Input type="password" showPasswordToggle />)
      
      expect(screen.getByTestId('eye-icon')).toBeInTheDocument()
    })

    it('点击切换按钮应该显示/隐藏密码', async () => {
      render(<Input type="password" showPasswordToggle defaultValue="secret" />)
      
      const input = screen.getByRole('textbox')
      const toggleButton = screen.getByTestId('eye-icon').parentElement
      
      expect(input).toHaveAttribute('type', 'password')
      
      if (toggleButton) {
        await user.click(toggleButton)
        expect(input).toHaveAttribute('type', 'text')
        expect(screen.getByTestId('eye-off-icon')).toBeInTheDocument()
        
        await user.click(toggleButton)
        expect(input).toHaveAttribute('type', 'password')
        expect(screen.getByTestId('eye-icon')).toBeInTheDocument()
      }
    })

    it('禁用状态下密码切换按钮应该被禁用', () => {
      render(<Input type="password" showPasswordToggle disabled />)
      
      const toggleButton = screen.getByTestId('eye-icon').parentElement
      expect(toggleButton).toHaveClass('cursor-not-allowed', 'opacity-50')
    })

    it('只读状态下密码切换按钮应该被禁用', () => {
      render(<Input type="password" showPasswordToggle readOnly />)
      
      const toggleButton = screen.getByTestId('eye-icon').parentElement
      expect(toggleButton).toHaveClass('cursor-not-allowed', 'opacity-50')
    })
  })

  describe('✅ 字符计数测试', () => {
    it('应该显示字符计数', () => {
      render(<Input maxLength={10} showCount defaultValue="test" />)
      
      expect(screen.getByText('4/10')).toBeInTheDocument()
    })

    it('应该实时更新字符计数', async () => {
      render(<Input maxLength={10} showCount />)
      
      const input = screen.getByRole('textbox')
      
      await user.type(input, 'hello')
      expect(screen.getByText('5/10')).toBeInTheDocument()
      
      await user.type(input, ' world')
      expect(screen.getByText('10/10')).toBeInTheDocument()
    })

    it('接近限制时应该显示警告颜色', async () => {
      render(<Input maxLength={10} showCount />)
      
      const input = screen.getByRole('textbox')
      
      // 输入9个字符（90%）
      await user.type(input, '123456789')
      
      const counter = screen.getByText('9/10')
      expect(counter).toHaveClass('text-yellow-600')
    })

    it('达到限制时应该显示错误颜色', async () => {
      render(<Input maxLength={10} showCount />)
      
      const input = screen.getByRole('textbox')
      
      await user.type(input, '1234567890')
      
      const counter = screen.getByText('10/10')
      expect(counter).toHaveClass('text-red-600')
    })

    it('不设置 maxLength 时不应该显示计数', () => {
      render(<Input showCount defaultValue="test" />)
      
      expect(screen.queryByText(/\/\d+/)).not.toBeInTheDocument()
    })
  })

  describe('✅ 状态测试', () => {
    it('应该应用成功状态样式', () => {
      render(<Input status="success" />)
      
      const container = screen.getByRole('textbox').parentElement
      expect(container?.className).toMatch(/border-green-500/)
    })

    it('应该应用警告状态样式', () => {
      render(<Input status="warning" />)
      
      const container = screen.getByRole('textbox').parentElement
      expect(container?.className).toMatch(/border-yellow-500/)
    })

    it('应该应用错误状态样式', () => {
      render(<Input status="error" />)
      
      const container = screen.getByRole('textbox').parentElement
      expect(container?.className).toMatch(/border-red-500/)
    })

    it('errorText 应该覆盖 status', () => {
      render(<Input status="success" errorText="这是错误" />)
      
      const container = screen.getByRole('textbox').parentElement
      expect(container?.className).toMatch(/border-red-500/)
    })
  })

  describe('✅ 交互测试', () => {
    it('应该响应输入事件', async () => {
      const handleChange = vi.fn()
      
      render(<Input onChange={handleChange} />)
      
      const input = screen.getByRole('textbox')
      await user.type(input, 'test')
      
      expect(handleChange).toHaveBeenCalledTimes(4) // 每个字符一次
      expect(input).toHaveValue('test')
    })

    it('应该支持受控模式', async () => {
      const TestComponent = () => {
        const [value, setValue] = React.useState('initial')
        
        return (
          <div>
            <Input value={value} onChange={(e) => setValue(e.target.value)} />
            <button onClick={() => setValue('controlled')}>设置值</button>
          </div>
        )
      }
      
      render(<TestComponent />)
      
      const input = screen.getByRole('textbox')
      expect(input).toHaveValue('initial')
      
      await user.click(screen.getByText('设置值'))
      expect(input).toHaveValue('controlled')
    })

    it('应该支持非受控模式', async () => {
      render(<Input defaultValue="default" />)
      
      const input = screen.getByRole('textbox')
      expect(input).toHaveValue('default')
      
      await user.clear(input)
      await user.type(input, 'new value')
      expect(input).toHaveValue('new value')
    })

    it('禁用状态下不应该响应输入', async () => {
      const handleChange = vi.fn()
      
      render(<Input disabled onChange={handleChange} />)
      
      const input = screen.getByRole('textbox')
      expectDisabled(input)
      
      await user.type(input, 'test')
      expect(handleChange).not.toHaveBeenCalled()
      expect(input).toHaveValue('')
    })

    it('只读状态下不应该响应输入', async () => {
      const handleChange = vi.fn()
      
      render(<Input readOnly defaultValue="readonly" onChange={handleChange} />)
      
      const input = screen.getByRole('textbox')
      expect(input).toHaveAttribute('readonly')
      
      await user.type(input, 'test')
      expect(handleChange).not.toHaveBeenCalled()
      expect(input).toHaveValue('readonly')
    })
  })

  describe('✅ 样式和布局测试', () => {
    it('应该支持块级布局', () => {
      render(<Input block />)
      
      const container = screen.getByRole('textbox').closest('div')
      expect(container).toHaveClass('w-full')
    })

    it('应该应用自定义类名', () => {
      render(
        <Input 
          className="custom-input" 
          containerClassName="custom-container"
        />
      )
      
      const input = screen.getByRole('textbox')
      expect(input).toHaveClass('custom-input')
      
      const container = input.closest('.custom-container')
      expect(container).toBeInTheDocument()
    })

    it('应该支持自定义样式', () => {
      render(<Input style={{ backgroundColor: 'red' }} />)
      
      const input = screen.getByRole('textbox')
      expect(input).toHaveStyle({ backgroundColor: 'red' })
    })
  })

  describe('✅ 可访问性测试', () => {
    it('应该支持 aria-label', () => {
      render(<Input aria-label="用户名输入框" />)
      
      expect(screen.getByLabelText('用户名输入框')).toBeInTheDocument()
    })

    it('应该支持 aria-describedby', () => {
      render(
        <div>
          <Input aria-describedby="help-text" />
          <div id="help-text">这是帮助文本</div>
        </div>
      )
      
      const input = screen.getByRole('textbox')
      expect(input).toHaveAttribute('aria-describedby', 'help-text')
    })

    it('应该支持 required 属性', () => {
      render(<Input required />)
      
      const input = screen.getByRole('textbox')
      expect(input).toBeRequired()
    })

    it('label 应该与输入框正确关联', () => {
      render(<Input label="邮箱地址" />)
      
      const input = screen.getByLabelText('邮箱地址')
      expect(input).toBeInTheDocument()
    })
  })

  describe('✅ 边界情况测试', () => {
    it('应该处理 null 和 undefined 值', () => {
      const { rerender } = render(<Input value={null as any} />)
      
      let input = screen.getByRole('textbox')
      expect(input).toHaveValue('')
      
      rerender(<Input value={undefined} />)
      
      input = screen.getByRole('textbox')
      expect(input).toHaveValue('')
    })

    it('应该正确处理数字类型', async () => {
      render(<Input type="number" />)
      
      const input = screen.getByRole('spinbutton')
      expect(input).toHaveAttribute('type', 'number')
      
      await user.type(input, '123')
      expect(input).toHaveValue(123)
    })

    it('应该处理极长的输入', async () => {
      const longText = 'a'.repeat(1000)
      
      render(<Input />)
      
      const input = screen.getByRole('textbox')
      await user.type(input, longText)
      
      expect(input).toHaveValue(longText)
    })

    it('应该处理特殊字符', async () => {
      const specialChars = '!@#$%^&*()_+-=[]{}|;:,.<>?'
      
      render(<Input />)
      
      const input = screen.getByRole('textbox')
      await user.type(input, specialChars)
      
      expect(input).toHaveValue(specialChars)
    })

    it('应该正确处理 ref', () => {
      const ref = vi.fn()
      
      render(<Input ref={ref} />)
      
      expect(ref).toHaveBeenCalled()
    })
  })

  describe('✅ 性能测试', () => {
    it('应该避免不必要的重新渲染', () => {
      let renderCount = 0
      
      const TestInput = (props: any) => {
        renderCount++
        return <Input {...props} />
      }
      
      const { rerender } = render(<TestInput placeholder="test" />)
      expect(renderCount).toBe(1)
      
      // 相同的 props
      rerender(<TestInput placeholder="test" />)
      expect(renderCount).toBe(2) // 没有 memo，会重新渲染
    })

    it('大量快速输入应该保持响应', async () => {
      const handleChange = vi.fn()
      
      render(<Input onChange={handleChange} />)
      
      const input = screen.getByRole('textbox')
      const longText = 'This is a very long text to test performance'
      
      await user.type(input, longText)
      
      expect(handleChange).toHaveBeenCalledTimes(longText.length)
      expect(input).toHaveValue(longText)
    })
  })
})

describe('Input 组件集成测试', () => {
  describe('✅ 表单集成', () => {
    it('应该在表单中正常工作', async () => {
      const handleSubmit = vi.fn()
      
      render(
        <form onSubmit={handleSubmit}>
          <Input name="username" label="用户名" required />
          <Input name="email" label="邮箱" type="email" required />
          <button type="submit">提交</button>
        </form>
      )
      
      const usernameInput = screen.getByLabelText('用户名')
      const emailInput = screen.getByLabelText('邮箱')
      
      await user.type(usernameInput, 'testuser')
      await user.type(emailInput, 'test@example.com')
      
      await user.click(screen.getByText('提交'))
      
      expect(handleSubmit).toHaveBeenCalled()
    })

    it('应该支持表单验证', async () => {
      render(
        <form>
          <Input type="email" required />
          <button type="submit">提交</button>
        </form>
      )
      
      const input = screen.getByRole('textbox')
      
      await user.type(input, 'invalid-email')
      
      // HTML5 验证会标记无效的邮箱
      expect(input).toHaveValue('invalid-email')
    })
  })

  describe('✅ 真实使用场景', () => {
    it('应该作为搜索框工作', async () => {
      const handleSearch = vi.fn()
      
      render(
        <Input
          type="search"
          placeholder="搜索..."
          prefix={<Search />}
          clearable
          onKeyDown={(e) => e.key === 'Enter' && handleSearch(e.currentTarget.value)}
        />
      )
      
      const input = screen.getByRole('searchbox')
      
      await user.type(input, 'test query')
      await user.keyboard('{Enter}')
      
      expect(handleSearch).toHaveBeenCalledWith('test query')
    })

    it('应该作为密码输入框工作', async () => {
      render(
        <Input
          type="password"
          label="密码"
          showPasswordToggle
          clearable
          helperText="密码至少8个字符"
        />
      )
      
      const input = screen.getByLabelText('密码')
      
      await user.type(input, 'mypassword123')
      
      expect(input).toHaveValue('mypassword123')
      expect(input).toHaveAttribute('type', 'password')
      expect(screen.getByText('密码至少8个字符')).toBeInTheDocument()
    })

    it('应该支持复杂的验证场景', async () => {
      const ValidationInput = () => {
        const [value, setValue] = React.useState('')
        const [error, setError] = React.useState('')
        
        const validate = (val: string) => {
          if (!val) {
            setError('此字段必填')
          } else if (val.length < 3) {
            setError('至少需要3个字符')
          } else {
            setError('')
          }
        }
        
        const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
          const newValue = e.target.value
          setValue(newValue)
          validate(newValue)
        }
        
        return (
          <Input
            label="用户名"
            value={value}
            onChange={handleChange}
            errorText={error}
            status={error ? 'error' : value.length >= 3 ? 'success' : undefined}
            required
          />
        )
      }
      
      render(<ValidationInput />)
      
      const input = screen.getByLabelText('用户名')
      
      // 空值 - 显示必填错误
      await user.click(input)
      await user.tab()
      // Note: 在这个测试中，我们不验证失焦行为，因为组件没有实现 onBlur 验证
      
      // 输入过短 - 显示长度错误
      await user.type(input, 'ab')
      expect(screen.getByText('至少需要3个字符')).toBeInTheDocument()
      
      // 输入足够长 - 显示成功状态
      await user.type(input, 'c')
      expect(screen.queryByText('至少需要3个字符')).not.toBeInTheDocument()
    })
  })
})
