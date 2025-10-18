/**
 * 快捷键设置面板组件
 * 
 * 提供快捷键的查看、编辑和管理功能
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import type { ShortcutConfig } from '@/types/shortcuts'
import useKeyboardShortcuts from '@/hooks/useKeyboardShortcuts'
import { 
    shortcutToDisplayString, 
    formatCategoryName, 
    formatScopeName,
    groupShortcutsByCategory,
    searchShortcuts,
} from '@/utils/shortcutHelpers'
import { ShortcutStorageManager } from '@/utils/shortcutStorage'
import { SHORTCUT_GROUPS } from '@/config/shortcutPresets'
import './ShortcutsPanel.css'

interface ShortcutsPanelProps {
    /** 是否显示 */
    visible?: boolean
    /** 关闭回调 */
    onClose?: () => void
}

/**
 * 快捷键设置面板
 */
export const ShortcutsPanel: React.FC<ShortcutsPanelProps> = ({ 
    visible = true, 
    onClose 
}) => {
    const shortcuts = useKeyboardShortcuts()
    const [searchQuery, setSearchQuery] = useState('')
    const [selectedCategory, setSelectedCategory] = useState<string>('all')
    const [editingId, setEditingId] = useState<string | null>(null)
    const [isRecording, setIsRecording] = useState(false)
    const [recordedShortcut, setRecordedShortcut] = useState<Partial<ShortcutConfig> | null>(null)

    // 获取所有已注册的快捷键
    const registeredShortcuts = shortcuts.getRegisteredShortcuts()

    // 搜索和过滤
    const filteredShortcuts = useMemo(() => {
        let result = registeredShortcuts

        // 搜索过滤
        if (searchQuery) {
            result = searchShortcuts(result, searchQuery)
        }

        // 分类过滤
        if (selectedCategory !== 'all') {
            result = result.filter(s => s.category === selectedCategory)
        }

        return result
    }, [registeredShortcuts, searchQuery, selectedCategory])

    // 按分类分组
    const groupedShortcuts = useMemo(() => {
        return groupShortcutsByCategory(filteredShortcuts)
    }, [filteredShortcuts])

    // 统计信息
    const statistics = useMemo(() => {
        const total = registeredShortcuts.length
        const enabled = registeredShortcuts.filter(s => s.enabled).length
        const global = registeredShortcuts.filter(s => s.scope === 'global').length
        
        return { total, enabled, global }
    }, [registeredShortcuts])

    // 切换快捷键启用状态
    const handleToggle = useCallback(async (id: string, enabled: boolean) => {
        try {
            await shortcuts.toggleShortcut(id, enabled)
            // 保存到本地存储
            ShortcutStorageManager.save(shortcuts.getRegisteredShortcuts())
        } catch (error) {
            console.error('切换快捷键状态失败:', error)
            alert('切换快捷键状态失败')
        }
    }, [shortcuts])

    // 开始编辑快捷键
    const handleEdit = useCallback((id: string) => {
        setEditingId(id)
        setIsRecording(false)
        setRecordedShortcut(null)
    }, [])

    // 取消编辑
    const handleCancelEdit = useCallback(() => {
        setEditingId(null)
        setIsRecording(false)
        setRecordedShortcut(null)
    }, [])

    // 开始录制快捷键
    const handleStartRecording = useCallback(() => {
        setIsRecording(true)
        setRecordedShortcut(null)
    }, [])

    // 保存快捷键
    const handleSave = useCallback(async () => {
        if (!editingId || !recordedShortcut) {
            return
        }

        try {
            const existingShortcut = registeredShortcuts.find(s => s.id === editingId)
            if (!existingShortcut) {
                throw new Error('快捷键不存在')
            }

            // 检查冲突
            const conflicts = await shortcuts.checkConflict({
                ...existingShortcut,
                ...recordedShortcut,
            } as ShortcutConfig)

            if (conflicts.length > 0) {
                const confirmUpdate = window.confirm(
                    `此快捷键与以下快捷键冲突：\n${conflicts.join(', ')}\n\n是否仍要更新？`
                )
                if (!confirmUpdate) {
                    return
                }
            }

            // 更新快捷键
            await shortcuts.updateShortcut(editingId, {
                ...existingShortcut,
                ...recordedShortcut,
            } as ShortcutConfig)

            // 保存到本地存储
            ShortcutStorageManager.save(shortcuts.getRegisteredShortcuts())

            // 完成编辑
            handleCancelEdit()
            alert('快捷键已更新')
        } catch (error) {
            console.error('保存快捷键失败:', error)
            alert('保存快捷键失败')
        }
    }, [editingId, recordedShortcut, registeredShortcuts, shortcuts, handleCancelEdit])

    // 重置快捷键
    const handleReset = useCallback(async (id: string) => {
        const confirmReset = window.confirm('确定要重置此快捷键到默认配置吗？')
        if (!confirmReset) {
            return
        }

        try {
            // 从预设中查找默认配置
            const { getAdjustedShortcuts } = await import('@/config/shortcutPresets')
            const presets = getAdjustedShortcuts()
            const preset = presets.find(p => p.id === id)

            if (!preset) {
                throw new Error('未找到默认配置')
            }

            const existingShortcut = registeredShortcuts.find(s => s.id === id)
            if (!existingShortcut) {
                throw new Error('快捷键不存在')
            }

            await shortcuts.updateShortcut(id, {
                ...existingShortcut,
                ...preset,
            } as ShortcutConfig)

            ShortcutStorageManager.save(shortcuts.getRegisteredShortcuts())
            alert('快捷键已重置')
        } catch (error) {
            console.error('重置快捷键失败:', error)
            alert('重置快捷键失败')
        }
    }, [registeredShortcuts, shortcuts])

    // 全部重置
    const handleResetAll = useCallback(async () => {
        const confirmReset = window.confirm('确定要重置所有快捷键到默认配置吗？此操作不可撤销！')
        if (!confirmReset) {
            return
        }

        try {
            ShortcutStorageManager.clear()
            window.location.reload() // 重新加载页面以应用默认配置
        } catch (error) {
            console.error('重置所有快捷键失败:', error)
            alert('重置所有快捷键失败')
        }
    }, [])

    // 导出配置
    const handleExport = useCallback(() => {
        try {
            const config = ShortcutStorageManager.export()
            const blob = new Blob([config], { type: 'application/json' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `zishu-shortcuts-${Date.now()}.json`
            a.click()
            URL.revokeObjectURL(url)
        } catch (error) {
            console.error('导出配置失败:', error)
            alert('导出配置失败')
        }
    }, [])

    // 导入配置
    const handleImport = useCallback(() => {
        const input = document.createElement('input')
        input.type = 'file'
        input.accept = 'application/json'
        input.onchange = async (e) => {
            const file = (e.target as HTMLInputElement).files?.[0]
            if (!file) return

            try {
                const text = await file.text()
                const success = ShortcutStorageManager.import(text)
                
                if (success) {
                    window.location.reload() // 重新加载页面以应用配置
                } else {
                    alert('导入配置失败：格式无效')
                }
            } catch (error) {
                console.error('导入配置失败:', error)
                alert('导入配置失败')
            }
        }
        input.click()
    }, [])

    // 监听键盘事件进行录制
    useEffect(() => {
        if (!isRecording) return

        const handleKeyDown = (event: KeyboardEvent) => {
            event.preventDefault()
            event.stopPropagation()

            // 忽略单独的修饰键
            if (['Control', 'Alt', 'Shift', 'Meta'].includes(event.key)) {
                return
            }

            // 记录快捷键
            setRecordedShortcut({
                key: event.key,
                modifiers: {
                    ctrl: event.ctrlKey,
                    alt: event.altKey,
                    shift: event.shiftKey,
                    meta: event.metaKey,
                },
            })

            setIsRecording(false)
        }

        document.addEventListener('keydown', handleKeyDown, true)
        return () => {
            document.removeEventListener('keydown', handleKeyDown, true)
        }
    }, [isRecording])

    if (!visible) {
        return null
    }

    return (
        <div className="shortcuts-panel">
            {/* 头部 */}
            <div className="shortcuts-header">
                <h2>⌨️ 快捷键设置</h2>
                {onClose && (
                    <button className="close-button" onClick={onClose}>✕</button>
                )}
            </div>

            {/* 统计信息 */}
            <div className="shortcuts-stats">
                <div className="stat-item">
                    <span className="stat-label">总计</span>
                    <span className="stat-value">{statistics.total}</span>
                </div>
                <div className="stat-item">
                    <span className="stat-label">已启用</span>
                    <span className="stat-value">{statistics.enabled}</span>
                </div>
                <div className="stat-item">
                    <span className="stat-label">全局</span>
                    <span className="stat-value">{statistics.global}</span>
                </div>
            </div>

            {/* 搜索和过滤 */}
            <div className="shortcuts-toolbar">
                <input
                    type="text"
                    className="search-input"
                    placeholder="搜索快捷键..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
                <select
                    className="category-select"
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                >
                    <option value="all">全部分类</option>
                    {SHORTCUT_GROUPS.map(group => (
                        <option key={group.id} value={group.id}>
                            {group.icon} {group.name}
                        </option>
                    ))}
                </select>
            </div>

            {/* 操作按钮 */}
            <div className="shortcuts-actions">
                <button className="action-button" onClick={handleResetAll}>
                    🔄 重置全部
                </button>
                <button className="action-button" onClick={handleExport}>
                    📤 导出配置
                </button>
                <button className="action-button" onClick={handleImport}>
                    📥 导入配置
                </button>
            </div>

            {/* 快捷键列表 */}
            <div className="shortcuts-list">
                {Object.entries(groupedShortcuts).map(([category, categoryShortcuts]) => (
                    <div key={category} className="shortcut-category">
                        <h3 className="category-title">
                            {SHORTCUT_GROUPS.find(g => g.id === category)?.icon} {formatCategoryName(category)}
                        </h3>
                        {categoryShortcuts.map((shortcut) => (
                            <div 
                                key={shortcut.id} 
                                className={`shortcut-item ${editingId === shortcut.id ? 'editing' : ''} ${!shortcut.enabled ? 'disabled' : ''}`}
                            >
                                <div className="shortcut-info">
                                    <div className="shortcut-name">
                                        {shortcut.name}
                                        {shortcut.scope === 'global' && <span className="global-badge">全局</span>}
                                    </div>
                                    <div className="shortcut-description">
                                        {shortcut.description}
                                    </div>
                                </div>

                                <div className="shortcut-key">
                                    {editingId === shortcut.id ? (
                                        <div className="shortcut-editor">
                                            {isRecording ? (
                                                <div className="recording-indicator">
                                                    ⏺ 按下新的快捷键...
                                                </div>
                                            ) : recordedShortcut ? (
                                                <div className="recorded-key">
                                                    {shortcutToDisplayString(recordedShortcut as any)}
                                                </div>
                                            ) : (
                                                <div className="current-key">
                                                    {shortcutToDisplayString(shortcut)}
                                                </div>
                                            )}
                                            <div className="editor-buttons">
                                                {!isRecording && !recordedShortcut && (
                                                    <button onClick={handleStartRecording}>
                                                        录制
                                                    </button>
                                                )}
                                                {recordedShortcut && (
                                                    <>
                                                        <button onClick={handleSave}>
                                                            保存
                                                        </button>
                                                        <button onClick={handleCancelEdit}>
                                                            取消
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    ) : (
                                        <kbd className="key-display">
                                            {shortcutToDisplayString(shortcut)}
                                        </kbd>
                                    )}
                                </div>

                                <div className="shortcut-controls">
                                    <label className="toggle-switch">
                                        <input
                                            type="checkbox"
                                            checked={shortcut.enabled}
                                            onChange={(e) => handleToggle(shortcut.id, e.target.checked)}
                                        />
                                        <span className="toggle-slider"></span>
                                    </label>

                                    {shortcut.customizable !== false && (
                                        <>
                                            <button
                                                className="edit-button"
                                                onClick={() => handleEdit(shortcut.id)}
                                                disabled={editingId === shortcut.id}
                                            >
                                                ✏️
                                            </button>
                                            <button
                                                className="reset-button"
                                                onClick={() => handleReset(shortcut.id)}
                                                title="重置到默认"
                                            >
                                                🔄
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                ))}
            </div>

            {/* 空状态 */}
            {filteredShortcuts.length === 0 && (
                <div className="empty-state">
                    <p>😕 没有找到匹配的快捷键</p>
                </div>
            )}
        </div>
    )
}

export default ShortcutsPanel

