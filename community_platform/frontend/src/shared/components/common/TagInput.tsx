/**
 * TagInput 标签输入组件
 * 允许用户添加、编辑和删除标签
 */

import { cn } from '@/shared/utils'
import React from 'react'

export interface TagInputProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'> {
  value?: string[]
  onChange?: (tags: string[]) => void
  placeholder?: string
  maxTags?: number
  maxLength?: number
  allowDuplicates?: boolean
  suggestions?: string[]
  disabled?: boolean
}

export const TagInput = React.forwardRef<HTMLDivElement, TagInputProps>(
  (
    {
      className,
      value = [],
      onChange,
      placeholder = '输入标签后按回车',
      maxTags = 10,
      maxLength = 20,
      allowDuplicates = false,
      suggestions = [],
      disabled = false,
      ...props
    },
    ref
  ) => {
    const [tags, setTags] = React.useState<string[]>(value)
    const [inputValue, setInputValue] = React.useState('')
    const [showSuggestions, setShowSuggestions] = React.useState(false)
    const inputRef = React.useRef<HTMLInputElement>(null)

    React.useEffect(() => {
      setTags(value)
    }, [value])

    const filteredSuggestions = React.useMemo(() => {
      if (!inputValue || !showSuggestions) return []
      return suggestions.filter(
        (suggestion) =>
          suggestion.toLowerCase().includes(inputValue.toLowerCase()) &&
          (allowDuplicates || !tags.includes(suggestion))
      )
    }, [inputValue, showSuggestions, suggestions, tags, allowDuplicates])

    const addTag = (tag: string): void => {
      const trimmedTag = tag.trim()

      if (!trimmedTag) return
      if (tags.length >= maxTags) return
      if (!allowDuplicates && tags.includes(trimmedTag)) return
      if (trimmedTag.length > maxLength) return

      const newTags = [...tags, trimmedTag]
      setTags(newTags)
      onChange?.(newTags)
      setInputValue('')
      setShowSuggestions(false)
    }

    const removeTag = (index: number): void => {
      const newTags = tags.filter((_, i) => i !== index)
      setTags(newTags)
      onChange?.(newTags)
    }

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
      if (e.key === 'Enter') {
        e.preventDefault()
        addTag(inputValue)
      } else if (e.key === 'Backspace' && !inputValue && tags.length > 0) {
        removeTag(tags.length - 1)
      } else if (e.key === 'Escape') {
        setShowSuggestions(false)
      }
    }

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
      setInputValue(e.target.value)
      setShowSuggestions(true)
    }

    const handleSuggestionClick = (suggestion: string): void => {
      addTag(suggestion)
      inputRef.current?.focus()
    }

    return (
      <div ref={ref} className={cn('relative w-full', className)} {...props}>
        <div
          className={cn(
            'flex flex-wrap gap-2 p-3 min-h-[42px] rounded-lg border transition-colors',
            'border-gray-300 dark:border-gray-700',
            'bg-white dark:bg-gray-900',
            'focus-within:border-primary-500 focus-within:ring-2 focus-within:ring-primary-500/20',
            disabled && 'opacity-50 cursor-not-allowed bg-gray-50 dark:bg-gray-800'
          )}
          onClick={() => !disabled && inputRef.current?.focus()}
        >
          {tags.map((tag, index) => (
            <span
              key={index}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-sm bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300"
            >
              <span>{tag}</span>
              {!disabled && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    removeTag(index)
                  }}
                  className="hover:text-primary-900 dark:hover:text-primary-100"
                  aria-label={`删除标签 ${tag}`}
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              )}
            </span>
          ))}

          {tags.length < maxTags && (
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              placeholder={tags.length === 0 ? placeholder : ''}
              disabled={disabled}
              maxLength={maxLength}
              className="flex-1 min-w-[120px] outline-none bg-transparent text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500"
            />
          )}
        </div>

        {/* 建议列表 */}
        {filteredSuggestions.length > 0 && (
          <div className="absolute z-10 w-full mt-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg overflow-hidden">
            <ul className="py-1 max-h-48 overflow-y-auto">
              {filteredSuggestions.map((suggestion, index) => (
                <li key={index}>
                  <button
                    type="button"
                    onClick={() => handleSuggestionClick(suggestion)}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    {suggestion}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* 提示信息 */}
        {tags.length >= maxTags && (
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            已达到最大标签数量 ({maxTags})
          </p>
        )}
      </div>
    )
  }
)

TagInput.displayName = 'TagInput'

