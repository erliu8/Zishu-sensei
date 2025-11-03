/**
 * 主题系统使用示例
 * 
 * 展示如何使用主题 Hook 和 Store
 */

import React, { useEffect, useState } from 'react'
import { useTheme } from '@/hooks/useTheme'
import { useThemeStore } from '@/stores/themeStore'
import type { ThemeMode } from '@/types/app'

/**
 * 示例 1: 基础主题切换
 */
export const BasicThemeExample: React.FC = () => {
    const { theme, isDark, toggleTheme, setTheme } = useTheme()

    return (
        <div style={{ padding: '20px', border: '1px solid #ccc', borderRadius: '8px', marginBottom: '20px' }}>
            <h3>示例 1: 基础主题切换</h3>
            
            <p>当前主题: <strong>{theme}</strong></p>
            <p>是否深色: <strong>{isDark ? '是' : '否'}</strong></p>
            
            <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button onClick={toggleTheme}>
                    切换主题
                </button>
                
                <button onClick={() => setTheme('light')}>
                    浅色
                </button>
                
                <button onClick={() => setTheme('dark')}>
                    深色
                </button>
                
                <button onClick={() => setTheme('dark')}>
                    跟随系统 (深色)
                </button>
            </div>
        </div>
    )
}

/**
 * 示例 2: 主题选择器
 */
export const ThemeSelectorExample: React.FC = () => {
    const { theme, setTheme, isDark } = useTheme()
    const effectiveTheme = isDark ? 'dark' : 'light'
    const systemTheme = 'light' // 默认值

    return (
        <div style={{ padding: '20px', border: '1px solid #ccc', borderRadius: '8px', marginBottom: '20px' }}>
            <h3>示例 2: 主题选择器</h3>
            
            <div style={{ marginBottom: '10px' }}>
                <p>当前设置: <strong>{theme}</strong></p>
                <p>系统主题: <strong>{systemTheme}</strong></p>
                <p>实际主题: <strong>{effectiveTheme}</strong></p>
            </div>
            
            <select 
                value={theme} 
                onChange={(e) => setTheme(e.target.value as any)}
                style={{ padding: '8px', fontSize: '14px' }}
            >
                <option value="light">☀️ 浅色</option>
                <option value="dark">🌙 深色</option>
                <option value="light">💻 跟随系统(浅色)</option>
            </select>
        </div>
    )
}

/**
 * 示例 3: 主题按钮（只读状态）
 */
export const ThemeButtonExample: React.FC = () => {
    const { isDark, toggleTheme } = useTheme()
    const effectiveTheme = isDark ? 'dark' : 'light'
    const cycleTheme = () => toggleTheme() // 简化实现

    return (
        <div style={{ padding: '20px', border: '1px solid #ccc', borderRadius: '8px', marginBottom: '20px' }}>
            <h3>示例 3: 主题按钮</h3>
            
            <p>当前主题: {effectiveTheme} {isDark ? '🌙' : '☀️'}</p>
            
            <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button onClick={toggleTheme}>
                    {isDark ? '切换到浅色' : '切换到深色'}
                </button>
                
                <button onClick={cycleTheme}>
                    循环切换 (light → dark → system)
                </button>
            </div>
        </div>
    )
}

/**
 * 示例 4: 高级设置
 */
export const AdvancedThemeExample: React.FC = () => {
    const theme = useThemeStore((state) => state.theme)
    const setTheme = useThemeStore((state) => state.setTheme)
    const enableTransitions = useThemeStore((state) => state.enableTransitions)
    const setEnableTransitions = useThemeStore((state) => state.setEnableTransitions)
    const autoSwitch = useThemeStore((state) => state.autoSwitch)
    const setAutoSwitch = useThemeStore((state) => state.setAutoSwitch)
    const autoSwitchTime = useThemeStore((state) => state.autoSwitchTime)
    const setAutoSwitchTime = useThemeStore((state) => state.setAutoSwitchTime)

    return (
        <div style={{ padding: '20px', border: '1px solid #ccc', borderRadius: '8px', marginBottom: '20px' }}>
            <h3>示例 4: 高级设置</h3>
            
            <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px' }}>
                    主题模式:
                </label>
                <select 
                    value={theme} 
                    onChange={(e) => setTheme(e.target.value as ThemeMode)}
                    style={{ padding: '8px', fontSize: '14px', width: '200px' }}
                >
                    <option value="light">浅色</option>
                    <option value="dark">深色</option>
                    <option value="system">跟随系统</option>
                </select>
            </div>
            
            <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                        type="checkbox"
                        checked={enableTransitions}
                        onChange={(e) => setEnableTransitions(e.target.checked)}
                    />
                    启用过渡动画
                </label>
            </div>
            
            <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                        type="checkbox"
                        checked={autoSwitch}
                        onChange={(e) => setAutoSwitch(e.target.checked)}
                    />
                    启用自动切换
                </label>
            </div>
            
            {autoSwitch && (
                <div style={{ marginLeft: '24px', padding: '10px', background: '#f5f5f5', borderRadius: '4px' }}>
                    <div style={{ marginBottom: '10px' }}>
                        <label style={{ display: 'block', marginBottom: '5px' }}>
                            浅色主题时间:
                        </label>
                        <input
                            type="time"
                            value={autoSwitchTime.lightTime}
                            onChange={(e) => setAutoSwitchTime(e.target.value, autoSwitchTime.darkTime)}
                            style={{ padding: '4px', fontSize: '14px' }}
                        />
                    </div>
                    
                    <div>
                        <label style={{ display: 'block', marginBottom: '5px' }}>
                            深色主题时间:
                        </label>
                        <input
                            type="time"
                            value={autoSwitchTime.darkTime}
                            onChange={(e) => setAutoSwitchTime(autoSwitchTime.lightTime, e.target.value)}
                            style={{ padding: '4px', fontSize: '14px' }}
                        />
                    </div>
                </div>
            )}
        </div>
    )
}

/**
 * 示例 5: CSS 变量自定义
 */
export const CustomCSSExample: React.FC = () => {
    const updateCSSVariables = useThemeStore((state) => state.updateCSSVariables)
    const resetCSSVariables = useThemeStore((state) => state.resetCSSVariables)
    
    const [primaryColor, setPrimaryColor] = useState('222.2 47.4% 11.2%')

    const applyCustomColors = () => {
        updateCSSVariables({
            '--color-primary': primaryColor,
        })
    }

    return (
        <div style={{ padding: '20px', border: '1px solid #ccc', borderRadius: '8px', marginBottom: '20px' }}>
            <h3>示例 5: CSS 变量自定义</h3>
            
            <div style={{ marginBottom: '10px' }}>
                <label style={{ display: 'block', marginBottom: '5px' }}>
                    主色调 (HSL):
                </label>
                <input
                    type="text"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    placeholder="例如: 220 90% 56%"
                    style={{ padding: '8px', fontSize: '14px', width: '300px' }}
                />
            </div>
            
            <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={applyCustomColors}>
                    应用自定义颜色
                </button>
                
                <button onClick={resetCSSVariables}>
                    重置为默认
                </button>
            </div>
            
            <div style={{ marginTop: '15px', padding: '10px', background: 'hsl(var(--color-primary))', color: 'hsl(var(--color-primary-foreground))', borderRadius: '4px' }}>
                这是使用主色调的示例文本
            </div>
        </div>
    )
}

/**
 * 示例 6: 事件监听
 */
export const EventListenerExample: React.FC = () => {
    const [events, setEvents] = useState<string[]>([])
    const addEventListener = useThemeStore((state) => state.addEventListener)

    useEffect(() => {
        const unsubscribe = addEventListener((event) => {
            const timestamp = new Date().toLocaleTimeString()
            const message = `[${timestamp}] ${event.type}: ${JSON.stringify(event.payload)}`
            setEvents((prev) => [...prev.slice(-4), message]) // 只保留最近 5 条
        })

        return unsubscribe
    }, [addEventListener])

    return (
        <div style={{ padding: '20px', border: '1px solid #ccc', borderRadius: '8px', marginBottom: '20px' }}>
            <h3>示例 6: 事件监听</h3>
            
            <p>主题事件日志（最近 5 条）:</p>
            
            <div style={{ 
                background: '#f5f5f5', 
                padding: '10px', 
                borderRadius: '4px', 
                fontFamily: 'monospace',
                fontSize: '12px',
                maxHeight: '150px',
                overflowY: 'auto'
            }}>
                {events.length === 0 ? (
                    <div style={{ color: '#999' }}>等待事件...</div>
                ) : (
                    events.map((event, index) => (
                        <div key={index} style={{ marginBottom: '5px' }}>
                            {event}
                        </div>
                    ))
                )}
            </div>
            
            <button 
                onClick={() => setEvents([])}
                style={{ marginTop: '10px' }}
            >
                清空日志
            </button>
        </div>
    )
}

/**
 * 完整示例页面
 */
export const ThemeExamplePage: React.FC = () => {
    return (
        <div style={{ 
            maxWidth: '800px', 
            margin: '0 auto', 
            padding: '40px 20px',
            fontFamily: 'system-ui, -apple-system, sans-serif'
        }}>
            <h1 style={{ marginBottom: '30px' }}>主题系统使用示例</h1>
            
            <BasicThemeExample />
            <ThemeSelectorExample />
            <ThemeButtonExample />
            <AdvancedThemeExample />
            <CustomCSSExample />
            <EventListenerExample />
            
            <div style={{ 
                marginTop: '30px', 
                padding: '20px', 
                background: 'hsl(var(--color-muted))', 
                borderRadius: '8px' 
            }}>
                <h4>提示</h4>
                <p style={{ margin: '10px 0' }}>
                    本页面展示了主题系统的各种使用方式。你可以：
                </p>
                <ul style={{ paddingLeft: '20px' }}>
                    <li>使用不同的 Hook 来访问主题状态和方法</li>
                    <li>自定义 CSS 变量来调整主题颜色</li>
                    <li>监听主题变化事件</li>
                    <li>配置自动主题切换</li>
                </ul>
            </div>
        </div>
    )
}

export default ThemeExamplePage

