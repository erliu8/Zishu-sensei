import { AnimatePresence, motion } from 'framer-motion'
import React, { useEffect, useState } from 'react'

/**
 * 更新通知组件
 */
export const UpdateNotification: React.FC = () => {
    const [hasUpdate, setHasUpdate] = useState(false)
    const [updateInfo, setUpdateInfo] = useState<{
        version: string
        releaseNotes: string
    } | null>(null)

    useEffect(() => {
        // 检查更新逻辑
        const checkForUpdates = async () => {
            try {
                if (window.__TAURI__) {
                    // 这里可以集成 Tauri 的更新检查
                    // const { checkUpdate } = await import('@tauri-apps/api/updater')
                    // const update = await checkUpdate()
                    // if (update.shouldUpdate) {
                    //     setHasUpdate(true)
                    //     setUpdateInfo({
                    //         version: update.manifest.version,
                    //         releaseNotes: update.manifest.body
                    //     })
                    // }
                }
            } catch (error) {
                console.error('检查更新失败:', error)
            }
        }

        checkForUpdates()
    }, [])

    const handleUpdate = async () => {
        try {
            if (window.__TAURI__) {
                // const { installUpdate } = await import('@tauri-apps/api/updater')
                // await installUpdate()
            }
        } catch (error) {
            console.error('更新失败:', error)
        }
    }

    const handleDismiss = () => {
        setHasUpdate(false)
    }

    return (
        <AnimatePresence>
            {hasUpdate && (
                <motion.div
                    initial={{ opacity: 0, y: -50 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -50 }}
                    style={{
                        position: 'fixed',
                        top: '16px',
                        right: '16px',
                        zIndex: 50,
                        backgroundColor: 'hsl(var(--color-primary))',
                        color: 'hsl(var(--color-primary-foreground))',
                        borderRadius: '12px',
                        boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)',
                        padding: '16px',
                        maxWidth: '384px',
                    }}
                >
                    <div style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '12px',
                    }}>
                        <div style={{ fontSize: '24px' }}>🚀</div>
                        <div style={{ flex: 1 }}>
                            <h3 style={{
                                fontWeight: 600,
                                marginBottom: '4px',
                            }}>
                                新版本可用
                            </h3>
                            {updateInfo && (
                                <p style={{
                                    fontSize: '14px',
                                    opacity: 0.9,
                                    marginBottom: '8px',
                                }}>
                                    版本 {updateInfo.version} 已发布
                                </p>
                            )}
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button
                                    onClick={handleUpdate}
                                    style={{
                                        padding: '4px 12px',
                                        backgroundColor: 'hsl(var(--color-background))',
                                        color: 'hsl(var(--color-primary))',
                                        border: 'none',
                                        borderRadius: '4px',
                                        fontSize: '14px',
                                        fontWeight: 500,
                                        cursor: 'pointer',
                                        transition: 'opacity 200ms',
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
                                    onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                                >
                                    立即更新
                                </button>
                                <button
                                    onClick={handleDismiss}
                                    style={{
                                        padding: '4px 12px',
                                        backgroundColor: 'hsl(var(--color-primary) / 0.8)',
                                        color: 'hsl(var(--color-primary-foreground))',
                                        border: 'none',
                                        borderRadius: '4px',
                                        fontSize: '14px',
                                        cursor: 'pointer',
                                        transition: 'opacity 200ms',
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
                                    onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                                >
                                    稍后提醒
                                </button>
                            </div>
                        </div>
                        <button
                            onClick={handleDismiss}
                            style={{
                                color: 'hsl(var(--color-primary-foreground) / 0.7)',
                                fontSize: '18px',
                                lineHeight: 1,
                                border: 'none',
                                background: 'transparent',
                                cursor: 'pointer',
                                padding: 0,
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.color = 'hsl(var(--color-primary-foreground))'
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.color = 'hsl(var(--color-primary-foreground) / 0.7)'
                            }}
                        >
                            ×
                        </button>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    )
}
