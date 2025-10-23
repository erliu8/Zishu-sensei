/**
 * MarkdownToolbar Markdown 编辑器工具栏
 * 提供完整的 Markdown 编辑工具按钮
 */

'use client'

import React from 'react'
import {
  Bold,
  Italic,
  Strikethrough,
  Code,
  Code2,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Link,
  Image,
  Table,
  Minus,
  CheckSquare,
  Superscript,
  Eye,
  EyeOff,
} from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip'
import { Separator } from '@/shared/components/ui/separator'
import { cn } from '@/shared/utils'

export interface MarkdownToolbarProps {
  onAction: (action: MarkdownAction) => void
  disabled?: boolean
  showPreview?: boolean
  onTogglePreview?: () => void
  className?: string
}

export type MarkdownAction =
  | 'bold'
  | 'italic'
  | 'strikethrough'
  | 'code'
  | 'code-block'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'ul'
  | 'ol'
  | 'quote'
  | 'link'
  | 'image'
  | 'table'
  | 'hr'
  | 'task'
  | 'math'

interface ToolbarButton {
  action: MarkdownAction
  icon: React.ComponentType<{ className?: string }>
  label: string
  shortcut?: string
}

const toolbarGroups: ToolbarButton[][] = [
  // 文本格式
  [
    { action: 'bold', icon: Bold, label: '粗体', shortcut: 'Ctrl+B' },
    { action: 'italic', icon: Italic, label: '斜体', shortcut: 'Ctrl+I' },
    { action: 'strikethrough', icon: Strikethrough, label: '删除线', shortcut: 'Ctrl+Shift+S' },
  ],
  // 代码
  [
    { action: 'code', icon: Code, label: '行内代码', shortcut: 'Ctrl+`' },
    { action: 'code-block', icon: Code2, label: '代码块', shortcut: 'Ctrl+Shift+C' },
  ],
  // 标题
  [
    { action: 'h1', icon: Heading1, label: '一级标题', shortcut: 'Ctrl+1' },
    { action: 'h2', icon: Heading2, label: '二级标题', shortcut: 'Ctrl+2' },
    { action: 'h3', icon: Heading3, label: '三级标题', shortcut: 'Ctrl+3' },
  ],
  // 列表
  [
    { action: 'ul', icon: List, label: '无序列表', shortcut: 'Ctrl+Shift+U' },
    { action: 'ol', icon: ListOrdered, label: '有序列表', shortcut: 'Ctrl+Shift+O' },
    { action: 'task', icon: CheckSquare, label: '任务列表', shortcut: 'Ctrl+Shift+T' },
  ],
  // 其他
  [
    { action: 'quote', icon: Quote, label: '引用', shortcut: 'Ctrl+Shift+Q' },
    { action: 'link', icon: Link, label: '链接', shortcut: 'Ctrl+K' },
    { action: 'image', icon: Image, label: '图片', shortcut: 'Ctrl+Shift+I' },
    { action: 'table', icon: Table, label: '表格', shortcut: 'Ctrl+Shift+T' },
    { action: 'hr', icon: Minus, label: '分隔线', shortcut: 'Ctrl+Shift+-' },
    { action: 'math', icon: Superscript, label: '数学公式', shortcut: 'Ctrl+M' },
  ],
]

export const MarkdownToolbar: React.FC<MarkdownToolbarProps> = ({
  onAction,
  disabled = false,
  showPreview = false,
  onTogglePreview,
  className,
}) => {
  const handleAction = (action: MarkdownAction) => {
    if (!disabled) {
      onAction(action)
    }
  }

  return (
    <TooltipProvider>
      <div
        className={cn(
          'flex items-center gap-1 px-3 py-2 bg-gray-50 dark:bg-gray-800 border-b border-gray-300 dark:border-gray-700 overflow-x-auto',
          className
        )}
      >
        {toolbarGroups.map((group, groupIndex) => (
          <React.Fragment key={groupIndex}>
            {groupIndex > 0 && (
              <Separator orientation="vertical" className="h-6 mx-1" />
            )}
            <div className="flex items-center gap-0.5">
              {group.map((button) => (
                <Tooltip key={button.action}>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleAction(button.action)}
                      disabled={disabled}
                      className={cn(
                        'h-8 w-8 p-0',
                        'hover:bg-gray-200 dark:hover:bg-gray-700',
                        disabled && 'opacity-50 cursor-not-allowed'
                      )}
                    >
                      <button.icon className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="text-center">
                      <div className="font-medium">{button.label}</div>
                      {button.shortcut && (
                        <div className="text-xs text-gray-400 mt-1">
                          {button.shortcut}
                        </div>
                      )}
                    </div>
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>
          </React.Fragment>
        ))}

        {/* 预览切换按钮 */}
        {onTogglePreview && (
          <>
            <Separator orientation="vertical" className="h-6 mx-1" />
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant={showPreview ? 'default' : 'ghost'}
                  size="sm"
                  onClick={onTogglePreview}
                  disabled={disabled}
                  className={cn(
                    'h-8 px-3 gap-2',
                    !showPreview && 'hover:bg-gray-200 dark:hover:bg-gray-700'
                  )}
                >
                  {showPreview ? (
                    <>
                      <EyeOff className="h-4 w-4" />
                      <span className="text-xs">编辑</span>
                    </>
                  ) : (
                    <>
                      <Eye className="h-4 w-4" />
                      <span className="text-xs">预览</span>
                    </>
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <div className="font-medium">
                  {showPreview ? '返回编辑' : '预览内容'}
                </div>
              </TooltipContent>
            </Tooltip>
          </>
        )}
      </div>
    </TooltipProvider>
  )
}

