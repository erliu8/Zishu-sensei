/**
 * Markdown 渲染器组件
 * 
 * 功能：
 * - 完整的 GitHub Flavored Markdown (GFM) 支持
 * - 代码语法高亮
 * - 表格支持
 * - 任务列表
 * - 自动链接
 * - 数学公式（可选）
 * - 安全的 HTML 渲染
 */

import React, { memo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import rehypeSanitize from 'rehype-sanitize'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus, vs } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { Copy, Check } from 'lucide-react'
import clsx from 'clsx'
import styles from './MarkdownRenderer.module.css'

// ==================== 类型定义 ====================

export interface MarkdownRendererProps {
  /** Markdown 内容 */
  content: string
  /** 是否使用暗色主题 */
  darkMode?: boolean
  /** 自定义类名 */
  className?: string
  /** 是否启用代码复制按钮 */
  enableCodeCopy?: boolean
  /** 是否显示行号 */
  showLineNumbers?: boolean
  /** 最大高度（超出滚动） */
  maxHeight?: number
  /** 代码块样式主题 */
  codeTheme?: 'dark' | 'light'
}

interface CodeBlockProps {
  inline?: boolean
  className?: string
  children?: React.ReactNode
  node?: any
}

// ==================== 子组件 ====================

/**
 * 代码块组件
 */
const CodeBlock: React.FC<CodeBlockProps & { 
  darkMode: boolean
  enableCodeCopy: boolean
  showLineNumbers: boolean
}> = memo(({ 
  inline, 
  className, 
  children, 
  darkMode,
  enableCodeCopy,
  showLineNumbers,
  ...props 
}) => {
  const [copied, setCopied] = React.useState(false)
  
  // 提取语言
  const match = /language-(\w+)/.exec(className || '')
  const language = match ? match[1] : ''
  
  // 提取代码内容
  const codeContent = String(children).replace(/\n$/, '')

  // 复制代码
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(codeContent)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('Failed to copy code:', error)
    }
  }

  // 行内代码
  if (inline) {
    return (
      <code className={clsx(styles.inlineCode, className)} {...props}>
        {children}
      </code>
    )
  }

  // 代码块
  return (
    <div className={styles.codeBlockContainer}>
      <div className={styles.codeBlockHeader}>
        <span className={styles.codeBlockLanguage}>
          {language || 'text'}
        </span>
        {enableCodeCopy && (
          <button
            onClick={handleCopy}
            className={styles.copyButton}
            title={copied ? '已复制!' : '复制代码'}
          >
            {copied ? (
              <>
                <Check size={14} />
                <span>已复制</span>
              </>
            ) : (
              <>
                <Copy size={14} />
                <span>复制</span>
              </>
            )}
          </button>
        )}
      </div>
      <SyntaxHighlighter
        style={darkMode ? vscDarkPlus : vs}
        language={language || 'text'}
        showLineNumbers={showLineNumbers}
        wrapLines
        customStyle={{
          margin: 0,
          borderRadius: '0 0 8px 8px',
          fontSize: '13px',
        }}
        codeTagProps={{
          className: styles.codeTag
        }}
        {...props}
      >
        {codeContent}
      </SyntaxHighlighter>
    </div>
  )
})

CodeBlock.displayName = 'CodeBlock'

// ==================== 主组件 ====================

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = memo(({
  content,
  darkMode = false,
  className,
  enableCodeCopy = true,
  showLineNumbers = false,
  maxHeight,
  codeTheme,
}) => {
  const effectiveDarkMode = codeTheme === 'dark' || (codeTheme === undefined && darkMode)

  return (
    <div
      className={clsx(
        styles.markdownRenderer,
        effectiveDarkMode && styles.darkMode,
        className
      )}
      style={{ maxHeight: maxHeight ? `${maxHeight}px` : undefined }}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw, rehypeSanitize]}
        components={{
          // 代码块
          code: (props) => (
            <CodeBlock
              {...props}
              darkMode={effectiveDarkMode}
              enableCodeCopy={enableCodeCopy}
              showLineNumbers={showLineNumbers}
            />
          ),
          
          // 链接 - 在新标签页打开
          a: ({ node, ...props }) => (
            <a
              {...props}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.link}
            />
          ),
          
          // 表格
          table: ({ node, ...props }) => (
            <div className={styles.tableWrapper}>
              <table className={styles.table} {...props} />
            </div>
          ),
          
          // 表格头
          thead: ({ node, ...props }) => (
            <thead className={styles.tableHead} {...props} />
          ),
          
          // 表格行
          tr: ({ node, ...props }) => (
            <tr className={styles.tableRow} {...props} />
          ),
          
          // 表格单元格
          td: ({ node, ...props }) => (
            <td className={styles.tableCell} {...props} />
          ),
          
          th: ({ node, ...props }) => (
            <th className={styles.tableHeader} {...props} />
          ),
          
          // 引用块
          blockquote: ({ node, ...props }) => (
            <blockquote className={styles.blockquote} {...props} />
          ),
          
          // 标题
          h1: ({ node, ...props }) => (
            <h1 className={styles.heading1} {...props} />
          ),
          h2: ({ node, ...props }) => (
            <h2 className={styles.heading2} {...props} />
          ),
          h3: ({ node, ...props }) => (
            <h3 className={styles.heading3} {...props} />
          ),
          h4: ({ node, ...props }) => (
            <h4 className={styles.heading4} {...props} />
          ),
          h5: ({ node, ...props }) => (
            <h5 className={styles.heading5} {...props} />
          ),
          h6: ({ node, ...props }) => (
            <h6 className={styles.heading6} {...props} />
          ),
          
          // 列表
          ul: ({ node, ...props }) => (
            <ul className={styles.unorderedList} {...props} />
          ),
          ol: ({ node, ...props }) => (
            <ol className={styles.orderedList} {...props} />
          ),
          li: ({ node, ...props }) => (
            <li className={styles.listItem} {...props} />
          ),
          
          // 分隔线
          hr: ({ node, ...props }) => (
            <hr className={styles.horizontalRule} {...props} />
          ),
          
          // 图片
          img: ({ node, ...props }) => (
            <img
              {...props}
              className={styles.image}
              loading="lazy"
              alt={props.alt || '图片'}
            />
          ),
          
          // 段落
          p: ({ node, ...props }) => (
            <p className={styles.paragraph} {...props} />
          ),
          
          // 强调
          strong: ({ node, ...props }) => (
            <strong className={styles.strong} {...props} />
          ),
          em: ({ node, ...props }) => (
            <em className={styles.emphasis} {...props} />
          ),
          
          // 删除线
          del: ({ node, ...props }) => (
            <del className={styles.strikethrough} {...props} />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
})

MarkdownRenderer.displayName = 'MarkdownRenderer'

export default MarkdownRenderer

