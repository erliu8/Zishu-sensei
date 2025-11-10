/**
 * Prompt设置组件
 * 
 * 功能特性：
 * - ✏️ 创建和编辑Prompt
 * - 📋 管理Prompt列表
 * - ⭐ 设置默认Prompt
 * - 🎭 角色设定配置
 * - 🗑️ 删除Prompt
 * - 📊 显示使用统计
 */

import React, { useState, useEffect, useCallback } from 'react'
import { AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import { Plus, Edit, Trash2, Star, FileText, CheckCircle } from 'lucide-react'

// API服务
import PromptAPI from '@/services/api/prompt'
import type { Prompt, CreatePromptRequest, UpdatePromptRequest } from '@/types/prompt'
import { validatePromptContent, formatPromptPreview } from '@/types/prompt'

/**
 * 组件属性
 */
export interface PromptSettingsProps {
    className?: string
}

/**
 * Prompt设置组件
 */
export const PromptSettings: React.FC<PromptSettingsProps> = () => {
    // ==================== 状态管理 ====================
    const [prompts, setPrompts] = useState<Prompt[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [showEditDialog, setShowEditDialog] = useState(false)
    const [editingPrompt, setEditingPrompt] = useState<Prompt | null>(null)
    const [formData, setFormData] = useState({
        name: '',
        content: '',
        description: '',
        character_setting: '',
        set_as_default: false,
    })

    // ==================== 加载Prompt列表 ====================
    const loadPrompts = useCallback(async () => {
        setIsLoading(true)
        try {
            const promptList = await PromptAPI.getPrompts()
            setPrompts(promptList)
        } catch (error) {
            console.error('加载Prompt列表失败:', error)
            toast.error(`加载失败: ${error instanceof Error ? error.message : '未知错误'}`)
        } finally {
            setIsLoading(false)
        }
    }, [])

    useEffect(() => {
        loadPrompts()
    }, [loadPrompts])

    // ==================== 打开编辑对话框 ====================
    const openEditDialog = useCallback((prompt?: Prompt) => {
        if (prompt) {
            setEditingPrompt(prompt)
            setFormData({
                name: prompt.name,
                content: prompt.content,
                description: prompt.description || '',
                character_setting: prompt.character_setting || '',
                set_as_default: prompt.is_default,
            })
        } else {
            setEditingPrompt(null)
            setFormData({
                name: '',
                content: '',
                description: '',
                character_setting: '',
                set_as_default: false,
            })
        }
        setShowEditDialog(true)
    }, [])

    // ==================== 保存Prompt ====================
    const handleSave = useCallback(async () => {
        // 验证内容
        const validation = validatePromptContent(formData.content)
        if (!validation.valid) {
            toast.error(validation.error || 'Prompt内容无效')
            return
        }

        if (!formData.name.trim()) {
            toast.error('请输入Prompt名称')
            return
        }

        const toastId = toast.loading(editingPrompt ? '正在更新Prompt...' : '正在创建Prompt...')

        try {
            if (editingPrompt) {
                // 更新Prompt
                const updateRequest: UpdatePromptRequest = {
                    prompt_id: editingPrompt.id,
                    name: formData.name,
                    content: formData.content,
                    description: formData.description || undefined,
                    character_setting: formData.character_setting || undefined,
                    set_as_default: formData.set_as_default,
                }
                await PromptAPI.updatePrompt(updateRequest)
                toast.success('Prompt更新成功', { id: toastId })
            } else {
                // 创建Prompt
                const createRequest: CreatePromptRequest = {
                    name: formData.name,
                    content: formData.content,
                    description: formData.description || undefined,
                    character_setting: formData.character_setting || undefined,
                    set_as_default: formData.set_as_default,
                }
                await PromptAPI.createPrompt(createRequest)
                toast.success('Prompt创建成功', { id: toastId })
            }

            setShowEditDialog(false)
            await loadPrompts()
        } catch (error) {
            console.error('保存Prompt失败:', error)
            toast.error(
                `保存失败: ${error instanceof Error ? error.message : '未知错误'}`,
                { id: toastId }
            )
        }
    }, [formData, editingPrompt, loadPrompts])

    // ==================== 删除Prompt ====================
    const handleDelete = useCallback(async (promptId: string, promptName: string) => {
        if (!window.confirm(`确定要删除Prompt "${promptName}" 吗？此操作无法撤销。`)) {
            return
        }

        const toastId = toast.loading('正在删除Prompt...')

        try {
            await PromptAPI.deletePrompt({ prompt_id: promptId })
            toast.success('Prompt删除成功', { id: toastId })
            await loadPrompts()
        } catch (error) {
            console.error('删除Prompt失败:', error)
            toast.error(
                `删除失败: ${error instanceof Error ? error.message : '未知错误'}`,
                { id: toastId }
            )
        }
    }, [loadPrompts])

    // ==================== 应用Prompt ====================
    const handleApply = useCallback(async (promptId: string) => {
        const toastId = toast.loading('正在应用Prompt...')

        try {
            await PromptAPI.applyPrompt({ prompt_id: promptId })
            toast.success('Prompt已应用为默认', { id: toastId })
            await loadPrompts()
        } catch (error) {
            console.error('应用Prompt失败:', error)
            toast.error(
                `应用失败: ${error instanceof Error ? error.message : '未知错误'}`,
                { id: toastId }
            )
        }
    }, [loadPrompts])

    // ==================== 渲染 ====================
    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            width: '100%',
        }}>
            {/* 标题和操作栏 */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '20px',
            }}>
                <div>
                    <h3 style={{
                        fontSize: '16px',
                        fontWeight: 500,
                        color: 'hsl(var(--color-foreground))',
                        marginBottom: '4px',
                    }}>
                        Prompt管理
                    </h3>
                    <p style={{
                        fontSize: '12px',
                        color: 'hsl(var(--color-muted-foreground))',
                    }}>
                        创建和管理AI对话的Prompt模板
                    </p>
                </div>
                <button
                    onClick={() => openEditDialog()}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '8px 16px',
                        fontSize: '14px',
                        fontWeight: 500,
                        color: 'white',
                        backgroundColor: 'hsl(var(--color-primary))',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        transition: 'background-color 0.2s',
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'hsl(var(--color-primary) / 0.9)'
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'hsl(var(--color-primary))'
                    }}
                >
                    <Plus size={16} />
                    新建Prompt
                </button>
            </div>

            {/* Prompt列表 */}
            {isLoading ? (
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '48px 0',
                }}>
                    <div style={{
                        textAlign: 'center',
                    }}>
                        <div style={{
                            display: 'inline-block',
                            width: '24px',
                            height: '24px',
                            border: '3px solid hsl(var(--color-muted))',
                            borderTopColor: 'hsl(var(--color-primary))',
                            borderRadius: '50%',
                            animation: 'spin 1s linear infinite',
                            marginBottom: '12px',
                        }} />
                        <p style={{
                            fontSize: '14px',
                            color: 'hsl(var(--color-muted-foreground))',
                        }}>正在加载Prompt列表...</p>
                    </div>
                </div>
            ) : prompts.length === 0 ? (
                <div style={{
                    textAlign: 'center',
                    padding: '48px 0',
                    border: '2px dashed hsl(var(--color-border))',
                    borderRadius: '8px',
                    backgroundColor: 'hsl(var(--color-muted) / 0.1)',
                }}>
                    <FileText size={40} style={{
                        margin: '0 auto 12px',
                        color: 'hsl(var(--color-muted-foreground))',
                    }} />
                    <p style={{
                        fontSize: '14px',
                        color: 'hsl(var(--color-foreground))',
                        marginBottom: '8px',
                    }}>还没有创建任何Prompt</p>
                    <p style={{
                        fontSize: '12px',
                        color: 'hsl(var(--color-muted-foreground))',
                    }}>
                        点击"新建Prompt"按钮开始创建
                    </p>
                </div>
            ) : (
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                }}>
                    {prompts.map((prompt) => (
                        <div
                            key={prompt.id}
                            style={{
                                backgroundColor: 'hsl(var(--color-background))',
                                border: `1px solid ${prompt.is_default ? 'hsl(var(--color-primary))' : 'hsl(var(--color-border))'}`,
                                borderRadius: '8px',
                                padding: '16px',
                                transition: 'box-shadow 0.2s',
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.boxShadow = '0 2px 8px hsl(var(--color-muted) / 0.2)'
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.boxShadow = 'none'
                            }}
                        >
                            <div style={{
                                display: 'flex',
                                alignItems: 'flex-start',
                                justifyContent: 'space-between',
                                gap: '16px',
                            }}>
                                <div style={{
                                    flex: 1,
                                    minWidth: 0,
                                }}>
                                    <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        marginBottom: '8px',
                                        flexWrap: 'wrap',
                                    }}>
                                        <FileText size={18} style={{
                                            color: 'hsl(var(--color-primary))',
                                            flexShrink: 0,
                                        }} />
                                        <h4 style={{
                                            fontSize: '15px',
                                            fontWeight: 600,
                                            color: 'hsl(var(--color-foreground))',
                                            margin: 0,
                                        }}>
                                            {prompt.name}
                                        </h4>
                                        {prompt.is_default && (
                                            <span style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '4px',
                                                padding: '2px 8px',
                                                fontSize: '11px',
                                                backgroundColor: 'hsl(var(--color-primary) / 0.2)',
                                                color: 'hsl(var(--color-primary))',
                                                borderRadius: '4px',
                                            }}>
                                                <Star size={12} />
                                                默认
                                            </span>
                                        )}
                                        {prompt.is_enabled && (
                                            <span style={{
                                                padding: '2px 8px',
                                                fontSize: '11px',
                                                backgroundColor: 'hsl(142 76% 36% / 0.2)',
                                                color: 'hsl(142 76% 36%)',
                                                borderRadius: '4px',
                                            }}>
                                                已启用
                                            </span>
                                        )}
                                    </div>

                                    {prompt.description && (
                                        <p style={{
                                            fontSize: '13px',
                                            color: 'hsl(var(--color-muted-foreground))',
                                            marginBottom: '12px',
                                            lineHeight: '1.5',
                                        }}>
                                            {prompt.description}
                                        </p>
                                    )}

                                    <div style={{
                                        backgroundColor: 'hsl(var(--color-muted) / 0.1)',
                                        borderRadius: '6px',
                                        padding: '12px',
                                        marginBottom: '12px',
                                    }}>
                                        <p style={{
                                            fontSize: '12px',
                                            color: 'hsl(var(--color-foreground))',
                                            fontFamily: 'monospace',
                                            whiteSpace: 'pre-wrap',
                                            wordBreak: 'break-word',
                                            margin: 0,
                                            lineHeight: '1.5',
                                        }}>
                                            {formatPromptPreview(prompt.content, 200)}
                                        </p>
                                    </div>

                                    {prompt.character_setting && (
                                        <div style={{
                                            marginBottom: '12px',
                                        }}>
                                            <span style={{
                                                fontSize: '11px',
                                                color: 'hsl(var(--color-muted-foreground))',
                                            }}>角色设定: </span>
                                            <p style={{
                                                fontSize: '13px',
                                                color: 'hsl(var(--color-foreground))',
                                                marginTop: '4px',
                                                lineHeight: '1.5',
                                            }}>
                                                {formatPromptPreview(prompt.character_setting, 100)}
                                            </p>
                                        </div>
                                    )}

                                    <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '16px',
                                        fontSize: '11px',
                                        color: 'hsl(var(--color-muted-foreground))',
                                    }}>
                                        <span>使用次数: {prompt.usage_count}</span>
                                        <span>
                                            创建: {new Date(prompt.created_at).toLocaleDateString()}
                                        </span>
                                    </div>
                                </div>

                                <div style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '8px',
                                    flexShrink: 0,
                                }}>
                                    {!prompt.is_default && (
                                        <button
                                            onClick={() => handleApply(prompt.id)}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '4px',
                                                padding: '6px 12px',
                                                fontSize: '13px',
                                                color: 'hsl(var(--color-foreground))',
                                                backgroundColor: 'hsl(var(--color-muted) / 0.3)',
                                                border: 'none',
                                                borderRadius: '6px',
                                                cursor: 'pointer',
                                                transition: 'background-color 0.2s',
                                            }}
                                            title="设为默认"
                                            onMouseEnter={(e) => {
                                                e.currentTarget.style.backgroundColor = 'hsl(var(--color-muted) / 0.5)'
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.backgroundColor = 'hsl(var(--color-muted) / 0.3)'
                                            }}
                                        >
                                            <Star size={14} />
                                            设为默认
                                        </button>
                                    )}
                                    <button
                                        onClick={() => openEditDialog(prompt)}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '4px',
                                            padding: '6px 12px',
                                            fontSize: '13px',
                                            color: 'hsl(var(--color-foreground))',
                                            backgroundColor: 'hsl(var(--color-muted) / 0.3)',
                                            border: 'none',
                                            borderRadius: '6px',
                                            cursor: 'pointer',
                                            transition: 'background-color 0.2s',
                                        }}
                                        title="编辑"
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.backgroundColor = 'hsl(var(--color-muted) / 0.5)'
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.backgroundColor = 'hsl(var(--color-muted) / 0.3)'
                                        }}
                                    >
                                        <Edit size={14} />
                                        编辑
                                    </button>
                                    <button
                                        onClick={() => handleDelete(prompt.id, prompt.name)}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '4px',
                                            padding: '6px 12px',
                                            fontSize: '13px',
                                            color: 'hsl(0 72% 51%)',
                                            backgroundColor: 'hsl(0 72% 51% / 0.1)',
                                            border: 'none',
                                            borderRadius: '6px',
                                            cursor: 'pointer',
                                            transition: 'background-color 0.2s',
                                        }}
                                        title="删除"
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.backgroundColor = 'hsl(0 72% 51% / 0.2)'
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.backgroundColor = 'hsl(0 72% 51% / 0.1)'
                                        }}
                                    >
                                        <Trash2 size={14} />
                                        删除
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* 编辑对话框 */}
            <AnimatePresence>
                {showEditDialog && (
                    <div
                        style={{
                            position: 'fixed',
                            inset: 0,
                            backgroundColor: 'rgba(0, 0, 0, 0.5)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            zIndex: 1000,
                            padding: '16px',
                        }}
                        onClick={() => setShowEditDialog(false)}
                    >
                        <div
                            onClick={(e) => e.stopPropagation()}
                            style={{
                                backgroundColor: 'hsl(var(--color-background))',
                                borderRadius: '8px',
                                padding: '24px',
                                width: '100%',
                                maxWidth: '768px',
                                maxHeight: '90vh',
                                overflowY: 'auto',
                                boxShadow: '0 10px 40px rgba(0, 0, 0, 0.2)',
                            }}
                        >
                            <h3 style={{
                                fontSize: '18px',
                                fontWeight: 600,
                                color: 'hsl(var(--color-foreground))',
                                marginBottom: '20px',
                            }}>
                                {editingPrompt ? '编辑Prompt' : '新建Prompt'}
                            </h3>

                            <div style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '16px',
                            }}>
                                <div>
                                    <label style={{
                                        display: 'block',
                                        fontSize: '14px',
                                        fontWeight: 500,
                                        color: 'hsl(var(--color-foreground))',
                                        marginBottom: '8px',
                                    }}>
                                        Prompt名称 *
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.name}
                                        onChange={(e) =>
                                            setFormData({ ...formData, name: e.target.value })
                                        }
                                        placeholder="例如: 角色扮演助手"
                                        style={{
                                            width: '100%',
                                            padding: '8px 12px',
                                            fontSize: '14px',
                                            border: '1px solid hsl(var(--color-border))',
                                            borderRadius: '6px',
                                            backgroundColor: 'hsl(var(--color-background))',
                                            color: 'hsl(var(--color-foreground))',
                                            outline: 'none',
                                        }}
                                        onFocus={(e) => {
                                            e.currentTarget.style.borderColor = 'hsl(var(--color-primary))'
                                            e.currentTarget.style.boxShadow = '0 0 0 2px hsl(var(--color-primary) / 0.2)'
                                        }}
                                        onBlur={(e) => {
                                            e.currentTarget.style.borderColor = 'hsl(var(--color-border))'
                                            e.currentTarget.style.boxShadow = 'none'
                                        }}
                                    />
                                </div>

                                <div>
                                    <label style={{
                                        display: 'block',
                                        fontSize: '14px',
                                        fontWeight: 500,
                                        color: 'hsl(var(--color-foreground))',
                                        marginBottom: '8px',
                                    }}>
                                        描述（可选）
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.description}
                                        onChange={(e) =>
                                            setFormData({ ...formData, description: e.target.value })
                                        }
                                        placeholder="简短描述这个Prompt的用途..."
                                        style={{
                                            width: '100%',
                                            padding: '8px 12px',
                                            fontSize: '14px',
                                            border: '1px solid hsl(var(--color-border))',
                                            borderRadius: '6px',
                                            backgroundColor: 'hsl(var(--color-background))',
                                            color: 'hsl(var(--color-foreground))',
                                            outline: 'none',
                                        }}
                                        onFocus={(e) => {
                                            e.currentTarget.style.borderColor = 'hsl(var(--color-primary))'
                                            e.currentTarget.style.boxShadow = '0 0 0 2px hsl(var(--color-primary) / 0.2)'
                                        }}
                                        onBlur={(e) => {
                                            e.currentTarget.style.borderColor = 'hsl(var(--color-border))'
                                            e.currentTarget.style.boxShadow = 'none'
                                        }}
                                    />
                                </div>

                                <div>
                                    <label style={{
                                        display: 'block',
                                        fontSize: '14px',
                                        fontWeight: 500,
                                        color: 'hsl(var(--color-foreground))',
                                        marginBottom: '8px',
                                    }}>
                                        Prompt内容 *
                                    </label>
                                    <textarea
                                        value={formData.content}
                                        onChange={(e) =>
                                            setFormData({ ...formData, content: e.target.value })
                                        }
                                        placeholder="输入Prompt内容，例如：你是一个友好的AI助手..."
                                        rows={8}
                                        style={{
                                            width: '100%',
                                            padding: '8px 12px',
                                            fontSize: '13px',
                                            border: '1px solid hsl(var(--color-border))',
                                            borderRadius: '6px',
                                            backgroundColor: 'hsl(var(--color-background))',
                                            color: 'hsl(var(--color-foreground))',
                                            outline: 'none',
                                            resize: 'none',
                                            fontFamily: 'monospace',
                                        }}
                                        onFocus={(e) => {
                                            e.currentTarget.style.borderColor = 'hsl(var(--color-primary))'
                                            e.currentTarget.style.boxShadow = '0 0 0 2px hsl(var(--color-primary) / 0.2)'
                                        }}
                                        onBlur={(e) => {
                                            e.currentTarget.style.borderColor = 'hsl(var(--color-border))'
                                            e.currentTarget.style.boxShadow = 'none'
                                        }}
                                    />
                                    <p style={{
                                        fontSize: '11px',
                                        color: 'hsl(var(--color-muted-foreground))',
                                        marginTop: '4px',
                                    }}>
                                        {formData.content.length} / 100000 字符
                                    </p>
                                </div>

                                <div>
                                    <label style={{
                                        display: 'block',
                                        fontSize: '14px',
                                        fontWeight: 500,
                                        color: 'hsl(var(--color-foreground))',
                                        marginBottom: '8px',
                                    }}>
                                        角色设定（可选）
                                    </label>
                                    <textarea
                                        value={formData.character_setting}
                                        onChange={(e) =>
                                            setFormData({ ...formData, character_setting: e.target.value })
                                        }
                                        placeholder="描述角色的性格、背景、说话风格等..."
                                        rows={4}
                                        style={{
                                            width: '100%',
                                            padding: '8px 12px',
                                            fontSize: '14px',
                                            border: '1px solid hsl(var(--color-border))',
                                            borderRadius: '6px',
                                            backgroundColor: 'hsl(var(--color-background))',
                                            color: 'hsl(var(--color-foreground))',
                                            outline: 'none',
                                            resize: 'none',
                                            fontFamily: 'inherit',
                                        }}
                                        onFocus={(e) => {
                                            e.currentTarget.style.borderColor = 'hsl(var(--color-primary))'
                                            e.currentTarget.style.boxShadow = '0 0 0 2px hsl(var(--color-primary) / 0.2)'
                                        }}
                                        onBlur={(e) => {
                                            e.currentTarget.style.borderColor = 'hsl(var(--color-border))'
                                            e.currentTarget.style.boxShadow = 'none'
                                        }}
                                    />
                                </div>

                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                }}>
                                    <input
                                        type="checkbox"
                                        id="set-as-default"
                                        checked={formData.set_as_default}
                                        onChange={(e) =>
                                            setFormData({ ...formData, set_as_default: e.target.checked })
                                        }
                                        style={{
                                            width: '16px',
                                            height: '16px',
                                            cursor: 'pointer',
                                        }}
                                    />
                                    <label
                                        htmlFor="set-as-default"
                                        style={{
                                            marginLeft: '8px',
                                            fontSize: '13px',
                                            color: 'hsl(var(--color-foreground))',
                                            cursor: 'pointer',
                                        }}
                                    >
                                        设为默认Prompt（使用本地LLM时自动应用）
                                    </label>
                                </div>
                            </div>

                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'flex-end',
                                gap: '12px',
                                marginTop: '24px',
                            }}>
                                <button
                                    onClick={() => setShowEditDialog(false)}
                                    style={{
                                        padding: '8px 16px',
                                        fontSize: '14px',
                                        color: 'hsl(var(--color-foreground))',
                                        backgroundColor: 'hsl(var(--color-muted) / 0.3)',
                                        border: 'none',
                                        borderRadius: '6px',
                                        cursor: 'pointer',
                                        transition: 'background-color 0.2s',
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.backgroundColor = 'hsl(var(--color-muted) / 0.5)'
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.backgroundColor = 'hsl(var(--color-muted) / 0.3)'
                                    }}
                                >
                                    取消
                                </button>
                                <button
                                    onClick={handleSave}
                                    disabled={!formData.name.trim() || !formData.content.trim()}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        padding: '8px 16px',
                                        fontSize: '14px',
                                        fontWeight: 500,
                                        color: 'white',
                                        backgroundColor: 'hsl(var(--color-primary))',
                                        border: 'none',
                                        borderRadius: '6px',
                                        cursor: (!formData.name.trim() || !formData.content.trim()) ? 'not-allowed' : 'pointer',
                                        opacity: (!formData.name.trim() || !formData.content.trim()) ? 0.5 : 1,
                                        transition: 'background-color 0.2s',
                                    }}
                                    onMouseEnter={(e) => {
                                        if (formData.name.trim() && formData.content.trim()) {
                                            e.currentTarget.style.backgroundColor = 'hsl(var(--color-primary) / 0.9)'
                                        }
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.backgroundColor = 'hsl(var(--color-primary))'
                                    }}
                                >
                                    <CheckCircle size={16} />
                                    {editingPrompt ? '更新' : '创建'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    )
}

/**
 * 默认导出
 */
export default PromptSettings

