/**
 * 键盘快捷键帮助组件
 * Keyboard Shortcut Help Component
 */

'use client';

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { cn } from '@/shared/utils/cn';
import { KEYBOARD_KEYS } from '@/shared/utils/accessibility';

interface KeyboardShortcut {
  /** 快捷键组合 */
  keys: string[];
  /** 描述 */
  description: string;
  /** 分类 */
  category?: string;
}

interface KeyboardShortcutHelpProps {
  /** 快捷键列表 */
  shortcuts: KeyboardShortcut[];
  /** 触发按钮文本 */
  triggerText?: string;
  /** 对话框标题 */
  title?: string;
}

export function KeyboardShortcutHelp({
  shortcuts,
  triggerText = '键盘快捷键',
  title = '键盘快捷键',
}: KeyboardShortcutHelpProps) {
  const [open, setOpen] = useState(false);

  // 按分类分组
  const groupedShortcuts = shortcuts.reduce(
    (acc, shortcut) => {
      const category = shortcut.category || '通用';
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(shortcut);
      return acc;
    },
    {} as Record<string, KeyboardShortcut[]>
  );

  // 监听 ? 键打开帮助
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '?' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const target = e.target as HTMLElement;
        // 不在输入框中时才触发
        if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') {
          e.preventDefault();
          setOpen(true);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" aria-label={triggerText}>
          <span className="sr-only">{triggerText}</span>
          <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
            ?
          </kbd>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-6">
          {Object.entries(groupedShortcuts).map(([category, categoryShortcuts]) => (
            <div key={category}>
              <h3 className="mb-3 text-sm font-semibold">{category}</h3>
              <div className="space-y-2">
                {categoryShortcuts.map((shortcut, index) => (
                  <div key={index} className="flex items-center justify-between gap-4">
                    <span className="text-sm text-muted-foreground">{shortcut.description}</span>
                    <div className="flex items-center gap-1">
                      {shortcut.keys.map((key, keyIndex) => (
                        <React.Fragment key={keyIndex}>
                          {keyIndex > 0 && <span className="text-xs text-muted-foreground">+</span>}
                          <kbd className="inline-flex h-5 min-w-[20px] items-center justify-center rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                            {formatKey(key)}
                          </kbd>
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * 格式化键名显示
 */
function formatKey(key: string): string {
  const keyMap: Record<string, string> = {
    Control: 'Ctrl',
    Meta: '⌘',
    Shift: '⇧',
    Alt: '⌥',
    Enter: '↵',
    Escape: 'Esc',
    ArrowUp: '↑',
    ArrowDown: '↓',
    ArrowLeft: '←',
    ArrowRight: '→',
    ' ': 'Space',
  };

  return keyMap[key] || key.toUpperCase();
}

/**
 * 键盘快捷键指示器
 * 在元素旁边显示快捷键提示
 */
interface KeyboardShortcutIndicatorProps {
  keys: string[];
  className?: string;
}

export function KeyboardShortcutIndicator({ keys, className }: KeyboardShortcutIndicatorProps) {
  return (
    <span className={cn('inline-flex items-center gap-1', className)}>
      {keys.map((key, index) => (
        <React.Fragment key={index}>
          {index > 0 && <span className="text-xs text-muted-foreground">+</span>}
          <kbd className="inline-flex h-4 min-w-[16px] items-center justify-center rounded border bg-muted px-1 font-mono text-[9px] font-medium text-muted-foreground">
            {formatKey(key)}
          </kbd>
        </React.Fragment>
      ))}
    </span>
  );
}

