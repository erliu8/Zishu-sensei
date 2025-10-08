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
            className="w-full h-full bg-white dark:bg-gray-900 flex flex-col"
        >
            {/* 标题栏 */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
                <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
                    设置
                </h1>
                <button
                    onClick={onClose}
                    className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                    ✕
                </button>
            </div>

            {/* 设置内容 */}
            <div className="flex-1 overflow-y-auto p-4">
                <div className="space-y-6">
                    {/* 基础设置 */}
                    <section>
                        <h2 className="text-md font-medium text-gray-900 dark:text-white mb-3">
                            基础设置
                        </h2>
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <label className="text-sm text-gray-700 dark:text-gray-300">
                                    开机自启动
                                </label>
                                <input
                                    type="checkbox"
                                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                />
                            </div>
                            <div className="flex items-center justify-between">
                                <label className="text-sm text-gray-700 dark:text-gray-300">
                                    最小化到托盘
                                </label>
                                <input
                                    type="checkbox"
                                    defaultChecked
                                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                />
                            </div>
                            <div className="flex items-center justify-between">
                                <label className="text-sm text-gray-700 dark:text-gray-300">
                                    启用通知
                                </label>
                                <input
                                    type="checkbox"
                                    defaultChecked
                                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                />
                            </div>
                        </div>
                    </section>

                    {/* 外观设置 */}
                    <section>
                        <h2 className="text-md font-medium text-gray-900 dark:text-white mb-3">
                            外观设置
                        </h2>
                        <div className="space-y-3">
                            <div>
                                <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">
                                    主题
                                </label>
                                <select className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
                                    <option value="system">跟随系统</option>
                                    <option value="light">浅色主题</option>
                                    <option value="dark">深色主题</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">
                                    语言
                                </label>
                                <select className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
                                    <option value="zh-CN">简体中文</option>
                                    <option value="en-US">English</option>
                                    <option value="ja-JP">日本語</option>
                                </select>
                            </div>
                        </div>
                    </section>

                    {/* 角色设置 */}
                    <section>
                        <h2 className="text-md font-medium text-gray-900 dark:text-white mb-3">
                            角色设置
                        </h2>
                        <div className="space-y-3">
                            <div>
                                <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">
                                    音量
                                </label>
                                <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    defaultValue="80"
                                    className="w-full"
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">
                                    动画速度
                                </label>
                                <input
                                    type="range"
                                    min="0.5"
                                    max="2"
                                    step="0.1"
                                    defaultValue="1"
                                    className="w-full"
                                />
                            </div>
                        </div>
                    </section>
                </div>
            </div>

            {/* 底部按钮 */}
            <div className="flex items-center justify-between p-4 border-t border-gray-200 dark:border-gray-700">
                <button
                    onClick={onReset}
                    className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
                >
                    重置设置
                </button>
                <div className="flex gap-2">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-md transition-colors"
                    >
                        取消
                    </button>
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
                    >
                        保存
                    </button>
                </div>
            </div>
        </motion.div>
    )
}
