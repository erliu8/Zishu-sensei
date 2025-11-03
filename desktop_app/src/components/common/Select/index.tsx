/**
 * Select 通用选择器组件
 * 
 * 功能特性：
 * - 单选和多选支持
 * - 搜索过滤功能
 * - 多种尺寸和变体
 * - 分组选项支持
 * - 自定义选项渲染
 * - 虚拟滚动（大数据量）
 * - 异步加载
 */

import React, { forwardRef, useState, useCallback, useRef, useEffect } from 'react'
import { ChevronDown, ChevronUp, X, Search, Check } from 'lucide-react'

/**
 * 选择器尺寸
 */
export type SelectSize = 'sm' | 'md' | 'lg'

/**
 * 选择器变体
 */
export type SelectVariant = 'default' | 'filled' | 'outlined' | 'borderless'

/**
 * 选项数据结构
 */
export interface SelectOption {
  /** 选项值 */
  value: string | number
  
  /** 选项显示文本 */
  label: string
  
  /** 是否禁用 */
  disabled?: boolean
  
  /** 选项描述 */
  description?: string
  
  /** 自定义图标 */
  icon?: React.ReactNode
  
  /** 分组 */
  group?: string
  
  /** 自定义数据 */
  data?: any
}

/**
 * 选项分组结构
 */
export interface SelectOptionGroup {
  /** 分组标题 */
  label: string
  
  /** 分组选项 */
  options: SelectOption[]
  
  /** 是否禁用整个分组 */
  disabled?: boolean
}

/**
 * Select 组件属性
 */
export interface SelectProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange' | 'defaultValue'> {
  /** 选项列表 */
  options?: SelectOption[]
  
  /** 分组选项列表 */
  groups?: SelectOptionGroup[]
  
  /** 当前选中值 */
  value?: string | number | (string | number)[]
  
  /** 默认选中值 */
  defaultValue?: string | number | (string | number)[]
  
  /** 占位符文本 */
  placeholder?: string
  
  /** 尺寸 */
  size?: SelectSize
  
  /** 变体样式 */
  variant?: SelectVariant
  
  /** 是否多选 */
  multiple?: boolean
  
  /** 是否可搜索 */
  searchable?: boolean
  
  /** 搜索占位符 */
  searchPlaceholder?: string
  
  /** 是否可清除 */
  clearable?: boolean
  
  /** 是否禁用 */
  disabled?: boolean
  
  /** 是否只读 */
  readOnly?: boolean
  
  /** 是否必填 */
  required?: boolean
  
  /** 标签文本 */
  label?: string
  
  /** 帮助文本 */
  helperText?: string
  
  /** 错误文本 */
  errorText?: string
  
  /** 是否为块级元素 */
  block?: boolean
  
  /** 最大显示选项数 */
  maxDisplayCount?: number
  
  /** 下拉框最大高度 */
  maxHeight?: number
  
  /** 是否显示全选选项（多选时） */
  showSelectAll?: boolean
  
  /** 全选文本 */
  selectAllText?: string
  
  /** 加载状态 */
  loading?: boolean
  
  /** 加载文本 */
  loadingText?: string
  
  /** 空数据文本 */
  emptyText?: string
  
  /** 自定义容器类名 */
  containerClassName?: string
  
  /** 自定义选项渲染函数 */
  renderOption?: (option: SelectOption, selected: boolean) => React.ReactNode
  
  /** 自定义选中值显示函数 */
  renderValue?: (values: SelectOption[]) => React.ReactNode
  
  /** 值变化回调 */
  onChange?: (value: string | number | (string | number)[], option: SelectOption | SelectOption[]) => void
  
  /** 搜索回调 */
  onSearch?: (query: string) => void
  
  /** 清除回调 */
  onClear?: () => void
  
  /** 下拉框打开/关闭回调 */
  onOpenChange?: (open: boolean) => void
}

/**
 * 工具函数：组合类名
 */
const combineClasses = (...classes: (string | undefined | false)[]): string => {
  return classes.filter(Boolean).join(' ')
}

/**
 * Select 组件
 */
export const Select = forwardRef<HTMLDivElement, SelectProps>(({
  options = [],
  groups = [],
  value,
  defaultValue,
  placeholder = '请选择',
  size = 'md',
  variant = 'default',
  multiple = false,
  searchable = false,
  searchPlaceholder = '搜索选项...',
  clearable = false,
  disabled = false,
  readOnly = false,
  required = false,
  label,
  helperText,
  errorText,
  block = false,
  maxDisplayCount = 3,
  maxHeight = 256,
  showSelectAll = false,
  selectAllText = '全选',
  loading = false,
  loadingText = '加载中...',
  emptyText = '暂无数据',
  containerClassName,
  renderOption,
  renderValue,
  onChange,
  onSearch,
  onClear,
  onOpenChange,
  className,
  ...props
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [internalValue, setInternalValue] = useState(() => {
    if (defaultValue !== undefined) {
      return multiple && !Array.isArray(defaultValue) ? [defaultValue] : defaultValue
    }
    return multiple ? [] : undefined
  })

  const containerRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  
  // Generate unique ID for form label association
  const selectId = React.useId()

  // 受控/非受控值管理
  const currentValue = value !== undefined ? value : internalValue
  const isControlled = value !== undefined

  // 扁平化选项列表
  const flatOptions = React.useMemo(() => {
    if (groups.length > 0) {
      return groups.reduce<SelectOption[]>((acc, group) => [...acc, ...group.options], [])
    }
    return options
  }, [options, groups])

  // 过滤选项
  const filteredOptions = React.useMemo(() => {
    if (!searchQuery) return flatOptions
    
    return flatOptions.filter(option =>
      option.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      option.description?.toLowerCase().includes(searchQuery.toLowerCase())
    )
  }, [flatOptions, searchQuery])

  // 获取选中的选项
  const selectedOptions = React.useMemo(() => {
    if (!currentValue) return []
    
    const values = Array.isArray(currentValue) ? currentValue : [currentValue]
    return flatOptions.filter(option => values.includes(option.value))
  }, [currentValue, flatOptions])

  // 检查选项是否被选中
  const isOptionSelected = useCallback((option: SelectOption) => {
    if (!currentValue) return false
    
    if (Array.isArray(currentValue)) {
      return currentValue.includes(option.value)
    }
    
    return currentValue === option.value
  }, [currentValue])

  // 检查是否全选
  const isAllSelected = React.useMemo(() => {
    if (!multiple || filteredOptions.length === 0) return false
    
    const availableOptions = filteredOptions.filter(option => !option.disabled)
    return availableOptions.every(option => isOptionSelected(option))
  }, [multiple, filteredOptions, isOptionSelected])

  // 处理值变化
  const handleValueChange = useCallback((newValue: string | number | (string | number)[], selectedOption: SelectOption | SelectOption[]) => {
    if (!isControlled) {
      setInternalValue(newValue)
    }
    
    onChange?.(newValue, selectedOption)
  }, [isControlled, onChange])

  // 处理选项点击
  const handleOptionClick = useCallback((option: SelectOption) => {
    if (option.disabled || disabled || readOnly) return
    
    if (multiple) {
      const currentValues = Array.isArray(currentValue) ? currentValue : []
      let newValues: (string | number)[]
      let newOptions: SelectOption[]
      
      if (isOptionSelected(option)) {
        newValues = currentValues.filter(v => v !== option.value)
        newOptions = selectedOptions.filter(opt => opt.value !== option.value)
      } else {
        newValues = [...currentValues, option.value]
        newOptions = [...selectedOptions, option]
      }
      
      handleValueChange(newValues, newOptions)
    } else {
      handleValueChange(option.value, option)
      setIsOpen(false)
    }
  }, [multiple, currentValue, isOptionSelected, selectedOptions, handleValueChange, disabled, readOnly])

  // 处理全选
  const handleSelectAll = useCallback(() => {
    if (!multiple) return
    
    const availableOptions = filteredOptions.filter(option => !option.disabled)
    
    if (isAllSelected) {
      // 取消全选
      const currentValues = Array.isArray(currentValue) ? currentValue : []
      const availableValues = availableOptions.map(opt => opt.value)
      const newValues = currentValues.filter(v => !availableValues.includes(v))
      const newOptions = selectedOptions.filter(opt => !availableValues.includes(opt.value))
      
      handleValueChange(newValues, newOptions)
    } else {
      // 全选
      const currentValues = Array.isArray(currentValue) ? currentValue : []
      const newValues = [...new Set([...currentValues, ...availableOptions.map(opt => opt.value)])]
      const newOptions = flatOptions.filter(opt => newValues.includes(opt.value))
      
      handleValueChange(newValues, newOptions)
    }
  }, [multiple, filteredOptions, isAllSelected, currentValue, selectedOptions, flatOptions, handleValueChange])

  // 处理清除
  const handleClear = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    
    if (disabled || readOnly) return
    
    const emptyValue = multiple ? [] : undefined
    handleValueChange(emptyValue as any, multiple ? [] : ({} as SelectOption))
    onClear?.()
  }, [multiple, handleValueChange, onClear, disabled, readOnly])

  // 切换下拉框
  const toggleDropdown = useCallback(() => {
    if (disabled || readOnly) return
    
    const newOpen = !isOpen
    setIsOpen(newOpen)
    onOpenChange?.(newOpen)
    
    if (newOpen) {
      setSearchQuery('')
    }
  }, [isOpen, disabled, readOnly, onOpenChange])

  // 处理搜索
  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query)
    onSearch?.(query)
  }, [onSearch])

  // 点击外部关闭下拉框
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        dropdownRef.current &&
        !containerRef.current.contains(event.target as Node) &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  // 处理键盘事件
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (disabled || readOnly) return
    
    switch (e.key) {
      case 'Enter':
      case ' ':
        e.preventDefault()
        toggleDropdown()
        break
      case 'Escape':
        if (isOpen) {
          e.preventDefault()
          setIsOpen(false)
        }
        break
    }
  }, [disabled, readOnly, isOpen, toggleDropdown])

  // 渲染选中值
  const renderSelectedValue = () => {
    if (renderValue) {
      return renderValue(selectedOptions)
    }
    
    if (selectedOptions.length === 0) {
      return <span className="text-gray-400">{placeholder}</span>
    }
    
    if (multiple) {
      if (selectedOptions.length <= maxDisplayCount) {
        return (
          <div className="flex flex-wrap gap-1">
            {selectedOptions.map(option => (
              <span
                key={option.value}
                className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-800 text-sm rounded"
              >
                {option.label}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleOptionClick(option)
                  }}
                  className="hover:bg-blue-200 rounded-full p-0.5"
                >
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
        )
      } else {
        return (
          <span>
            已选择 {selectedOptions.length} 项
          </span>
        )
      }
    }
    
    return <span>{selectedOptions[0]?.label}</span>
  }

  // 渲染选项
  const renderOptionItem = (option: SelectOption) => {
    const selected = isOptionSelected(option)
    
    if (renderOption) {
      return renderOption(option, selected)
    }
    
    return (
      <div className="flex items-center gap-2 flex-1">
        {option.icon && (
          <span className="flex-shrink-0">
            {React.isValidElement(option.icon)
              ? React.cloneElement(option.icon, { size: 16 } as any)
              : option.icon
            }
          </span>
        )}
        
        <div className="flex-1 min-w-0">
          <div className="truncate">{option.label}</div>
          {option.description && (
            <div className="text-sm text-gray-500 truncate">{option.description}</div>
          )}
        </div>
        
        {multiple && selected && (
          <Check size={16} className="text-blue-600 flex-shrink-0" />
        )}
      </div>
    )
  }

  // 基础样式类
  const baseClasses = combineClasses(
    'relative flex items-center transition-all duration-200 cursor-pointer',
    'border rounded-md bg-white',
    
    // 尺寸样式
    size === 'sm' && 'min-h-[2rem] text-sm',
    size === 'md' && 'min-h-[2.5rem] text-base',
    size === 'lg' && 'min-h-[3rem] text-lg',
    
    // 变体样式
    variant === 'default' && 'border-gray-300',
    variant === 'filled' && 'border-transparent bg-gray-100',
    variant === 'outlined' && 'border-2 border-gray-300',
    variant === 'borderless' && 'border-transparent',
    
    // 状态样式
    isOpen && 'border-blue-500 ring-2 ring-blue-500/20',
    !isOpen && !disabled && 'hover:border-gray-400',
    
    // 错误状态
    errorText && 'border-red-500',
    
    // 禁用状态
    disabled && 'opacity-50 cursor-not-allowed bg-gray-50',
    
    // 只读状态
    readOnly && 'cursor-default bg-gray-50',
    
    // 块级样式
    block && 'w-full'
  )

  // 内容区域样式
  const contentClasses = combineClasses(
    'flex-1 px-3 py-2 min-w-0',
    disabled && 'cursor-not-allowed',
    readOnly && 'cursor-default'
  )

  return (
    <div className={combineClasses('space-y-1', block && 'w-full', containerClassName)}>
      {/* 标签 */}
      {label && (
        <label id={`${selectId}-label`} className="block text-sm font-medium text-gray-700">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      
      {/* 选择器容器 */}
      <div
        ref={containerRef}
        id={selectId}
        className={combineClasses(baseClasses, className)}
        onClick={toggleDropdown}
        onKeyDown={handleKeyDown}
        tabIndex={disabled ? -1 : 0}
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-labelledby={label ? `${selectId}-label` : undefined}
        {...props}
      >
        {/* 选中值显示区域 */}
        <div className={contentClasses}>
          {renderSelectedValue()}
        </div>
        
        {/* 操作按钮区域 */}
        <div className="flex items-center gap-1 px-2">
          {/* 清除按钮 */}
          {clearable && selectedOptions.length > 0 && !disabled && !readOnly && (
            <button
              type="button"
              onClick={handleClear}
              className="flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors p-1"
              tabIndex={-1}
            >
              <X size={16} />
            </button>
          )}
          
          {/* 展开/收起按钮 */}
          <div className="flex items-center justify-center text-gray-400">
            {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </div>
        </div>
        
        {/* 下拉框 */}
        {isOpen && (
          <div
            ref={dropdownRef}
            className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-md shadow-lg z-50"
            style={{ maxHeight }}
          >
            {/* 搜索框 */}
            {searchable && (
              <div className="p-2 border-b border-gray-200">
                <div className="relative">
                  <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => handleSearch(e.target.value)}
                    placeholder={searchPlaceholder}
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:border-blue-500"
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
              </div>
            )}
            
            {/* 选项列表 */}
            <div className="max-h-60 overflow-y-auto">
              {loading ? (
                <div className="px-3 py-2 text-center text-gray-500">
                  {loadingText}
                </div>
              ) : filteredOptions.length === 0 ? (
                <div className="px-3 py-2 text-center text-gray-500">
                  {emptyText}
                </div>
              ) : (
                <>
                  {/* 全选选项 */}
                  {multiple && showSelectAll && filteredOptions.length > 0 && (
                    <div
                      className="flex items-center px-3 py-2 hover:bg-gray-50 cursor-pointer border-b border-gray-200"
                      onClick={handleSelectAll}
                    >
                      <div className="flex items-center gap-2 flex-1">
                        <div className="flex-1">{selectAllText}</div>
                        {isAllSelected && (
                          <Check size={16} className="text-blue-600 flex-shrink-0" />
                        )}
                      </div>
                    </div>
                  )}
                  
                  {/* 选项 */}
                  {filteredOptions.map(option => (
                    <div
                      key={option.value}
                      className={combineClasses(
                        'flex items-center px-3 py-2 cursor-pointer',
                        !option.disabled && 'hover:bg-gray-50',
                        option.disabled && 'opacity-50 cursor-not-allowed',
                        isOptionSelected(option) && !multiple && 'bg-blue-50 text-blue-600'
                      )}
                      onClick={() => handleOptionClick(option)}
                    >
                      {renderOptionItem(option)}
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        )}
      </div>
      
      {/* 帮助文本和错误文本 */}
      {(helperText || errorText) && (
        <div className="text-sm">
          {errorText ? (
            <div className="flex items-center gap-1 text-red-600">
              <span>{errorText}</span>
            </div>
          ) : (
            <div className="text-gray-500">{helperText}</div>
          )}
        </div>
      )}
    </div>
  )
})

Select.displayName = 'Select'

export default Select
