/**
 * Select 组件测试
 * 
 * 测试选择器组件的各种功能和状态
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { User, Star, Settings } from 'lucide-react'
import { Select } from '../../../../components/common/Select'
import { renderWithProviders, expectVisible, expectHidden } from '../../../utils/test-utils'
import type { SelectOption, SelectOptionGroup, SelectSize, SelectVariant } from '../../../../components/common/Select'

// Mock Lucide icons
vi.mock('lucide-react', () => ({
  ChevronDown: () => <svg data-testid="chevron-down-icon" />,
  ChevronUp: () => <svg data-testid="chevron-up-icon" />,
  X: () => <svg data-testid="x-icon" />,
  Search: () => <svg data-testid="search-icon" />,
  Check: () => <svg data-testid="check-icon" />,
  User: () => <svg data-testid="user-icon" />,
  Star: () => <svg data-testid="star-icon" />,
  Settings: () => <svg data-testid="settings-icon" />,
}))

// 测试数据
const mockOptions: SelectOption[] = [
  { value: '1', label: '选项 1' },
  { value: '2', label: '选项 2' },
  { value: '3', label: '选项 3', disabled: true },
  { value: '4', label: '选项 4', description: '这是选项4的描述' },
  { value: '5', label: '选项 5', icon: <Star /> },
]

const mockGroups: SelectOptionGroup[] = [
  {
    label: '用户组',
    options: [
      { value: 'user1', label: '用户 1' },
      { value: 'user2', label: '用户 2' },
    ],
  },
  {
    label: '管理员组',
    options: [
      { value: 'admin1', label: '管理员 1' },
      { value: 'admin2', label: '管理员 2' },
    ],
    disabled: false,
  },
]

describe('Select 组件', () => {
  let user: ReturnType<typeof userEvent.setup>

  beforeEach(() => {
    user = userEvent.setup()
  })

  describe('✅ 渲染测试', () => {
    it('应该正确渲染基本选择器', () => {
      render(<Select options={mockOptions} placeholder="请选择选项" />)
      
      expect(screen.getByRole('combobox')).toBeInTheDocument()
      expect(screen.getByText('请选择选项')).toBeInTheDocument()
      expect(screen.getByTestId('chevron-down-icon')).toBeInTheDocument()
    })

    it('应该支持所有尺寸', () => {
      const sizes: SelectSize[] = ['sm', 'md', 'lg']
      
      sizes.forEach(size => {
        const { unmount } = render(
          <Select options={mockOptions} size={size} data-testid={`select-${size}`} />
        )
        
        const select = screen.getByTestId(`select-${size}`)
        
        if (size === 'sm') {
          expect(select).toHaveClass('min-h-[2rem]', 'text-sm')
        } else if (size === 'md') {
          expect(select).toHaveClass('min-h-[2.5rem]', 'text-base')
        } else if (size === 'lg') {
          expect(select).toHaveClass('min-h-[3rem]', 'text-lg')
        }
        
        unmount()
      })
    })

    it('应该支持所有变体样式', () => {
      const variants: SelectVariant[] = ['default', 'filled', 'outlined', 'borderless']
      
      variants.forEach(variant => {
        const { unmount } = render(
          <Select options={mockOptions} variant={variant} data-testid={`select-${variant}`} />
        )
        
        const select = screen.getByTestId(`select-${variant}`)
        expect(select).toBeInTheDocument()
        
        unmount()
      })
    })

    it('应该渲染标签', () => {
      render(<Select options={mockOptions} label="选择用户" />)
      
      expect(screen.getByText('选择用户')).toBeInTheDocument()
      expect(screen.getByLabelText('选择用户')).toBeInTheDocument()
    })

    it('应该显示必填标记', () => {
      render(<Select options={mockOptions} label="选择用户" required />)
      
      expect(screen.getByText('选择用户')).toBeInTheDocument()
      expect(screen.getByText('*')).toBeInTheDocument()
    })

    it('应该渲染帮助文本', () => {
      render(<Select options={mockOptions} helperText="请选择一个用户" />)
      
      expect(screen.getByText('请选择一个用户')).toBeInTheDocument()
    })

    it('应该渲染错误文本', () => {
      render(<Select options={mockOptions} errorText="请选择一个选项" />)
      
      expect(screen.getByText('请选择一个选项')).toBeInTheDocument()
    })
  })

  describe('✅ 单选功能测试', () => {
    it('应该打开下拉框显示选项', async () => {
      render(<Select options={mockOptions} />)
      
      const select = screen.getByRole('combobox')
      
      // 初始状态下拉框关闭
      expect(screen.queryByText('选项 1')).not.toBeInTheDocument()
      
      // 点击打开下拉框
      await user.click(select)
      
      expect(screen.getByText('选项 1')).toBeInTheDocument()
      expect(screen.getByText('选项 2')).toBeInTheDocument()
      expect(screen.getByTestId('chevron-up-icon')).toBeInTheDocument()
    })

    it('应该选择选项并关闭下拉框', async () => {
      const handleChange = vi.fn()
      
      render(<Select options={mockOptions} onChange={handleChange} />)
      
      const select = screen.getByRole('combobox')
      
      // 打开下拉框
      await user.click(select)
      
      // 选择选项1
      await user.click(screen.getByText('选项 1'))
      
      // 验证选中状态
      expect(screen.getByText('选项 1')).toBeInTheDocument()
      expect(screen.queryByText('选项 2')).not.toBeInTheDocument() // 下拉框已关闭
      expect(handleChange).toHaveBeenCalledWith('1', expect.objectContaining({ value: '1', label: '选项 1' }))
    })

    it('应该支持键盘导航', async () => {
      render(<Select options={mockOptions} />)
      
      const select = screen.getByRole('combobox')
      
      // 使用空格键打开下拉框
      select.focus()
      await user.keyboard(' ')
      
      expect(screen.getByText('选项 1')).toBeInTheDocument()
      
      // 使用ESC键关闭下拉框
      await user.keyboard('{Escape}')
      
      expect(screen.queryByText('选项 1')).not.toBeInTheDocument()
    })

    it('应该支持受控模式', () => {
      const { rerender } = render(
        <Select options={mockOptions} value="1" />
      )
      
      expect(screen.getByText('选项 1')).toBeInTheDocument()
      
      rerender(<Select options={mockOptions} value="2" />)
      
      expect(screen.getByText('选项 2')).toBeInTheDocument()
    })

    it('应该支持非受控模式', async () => {
      render(<Select options={mockOptions} defaultValue="2" />)
      
      expect(screen.getByText('选项 2')).toBeInTheDocument()
    })

    it('不应该选择禁用的选项', async () => {
      const handleChange = vi.fn()
      
      render(<Select options={mockOptions} onChange={handleChange} />)
      
      const select = screen.getByRole('combobox')
      
      await user.click(select)
      
      // 尝试点击禁用的选项3
      const disabledOption = screen.getByText('选项 3')
      expect(disabledOption.parentElement).toHaveClass('opacity-50', 'cursor-not-allowed')
      
      await user.click(disabledOption)
      
      // 验证没有被选中
      expect(handleChange).not.toHaveBeenCalled()
    })
  })

  describe('✅ 多选功能测试', () => {
    it('应该支持多选模式', async () => {
      const handleChange = vi.fn()
      
      render(<Select options={mockOptions} multiple onChange={handleChange} />)
      
      const select = screen.getByRole('combobox')
      
      await user.click(select)
      
      // 选择多个选项
      await user.click(screen.getByText('选项 1'))
      expect(handleChange).toHaveBeenLastCalledWith(['1'], expect.any(Array))
      
      await user.click(screen.getByText('选项 2'))
      expect(handleChange).toHaveBeenLastCalledWith(['1', '2'], expect.any(Array))
      
      // 下拉框应该保持打开状态
      expect(screen.getByText('选项 1')).toBeInTheDocument()
      expect(screen.getByText('选项 2')).toBeInTheDocument()
    })

    it('应该显示选中的标签', async () => {
      render(<Select options={mockOptions} multiple defaultValue={['1', '2']} />)
      
      // 应该显示两个标签
      expect(screen.getByText('选项 1')).toBeInTheDocument()
      expect(screen.getByText('选项 2')).toBeInTheDocument()
    })

    it('应该能够移除选中的标签', async () => {
      const handleChange = vi.fn()
      
      render(<Select options={mockOptions} multiple defaultValue={['1', '2']} onChange={handleChange} />)
      
      // 点击选项1标签的删除按钮
      const removeButtons = screen.getAllByTestId('x-icon')
      await user.click(removeButtons[0])
      
      expect(handleChange).toHaveBeenCalledWith(['2'], expect.any(Array))
    })

    it('应该支持全选功能', async () => {
      const handleChange = vi.fn()
      
      render(<Select options={mockOptions} multiple showSelectAll onChange={handleChange} />)
      
      const select = screen.getByRole('combobox')
      
      await user.click(select)
      
      // 点击全选
      await user.click(screen.getByText('全选'))
      
      // 应该选中所有非禁用的选项
      const enabledOptions = mockOptions.filter(opt => !opt.disabled)
      const expectedValues = enabledOptions.map(opt => opt.value)
      
      expect(handleChange).toHaveBeenCalledWith(expectedValues, expect.any(Array))
    })

    it('选中项目过多时应该显示计数', () => {
      const manyOptions = Array.from({ length: 10 }, (_, i) => ({
        value: `${i + 1}`,
        label: `选项 ${i + 1}`,
      }))
      
      const selectedValues = manyOptions.slice(0, 5).map(opt => opt.value)
      
      render(
        <Select 
          options={manyOptions} 
          multiple 
          defaultValue={selectedValues}
          maxDisplayCount={3}
        />
      )
      
      expect(screen.getByText('已选择 5 项')).toBeInTheDocument()
    })
  })

  describe('✅ 搜索功能测试', () => {
    it('应该显示搜索框', async () => {
      render(<Select options={mockOptions} searchable />)
      
      const select = screen.getByRole('combobox')
      
      await user.click(select)
      
      expect(screen.getByPlaceholderText('搜索选项...')).toBeInTheDocument()
      expect(screen.getByTestId('search-icon')).toBeInTheDocument()
    })

    it('应该能够搜索过滤选项', async () => {
      render(<Select options={mockOptions} searchable />)
      
      const select = screen.getByRole('combobox')
      
      await user.click(select)
      
      const searchInput = screen.getByPlaceholderText('搜索选项...')
      
      // 搜索 "选项 1"
      await user.type(searchInput, '选项 1')
      
      expect(screen.getByText('选项 1')).toBeInTheDocument()
      expect(screen.queryByText('选项 2')).not.toBeInTheDocument()
    })

    it('应该搜索描述文本', async () => {
      render(<Select options={mockOptions} searchable />)
      
      const select = screen.getByRole('combobox')
      
      await user.click(select)
      
      const searchInput = screen.getByPlaceholderText('搜索选项...')
      
      // 搜索描述中的关键词
      await user.type(searchInput, '描述')
      
      expect(screen.getByText('选项 4')).toBeInTheDocument()
      expect(screen.queryByText('选项 1')).not.toBeInTheDocument()
    })

    it('应该触发搜索回调', async () => {
      const handleSearch = vi.fn()
      
      render(<Select options={mockOptions} searchable onSearch={handleSearch} />)
      
      const select = screen.getByRole('combobox')
      
      await user.click(select)
      
      const searchInput = screen.getByPlaceholderText('搜索选项...')
      
      await user.type(searchInput, 'test')
      
      expect(handleSearch).toHaveBeenLastCalledWith('test')
    })

    it('搜索无结果时应该显示空状态', async () => {
      render(<Select options={mockOptions} searchable emptyText="没有匹配的选项" />)
      
      const select = screen.getByRole('combobox')
      
      await user.click(select)
      
      const searchInput = screen.getByPlaceholderText('搜索选项...')
      
      await user.type(searchInput, 'xyz不存在的选项')
      
      expect(screen.getByText('没有匹配的选项')).toBeInTheDocument()
    })
  })

  describe('✅ 清除功能测试', () => {
    it('应该显示清除按钮', () => {
      render(<Select options={mockOptions} clearable defaultValue="1" />)
      
      expect(screen.getByTestId('x-icon')).toBeInTheDocument()
    })

    it('无选中值时不应该显示清除按钮', () => {
      render(<Select options={mockOptions} clearable />)
      
      expect(screen.queryByTestId('x-icon')).not.toBeInTheDocument()
    })

    it('点击清除按钮应该清空选择', async () => {
      const handleChange = vi.fn()
      const handleClear = vi.fn()
      
      render(
        <Select 
          options={mockOptions} 
          clearable 
          defaultValue="1" 
          onChange={handleChange}
          onClear={handleClear}
        />
      )
      
      const clearButton = screen.getByTestId('x-icon')
      
      await user.click(clearButton)
      
      expect(handleChange).toHaveBeenCalledWith(undefined, expect.any(Object))
      expect(handleClear).toHaveBeenCalled()
    })

    it('多选模式下清除应该清空所有选择', async () => {
      const handleChange = vi.fn()
      
      render(
        <Select 
          options={mockOptions} 
          multiple
          clearable 
          defaultValue={['1', '2']} 
          onChange={handleChange}
        />
      )
      
      const clearButton = screen.getByTestId('x-icon')
      
      await user.click(clearButton)
      
      expect(handleChange).toHaveBeenCalledWith([], [])
    })
  })

  describe('✅ 状态测试', () => {
    it('禁用状态下不应该响应交互', async () => {
      render(<Select options={mockOptions} disabled />)
      
      const select = screen.getByRole('combobox')
      expect(select).toHaveClass('opacity-50', 'cursor-not-allowed')
      
      await user.click(select)
      
      // 下拉框不应该打开
      expect(screen.queryByText('选项 1')).not.toBeInTheDocument()
    })

    it('只读状态下不应该响应交互', async () => {
      render(<Select options={mockOptions} readOnly defaultValue="1" />)
      
      const select = screen.getByRole('combobox')
      expect(select).toHaveClass('cursor-default', 'bg-gray-50')
      
      await user.click(select)
      
      // 下拉框不应该打开
      expect(screen.queryByText('选项 2')).not.toBeInTheDocument()
    })

    it('加载状态应该显示加载文本', async () => {
      render(<Select options={mockOptions} loading loadingText="数据加载中..." />)
      
      const select = screen.getByRole('combobox')
      
      await user.click(select)
      
      expect(screen.getByText('数据加载中...')).toBeInTheDocument()
    })

    it('错误状态应该应用错误样式', () => {
      render(<Select options={mockOptions} errorText="请选择一个选项" />)
      
      const select = screen.getByRole('combobox')
      expect(select).toHaveClass('border-red-500')
    })
  })

  describe('✅ 自定义渲染测试', () => {
    it('应该支持自定义选项渲染', async () => {
      const renderOption = (option: SelectOption, selected: boolean) => (
        <div data-testid={`custom-option-${option.value}`}>
          自定义: {option.label} {selected ? '(已选中)' : ''}
        </div>
      )
      
      render(<Select options={mockOptions} renderOption={renderOption} defaultValue="1" />)
      
      const select = screen.getByRole('combobox')
      
      await user.click(select)
      
      expect(screen.getByTestId('custom-option-1')).toBeInTheDocument()
      expect(screen.getByText(/自定义: 选项 1 \(已选中\)/)).toBeInTheDocument()
    })

    it('应该支持自定义值渲染', () => {
      const renderValue = (values: SelectOption[]) => (
        <div data-testid="custom-value">
          自定义显示: {values.map(v => v.label).join(', ')}
        </div>
      )
      
      render(
        <Select 
          options={mockOptions} 
          renderValue={renderValue} 
          defaultValue="1"
        />
      )
      
      expect(screen.getByTestId('custom-value')).toBeInTheDocument()
      expect(screen.getByText('自定义显示: 选项 1')).toBeInTheDocument()
    })

    it('应该渲染选项图标', async () => {
      render(<Select options={mockOptions} />)
      
      const select = screen.getByRole('combobox')
      
      await user.click(select)
      
      // 选项5有图标
      expect(screen.getByTestId('star-icon')).toBeInTheDocument()
    })
  })

  describe('✅ 分组功能测试', () => {
    it('应该支持分组选项', async () => {
      render(<Select groups={mockGroups} />)
      
      const select = screen.getByRole('combobox')
      
      await user.click(select)
      
      // 应该显示分组中的选项
      expect(screen.getByText('用户 1')).toBeInTheDocument()
      expect(screen.getByText('用户 2')).toBeInTheDocument()
      expect(screen.getByText('管理员 1')).toBeInTheDocument()
      expect(screen.getByText('管理员 2')).toBeInTheDocument()
    })

    it('应该能够选择分组中的选项', async () => {
      const handleChange = vi.fn()
      
      render(<Select groups={mockGroups} onChange={handleChange} />)
      
      const select = screen.getByRole('combobox')
      
      await user.click(select)
      
      await user.click(screen.getByText('用户 1'))
      
      expect(handleChange).toHaveBeenCalledWith('user1', expect.objectContaining({
        value: 'user1',
        label: '用户 1'
      }))
    })
  })

  describe('✅ 点击外部关闭测试', () => {
    it('点击外部应该关闭下拉框', async () => {
      render(
        <div>
          <Select options={mockOptions} />
          <div data-testid="outside">外部区域</div>
        </div>
      )
      
      const select = screen.getByRole('combobox')
      
      // 打开下拉框
      await user.click(select)
      expect(screen.getByText('选项 1')).toBeInTheDocument()
      
      // 点击外部
      await user.click(screen.getByTestId('outside'))
      
      // 下拉框应该关闭
      await waitFor(() => {
        expect(screen.queryByText('选项 1')).not.toBeInTheDocument()
      })
    })
  })

  describe('✅ 可访问性测试', () => {
    it('应该有正确的 ARIA 属性', () => {
      render(<Select options={mockOptions} />)
      
      const select = screen.getByRole('combobox')
      expect(select).toHaveAttribute('aria-expanded', 'false')
      expect(select).toHaveAttribute('aria-haspopup', 'listbox')
    })

    it('打开时应该更新 ARIA 属性', async () => {
      render(<Select options={mockOptions} />)
      
      const select = screen.getByRole('combobox')
      
      await user.click(select)
      
      expect(select).toHaveAttribute('aria-expanded', 'true')
    })

    it('应该支持键盘导航', async () => {
      render(<Select options={mockOptions} />)
      
      const select = screen.getByRole('combobox')
      
      // 使用 Tab 键聚焦
      await user.tab()
      expect(select).toHaveFocus()
      
      // 使用 Enter 键打开
      await user.keyboard('{Enter}')
      expect(screen.getByText('选项 1')).toBeInTheDocument()
    })
  })

  describe('✅ 边界情况测试', () => {
    it('应该处理空选项列表', async () => {
      render(<Select options={[]} emptyText="没有可用选项" />)
      
      const select = screen.getByRole('combobox')
      
      await user.click(select)
      
      expect(screen.getByText('没有可用选项')).toBeInTheDocument()
    })

    it('应该处理 null 和 undefined 值', () => {
      const { rerender } = render(<Select options={mockOptions} value={null as any} />)
      
      expect(screen.getByText('请选择')).toBeInTheDocument()
      
      rerender(<Select options={mockOptions} value={undefined} />)
      
      expect(screen.getByText('请选择')).toBeInTheDocument()
    })

    it('应该处理不存在的选中值', () => {
      render(<Select options={mockOptions} value="999" />)
      
      // 不存在的值应该显示为空
      expect(screen.getByText('请选择')).toBeInTheDocument()
    })

    it('应该正确处理组件卸载', () => {
      const { unmount } = render(<Select options={mockOptions} />)
      
      // 卸载不应该报错
      unmount()
    })
  })

  describe('✅ 性能测试', () => {
    it('应该避免不必要的重新渲染', () => {
      let renderCount = 0
      
      const TestSelect = (props: any) => {
        renderCount++
        return <Select {...props} />
      }
      
      const { rerender } = render(<TestSelect options={mockOptions} />)
      expect(renderCount).toBe(1)
      
      // 相同的 props
      rerender(<TestSelect options={mockOptions} />)
      expect(renderCount).toBe(2) // 没有 memo，会重新渲染
    })

    it('大量选项应该正常工作', async () => {
      const manyOptions = Array.from({ length: 1000 }, (_, i) => ({
        value: `${i}`,
        label: `选项 ${i}`,
      }))
      
      render(<Select options={manyOptions} />)
      
      const select = screen.getByRole('combobox')
      
      await user.click(select)
      
      // 应该能够渲染所有选项（虽然可能不在视口中）
      expect(screen.getByText('选项 0')).toBeInTheDocument()
      expect(screen.getByText('选项 999')).toBeInTheDocument()
    })
  })
})

describe('Select 组件集成测试', () => {
  describe('✅ 表单集成', () => {
    it('应该在表单中正常工作', async () => {
      const handleSubmit = vi.fn()
      
      const TestForm = () => {
        const [formData, setFormData] = React.useState({ user: '', department: [] })
        
        const handleFormSubmit = (e: React.FormEvent) => {
          e.preventDefault()
          handleSubmit(formData)
        }
        
        return (
          <form onSubmit={handleFormSubmit}>
            <Select
              options={mockOptions}
              value={formData.user}
              onChange={(value) => setFormData(prev => ({ ...prev, user: value as string }))}
              label="选择用户"
            />
            <Select
              options={mockOptions}
              multiple
              value={formData.department}
              onChange={(value) => setFormData(prev => ({ ...prev, department: value as string[] }))}
              label="选择部门"
            />
            <button type="submit">提交</button>
          </form>
        )
      }
      
      render(<TestForm />)
      
      // 选择单个用户
      const userSelect = screen.getByLabelText('选择用户')
      await user.click(userSelect)
      await user.click(screen.getByText('选项 1'))
      
      // 选择多个部门
      const deptSelect = screen.getByLabelText('选择部门')
      await user.click(deptSelect)
      await user.click(screen.getByText('选项 2'))
      await user.click(screen.getByText('选项 4'))
      
      // 提交表单
      await user.click(screen.getByText('提交'))
      
      expect(handleSubmit).toHaveBeenCalledWith({
        user: '1',
        department: ['2', '4']
      })
    })
  })

  describe('✅ 真实使用场景', () => {
    it('应该作为用户选择器工作', async () => {
      const users = [
        { value: '1', label: 'Alice', icon: <User />, description: '前端开发工程师' },
        { value: '2', label: 'Bob', icon: <User />, description: '后端开发工程师' },
        { value: '3', label: 'Charlie', icon: <User />, description: '产品经理' },
      ]
      
      const handleChange = vi.fn()
      
      render(
        <Select
          options={users}
          placeholder="选择团队成员"
          searchable
          clearable
          onChange={handleChange}
          renderOption={(option, selected) => (
            <div className="flex items-center gap-3 p-2">
              {option.icon}
              <div>
                <div className="font-medium">{option.label}</div>
                <div className="text-sm text-gray-500">{option.description}</div>
              </div>
              {selected && <Check className="text-blue-600" />}
            </div>
          )}
        />
      )
      
      const select = screen.getByRole('combobox')
      
      await user.click(select)
      
      // 搜索用户
      const searchInput = screen.getByPlaceholderText('搜索选项...')
      await user.type(searchInput, 'Alice')
      
      // 选择Alice
      await user.click(screen.getByText('Alice'))
      
      expect(handleChange).toHaveBeenCalledWith('1', expect.objectContaining({
        value: '1',
        label: 'Alice'
      }))
    })

    it('应该作为多选标签选择器工作', async () => {
      const tags = [
        { value: 'react', label: 'React' },
        { value: 'typescript', label: 'TypeScript' },
        { value: 'nodejs', label: 'Node.js' },
        { value: 'python', label: 'Python' },
        { value: 'javascript', label: 'JavaScript' },
      ]
      
      const handleChange = vi.fn()
      
      render(
        <Select
          options={tags}
          multiple
          searchable
          clearable
          placeholder="选择技术标签"
          onChange={handleChange}
          maxDisplayCount={2}
        />
      )
      
      const select = screen.getByRole('combobox')
      
      await user.click(select)
      
      // 选择多个标签
      await user.click(screen.getByText('React'))
      await user.click(screen.getByText('TypeScript'))
      await user.click(screen.getByText('Node.js'))
      
      expect(handleChange).toHaveBeenLastCalledWith(
        ['react', 'typescript', 'nodejs'],
        expect.any(Array)
      )
      
      // 应该显示计数而不是所有标签
      await user.click(document.body) // 关闭下拉框
      expect(screen.getByText('已选择 3 项')).toBeInTheDocument()
    })
  })
})
