/**
 * 快捷键辅助函数
 * 
 * 提供快捷键字符串转换、验证等实用工具
 */

import type { ShortcutConfig, ShortcutString, ModifierKeys, Platform } from '@/types/shortcuts'
import { getCurrentPlatform, getPlatformModifierName } from '@/config/shortcutPresets'
import { RESERVED_SHORTCUTS } from '@/types/shortcuts'

/**
 * 将快捷键配置转换为字符串
 * 
 * @example
 * ```ts
 * shortcutToString({ key: 'K', modifiers: { ctrl: true } }) // "Ctrl+K"
 * ```
 */
export function shortcutToString(config: Pick<ShortcutConfig, 'key' | 'modifiers'>): ShortcutString {
    const { key, modifiers } = config
    const parts: string[] = []

    // 防御性检查：如果 modifiers 或 key 未定义，返回空字符串
    if (!modifiers || !key) {
        return ''
    }

    if (modifiers.ctrl) parts.push('Ctrl')
    if (modifiers.alt) parts.push('Alt')
    if (modifiers.shift) parts.push('Shift')
    if (modifiers.meta) parts.push('Meta')
    
    parts.push(key)
    
    return parts.join('+')
}

/**
 * 将快捷键配置转换为显示字符串（带平台特定名称）
 * 
 * @example
 * ```ts
 * shortcutToDisplayString({ key: 'K', modifiers: { ctrl: true } }) 
 * // macOS: "⌘ Cmd+K"
 * // Windows: "Ctrl+K"
 * ```
 */
export function shortcutToDisplayString(config: Pick<ShortcutConfig, 'key' | 'modifiers'>): string {
    const { key, modifiers } = config
    const parts: string[] = []

    if (modifiers.ctrl) parts.push(getPlatformModifierName('ctrl'))
    if (modifiers.alt) parts.push(getPlatformModifierName('alt'))
    if (modifiers.shift) parts.push(getPlatformModifierName('shift'))
    if (modifiers.meta) parts.push(getPlatformModifierName('meta'))
    
    // 特殊按键的显示名称
    const keyDisplayNames: Record<string, string> = {
        'ArrowUp': '↑',
        'ArrowDown': '↓',
        'ArrowLeft': '←',
        'ArrowRight': '→',
        'Enter': '↵ Enter',
        'Escape': 'Esc',
        'Backspace': '⌫',
        'Delete': '⌦ Del',
        'Tab': '⇥ Tab',
        'Space': '␣ Space',
    }
    
    parts.push(keyDisplayNames[key] || key.toUpperCase())
    
    return parts.join('+')
}

/**
 * 解析快捷键字符串
 * 
 * @example
 * ```ts
 * parseShortcutString('Ctrl+Shift+K') 
 * // { key: 'K', modifiers: { ctrl: true, shift: true } }
 * ```
 */
export function parseShortcutString(shortcutString: string): { key: string; modifiers: ModifierKeys } {
    const parts = shortcutString.split('+').map(p => p.trim())
    const modifiers: ModifierKeys = {
        ctrl: false,
        alt: false,
        shift: false,
        meta: false,
    }
    
    let key = ''
    
    parts.forEach(part => {
        const lowerPart = part.toLowerCase()
        if (lowerPart === 'ctrl' || lowerPart === 'control') {
            modifiers.ctrl = true
        } else if (lowerPart === 'alt' || lowerPart === 'option') {
            modifiers.alt = true
        } else if (lowerPart === 'shift') {
            modifiers.shift = true
        } else if (lowerPart === 'meta' || lowerPart === 'cmd' || lowerPart === 'command' || lowerPart === 'win' || lowerPart === 'windows') {
            modifiers.meta = true
        } else {
            key = part
        }
    })
    
    return { key, modifiers }
}

/**
 * 检查快捷键是否为保留快捷键
 */
export function isReservedShortcut(shortcutString: ShortcutString): boolean {
    return RESERVED_SHORTCUTS.includes(shortcutString)
}

/**
 * 检查快捷键配置是否有效
 */
export function isValidShortcutConfig(config: Partial<ShortcutConfig>): boolean {
    if (!config.id || !config.name || !config.key) {
        return false
    }
    
    // 检查 key 是否有效（非空且不是特殊字符）
    if (typeof config.key !== 'string' || config.key.length === 0) {
        return false
    }
    
    // 检查是否至少有一个修饰键（对于单字符按键）
    if (config.key.length === 1 && config.modifiers) {
        const hasModifier = 
            config.modifiers.ctrl || 
            config.modifiers.alt || 
            config.modifiers.shift || 
            config.modifiers.meta
        
        if (!hasModifier) {
            return false
        }
    }
    
    return true
}

/**
 * 比较两个快捷键配置是否相同
 */
export function areShortcutsEqual(
    a: Pick<ShortcutConfig, 'key' | 'modifiers'>,
    b: Pick<ShortcutConfig, 'key' | 'modifiers'>
): boolean {
    return (
        a.key.toLowerCase() === b.key.toLowerCase() &&
        a.modifiers.ctrl === b.modifiers.ctrl &&
        a.modifiers.alt === b.modifiers.alt &&
        a.modifiers.shift === b.modifiers.shift &&
        a.modifiers.meta === b.modifiers.meta
    )
}

/**
 * 获取快捷键配置的哈希值（用于冲突检测）
 */
export function getShortcutHash(config: Pick<ShortcutConfig, 'key' | 'modifiers' | 'scope'>): string {
    return `${config.scope}:${shortcutToString(config)}`
}

/**
 * 格式化快捷键分类名称
 */
export function formatCategoryName(category: string): string {
    const categoryNames: Record<string, string> = {
        'window': '窗口管理',
        'chat': '聊天对话',
        'character': '角色管理',
        'settings': '设置',
        'navigation': '导航',
        'system': '系统',
        'custom': '自定义',
    }
    
    return categoryNames[category] || category
}

/**
 * 获取快捷键作用域的显示名称
 */
export function formatScopeName(scope: string): string {
    const scopeNames: Record<string, string> = {
        'global': '全局',
        'local': '本地',
        'window': '窗口',
    }
    
    return scopeNames[scope] || scope
}

/**
 * 检查键盘事件是否匹配快捷键配置
 */
export function matchesKeyboardEvent(
    event: KeyboardEvent,
    config: Pick<ShortcutConfig, 'key' | 'modifiers'>
): boolean {
    // 检查主键
    if (event.key.toLowerCase() !== config.key.toLowerCase()) {
        return false
    }
    
    // 检查修饰键
    const modifiers = config.modifiers
    if (event.ctrlKey !== (modifiers.ctrl || false)) return false
    if (event.altKey !== (modifiers.alt || false)) return false
    if (event.shiftKey !== (modifiers.shift || false)) return false
    if (event.metaKey !== (modifiers.meta || false)) return false
    
    return true
}

/**
 * 从键盘事件创建快捷键配置
 */
export function createShortcutFromEvent(event: KeyboardEvent): Pick<ShortcutConfig, 'key' | 'modifiers'> {
    return {
        key: event.key,
        modifiers: {
            ctrl: event.ctrlKey,
            alt: event.altKey,
            shift: event.shiftKey,
            meta: event.metaKey,
        },
    }
}

/**
 * 验证快捷键字符串格式
 */
export function isValidShortcutString(str: string): boolean {
    if (!str || typeof str !== 'string') {
        return false
    }
    
    // 拒绝只包含空白字符的字符串
    if (str.trim().length === 0) {
        return false
    }
    
    const parts = str.split('+').map(p => p.trim())
    
    // 至少要有一个按键
    if (parts.length === 0) {
        return false
    }
    
    // 最后一个部分应该是主键，且不能为空
    const key = parts[parts.length - 1]
    if (!key || key.length === 0) {
        return false
    }
    
    // 检查是否有空的部分（例如 'Ctrl+' 或 '+K'）
    if (parts.some(p => p.length === 0)) {
        return false
    }
    
    return true
}

/**
 * 获取快捷键的优先级分数（用于排序）
 */
export function getShortcutPriority(config: ShortcutConfig): number {
    let priority = 0
    
    // 作用域优先级
    if (config.scope === 'global') priority += 100
    else if (config.scope === 'window') priority += 50
    
    // 分类优先级
    const categoryPriority: Record<string, number> = {
        'system': 90,
        'window': 80,
        'navigation': 70,
        'chat': 60,
        'character': 50,
        'settings': 40,
        'custom': 30,
    }
    priority += categoryPriority[config.category] || 0
    
    // 是否启用
    if (config.enabled) priority += 10
    
    return priority
}

/**
 * 排序快捷键配置列表
 */
export function sortShortcuts(shortcuts: ShortcutConfig[]): ShortcutConfig[] {
    return [...shortcuts].sort((a, b) => {
        // 首先按分类排序（高优先级在前，所以是降序）
        if (a.category !== b.category) {
            return getShortcutPriority(b) - getShortcutPriority(a)
        }
        
        // 然后按名称排序
        return a.name.localeCompare(b.name, 'zh-CN')
    })
}

/**
 * 按分类分组快捷键
 */
export function groupShortcutsByCategory(shortcuts: ShortcutConfig[]): Record<string, ShortcutConfig[]> {
    return shortcuts.reduce((acc, shortcut) => {
        const category = shortcut.category
        if (!acc[category]) {
            acc[category] = []
        }
        acc[category].push(shortcut)
        return acc
    }, {} as Record<string, ShortcutConfig[]>)
}

/**
 * 搜索快捷键
 */
export function searchShortcuts(shortcuts: ShortcutConfig[], query: string): ShortcutConfig[] {
    if (!query) {
        return shortcuts
    }
    
    const lowerQuery = query.toLowerCase()
    
    return shortcuts.filter(shortcut => {
        return (
            shortcut.name.toLowerCase().includes(lowerQuery) ||
            shortcut.description.toLowerCase().includes(lowerQuery) ||
            shortcut.id.toLowerCase().includes(lowerQuery) ||
            shortcutToDisplayString(shortcut).toLowerCase().includes(lowerQuery) ||
            formatCategoryName(shortcut.category).toLowerCase().includes(lowerQuery)
        )
    })
}

/**
 * 导出快捷键配置为可读格式
 */
export function exportShortcutsToText(shortcuts: ShortcutConfig[]): string {
    let text = '# Zishu Sensei 快捷键配置\n\n'
    
    const grouped = groupShortcutsByCategory(shortcuts)
    
    Object.entries(grouped).forEach(([category, categoryShortcuts]) => {
        text += `## ${formatCategoryName(category)}\n\n`
        
        categoryShortcuts.forEach(shortcut => {
            const status = shortcut.enabled ? '✓' : '✗'
            const scopeText = formatScopeName(shortcut.scope)
            text += `- [${status}] **${shortcut.name}** (${scopeText})\n`
            text += `  - 快捷键: \`${shortcutToDisplayString(shortcut)}\`\n`
            text += `  - 说明: ${shortcut.description}\n\n`
        })
    })
    
    return text
}

export default {
    shortcutToString,
    shortcutToDisplayString,
    parseShortcutString,
    isReservedShortcut,
    isValidShortcutConfig,
    areShortcutsEqual,
    getShortcutHash,
    formatCategoryName,
    formatScopeName,
    matchesKeyboardEvent,
    createShortcutFromEvent,
    isValidShortcutString,
    getShortcutPriority,
    sortShortcuts,
    groupShortcutsByCategory,
    searchShortcuts,
    exportShortcutsToText,
}

