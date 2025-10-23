/**
 * MarkdownViewer Markdown 查看器组件
 * 使用 react-markdown 渲染 Markdown 内容
 * 支持：代码高亮、表格、数学公式、GitHub 风格 Markdown
 */

'use client'

import React, { useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeHighlight from 'rehype-highlight'
import rehypeKatex from 'rehype-katex'
import rehypeRaw from 'rehype-raw'
import { cn } from '@/shared/utils'

// 导入样式
import 'highlight.js/styles/github-dark.css'
import 'katex/dist/katex.min.css'

export interface MarkdownViewerProps extends React.HTMLAttributes<HTMLDivElement> {
  content: string
  className?: string
  enableMath?: boolean // 是否启用数学公式支持
  enableRaw?: boolean // 是否支持原始 HTML
}

export const MarkdownViewer = React.forwardRef<HTMLDivElement, MarkdownViewerProps>(
  ({ className, content, enableMath = true, enableRaw = false, ...props }, ref) => {
    // 配置插件
    const remarkPlugins = useMemo(() => {
      const plugins: any[] = [remarkGfm]
      if (enableMath) {
        plugins.push(remarkMath)
      }
      return plugins
    }, [enableMath])

    const rehypePlugins = useMemo(() => {
      const plugins: any[] = [
        [
          rehypeHighlight,
          {
            detect: true,
            ignoreMissing: true,
          },
        ],
      ]
      if (enableMath) {
        plugins.push(rehypeKatex)
      }
      if (enableRaw) {
        plugins.push(rehypeRaw)
      }
      return plugins
    }, [enableMath, enableRaw])

    return (
      <div
        ref={ref}
        className={cn(
          'prose prose-sm dark:prose-invert max-w-none',
          // 标题样式
          'prose-headings:font-semibold prose-h1:text-3xl prose-h2:text-2xl prose-h3:text-xl',
          'prose-h1:mt-8 prose-h1:mb-4 prose-h2:mt-6 prose-h2:mb-3 prose-h3:mt-4 prose-h3:mb-2',
          // 段落样式
          'prose-p:text-gray-700 dark:prose-p:text-gray-300 prose-p:leading-relaxed',
          // 链接样式
          'prose-a:text-primary-600 dark:prose-a:text-primary-400 prose-a:no-underline hover:prose-a:underline',
          // 代码样式
          'prose-code:text-sm prose-code:bg-gray-100 dark:prose-code:bg-gray-800 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded',
          'prose-code:before:content-none prose-code:after:content-none',
          // 代码块样式
          'prose-pre:bg-gray-900 dark:prose-pre:bg-gray-950 prose-pre:border prose-pre:border-gray-700',
          'prose-pre:overflow-x-auto prose-pre:rounded-lg',
          // 引用样式
          'prose-blockquote:border-l-4 prose-blockquote:border-gray-300 dark:prose-blockquote:border-gray-700',
          'prose-blockquote:bg-gray-50 dark:prose-blockquote:bg-gray-800/50 prose-blockquote:px-4 prose-blockquote:py-2',
          'prose-blockquote:not-italic prose-blockquote:text-gray-600 dark:prose-blockquote:text-gray-400',
          // 列表样式
          'prose-ul:list-disc prose-ol:list-decimal',
          'prose-li:text-gray-700 dark:prose-li:text-gray-300',
          // 表格样式
          'prose-table:border-collapse prose-table:w-full',
          'prose-th:bg-gray-100 dark:prose-th:bg-gray-800 prose-th:px-4 prose-th:py-2 prose-th:text-left prose-th:font-semibold',
          'prose-td:border prose-td:border-gray-300 dark:prose-td:border-gray-700 prose-td:px-4 prose-td:py-2',
          'prose-tr:border-b prose-tr:border-gray-300 dark:prose-tr:border-gray-700',
          // 图片样式
          'prose-img:rounded-lg prose-img:shadow-md',
          // 水平线样式
          'prose-hr:border-gray-300 dark:prose-hr:border-gray-700',
          className
        )}
        {...props}
      >
        {content ? (
          <ReactMarkdown
            remarkPlugins={remarkPlugins}
            rehypePlugins={rehypePlugins}
            components={{
              // 自定义代码块渲染
              code({ node, inline, className, children, ...props }: any) {
                const match = /language-(\w+)/.exec(className || '')
                const language = match ? match[1] : ''

                if (inline) {
                  return (
                    <code className={className} {...props}>
                      {children}
                    </code>
                  )
                }

                return (
                  <div className="relative group">
                    {language && (
                      <div className="absolute top-2 right-2 text-xs text-gray-400 bg-gray-800 px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                        {language}
                      </div>
                    )}
                    <pre className={className}>
                      <code className={`language-${language}`} {...props}>
                        {children}
                      </code>
                    </pre>
                  </div>
                )
              },
              // 自定义表格渲染
              table({ children, ...props }) {
                return (
                  <div className="overflow-x-auto my-6">
                    <table className="min-w-full divide-y divide-gray-300 dark:divide-gray-700" {...props}>
                      {children}
                    </table>
                  </div>
                )
              },
              // 自定义链接渲染（添加安全属性）
              a({ children, href, ...props }) {
                return (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300"
                    {...props}
                  >
                    {children}
                  </a>
                )
              },
              // 自定义图片渲染（添加懒加载）
              img({ src, alt, ...props }) {
                return (
                  <img
                    src={src}
                    alt={alt || ''}
                    loading="lazy"
                    className="max-w-full h-auto rounded-lg shadow-md my-4"
                    {...props}
                  />
                )
              },
            }}
          >
            {content}
          </ReactMarkdown>
        ) : (
          <p className="text-gray-400 dark:text-gray-500 italic">暂无内容</p>
        )}
      </div>
    )
  }
)

MarkdownViewer.displayName = 'MarkdownViewer'
