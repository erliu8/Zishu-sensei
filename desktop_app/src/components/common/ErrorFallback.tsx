import type { AppError } from '@/types/app'
import React from 'react'

interface ErrorFallbackProps {
    error?: AppError | null
    resetError?: () => void
    onRestart?: () => void
}

/**
 * 错误回退组件
 */
export const ErrorFallback: React.FC<ErrorFallbackProps> = ({
    error,
    resetError,
    onRestart,
}) => {
    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'hsl(var(--color-muted) / 0.3)',
            padding: '16px',
        }}>
            <div style={{
                maxWidth: '448px',
                width: '100%',
                backgroundColor: 'hsl(var(--color-card))',
                borderRadius: '12px',
                boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)',
                padding: '24px',
            }}>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '60px', marginBottom: '16px' }}>😵</div>
                    <h1 style={{
                        fontSize: '20px',
                        fontWeight: 600,
                        color: 'hsl(var(--color-foreground))',
                        marginBottom: '8px',
                    }}>
                        应用程序出现错误
                    </h1>
                    <p style={{
                        color: 'hsl(var(--color-muted-foreground))',
                        marginBottom: '16px',
                        fontSize: '14px',
                    }}>
                        很抱歉，应用程序遇到了一个意外错误
                    </p>

                    {error && (
                        <div style={{
                            backgroundColor: 'hsl(var(--color-destructive) / 0.1)',
                            border: '1px solid hsl(var(--color-destructive) / 0.3)',
                            borderRadius: '6px',
                            padding: '12px',
                            marginBottom: '16px',
                            textAlign: 'left',
                        }}>
                            <p style={{
                                fontSize: '14px',
                                fontWeight: 500,
                                color: 'hsl(var(--color-destructive))',
                                marginBottom: '4px',
                            }}>
                                错误信息:
                            </p>
                            <p style={{
                                fontSize: '14px',
                                color: 'hsl(var(--color-destructive))',
                                wordBreak: 'break-word',
                            }}>
                                {error.message}
                            </p>
                            {error.timestamp && (
                                <p style={{
                                    fontSize: '12px',
                                    color: 'hsl(var(--color-destructive))',
                                    marginTop: '8px',
                                    opacity: 0.8,
                                }}>
                                    时间: {new Date(error.timestamp).toLocaleString()}
                                </p>
                            )}
                        </div>
                    )}

                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px',
                    }}>
                        {resetError && (
                            <button
                                onClick={resetError}
                                style={{
                                    flex: 1,
                                    padding: '8px 16px',
                                    backgroundColor: 'hsl(var(--color-primary))',
                                    color: 'hsl(var(--color-primary-foreground))',
                                    border: 'none',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    fontSize: '14px',
                                    transition: 'opacity 200ms',
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
                                onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                            >
                                重试
                            </button>
                        )}
                        {onRestart && (
                            <button
                                onClick={onRestart}
                                style={{
                                    flex: 1,
                                    padding: '8px 16px',
                                    backgroundColor: 'hsl(var(--color-muted))',
                                    color: 'hsl(var(--color-muted-foreground))',
                                    border: 'none',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    fontSize: '14px',
                                    transition: 'opacity 200ms',
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
                                onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                            >
                                重启应用
                            </button>
                        )}
                    </div>

                    <p style={{
                        fontSize: '12px',
                        color: 'hsl(var(--color-muted-foreground))',
                        marginTop: '16px',
                    }}>
                        如果问题持续存在，请联系技术支持
                    </p>
                </div>
            </div>
        </div>
    )
}
