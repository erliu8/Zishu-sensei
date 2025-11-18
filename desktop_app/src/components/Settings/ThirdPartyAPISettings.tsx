/**
 * 第三方API设置组件
 * 用于配置和管理第三方模型API（GPT、Claude、Qwen等）
 */

import React, { useState, useEffect } from 'react'
import { Plus, Trash2, Eye, EyeOff, Check, X, Loader2 } from 'lucide-react'

// 支持的提供商列表
const PROVIDERS = [
    { value: 'openai', label: 'OpenAI (GPT)', defaultModel: 'gpt-3.5-turbo' },
    { value: 'anthropic', label: 'Anthropic (Claude)', defaultModel: 'claude-3-sonnet-20240229' },
    { value: 'qwen', label: '通义千问 (Qwen)', defaultModel: 'qwen-turbo' },
    { value: 'deepseek', label: 'DeepSeek', defaultModel: 'deepseek-chat' },
    { value: 'doubao', label: '豆包 (Doubao)', defaultModel: 'doubao-pro-4k' },
    { value: 'gemini', label: 'Google Gemini', defaultModel: 'gemini-pro' },
]

interface ThirdPartyAdapter {
    adapter_id: string
    name: string
    provider: string
    model: string
    status: string
}

export const ThirdPartyAPISettings: React.FC = () => {
    const [adapters, setAdapters] = useState<ThirdPartyAdapter[]>([])
    const [loading, setLoading] = useState(false)
    const [showAddForm, setShowAddForm] = useState(false)
    
    // 表单状态
    const [formData, setFormData] = useState({
        provider: 'openai',
        apiKey: '',
        model: 'gpt-3.5-turbo',
        apiBase: '',
        temperature: 0.7,
        maxTokens: 2000,
    })
    const [showApiKey, setShowApiKey] = useState(false)
    const [submitting, setSubmitting] = useState(false)

    // 加载已注册的适配器
    const loadAdapters = async () => {
        setLoading(true)
        try {
            const response = await fetch('http://localhost:8000/api/adapters/list')
            if (response.ok) {
                const data = await response.json()
                // 只显示第三方API适配器
                const thirdPartyAdapters = data.data.adapters.filter(
                    (adapter: any) => adapter.provider
                )
                setAdapters(thirdPartyAdapters)
            }
        } catch (error) {
            console.error('加载适配器列表失败:', error)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        loadAdapters()
    }, [])

    // 处理提供商变更
    const handleProviderChange = (provider: string) => {
        const providerInfo = PROVIDERS.find(p => p.value === provider)
        setFormData({
            ...formData,
            provider,
            model: providerInfo?.defaultModel || '',
        })
    }

    // 注册新适配器
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setSubmitting(true)

        try {
            const response = await fetch('http://localhost:8000/api/adapters/third-party/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    provider: formData.provider,
                    api_key: formData.apiKey,
                    model: formData.model,
                    api_base: formData.apiBase || undefined,
                    temperature: formData.temperature,
                    max_tokens: formData.maxTokens,
                }),
            })

            if (response.ok) {
                // 重置表单
                setFormData({
                    provider: 'openai',
                    apiKey: '',
                    model: 'gpt-3.5-turbo',
                    apiBase: '',
                    temperature: 0.7,
                    maxTokens: 2000,
                })
                setShowAddForm(false)
                // 重新加载列表
                await loadAdapters()
                alert('适配器注册成功！')
            } else {
                const error = await response.json()
                alert(`注册失败: ${error.detail || '未知错误'}`)
            }
        } catch (error) {
            console.error('注册适配器失败:', error)
            alert('注册失败，请检查网络连接')
        } finally {
            setSubmitting(false)
        }
    }

    // 删除适配器
    const handleDelete = async (adapterId: string) => {
        if (!confirm('确定要删除这个适配器吗？')) {
            return
        }

        try {
            const response = await fetch(`http://localhost:8000/api/adapters/${adapterId}`, {
                method: 'DELETE',
            })

            if (response.ok) {
                await loadAdapters()
                alert('适配器已删除')
            } else {
                alert('删除失败')
            }
        } catch (error) {
            console.error('删除适配器失败:', error)
            alert('删除失败')
        }
    }

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            width: '100%',
        }}>
            {/* 标题和添加按钮 */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
            }}>
                <h3 style={{
                    fontSize: '14px',
                    fontWeight: 500,
                    color: 'hsl(var(--color-foreground))',
                }}>
                    第三方模型API
                </h3>
                <button
                    onClick={() => setShowAddForm(!showAddForm)}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '6px 12px',
                        fontSize: '12px',
                        color: 'hsl(var(--color-primary-foreground))',
                        backgroundColor: 'hsl(var(--color-primary))',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                    }}
                >
                    {showAddForm ? <X size={14} /> : <Plus size={14} />}
                    {showAddForm ? '取消' : '添加API'}
                </button>
            </div>

            {/* 添加表单 */}
            {showAddForm && (
                <form onSubmit={handleSubmit} style={{
                    padding: '16px',
                    border: '1px solid hsl(var(--color-border))',
                    borderRadius: '8px',
                    backgroundColor: 'hsl(var(--color-muted) / 0.3)',
                }}>
                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px',
                    }}>
                        {/* 提供商选择 */}
                        <div>
                            <label style={{
                                display: 'block',
                                fontSize: '12px',
                                fontWeight: 500,
                                marginBottom: '4px',
                                color: 'hsl(var(--color-foreground))',
                            }}>
                                提供商 *
                            </label>
                            <select
                                value={formData.provider}
                                onChange={(e) => handleProviderChange(e.target.value)}
                                required
                                style={{
                                    width: '100%',
                                    padding: '8px',
                                    fontSize: '12px',
                                    border: '1px solid hsl(var(--color-border))',
                                    borderRadius: '4px',
                                    backgroundColor: 'hsl(var(--color-background))',
                                    color: 'hsl(var(--color-foreground))',
                                }}
                            >
                                {PROVIDERS.map(provider => (
                                    <option key={provider.value} value={provider.value}>
                                        {provider.label}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* API Key */}
                        <div>
                            <label style={{
                                display: 'block',
                                fontSize: '12px',
                                fontWeight: 500,
                                marginBottom: '4px',
                                color: 'hsl(var(--color-foreground))',
                            }}>
                                API Key *
                            </label>
                            <div style={{ position: 'relative' }}>
                                <input
                                    type={showApiKey ? 'text' : 'password'}
                                    value={formData.apiKey}
                                    onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                                    required
                                    placeholder="sk-..."
                                    style={{
                                        width: '100%',
                                        padding: '8px',
                                        paddingRight: '36px',
                                        fontSize: '12px',
                                        border: '1px solid hsl(var(--color-border))',
                                        borderRadius: '4px',
                                        backgroundColor: 'hsl(var(--color-background))',
                                        color: 'hsl(var(--color-foreground))',
                                    }}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowApiKey(!showApiKey)}
                                    style={{
                                        position: 'absolute',
                                        right: '8px',
                                        top: '50%',
                                        transform: 'translateY(-50%)',
                                        padding: '4px',
                                        border: 'none',
                                        background: 'transparent',
                                        cursor: 'pointer',
                                        color: 'hsl(var(--color-muted-foreground))',
                                    }}
                                >
                                    {showApiKey ? <EyeOff size={14} /> : <Eye size={14} />}
                                </button>
                            </div>
                        </div>

                        {/* 模型名称 */}
                        <div>
                            <label style={{
                                display: 'block',
                                fontSize: '12px',
                                fontWeight: 500,
                                marginBottom: '4px',
                                color: 'hsl(var(--color-foreground))',
                            }}>
                                模型名称 *
                            </label>
                            <input
                                type="text"
                                value={formData.model}
                                onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                                required
                                style={{
                                    width: '100%',
                                    padding: '8px',
                                    fontSize: '12px',
                                    border: '1px solid hsl(var(--color-border))',
                                    borderRadius: '4px',
                                    backgroundColor: 'hsl(var(--color-background))',
                                    color: 'hsl(var(--color-foreground))',
                                }}
                            />
                        </div>

                        {/* API Base URL (可选) */}
                        <div>
                            <label style={{
                                display: 'block',
                                fontSize: '12px',
                                fontWeight: 500,
                                marginBottom: '4px',
                                color: 'hsl(var(--color-foreground))',
                            }}>
                                API Base URL (可选)
                            </label>
                            <input
                                type="text"
                                value={formData.apiBase}
                                onChange={(e) => setFormData({ ...formData, apiBase: e.target.value })}
                                placeholder="留空使用默认URL"
                                style={{
                                    width: '100%',
                                    padding: '8px',
                                    fontSize: '12px',
                                    border: '1px solid hsl(var(--color-border))',
                                    borderRadius: '4px',
                                    backgroundColor: 'hsl(var(--color-background))',
                                    color: 'hsl(var(--color-foreground))',
                                }}
                            />
                        </div>

                        {/* 提交按钮 */}
                        <button
                            type="submit"
                            disabled={submitting}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '6px',
                                padding: '8px 16px',
                                fontSize: '12px',
                                fontWeight: 500,
                                color: 'hsl(var(--color-primary-foreground))',
                                backgroundColor: submitting 
                                    ? 'hsl(var(--color-muted))' 
                                    : 'hsl(var(--color-primary))',
                                border: 'none',
                                borderRadius: '6px',
                                cursor: submitting ? 'not-allowed' : 'pointer',
                            }}
                        >
                            {submitting ? (
                                <>
                                    <Loader2 size={14} className="animate-spin" />
                                    注册中...
                                </>
                            ) : (
                                <>
                                    <Check size={14} />
                                    注册适配器
                                </>
                            )}
                        </button>
                    </div>
                </form>
            )}

            {/* 已注册的适配器列表 */}
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
            }}>
                {loading ? (
                    <div style={{
                        padding: '20px',
                        textAlign: 'center',
                        color: 'hsl(var(--color-muted-foreground))',
                        fontSize: '12px',
                    }}>
                        <Loader2 size={20} className="animate-spin" style={{ margin: '0 auto' }} />
                        <p style={{ marginTop: '8px' }}>加载中...</p>
                    </div>
                ) : adapters.length === 0 ? (
                    <div style={{
                        padding: '20px',
                        textAlign: 'center',
                        color: 'hsl(var(--color-muted-foreground))',
                        fontSize: '12px',
                        border: '1px dashed hsl(var(--color-border))',
                        borderRadius: '8px',
                    }}>
                        暂无已注册的第三方API适配器
                    </div>
                ) : (
                    adapters.map(adapter => (
                        <div
                            key={adapter.adapter_id}
                            style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '12px',
                                border: '1px solid hsl(var(--color-border))',
                                borderRadius: '6px',
                                backgroundColor: 'hsl(var(--color-background))',
                            }}
                        >
                            <div style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '4px',
                            }}>
                                <div style={{
                                    fontSize: '13px',
                                    fontWeight: 500,
                                    color: 'hsl(var(--color-foreground))',
                                }}>
                                    {PROVIDERS.find(p => p.value === adapter.provider)?.label || adapter.provider}
                                </div>
                                <div style={{
                                    fontSize: '11px',
                                    color: 'hsl(var(--color-muted-foreground))',
                                }}>
                                    模型: {adapter.model}
                                </div>
                                <div style={{
                                    fontSize: '11px',
                                    color: adapter.status === 'running' 
                                        ? 'hsl(142 76% 36%)' 
                                        : 'hsl(var(--color-muted-foreground))',
                                }}>
                                    状态: {adapter.status}
                                </div>
                            </div>
                            <button
                                onClick={() => handleDelete(adapter.adapter_id)}
                                style={{
                                    padding: '6px',
                                    color: 'hsl(0 84% 60%)',
                                    border: 'none',
                                    background: 'transparent',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundColor = 'hsl(0 84% 60% / 0.1)'
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = 'transparent'
                                }}
                            >
                                <Trash2 size={16} />
                            </button>
                        </div>
                    ))
                )}
            </div>
        </div>
    )
}

export default ThirdPartyAPISettings
