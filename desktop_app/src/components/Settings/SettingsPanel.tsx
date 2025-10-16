import { motion } from 'framer-motion'
import React from 'react'

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
    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                backgroundColor: 'hsl(var(--color-background))',
                color: 'hsl(var(--color-foreground))',
            }}
        >
            {/* 标题栏 */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px',
                borderBottom: '1px solid hsl(var(--color-border))',
            }}>
                <h1 style={{
                    fontSize: '18px',
                    fontWeight: 600,
                    color: 'hsl(var(--color-foreground))',
                }}>
                    设置
                </h1>
                <button
                    onClick={onClose}
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
            <div style={{
                flex: 1,
                overflowY: 'auto',
                padding: '16px',
            }}>
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
                </div>
            </div>

            {/* 底部按钮 */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px',
                borderTop: '1px solid hsl(var(--color-border))',
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
