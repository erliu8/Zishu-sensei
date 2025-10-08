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
                    className="fixed top-4 right-4 z-50 bg-blue-600 text-white rounded-lg shadow-lg p-4 max-w-sm"
                >
                    <div className="flex items-start gap-3">
                        <div className="text-2xl">🚀</div>
                        <div className="flex-1">
                            <h3 className="font-semibold mb-1">
                                新版本可用
                            </h3>
                            {updateInfo && (
                                <p className="text-sm opacity-90 mb-2">
                                    版本 {updateInfo.version} 已发布
                                </p>
                            )}
                            <div className="flex gap-2">
                                <button
                                    onClick={handleUpdate}
                                    className="px-3 py-1 bg-white text-blue-600 rounded text-sm font-medium hover:bg-gray-100 transition-colors"
                                >
                                    立即更新
                                </button>
                                <button
                                    onClick={handleDismiss}
                                    className="px-3 py-1 bg-blue-700 text-white rounded text-sm hover:bg-blue-800 transition-colors"
                                >
                                    稍后提醒
                                </button>
                            </div>
                        </div>
                        <button
                            onClick={handleDismiss}
                            className="text-white/70 hover:text-white text-lg leading-none"
                        >
                            ×
                        </button>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    )
}
