/**
 * CodeBlock 代码块组件
 * 显示带语法高亮的代码块，支持复制功能
 */

import { cn } from '@/shared/utils'
import React from 'react'

export interface CodeBlockProps extends React.HTMLAttributes<HTMLDivElement> {
  code: string
  language?: string
  showLineNumbers?: boolean
  highlightLines?: number[]
  filename?: string
  copyable?: boolean
}

export const CodeBlock = React.forwardRef<HTMLDivElement, CodeBlockProps>(
  (
    {
      className,
      code,
      language = 'text',
      showLineNumbers = true,
      highlightLines = [],
      filename,
      copyable = true,
      ...props
    },
    ref
  ) => {
    const [copied, setCopied] = React.useState(false)

    const handleCopy = async (): Promise<void> => {
      try {
        await navigator.clipboard.writeText(code)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      } catch (err) {
        console.error('Failed to copy code:', err)
      }
    }

    const lines = code.split('\n')

    return (
      <div
        ref={ref}
        className={cn(
          'relative rounded-lg bg-gray-900 dark:bg-gray-950 text-gray-100 overflow-hidden',
          className
        )}
        {...props}
      >
        {/* 头部 */}
        {(filename || copyable) && (
          <div className="flex items-center justify-between px-4 py-2 bg-gray-800 dark:bg-gray-900 border-b border-gray-700">
            <div className="flex items-center space-x-2">
              {filename && (
                <span className="text-sm text-gray-300">{filename}</span>
              )}
              {language && !filename && (
                <span className="text-xs text-gray-400 uppercase">{language}</span>
              )}
            </div>
            {copyable && (
              <button
                type="button"
                onClick={handleCopy}
                className="px-3 py-1 text-xs text-gray-300 hover:text-white bg-gray-700 hover:bg-gray-600 rounded transition-colors"
              >
                {copied ? '已复制' : '复制代码'}
              </button>
            )}
          </div>
        )}

        {/* 代码内容 */}
        <div className="overflow-x-auto">
          <pre className="p-4">
            <code className={`language-${language}`}>
              {showLineNumbers ? (
                <div className="flex">
                  {/* 行号 */}
                  <div className="select-none pr-4 text-right text-gray-500 border-r border-gray-700">
                    {lines.map((_, index) => (
                      <div key={index}>{index + 1}</div>
                    ))}
                  </div>
                  {/* 代码 */}
                  <div className="pl-4 flex-1">
                    {lines.map((line, index) => (
                      <div
                        key={index}
                        className={cn(
                          highlightLines.includes(index + 1) &&
                            'bg-yellow-500/10 -mx-4 px-4 border-l-2 border-yellow-500'
                        )}
                      >
                        {line || '\n'}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                code
              )}
            </code>
          </pre>
        </div>
      </div>
    )
  }
)

CodeBlock.displayName = 'CodeBlock'

// InlineCode 行内代码组件
export interface InlineCodeProps extends React.HTMLAttributes<HTMLElement> {}

export const InlineCode = React.forwardRef<HTMLElement, InlineCodeProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <code
        ref={ref}
        className={cn(
          'px-1.5 py-0.5 rounded text-sm font-mono',
          'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
          className
        )}
        {...props}
      >
        {children}
      </code>
    )
  }
)

InlineCode.displayName = 'InlineCode'

