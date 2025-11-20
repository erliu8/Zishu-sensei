import { motion } from 'framer-motion'
import React, { useState, useCallback } from 'react'
import { ModelSelector } from '@/components/Character/ModelSelector'
import { useModelLoader } from '@/components/Character/ModelLoader'
import { AISettings } from './AISettings'
import styles from './SettingsPanel.module.css'

interface SettingsPanelProps {
    onClose: () => void
    onReset: () => void
}

/**
 * 设置面板组件
 */
export const SettingsPanel: React.FC<SettingsPanelProps> = ({
    onClose,
    onReset,
}) => {
    // 使用模型加载器 Hook
    const { currentCharacter, characterList, switchCharacter, loadCharacters } = useModelLoader()
    const [isModelSwitching, setIsModelSwitching] = useState(false)

    // 加载角色列表（获取当前激活的角色）
    React.useEffect(() => {
        loadCharacters().catch(err => {
            console.error('❌ 加载角色列表失败:', err)
        })
    }, [loadCharacters])

    // 处理模型切换
    const handleModelSelect = useCallback(async (modelId: string) => {
        try {
            setIsModelSwitching(true)
            console.log('🔄 正在切换模型:', modelId)
            
            // 添加超时机制，10秒后强制结束
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('切换超时，请检查网络连接或重试')), 10000)
            })
            
            await Promise.race([
                switchCharacter(modelId),
                timeoutPromise
            ])
            
            console.log('✅ 模型切换成功:', modelId)
        } catch (error) {
            console.error('❌ 模型切换失败:', error)
            const errorMsg = error instanceof Error ? error.message : '未知错误'
            // 可以在这里添加用户提示
            alert(`模型切换失败: ${errorMsg}`)
        } finally {
            // 确保无论如何都会重置状态
            setIsModelSwitching(false)
        }
    }, [switchCharacter])

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            style={{
                width: '100%',
                height: '100%',
                maxHeight: '100vh',
                display: 'flex',
                flexDirection: 'column',
                backgroundColor: 'hsl(var(--color-background))',
                color: 'hsl(var(--color-foreground))',
                overflow: 'hidden',
                position: 'relative',
            } as React.CSSProperties}
        >
            {/* 标题栏 */}
            <div 
                data-tauri-drag-region
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '16px',
                    borderBottom: '1px solid hsl(var(--color-border))',
                    cursor: 'move',
                    flexShrink: 0,
                    backgroundColor: 'hsl(var(--color-background))',
                    position: 'relative',
                    zIndex: 1,
                }}
            >
                <h1 style={{
                    fontSize: '18px',
                    fontWeight: 600,
                    color: 'hsl(var(--color-foreground))',
                }}>
                    设置
                </h1>
                <button
                    onClick={onClose}
                    data-tauri-drag-region={false}
                    style={{
                        padding: '8px',
                        color: 'hsl(var(--color-muted-foreground))',
                        borderRadius: '6px',
                        border: 'none',
                        background: 'transparent',
                        cursor: 'pointer',
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'hsl(var(--color-accent))'
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent'
                    }}
                >
                    ✕
                </button>
            </div>

            {/* 设置内容 */}
            <div className={styles.settingsScrollContainer}>
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '24px',
                }}>
                    {/* 基础设置 */}
                    <section>
                        <h2 style={{
                            fontSize: '16px',
                            fontWeight: 500,
                            color: 'hsl(var(--color-foreground))',
                            marginBottom: '12px',
                        }}>
                            基础设置
                        </h2>
                        <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '12px',
                        }}>
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                            }}>
                                <label style={{
                                    fontSize: '14px',
                                    color: 'hsl(var(--color-foreground))',
                                }}>
                                    开机自启动
                                </label>
                                <input
                                    type="checkbox"
                                    style={{
                                        width: '20px',
                                        height: '20px',
                                        cursor: 'pointer',
                                    }}
                                />
                            </div>
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                            }}>
                                <label style={{
                                    fontSize: '14px',
                                    color: 'hsl(var(--color-foreground))',
                                }}>
                                    最小化到托盘
                                </label>
                                <input
                                    type="checkbox"
                                    defaultChecked
                                    style={{
                                        width: '20px',
                                        height: '20px',
                                        cursor: 'pointer',
                                    }}
                                />
                            </div>
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                            }}>
                                <label style={{
                                    fontSize: '14px',
                                    color: 'hsl(var(--color-foreground))',
                                }}>
                                    启用通知
                                </label>
                                <input
                                    type="checkbox"
                                    defaultChecked
                                    style={{
                                        width: '20px',
                                        height: '20px',
                                        cursor: 'pointer',
                                    }}
                                />
                            </div>
                        </div>
                    </section>

                    {/* 外观设置 */}
                    <section>
                        <h2 style={{
                            fontSize: '16px',
                            fontWeight: 500,
                            color: 'hsl(var(--color-foreground))',
                            marginBottom: '12px',
                        }}>
                            外观设置
                        </h2>
                        <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '12px',
                        }}>
                            <div>
                                <label style={{
                                    display: 'block',
                                    fontSize: '14px',
                                    color: 'hsl(var(--color-foreground))',
                                    marginBottom: '4px',
                                }}>
                                    主题
                                </label>
                                <select style={{
                                    width: '100%',
                                    padding: '8px 12px',
                                    border: '1px solid hsl(var(--color-border))',
                                    borderRadius: '6px',
                                    backgroundColor: 'hsl(var(--color-background))',
                                    color: 'hsl(var(--color-foreground))',
                                    cursor: 'pointer',
                                }}>
                                    <option value="system">跟随系统</option>
                                    <option value="light">浅色主题</option>
                                    <option value="dark">深色主题</option>
                                </select>
                            </div>
                            <div>
                                <label style={{
                                    display: 'block',
                                    fontSize: '14px',
                                    color: 'hsl(var(--color-foreground))',
                                    marginBottom: '4px',
                                }}>
                                    语言
                                </label>
                                <select style={{
                                    width: '100%',
                                    padding: '8px 12px',
                                    border: '1px solid hsl(var(--color-border))',
                                    borderRadius: '6px',
                                    backgroundColor: 'hsl(var(--color-background))',
                                    color: 'hsl(var(--color-foreground))',
                                    cursor: 'pointer',
                                }}>
                                    <option value="zh-CN">简体中文</option>
                                    <option value="en-US">English</option>
                                    <option value="ja-JP">日本語</option>
                                </select>
                            </div>
                        </div>
                    </section>

                    {/* 角色设置 */}
                    <section>
                        <h2 style={{
                            fontSize: '16px',
                            fontWeight: 500,
                            color: 'hsl(var(--color-foreground))',
                            marginBottom: '12px',
                        }}>
                            角色设置
                        </h2>
                        <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '12px',
                        }}>
                            <div>
                                <label style={{
                                    display: 'block',
                                    fontSize: '14px',
                                    color: 'hsl(var(--color-foreground))',
                                    marginBottom: '4px',
                                }}>
                                    音量
                                </label>
                                <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    defaultValue="80"
                                    style={{
                                        width: '100%',
                                        cursor: 'pointer',
                                    }}
                                />
                            </div>
                            <div>
                                <label style={{
                                    display: 'block',
                                    fontSize: '14px',
                                    color: 'hsl(var(--color-foreground))',
                                    marginBottom: '4px',
                                }}>
                                    动画速度
                                </label>
                                <input
                                    type="range"
                                    min="0.5"
                                    max="2"
                                    step="0.1"
                                    defaultValue="1"
                                    style={{
                                        width: '100%',
                                        cursor: 'pointer',
                                    }}
                                />
                            </div>
                        </div>
                    </section>

                    {/* Live2D模型设置 */}
                    <section>
                        <h2 style={{
                            fontSize: '16px',
                            fontWeight: 500,
                            color: 'hsl(var(--color-foreground))',
                            marginBottom: '12px',
                        }}>
                            Live2D模型设置
                        </h2>
                        <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '12px',
                        }}>
                            <div>
                                <label style={{
                                    display: 'block',
                                    fontSize: '14px',
                                    color: 'hsl(var(--color-foreground))',
                                    marginBottom: '8px',
                                }}>
                                    选择角色模型
                                </label>
                                <div style={{
                                    position: 'relative',
                                }}>
                                    {isModelSwitching && (
                                        <div style={{
                                            position: 'absolute',
                                            top: '50%',
                                            left: '50%',
                                            transform: 'translate(-50%, -50%)',
                                            zIndex: 10,
                                            background: 'rgba(255, 255, 255, 0.9)',
                                            padding: '8px 16px',
                                            borderRadius: '8px',
                                            fontSize: '12px',
                                            color: 'hsl(var(--color-foreground))',
                                            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                                        }}>
                                            切换中...
                                        </div>
                                    )}
                                    <ModelSelector
                                        currentModelId={currentCharacter?.id || 'hiyori'}
                                        onModelSelect={handleModelSelect}
                                        models={characterList}
                                        isLoading={!currentCharacter && characterList.length === 0}
                                    />
                                </div>
                                <p style={{
                                    fontSize: '12px',
                                    color: 'hsl(var(--color-muted-foreground))',
                                    marginTop: '8px',
                                    lineHeight: '1.5',
                                }}>
                                    当前模型: {currentCharacter?.name || '未知'}
                                </p>
                            </div>
                        </div>
                    </section>

                    {/* AI设置 */}
                    <section>
                        <h2 style={{
                            fontSize: '16px',
                            fontWeight: 500,
                            color: 'hsl(var(--color-foreground))',
                            marginBottom: '12px',
                        }}>
                            AI设置
                        </h2>
                        <div style={{
                            marginTop: '12px',
                        }}>
                            <AISettings />
                        </div>
                    </section>
                </div>
            </div>

            {/* 底部按钮 */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px',
                borderTop: '1px solid hsl(var(--color-border))',
                backgroundColor: 'hsl(var(--color-background))',
                flexShrink: 0,
                position: 'relative',
                zIndex: 1,
            }}>
                <button
                    onClick={onReset}
                    style={{
                        padding: '8px 16px',
                        fontSize: '14px',
                        color: 'hsl(var(--color-muted-foreground))',
                        border: 'none',
                        background: 'transparent',
                        cursor: 'pointer',
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.color = 'hsl(var(--color-foreground))'
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.color = 'hsl(var(--color-muted-foreground))'
                    }}
                >
                    重置设置
                </button>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                        onClick={onClose}
                        style={{
                            padding: '8px 16px',
                            fontSize: '14px',
                            color: 'hsl(var(--color-foreground))',
                            border: '1px solid hsl(var(--color-border))',
                            borderRadius: '6px',
                            background: 'transparent',
                            cursor: 'pointer',
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = 'hsl(var(--color-accent))'
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'transparent'
                        }}
                    >
                        取消
                    </button>
                    <button
                        onClick={onClose}
                        style={{
                            padding: '8px 16px',
                            fontSize: '14px',
                            color: 'hsl(var(--color-primary-foreground))',
                            backgroundColor: 'hsl(var(--color-primary))',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.opacity = '0.9'
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.opacity = '1'
                        }}
                    >
                        保存
                    </button>
                </div>
            </div>
        </motion.div>
    )
}
