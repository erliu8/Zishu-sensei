/**
 * 主题设置组件
 * 提供完整的主题配置界面
 */

'use client'

import React from 'react'
import { useTheme } from '@/infrastructure/hooks/useTheme'
import { ThemeSelector } from './ThemeToggle'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Label } from '@/shared/components/ui/label'
import { Switch } from '@/shared/components/ui/switch'
import { Separator } from '@/shared/components/ui/separator'

/**
 * ThemeSettings Props
 */
interface ThemeSettingsProps {
  /** 自定义类名 */
  className?: string
}

/**
 * 主题设置组件
 */
export function ThemeSettings({ className }: ThemeSettingsProps) {
  const { 
    theme, 
    resolvedTheme, 
    isSystem,
    enableTransitions,
    disableTransitions,
  } = useTheme()

  const [transitionsEnabled, setTransitionsEnabled] = React.useState(true)

  const handleTransitionsToggle = (enabled: boolean) => {
    setTransitionsEnabled(enabled)
    if (enabled) {
      enableTransitions()
    } else {
      disableTransitions()
    }
  }

  return (
    <div className={className}>
      <Card>
        <CardHeader>
          <CardTitle>主题设置</CardTitle>
          <CardDescription>
            选择你喜欢的主题样式，让界面更符合你的使用习惯
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 主题选择器 */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">主题外观</Label>
            <ThemeSelector />
          </div>

          <Separator />

          {/* 当前主题信息 */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">当前主题</Label>
            <div className="rounded-lg bg-muted p-4 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">选择的主题:</span>
                <span className="font-medium capitalize">{theme}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">实际应用:</span>
                <span className="font-medium capitalize">{resolvedTheme}</span>
              </div>
              {isSystem && (
                <div className="mt-2 text-xs text-muted-foreground">
                  当前跟随系统主题设置
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* 主题选项 */}
          <div className="space-y-4">
            <Label className="text-base font-semibold">主题选项</Label>
            
            {/* 过渡动画 */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="transitions" className="text-sm font-medium">
                  启用过渡动画
                </Label>
                <div className="text-xs text-muted-foreground">
                  主题切换时显示平滑过渡效果
                </div>
              </div>
              <Switch
                id="transitions"
                checked={transitionsEnabled}
                onCheckedChange={handleTransitionsToggle}
              />
            </div>
          </div>

          <Separator />

          {/* 主题预览 */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">颜色预览</Label>
            <div className="grid grid-cols-4 gap-3 sm:grid-cols-6">
              {[
                { name: '主色', var: 'primary' },
                { name: '辅助', var: 'secondary' },
                { name: '强调', var: 'accent' },
                { name: '成功', var: 'success' },
                { name: '警告', var: 'warning' },
                { name: '错误', var: 'error' },
              ].map((color) => (
                <div key={color.var} className="space-y-2">
                  <div
                    className="h-12 rounded-md border shadow-sm"
                    style={{
                      backgroundColor: `hsl(var(--${color.var}))`,
                    }}
                  />
                  <p className="text-xs text-center text-muted-foreground">
                    {color.name}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* 提示信息 */}
          <div className="rounded-lg bg-muted/50 p-4">
            <div className="flex gap-3">
              <div className="flex-shrink-0">💡</div>
              <div className="space-y-1 text-sm">
                <p className="font-medium">提示</p>
                <p className="text-muted-foreground">
                  选择"跟随系统"可以让主题自动适应你的操作系统设置。
                  暗色主题在夜间使用可以减少眼睛疲劳。
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

/**
 * 紧凑型主题设置组件
 */
export function CompactThemeSettings({ className }: ThemeSettingsProps) {
  const { theme, resolvedTheme } = useTheme()

  return (
    <div className={className}>
      <div className="space-y-4">
        <div>
          <Label className="text-sm font-medium">主题</Label>
          <div className="mt-2">
            <ThemeSelector />
          </div>
        </div>

        <div className="rounded-lg bg-muted/50 p-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">当前:</span>
            <span className="font-medium capitalize">{theme}</span>
          </div>
          <div className="flex items-center justify-between mt-1">
            <span className="text-muted-foreground">应用:</span>
            <span className="font-medium capitalize">{resolvedTheme}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

