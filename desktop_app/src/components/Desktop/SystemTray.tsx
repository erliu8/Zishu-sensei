import React, { useEffect } from 'react'

interface SystemTrayProps {
    onShow: () => void
    onSettings: () => void
    onExit: () => void
}

/**
 * 系统托盘组件
 */
export const SystemTray: React.FC<SystemTrayProps> = ({
    onShow,
    onSettings,
    onExit,
}) => {
    useEffect(() => {
        const setupSystemTray = async () => {
            try {
                if (window.__TAURI__) {
                    // 这里可以设置系统托盘
                    // const { Menu, MenuItem } = await import('@tauri-apps/api/menu')
                    // const { TrayIcon } = await import('@tauri-apps/api/tray')

                    // const menu = await Menu.new({
                    //     items: [
                    //         await MenuItem.new({
                    //             text: '显示',
                    //             action: onShow,
                    //         }),
                    //         await MenuItem.new({
                    //             text: '设置',
                    //             action: onSettings,
                    //         }),
                    //         await MenuItem.new({
                    //             text: '退出',
                    //             action: onExit,
                    //         }),
                    //     ],
                    // })

                    // await TrayIcon.new({
                    //     menu,
                    //     icon: 'icons/tray-icon.png',
                    //     tooltip: 'Zishu-sensei',
                    // })
                }
            } catch (error) {
                console.error('设置系统托盘失败:', error)
            }
        }

        setupSystemTray()
    }, [onShow, onSettings, onExit])

    // 系统托盘组件不需要渲染任何内容
    return null
}
