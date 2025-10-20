/**
 * 快捷键存储管理器测试
 * 
 * 测试快捷键配置的本地存储、读取、合并和同步功能
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { ShortcutStorageManager, ShortcutSyncManager } from '@/utils/shortcutStorage'
import type { ShortcutConfig, ShortcutsStorageData } from '@/types/shortcuts'

describe('ShortcutStorageManager', () => {
    const STORAGE_KEY = 'zishu-shortcuts-config'
    const STORAGE_VERSION = '1.0.0'

    // 模拟快捷键配置数据
    const mockShortcuts: ShortcutConfig[] = [
        {
            id: 'toggle-theme',
            name: '切换主题',
            description: '在亮色和暗色主题之间切换',
            key: 'T',
            modifiers: { ctrl: true, shift: true },
            enabled: true,
            scope: 'global',
            category: 'appearance',
            customizable: true,
            callback: vi.fn(),
        },
        {
            id: 'open-settings',
            name: '打开设置',
            description: '打开应用设置面板',
            key: ',',
            modifiers: { ctrl: true },
            enabled: true,
            scope: 'global',
            category: 'navigation',
            customizable: true,
            callback: vi.fn(),
        },
        {
            id: 'quit-app',
            name: '退出应用',
            description: '退出应用程序',
            key: 'Q',
            modifiers: { ctrl: true },
            enabled: false,
            scope: 'global',
            category: 'system',
            customizable: false,
            callback: vi.fn(),
        },
    ]

    beforeEach(() => {
        // 清空 localStorage
        localStorage.clear()
        // 清空所有模拟
        vi.clearAllMocks()
        // 模拟 console 方法以避免测试输出污染
        vi.spyOn(console, 'log').mockImplementation(() => {})
        vi.spyOn(console, 'warn').mockImplementation(() => {})
        vi.spyOn(console, 'error').mockImplementation(() => {})
    })

    afterEach(() => {
        localStorage.clear()
        vi.restoreAllMocks()
    })

    describe('save()', () => {
        it('应该保存快捷键配置到 localStorage', () => {
            ShortcutStorageManager.save(mockShortcuts)

            const stored = localStorage.getItem(STORAGE_KEY)
            expect(stored).toBeTruthy()

            const data: ShortcutsStorageData = JSON.parse(stored!)
            expect(data.version).toBe(STORAGE_VERSION)
            expect(data.customShortcuts).toBeDefined()
            expect(data.disabledShortcuts).toBeDefined()
            expect(data.lastUpdated).toBeGreaterThan(0)
        })

        it('应该只保存可自定义或禁用的快捷键', () => {
            ShortcutStorageManager.save(mockShortcuts)

            const stored = localStorage.getItem(STORAGE_KEY)
            const data: ShortcutsStorageData = JSON.parse(stored!)

            // toggle-theme 和 open-settings 是可自定义的
            // quit-app 虽然不可自定义但被禁用了，也应该保存
            expect(Object.keys(data.customShortcuts).length).toBeGreaterThan(0)
        })

        it('应该记录所有禁用的快捷键', () => {
            ShortcutStorageManager.save(mockShortcuts)

            const stored = localStorage.getItem(STORAGE_KEY)
            const data: ShortcutsStorageData = JSON.parse(stored!)

            expect(data.disabledShortcuts).toContain('quit-app')
        })

        it('应该正确保存快捷键的关键属性', () => {
            ShortcutStorageManager.save(mockShortcuts)

            const stored = localStorage.getItem(STORAGE_KEY)
            const data: ShortcutsStorageData = JSON.parse(stored!)

            const toggleTheme = data.customShortcuts['toggle-theme']
            expect(toggleTheme).toBeDefined()
            expect(toggleTheme.key).toBe('T')
            expect(toggleTheme.modifiers).toEqual({ ctrl: true, shift: true })
            expect(toggleTheme.enabled).toBe(true)
            expect(toggleTheme.scope).toBe('global')
        })

        it('应该在保存失败时记录错误', () => {
            // 模拟 localStorage.setItem 抛出错误
            const error = new Error('Storage quota exceeded')
            vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
                throw error
            })

            ShortcutStorageManager.save(mockShortcuts)

            expect(console.error).toHaveBeenCalledWith('保存快捷键配置失败:', error)
        })

        it('应该处理空数组', () => {
            ShortcutStorageManager.save([])

            const stored = localStorage.getItem(STORAGE_KEY)
            const data: ShortcutsStorageData = JSON.parse(stored!)

            expect(data.customShortcuts).toEqual({})
            expect(data.disabledShortcuts).toEqual([])
        })
    })

    describe('load()', () => {
        it('应该从 localStorage 加载快捷键配置', () => {
            const testData: ShortcutsStorageData = {
                version: STORAGE_VERSION,
                customShortcuts: {
                    'toggle-theme': {
                        key: 'T',
                        modifiers: { ctrl: true, shift: true },
                        enabled: true,
                        scope: 'global',
                    },
                },
                disabledShortcuts: ['quit-app'],
                lastUpdated: Date.now(),
            }

            localStorage.setItem(STORAGE_KEY, JSON.stringify(testData))

            const loaded = ShortcutStorageManager.load()
            expect(loaded).toEqual(testData)
        })

        it('应该在没有存储数据时返回 null', () => {
            const loaded = ShortcutStorageManager.load()
            expect(loaded).toBeNull()
        })

        it('应该在版本不匹配时返回 null', () => {
            const testData: ShortcutsStorageData = {
                version: '0.9.0', // 旧版本
                customShortcuts: {},
                disabledShortcuts: [],
                lastUpdated: Date.now(),
            }

            localStorage.setItem(STORAGE_KEY, JSON.stringify(testData))

            const loaded = ShortcutStorageManager.load()
            expect(loaded).toBeNull()
            expect(console.warn).toHaveBeenCalledWith('快捷键配置版本不匹配，使用默认配置')
        })

        it('应该在数据格式错误时返回 null', () => {
            localStorage.setItem(STORAGE_KEY, 'invalid json')

            const loaded = ShortcutStorageManager.load()
            expect(loaded).toBeNull()
            expect(console.error).toHaveBeenCalled()
        })

        it('应该在加载失败时记录错误', () => {
            const error = new Error('Access denied')
            vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
                throw error
            })

            const loaded = ShortcutStorageManager.load()
            expect(loaded).toBeNull()
            expect(console.error).toHaveBeenCalledWith('加载快捷键配置失败:', error)
        })
    })

    describe('merge()', () => {
        const defaultShortcuts: Omit<ShortcutConfig, 'callback'>[] = [
            {
                id: 'toggle-theme',
                name: '切换主题',
                description: '在亮色和暗色主题之间切换',
                key: 'D', // 默认是 D
                modifiers: { ctrl: true },
                enabled: true,
                scope: 'global',
                category: 'appearance',
                customizable: true,
            },
            {
                id: 'open-settings',
                name: '打开设置',
                description: '打开应用设置面板',
                key: ',',
                modifiers: { ctrl: true },
                enabled: true,
                scope: 'global',
                category: 'navigation',
                customizable: true,
            },
        ]

        it('应该在没有存储数据时返回默认配置', () => {
            const merged = ShortcutStorageManager.merge(defaultShortcuts, null)
            expect(merged).toEqual(defaultShortcuts)
        })

        it('应该合并自定义配置和默认配置', () => {
            const storedData: ShortcutsStorageData = {
                version: STORAGE_VERSION,
                customShortcuts: {
                    'toggle-theme': {
                        key: 'T', // 自定义按键
                        modifiers: { ctrl: true, shift: true },
                        enabled: true,
                        scope: 'global',
                    },
                },
                disabledShortcuts: [],
                lastUpdated: Date.now(),
            }

            const merged = ShortcutStorageManager.merge(defaultShortcuts, storedData)
            
            const toggleTheme = merged.find(s => s.id === 'toggle-theme')
            expect(toggleTheme).toBeDefined()
            expect(toggleTheme!.key).toBe('T') // 使用自定义值
            expect(toggleTheme!.modifiers).toEqual({ ctrl: true, shift: true })
        })

        it('应该正确处理禁用的快捷键', () => {
            const storedData: ShortcutsStorageData = {
                version: STORAGE_VERSION,
                customShortcuts: {},
                disabledShortcuts: ['open-settings'],
                lastUpdated: Date.now(),
            }

            const merged = ShortcutStorageManager.merge(defaultShortcuts, storedData)
            
            const openSettings = merged.find(s => s.id === 'open-settings')
            expect(openSettings).toBeDefined()
            expect(openSettings!.enabled).toBe(false)
        })

        it('应该保留未修改的默认配置', () => {
            const storedData: ShortcutsStorageData = {
                version: STORAGE_VERSION,
                customShortcuts: {
                    'toggle-theme': {
                        key: 'T',
                        modifiers: { ctrl: true, shift: true },
                        enabled: true,
                        scope: 'global',
                    },
                },
                disabledShortcuts: [],
                lastUpdated: Date.now(),
            }

            const merged = ShortcutStorageManager.merge(defaultShortcuts, storedData)
            
            const openSettings = merged.find(s => s.id === 'open-settings')
            expect(openSettings).toBeDefined()
            expect(openSettings!.key).toBe(',') // 保持默认值
            expect(openSettings!.modifiers).toEqual({ ctrl: true })
        })
    })

    describe('clear()', () => {
        it('应该清除所有快捷键配置', () => {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({ test: 'data' }))
            
            ShortcutStorageManager.clear()
            
            expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
        })

        it('应该在清除失败时记录错误', () => {
            const error = new Error('Access denied')
            vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
                throw error
            })

            ShortcutStorageManager.clear()
            expect(console.error).toHaveBeenCalledWith('清除快捷键配置失败:', error)
        })
    })

    describe('export()', () => {
        it('应该导出当前配置为 JSON 字符串', () => {
            const testData: ShortcutsStorageData = {
                version: STORAGE_VERSION,
                customShortcuts: {
                    'toggle-theme': {
                        key: 'T',
                        modifiers: { ctrl: true, shift: true },
                        enabled: true,
                        scope: 'global',
                    },
                },
                disabledShortcuts: [],
                lastUpdated: Date.now(),
            }

            localStorage.setItem(STORAGE_KEY, JSON.stringify(testData))

            const exported = ShortcutStorageManager.export()
            const parsed = JSON.parse(exported)

            expect(parsed).toEqual(testData)
        })

        it('应该在没有数据时返回空对象字符串', () => {
            const exported = ShortcutStorageManager.export()
            expect(exported).toBe('null')
        })

        it('应该格式化 JSON 输出', () => {
            const testData: ShortcutsStorageData = {
                version: STORAGE_VERSION,
                customShortcuts: {},
                disabledShortcuts: [],
                lastUpdated: Date.now(),
            }

            localStorage.setItem(STORAGE_KEY, JSON.stringify(testData))

            const exported = ShortcutStorageManager.export()
            
            // 检查是否有缩进（格式化）
            expect(exported).toContain('\n')
            expect(exported).toContain('  ')
        })
    })

    describe('import()', () => {
        it('应该成功导入有效的配置', () => {
            const testData: ShortcutsStorageData = {
                version: STORAGE_VERSION,
                customShortcuts: {
                    'toggle-theme': {
                        key: 'T',
                        modifiers: { ctrl: true, shift: true },
                        enabled: true,
                        scope: 'global',
                    },
                },
                disabledShortcuts: [],
                lastUpdated: Date.now(),
            }

            const result = ShortcutStorageManager.import(JSON.stringify(testData))
            
            expect(result).toBe(true)
            
            const stored = localStorage.getItem(STORAGE_KEY)
            expect(stored).toBeTruthy()
            
            const parsed = JSON.parse(stored!)
            expect(parsed).toEqual(testData)
        })

        it('应该拒绝无效的 JSON', () => {
            const result = ShortcutStorageManager.import('invalid json')
            
            expect(result).toBe(false)
            expect(console.error).toHaveBeenCalled()
        })

        it('应该拒绝格式不正确的配置', () => {
            const invalidData = {
                version: STORAGE_VERSION,
                // 缺少必需字段
            }

            const result = ShortcutStorageManager.import(JSON.stringify(invalidData))
            
            expect(result).toBe(false)
            expect(console.error).toHaveBeenCalled()
        })

        it('应该验证必需字段的存在', () => {
            const testCases = [
                { customShortcuts: {}, disabledShortcuts: [] }, // 缺少 version
                { version: '1.0.0', disabledShortcuts: [] }, // 缺少 customShortcuts
                { version: '1.0.0', customShortcuts: {} }, // 缺少 disabledShortcuts
            ]

            testCases.forEach(invalidData => {
                const result = ShortcutStorageManager.import(JSON.stringify(invalidData))
                expect(result).toBe(false)
            })
        })
    })

    describe('getInfo()', () => {
        it('应该返回正确的存储信息', () => {
            const testData: ShortcutsStorageData = {
                version: STORAGE_VERSION,
                customShortcuts: {
                    'toggle-theme': {
                        key: 'T',
                        modifiers: { ctrl: true, shift: true },
                        enabled: true,
                        scope: 'global',
                    },
                    'open-settings': {
                        key: ',',
                        modifiers: { ctrl: true },
                        enabled: true,
                        scope: 'global',
                    },
                },
                disabledShortcuts: [],
                lastUpdated: 1234567890,
            }

            localStorage.setItem(STORAGE_KEY, JSON.stringify(testData))

            const info = ShortcutStorageManager.getInfo()
            
            expect(info.exists).toBe(true)
            expect(info.version).toBe(STORAGE_VERSION)
            expect(info.lastUpdated).toBe(1234567890)
            expect(info.shortcutCount).toBe(2)
        })

        it('应该在没有存储数据时返回正确的信息', () => {
            const info = ShortcutStorageManager.getInfo()
            
            expect(info.exists).toBe(false)
            expect(info.version).toBeNull()
            expect(info.lastUpdated).toBeNull()
            expect(info.shortcutCount).toBe(0)
        })
    })

    describe('backup()', () => {
        it('应该创建配置备份', () => {
            const testData: ShortcutsStorageData = {
                version: STORAGE_VERSION,
                customShortcuts: {},
                disabledShortcuts: [],
                lastUpdated: Date.now(),
            }

            localStorage.setItem(STORAGE_KEY, JSON.stringify(testData))

            ShortcutStorageManager.backup()

            // 检查是否创建了备份
            let backupFound = false
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i)
                if (key && key.startsWith(`${STORAGE_KEY}-backup-`)) {
                    backupFound = true
                    const backupData = localStorage.getItem(key)
                    expect(JSON.parse(backupData!)).toEqual(testData)
                    break
                }
            }
            
            expect(backupFound).toBe(true)
        })

        it('应该在没有配置时不创建备份', () => {
            ShortcutStorageManager.backup()

            let backupCount = 0
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i)
                if (key && key.startsWith(`${STORAGE_KEY}-backup-`)) {
                    backupCount++
                }
            }
            
            expect(backupCount).toBe(0)
        })

        it('应该调用清理旧备份', () => {
            const testData: ShortcutsStorageData = {
                version: STORAGE_VERSION,
                customShortcuts: {},
                disabledShortcuts: [],
                lastUpdated: Date.now(),
            }

            localStorage.setItem(STORAGE_KEY, JSON.stringify(testData))

            const cleanSpy = vi.spyOn(ShortcutStorageManager, 'cleanOldBackups')
            
            ShortcutStorageManager.backup()
            
            expect(cleanSpy).toHaveBeenCalledWith(5)
        })
    })

    describe('cleanOldBackups()', () => {
        it('应该保留指定数量的最新备份', () => {
            const testData: ShortcutsStorageData = {
                version: STORAGE_VERSION,
                customShortcuts: {},
                disabledShortcuts: [],
                lastUpdated: Date.now(),
            }

            // 创建 10 个备份
            for (let i = 0; i < 10; i++) {
                const backupKey = `${STORAGE_KEY}-backup-${Date.now() + i}`
                localStorage.setItem(backupKey, JSON.stringify(testData))
            }

            ShortcutStorageManager.cleanOldBackups(5)

            // 统计剩余备份数量
            let backupCount = 0
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i)
                if (key && key.startsWith(`${STORAGE_KEY}-backup-`)) {
                    backupCount++
                }
            }
            
            expect(backupCount).toBe(5)
        })

        it('应该删除最旧的备份', () => {
            const testData: ShortcutsStorageData = {
                version: STORAGE_VERSION,
                customShortcuts: {},
                disabledShortcuts: [],
                lastUpdated: Date.now(),
            }

            const timestamps = [1000, 2000, 3000, 4000, 5000]
            timestamps.forEach(ts => {
                const backupKey = `${STORAGE_KEY}-backup-${ts}`
                localStorage.setItem(backupKey, JSON.stringify(testData))
            })

            ShortcutStorageManager.cleanOldBackups(3)

            // 检查旧备份是否被删除
            expect(localStorage.getItem(`${STORAGE_KEY}-backup-1000`)).toBeNull()
            expect(localStorage.getItem(`${STORAGE_KEY}-backup-2000`)).toBeNull()
            
            // 检查新备份是否保留
            expect(localStorage.getItem(`${STORAGE_KEY}-backup-3000`)).toBeTruthy()
            expect(localStorage.getItem(`${STORAGE_KEY}-backup-4000`)).toBeTruthy()
            expect(localStorage.getItem(`${STORAGE_KEY}-backup-5000`)).toBeTruthy()
        })
    })

    describe('restore()', () => {
        it('应该恢复指定的备份', () => {
            const currentData: ShortcutsStorageData = {
                version: STORAGE_VERSION,
                customShortcuts: { current: { key: 'C' } },
                disabledShortcuts: [],
                lastUpdated: Date.now(),
            }

            const backupData: ShortcutsStorageData = {
                version: STORAGE_VERSION,
                customShortcuts: { backup: { key: 'B' } },
                disabledShortcuts: [],
                lastUpdated: Date.now() - 1000,
            }

            localStorage.setItem(STORAGE_KEY, JSON.stringify(currentData))
            const backupTimestamp = 1234567890
            localStorage.setItem(
                `${STORAGE_KEY}-backup-${backupTimestamp}`,
                JSON.stringify(backupData)
            )

            const result = ShortcutStorageManager.restore(backupTimestamp)
            
            expect(result).toBe(true)
            
            const restored = localStorage.getItem(STORAGE_KEY)
            expect(JSON.parse(restored!)).toEqual(backupData)
        })

        it('应该恢复最新的备份（不指定时间戳）', () => {
            const backupData1: ShortcutsStorageData = {
                version: STORAGE_VERSION,
                customShortcuts: { old: { key: 'O' } },
                disabledShortcuts: [],
                lastUpdated: Date.now() - 2000,
            }

            const backupData2: ShortcutsStorageData = {
                version: STORAGE_VERSION,
                customShortcuts: { new: { key: 'N' } },
                disabledShortcuts: [],
                lastUpdated: Date.now() - 1000,
            }

            localStorage.setItem(`${STORAGE_KEY}-backup-1000`, JSON.stringify(backupData1))
            localStorage.setItem(`${STORAGE_KEY}-backup-2000`, JSON.stringify(backupData2))

            const result = ShortcutStorageManager.restore()
            
            expect(result).toBe(true)
            
            const restored = localStorage.getItem(STORAGE_KEY)
            expect(JSON.parse(restored!)).toEqual(backupData2)
        })

        it('应该在没有备份时返回 false', () => {
            const result = ShortcutStorageManager.restore()
            
            expect(result).toBe(false)
            expect(console.warn).toHaveBeenCalledWith('未找到备份')
        })

        it('应该在备份不存在时返回 false', () => {
            const result = ShortcutStorageManager.restore(9999999)
            
            expect(result).toBe(false)
            expect(console.warn).toHaveBeenCalledWith('备份数据不存在')
        })
    })

    describe('listBackups()', () => {
        it('应该列出所有备份', () => {
            const testData: ShortcutsStorageData = {
                version: STORAGE_VERSION,
                customShortcuts: {},
                disabledShortcuts: [],
                lastUpdated: Date.now(),
            }

            const timestamps = [1000, 2000, 3000]
            timestamps.forEach(ts => {
                localStorage.setItem(
                    `${STORAGE_KEY}-backup-${ts}`,
                    JSON.stringify(testData)
                )
            })

            const backups = ShortcutStorageManager.listBackups()
            
            expect(backups.length).toBe(3)
            expect(backups[0].timestamp).toBe(3000) // 最新的在前
            expect(backups[1].timestamp).toBe(2000)
            expect(backups[2].timestamp).toBe(1000)
        })

        it('应该包含格式化的日期', () => {
            const testData: ShortcutsStorageData = {
                version: STORAGE_VERSION,
                customShortcuts: {},
                disabledShortcuts: [],
                lastUpdated: Date.now(),
            }

            localStorage.setItem(
                `${STORAGE_KEY}-backup-1234567890`,
                JSON.stringify(testData)
            )

            const backups = ShortcutStorageManager.listBackups()
            
            expect(backups[0].date).toBeTruthy()
            expect(typeof backups[0].date).toBe('string')
        })

        it('应该在没有备份时返回空数组', () => {
            const backups = ShortcutStorageManager.listBackups()
            expect(backups).toEqual([])
        })
    })
})

describe('ShortcutSyncManager', () => {
    const STORAGE_KEY = 'zishu-shortcuts-config'

    beforeEach(() => {
        localStorage.clear()
        vi.clearAllMocks()
    })

    afterEach(() => {
        localStorage.clear()
        vi.restoreAllMocks()
    })

    describe('startListening()', () => {
        it('应该监听存储变化', () => {
            const callback = vi.fn()
            const unsubscribe = ShortcutSyncManager.startListening(callback)

            const testData: ShortcutsStorageData = {
                version: '1.0.0',
                customShortcuts: {},
                disabledShortcuts: [],
                lastUpdated: Date.now(),
            }

            // 模拟 storage 事件
            const event = new StorageEvent('storage', {
                key: STORAGE_KEY,
                newValue: JSON.stringify(testData),
                storageArea: localStorage,
            })

            window.dispatchEvent(event)

            expect(callback).toHaveBeenCalledWith(testData)

            unsubscribe()
        })

        it('应该忽略其他键的变化', () => {
            const callback = vi.fn()
            const unsubscribe = ShortcutSyncManager.startListening(callback)

            const event = new StorageEvent('storage', {
                key: 'other-key',
                newValue: 'some value',
                storageArea: localStorage,
            })

            window.dispatchEvent(event)

            expect(callback).not.toHaveBeenCalled()

            unsubscribe()
        })

        it('应该正确取消监听', () => {
            const callback = vi.fn()
            const unsubscribe = ShortcutSyncManager.startListening(callback)

            unsubscribe()

            const testData: ShortcutsStorageData = {
                version: '1.0.0',
                customShortcuts: {},
                disabledShortcuts: [],
                lastUpdated: Date.now(),
            }

            const event = new StorageEvent('storage', {
                key: STORAGE_KEY,
                newValue: JSON.stringify(testData),
                storageArea: localStorage,
            })

            window.dispatchEvent(event)

            expect(callback).not.toHaveBeenCalled()
        })

        it('应该处理无效的 JSON 数据', () => {
            const callback = vi.fn()
            const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
            const unsubscribe = ShortcutSyncManager.startListening(callback)

            const event = new StorageEvent('storage', {
                key: STORAGE_KEY,
                newValue: 'invalid json',
                storageArea: localStorage,
            })

            window.dispatchEvent(event)

            expect(callback).not.toHaveBeenCalled()
            expect(errorSpy).toHaveBeenCalled()

            unsubscribe()
        })

        it('应该支持多个监听器', () => {
            const callback1 = vi.fn()
            const callback2 = vi.fn()
            
            const unsubscribe1 = ShortcutSyncManager.startListening(callback1)
            const unsubscribe2 = ShortcutSyncManager.startListening(callback2)

            const testData: ShortcutsStorageData = {
                version: '1.0.0',
                customShortcuts: {},
                disabledShortcuts: [],
                lastUpdated: Date.now(),
            }

            const event = new StorageEvent('storage', {
                key: STORAGE_KEY,
                newValue: JSON.stringify(testData),
                storageArea: localStorage,
            })

            window.dispatchEvent(event)

            expect(callback1).toHaveBeenCalledWith(testData)
            expect(callback2).toHaveBeenCalledWith(testData)

            unsubscribe1()
            unsubscribe2()
        })
    })

    describe('notify()', () => {
        it('应该通知所有监听器', () => {
            const callback1 = vi.fn()
            const callback2 = vi.fn()
            
            ShortcutSyncManager.startListening(callback1)
            ShortcutSyncManager.startListening(callback2)

            const testData: ShortcutsStorageData = {
                version: '1.0.0',
                customShortcuts: {},
                disabledShortcuts: [],
                lastUpdated: Date.now(),
            }

            ShortcutSyncManager.notify(testData)

            expect(callback1).toHaveBeenCalledWith(testData)
            expect(callback2).toHaveBeenCalledWith(testData)
        })

        it('应该处理监听器中的错误', () => {
            const errorCallback = vi.fn(() => {
                throw new Error('Listener error')
            })
            const normalCallback = vi.fn()
            const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
            
            ShortcutSyncManager.startListening(errorCallback)
            ShortcutSyncManager.startListening(normalCallback)

            const testData: ShortcutsStorageData = {
                version: '1.0.0',
                customShortcuts: {},
                disabledShortcuts: [],
                lastUpdated: Date.now(),
            }

            ShortcutSyncManager.notify(testData)

            expect(errorCallback).toHaveBeenCalled()
            expect(normalCallback).toHaveBeenCalled()
            expect(errorSpy).toHaveBeenCalled()
        })
    })
})

