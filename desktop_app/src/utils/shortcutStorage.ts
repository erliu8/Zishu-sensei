/**
 * 快捷键配置存储管理器
 * 
 * 提供快捷键配置的本地存储、读取和同步功能
 */

import type { ShortcutConfig, ShortcutsStorageData } from '@/types/shortcuts'

const STORAGE_KEY = 'zishu-shortcuts-config'
const STORAGE_VERSION = '1.0.0'

/**
 * 快捷键存储管理器
 */
export class ShortcutStorageManager {
    /**
     * 保存快捷键配置到本地存储
     */
    static save(shortcuts: ShortcutConfig[]): void {
        try {
            const customShortcuts: Record<string, Partial<ShortcutConfig>> = {}
            const disabledShortcuts: string[] = []

            shortcuts.forEach(shortcut => {
                // 只保存自定义或修改过的快捷键
                if (shortcut.customizable !== false || !shortcut.enabled) {
                    customShortcuts[shortcut.id] = {
                        key: shortcut.key,
                        modifiers: shortcut.modifiers,
                        enabled: shortcut.enabled,
                        scope: shortcut.scope,
                    }
                }

                // 记录禁用的快捷键
                if (!shortcut.enabled) {
                    disabledShortcuts.push(shortcut.id)
                }
            })

            const data: ShortcutsStorageData = {
                version: STORAGE_VERSION,
                customShortcuts,
                disabledShortcuts,
                lastUpdated: Date.now(),
            }

            localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
            console.log('快捷键配置已保存', data)
        } catch (error) {
            console.error('保存快捷键配置失败:', error)
        }
    }

    /**
     * 从本地存储加载快捷键配置
     */
    static load(): ShortcutsStorageData | null {
        try {
            const dataStr = localStorage.getItem(STORAGE_KEY)
            if (!dataStr) {
                return null
            }

            const data: ShortcutsStorageData = JSON.parse(dataStr)

            // 版本检查
            if (data.version !== STORAGE_VERSION) {
                console.warn('快捷键配置版本不匹配，使用默认配置')
                return null
            }

            console.log('快捷键配置已加载', data)
            return data
        } catch (error) {
            console.error('加载快捷键配置失败:', error)
            return null
        }
    }

    /**
     * 合并默认配置和自定义配置
     */
    static merge(
        defaultShortcuts: Omit<ShortcutConfig, 'callback'>[],
        storedData: ShortcutsStorageData | null
    ): Omit<ShortcutConfig, 'callback'>[] {
        if (!storedData) {
            return defaultShortcuts
        }

        return defaultShortcuts.map(shortcut => {
            const customConfig = storedData.customShortcuts[shortcut.id]
            
            if (customConfig) {
                return {
                    ...shortcut,
                    ...customConfig,
                }
            }

            // 检查是否被禁用
            if (storedData.disabledShortcuts.includes(shortcut.id)) {
                return {
                    ...shortcut,
                    enabled: false,
                }
            }

            return shortcut
        })
    }

    /**
     * 清除所有快捷键配置
     */
    static clear(): void {
        try {
            localStorage.removeItem(STORAGE_KEY)
            console.log('快捷键配置已清除')
        } catch (error) {
            console.error('清除快捷键配置失败:', error)
        }
    }

    /**
     * 导出快捷键配置为 JSON 字符串
     */
    static export(): string {
        try {
            const data = this.load()
            return JSON.stringify(data, null, 2)
        } catch (error) {
            console.error('导出快捷键配置失败:', error)
            return '{}'
        }
    }

    /**
     * 从 JSON 字符串导入快捷键配置
     */
    static import(jsonStr: string): boolean {
        try {
            const data: ShortcutsStorageData = JSON.parse(jsonStr)
            
            // 基本验证
            if (!data.version || !data.customShortcuts || !data.disabledShortcuts) {
                throw new Error('配置格式无效')
            }

            localStorage.setItem(STORAGE_KEY, jsonStr)
            console.log('快捷键配置已导入', data)
            return true
        } catch (error) {
            console.error('导入快捷键配置失败:', error)
            return false
        }
    }

    /**
     * 获取存储信息
     */
    static getInfo(): {
        exists: boolean
        version: string | null
        lastUpdated: number | null
        shortcutCount: number
    } {
        const data = this.load()
        
        return {
            exists: data !== null,
            version: data?.version || null,
            lastUpdated: data?.lastUpdated || null,
            shortcutCount: data ? Object.keys(data.customShortcuts).length : 0,
        }
    }

    /**
     * 备份当前配置
     */
    static backup(): void {
        try {
            const data = this.load()
            if (!data) {
                return
            }

            const backupKey = `${STORAGE_KEY}-backup-${Date.now()}`
            localStorage.setItem(backupKey, JSON.stringify(data))
            console.log('快捷键配置已备份:', backupKey)

            // 只保留最近5个备份
            this.cleanOldBackups(5)
        } catch (error) {
            console.error('备份快捷键配置失败:', error)
        }
    }

    /**
     * 清理旧备份
     */
    static cleanOldBackups(keepCount: number = 5): void {
        try {
            const backupKeys: Array<{ key: string; timestamp: number }> = []

            // 查找所有备份
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i)
                if (key && key.startsWith(`${STORAGE_KEY}-backup-`)) {
                    const timestamp = parseInt(key.split('-').pop() || '0', 10)
                    backupKeys.push({ key, timestamp })
                }
            }

            // 按时间排序并删除旧备份
            backupKeys.sort((a, b) => b.timestamp - a.timestamp)
            backupKeys.slice(keepCount).forEach(backup => {
                localStorage.removeItem(backup.key)
                console.log('已删除旧备份:', backup.key)
            })
        } catch (error) {
            console.error('清理旧备份失败:', error)
        }
    }

    /**
     * 恢复备份
     */
    static restore(backupTimestamp?: number): boolean {
        try {
            let backupKey: string | null = null

            if (backupTimestamp) {
                backupKey = `${STORAGE_KEY}-backup-${backupTimestamp}`
            } else {
                // 查找最新的备份
                const backupKeys: Array<{ key: string; timestamp: number }> = []
                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i)
                    if (key && key.startsWith(`${STORAGE_KEY}-backup-`)) {
                        const timestamp = parseInt(key.split('-').pop() || '0', 10)
                        backupKeys.push({ key, timestamp })
                    }
                }
                
                if (backupKeys.length > 0) {
                    backupKeys.sort((a, b) => b.timestamp - a.timestamp)
                    backupKey = backupKeys[0].key
                }
            }

            if (!backupKey) {
                console.warn('未找到备份')
                return false
            }

            const backupData = localStorage.getItem(backupKey)
            if (!backupData) {
                console.warn('备份数据不存在')
                return false
            }

            localStorage.setItem(STORAGE_KEY, backupData)
            console.log('快捷键配置已从备份恢复:', backupKey)
            return true
        } catch (error) {
            console.error('恢复备份失败:', error)
            return false
        }
    }

    /**
     * 列出所有备份
     */
    static listBackups(): Array<{ timestamp: number; date: string }> {
        try {
            const backups: Array<{ timestamp: number; date: string }> = []

            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i)
                if (key && key.startsWith(`${STORAGE_KEY}-backup-`)) {
                    const timestamp = parseInt(key.split('-').pop() || '0', 10)
                    const date = new Date(timestamp).toLocaleString('zh-CN')
                    backups.push({ timestamp, date })
                }
            }

            backups.sort((a, b) => b.timestamp - a.timestamp)
            return backups
        } catch (error) {
            console.error('列出备份失败:', error)
            return []
        }
    }
}

/**
 * 快捷键配置同步管理器（用于跨标签页同步）
 */
export class ShortcutSyncManager {
    private static listeners: Array<(data: ShortcutsStorageData) => void> = []

    /**
     * 开始监听配置变化
     */
    static startListening(callback: (data: ShortcutsStorageData) => void): () => void {
        this.listeners.push(callback)

        const handleStorageChange = (event: StorageEvent) => {
            if (event.key === STORAGE_KEY && event.newValue) {
                try {
                    const data: ShortcutsStorageData = JSON.parse(event.newValue)
                    callback(data)
                } catch (error) {
                    console.error('解析存储变化失败:', error)
                }
            }
        }

        window.addEventListener('storage', handleStorageChange)

        // 返回取消监听函数
        return () => {
            this.listeners = this.listeners.filter(l => l !== callback)
            window.removeEventListener('storage', handleStorageChange)
        }
    }

    /**
     * 通知所有监听器
     */
    static notify(data: ShortcutsStorageData): void {
        this.listeners.forEach(listener => {
            try {
                listener(data)
            } catch (error) {
                console.error('通知监听器失败:', error)
            }
        })
    }
}

export default ShortcutStorageManager

