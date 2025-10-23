/**
 * SearchBar 搜索栏组件
 * 提供搜索输入框，支持搜索建议和快捷键
 */

import { cn } from '@/shared/utils'
import React from 'react'

export interface SearchBarProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  onSearch?: (value: string) => void
  onClear?: () => void
  loading?: boolean
  size?: 'sm' | 'md' | 'lg'
  suggestions?: string[]
  onSuggestionClick?: (suggestion: string) => void
}

const sizeClasses = {
  sm: 'h-8 text-sm',
  md: 'h-10 text-base',
  lg: 'h-12 text-lg',
}

export const SearchBar = React.forwardRef<HTMLInputElement, SearchBarProps>(
  (
    {
      className,
      onSearch,
      onClear,
      loading = false,
      size = 'md',
      suggestions = [],
      onSuggestionClick,
      value: controlledValue,
      onChange,
      ...props
    },
    ref
  ) => {
    const [value, setValue] = React.useState(controlledValue || '')
    const [showSuggestions, setShowSuggestions] = React.useState(false)
    const inputRef = React.useRef<HTMLInputElement>(null)
    const wrapperRef = React.useRef<HTMLDivElement>(null)

    React.useImperativeHandle(ref, () => inputRef.current!)

    React.useEffect(() => {
      if (controlledValue !== undefined) {
        setValue(controlledValue)
      }
    }, [controlledValue])

    React.useEffect(() => {
      const handleClickOutside = (event: MouseEvent): void => {
        if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
          setShowSuggestions(false)
        }
      }

      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
      const newValue = e.target.value
      setValue(newValue)
      onChange?.(e)
      setShowSuggestions(true)
    }

    const handleSubmit = (e: React.FormEvent): void => {
      e.preventDefault()
      onSearch?.(value as string)
      setShowSuggestions(false)
    }

    const handleClear = (): void => {
      setValue('')
      onClear?.()
      inputRef.current?.focus()
      setShowSuggestions(false)
    }

    const handleSuggestionClick = (suggestion: string): void => {
      setValue(suggestion)
      onSuggestionClick?.(suggestion)
      setShowSuggestions(false)
      inputRef.current?.focus()
    }

    const hasValue = value && String(value).length > 0
    const showSuggestionsList = showSuggestions && suggestions.length > 0 && hasValue

    return (
      <div ref={wrapperRef} className={cn('relative w-full', className)}>
        <form onSubmit={handleSubmit} className="relative">
          <div className="relative flex items-center">
            <input
              ref={inputRef}
              type="search"
              value={value}
              onChange={handleChange}
              onFocus={() => setShowSuggestions(true)}
              className={cn(
                'w-full rounded-lg border border-gray-300 bg-white px-10 py-2 transition-colors',
                'placeholder:text-gray-400',
                'focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20',
                'dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:placeholder:text-gray-500',
                sizeClasses[size]
              )}
              {...props}
            />
            
            {/* 搜索图标 */}
            <div className="absolute left-3 flex items-center pointer-events-none text-gray-400">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>

            {/* 加载或清除按钮 */}
            <div className="absolute right-3 flex items-center">
              {loading ? (
                <div className="animate-spin text-gray-400">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                </div>
              ) : hasValue ? (
                <button
                  type="button"
                  onClick={handleClear}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                  aria-label="清除搜索"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              ) : null}
            </div>
          </div>
        </form>

        {/* 搜索建议列表 */}
        {showSuggestionsList && (
          <div className="absolute z-10 w-full mt-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg overflow-hidden">
            <ul className="py-2">
              {suggestions.map((suggestion, index) => (
                <li key={index}>
                  <button
                    type="button"
                    onClick={() => handleSuggestionClick(suggestion)}
                    className="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-sm"
                  >
                    {suggestion}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    )
  }
)

SearchBar.displayName = 'SearchBar'

