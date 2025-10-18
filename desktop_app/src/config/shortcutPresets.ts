/**
 * 快捷键预设配置
 * 
 * 提供默认的快捷键配置和快捷键动作映射
 */

import type { ShortcutConfig, ShortcutAction, Platform } from '@/types/shortcuts'

/**
 * 获取当前平台
 */
export const getCurrentPlatform = (): Platform => {
    if (typeof navigator === 'undefined') return 'unknown'
    
    const userAgent = navigator.userAgent.toLowerCase()
    const platform = navigator.platform.toLowerCase()
    
    if (platform.includes('mac') || userAgent.includes('mac')) {
        return 'macos'
    } else if (platform.includes('win') || userAgent.includes('win')) {
        return 'windows'
    } else if (platform.includes('linux') || userAgent.includes('linux')) {
        return 'linux'
    }
    
    return 'unknown'
}

/**
 * 获取平台特定的修饰键名称
 */
export const getPlatformModifierName = (modifier: 'ctrl' | 'alt' | 'shift' | 'meta'): string => {
    const platform = getCurrentPlatform()
    
    switch (modifier) {
        case 'ctrl':
            return platform === 'macos' ? '⌘ Cmd' : 'Ctrl'
        case 'alt':
            return platform === 'macos' ? '⌥ Option' : 'Alt'
        case 'shift':
            return '⇧ Shift'
        case 'meta':
            return platform === 'macos' ? '⌘ Cmd' : '⊞ Win'
        default:
            return modifier
    }
}

/**
 * 默认快捷键配置（跨平台适配）
 */
export const DEFAULT_SHORTCUTS: Omit<ShortcutConfig, 'callback'>[] = [
    // ==================== 窗口管理 ====================
    {
        id: 'window.minimize',
        name: '最小化窗口',
        description: '将应用窗口最小化到系统托盘',
        key: 'Escape',
        modifiers: { ctrl: false, alt: false, shift: false, meta: false },
        scope: 'local',
        category: 'window',
        enabled: true,
        preventDefault: true,
        customizable: true,
    },
    {
        id: 'window.close',
        name: '关闭窗口',
        description: '关闭当前窗口（不退出应用）',
        key: 'W',
        modifiers: { ctrl: true, alt: false, shift: false, meta: false },
        scope: 'local',
        category: 'window',
        enabled: true,
        preventDefault: true,
        customizable: true,
    },
    {
        id: 'window.toggleAlwaysOnTop',
        name: '切换置顶',
        description: '切换窗口是否始终置顶',
        key: 'T',
        modifiers: { ctrl: true, alt: true, shift: false, meta: false },
        scope: 'local',
        category: 'window',
        enabled: true,
        preventDefault: true,
        customizable: true,
    },
    {
        id: 'window.show',
        name: '唤醒窗口',
        description: '从后台唤醒应用窗口（全局）',
        key: 'Space',
        modifiers: { ctrl: true, alt: true, shift: false, meta: false },
        scope: 'global',
        category: 'window',
        enabled: true,
        preventDefault: true,
        customizable: true,
    },

    // ==================== 视图切换 ====================
    {
        id: 'view.pet',
        name: '切换到宠物模式',
        description: '切换到桌面宠物视图',
        key: '1',
        modifiers: { ctrl: true, alt: false, shift: false, meta: false },
        scope: 'local',
        category: 'navigation',
        enabled: true,
        preventDefault: true,
        customizable: true,
    },
    {
        id: 'view.chat',
        name: '切换到聊天模式',
        description: '切换到聊天对话视图',
        key: '2',
        modifiers: { ctrl: true, alt: false, shift: false, meta: false },
        scope: 'local',
        category: 'navigation',
        enabled: true,
        preventDefault: true,
        customizable: true,
    },
    {
        id: 'view.settings',
        name: '打开设置',
        description: '打开应用设置面板',
        key: ',',
        modifiers: { ctrl: true, alt: false, shift: false, meta: false },
        scope: 'local',
        category: 'navigation',
        enabled: true,
        preventDefault: true,
        customizable: true,
    },
    {
        id: 'view.adapters',
        name: '打开适配器管理',
        description: '打开适配器管理面板',
        key: '3',
        modifiers: { ctrl: true, alt: false, shift: false, meta: false },
        scope: 'local',
        category: 'navigation',
        enabled: true,
        preventDefault: true,
        customizable: true,
    },

    // ==================== 聊天相关 ====================
    {
        id: 'chat.focusInput',
        name: '聚焦输入框',
        description: '将光标聚焦到聊天输入框',
        key: '/',
        modifiers: { ctrl: false, alt: false, shift: false, meta: false },
        scope: 'local',
        category: 'chat',
        enabled: true,
        preventDefault: true,
        customizable: true,
    },
    {
        id: 'chat.send',
        name: '发送消息',
        description: '发送当前输入的消息',
        key: 'Enter',
        modifiers: { ctrl: true, alt: false, shift: false, meta: false },
        scope: 'local',
        category: 'chat',
        enabled: true,
        preventDefault: true,
        customizable: false, // 核心功能，不允许自定义
    },
    {
        id: 'chat.newConversation',
        name: '新建对话',
        description: '创建一个新的聊天对话',
        key: 'N',
        modifiers: { ctrl: true, alt: false, shift: false, meta: false },
        scope: 'local',
        category: 'chat',
        enabled: true,
        preventDefault: true,
        customizable: true,
    },
    {
        id: 'chat.clearHistory',
        name: '清空聊天记录',
        description: '清空当前对话的聊天记录',
        key: 'K',
        modifiers: { ctrl: true, alt: false, shift: true, meta: false },
        scope: 'local',
        category: 'chat',
        enabled: true,
        preventDefault: true,
        customizable: true,
    },
    {
        id: 'chat.search',
        name: '搜索消息',
        description: '在聊天记录中搜索',
        key: 'F',
        modifiers: { ctrl: true, alt: false, shift: false, meta: false },
        scope: 'local',
        category: 'chat',
        enabled: true,
        preventDefault: true,
        customizable: true,
    },

    // ==================== 角色相关 ====================
    {
        id: 'character.switch',
        name: '切换角色',
        description: '打开角色切换菜单',
        key: 'C',
        modifiers: { ctrl: true, alt: true, shift: false, meta: false },
        scope: 'local',
        category: 'character',
        enabled: true,
        preventDefault: true,
        customizable: true,
    },
    {
        id: 'character.interact',
        name: '与角色互动',
        description: '触发角色互动动画',
        key: 'I',
        modifiers: { ctrl: true, alt: false, shift: false, meta: false },
        scope: 'local',
        category: 'character',
        enabled: true,
        preventDefault: true,
        customizable: true,
    },
    {
        id: 'character.resetPosition',
        name: '重置角色位置',
        description: '将角色移回到默认位置',
        key: 'R',
        modifiers: { ctrl: true, alt: true, shift: false, meta: false },
        scope: 'local',
        category: 'character',
        enabled: true,
        preventDefault: true,
        customizable: true,
    },

    // ==================== 系统相关 ====================
    {
        id: 'system.quit',
        name: '退出应用',
        description: '完全退出应用程序',
        key: 'Q',
        modifiers: { ctrl: true, alt: false, shift: false, meta: false },
        scope: 'local',
        category: 'system',
        enabled: true,
        preventDefault: true,
        customizable: false, // 系统功能，不允许自定义
    },
    {
        id: 'system.reload',
        name: '重新加载',
        description: '重新加载应用程序',
        key: 'R',
        modifiers: { ctrl: true, alt: false, shift: true, meta: false },
        scope: 'local',
        category: 'system',
        enabled: true,
        preventDefault: true,
        customizable: true,
    },
    {
        id: 'system.toggleDevTools',
        name: '切换开发工具',
        description: '打开或关闭开发者工具',
        key: 'F12',
        modifiers: { ctrl: false, alt: false, shift: false, meta: false },
        scope: 'local',
        category: 'system',
        enabled: true,
        preventDefault: true,
        customizable: false,
    },
    {
        id: 'system.openSettings',
        name: '打开设置（快速）',
        description: '快速打开设置面板',
        key: 'P',
        modifiers: { ctrl: true, alt: false, shift: true, meta: false },
        scope: 'global',
        category: 'system',
        enabled: false, // 默认禁用，用户可根据需要启用
        preventDefault: true,
        customizable: true,
    },

    // ==================== 导航相关 ====================
    {
        id: 'nav.back',
        name: '后退',
        description: '返回上一页',
        key: 'ArrowLeft',
        modifiers: { ctrl: false, alt: true, shift: false, meta: false },
        scope: 'local',
        category: 'navigation',
        enabled: true,
        preventDefault: true,
        customizable: true,
    },
    {
        id: 'nav.forward',
        name: '前进',
        description: '前进到下一页',
        key: 'ArrowRight',
        modifiers: { ctrl: false, alt: true, shift: false, meta: false },
        scope: 'local',
        category: 'navigation',
        enabled: true,
        preventDefault: true,
        customizable: true,
    },
    {
        id: 'nav.home',
        name: '返回首页',
        description: '返回到主页面',
        key: 'H',
        modifiers: { ctrl: true, alt: false, shift: false, meta: false },
        scope: 'local',
        category: 'navigation',
        enabled: true,
        preventDefault: true,
        customizable: true,
    },
]

/**
 * 根据平台调整快捷键
 */
export const getAdjustedShortcuts = (): Omit<ShortcutConfig, 'callback'>[] => {
    const platform = getCurrentPlatform()
    
    return DEFAULT_SHORTCUTS.map(shortcut => {
        // 在 macOS 上，将 Ctrl 替换为 Meta (Cmd)
        if (platform === 'macos' && shortcut.modifiers.ctrl) {
            return {
                ...shortcut,
                modifiers: {
                    ...shortcut.modifiers,
                    ctrl: false,
                    meta: true,
                },
            }
        }
        
        return shortcut
    })
}

/**
 * 快捷键分组配置
 */
export const SHORTCUT_GROUPS = [
    {
        id: 'window',
        name: '窗口管理',
        description: '窗口相关的快捷键',
        icon: '🪟',
    },
    {
        id: 'navigation',
        name: '导航操作',
        description: '页面导航和视图切换',
        icon: '🧭',
    },
    {
        id: 'chat',
        name: '聊天对话',
        description: '聊天功能相关的快捷键',
        icon: '💬',
    },
    {
        id: 'character',
        name: '角色管理',
        description: '角色互动和管理',
        icon: '🐾',
    },
    {
        id: 'system',
        name: '系统功能',
        description: '系统级操作',
        icon: '⚙️',
    },
    {
        id: 'custom',
        name: '自定义',
        description: '用户自定义的快捷键',
        icon: '✨',
    },
] as const

/**
 * 快捷键动作到ID的映射
 */
export const ACTION_TO_SHORTCUT_ID: Record<ShortcutAction, string> = {
    'window.minimize': 'window.minimize',
    'window.close': 'window.close',
    'window.maximize': 'window.maximize',
    'window.toggleAlwaysOnTop': 'window.toggleAlwaysOnTop',
    'window.focus': 'window.focus',
    'window.hide': 'window.hide',
    'window.show': 'window.show',
    'view.pet': 'view.pet',
    'view.chat': 'view.chat',
    'view.settings': 'view.settings',
    'view.adapters': 'view.adapters',
    'chat.focusInput': 'chat.focusInput',
    'chat.send': 'chat.send',
    'chat.newConversation': 'chat.newConversation',
    'chat.clearHistory': 'chat.clearHistory',
    'chat.search': 'chat.search',
    'character.switch': 'character.switch',
    'character.interact': 'character.interact',
    'character.resetPosition': 'character.resetPosition',
    'system.quit': 'system.quit',
    'system.reload': 'system.reload',
    'system.toggleDevTools': 'system.toggleDevTools',
    'system.openSettings': 'system.openSettings',
    'nav.back': 'nav.back',
    'nav.forward': 'nav.forward',
    'nav.home': 'nav.home',
    'custom': 'custom',
}

/**
 * 快捷键帮助文本
 */
export const SHORTCUT_HELP_TEXTS = {
    'window.minimize': '按下此快捷键可以快速将窗口最小化到系统托盘',
    'window.close': '关闭当前窗口，但应用会继续在后台运行',
    'window.toggleAlwaysOnTop': '切换窗口是否始终显示在其他窗口上方',
    'window.show': '无论窗口在哪里，都可以用这个全局快捷键快速唤醒',
    'view.pet': '切换到可爱的桌面宠物模式',
    'view.chat': '切换到聊天对话界面',
    'view.settings': '快速打开设置页面',
    'chat.focusInput': '快速将光标定位到输入框，开始输入',
    'chat.send': '发送你输入的消息',
    'chat.newConversation': '开始一个全新的对话',
    'chat.clearHistory': '清空当前对话的所有历史记录',
    'system.quit': '完全退出应用程序',
    'system.reload': '重新加载应用（在出现问题时很有用）',
} as const

