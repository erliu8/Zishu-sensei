/**
 * Tauri 命令服务
 * 
 * 提供类型安全的 Tauri 命令调用封装
 */

import type {
    AppCommand,
    ExtractCommandPayload,
    TauriCommandPayload,
    TauriResponse
} from '../../types/tauri'
import { tauriService } from './core'

/**
 * Tauri 命令服务类
 */
export class TauriCommandService {
    private static instance: TauriCommandService | null = null

    private constructor() {
        // 私有构造函数，确保单例
    }

    /**
     * 获取服务实例
     */
    public static getInstance(): TauriCommandService {
        if (!TauriCommandService.instance) {
            TauriCommandService.instance = new TauriCommandService()
        }
        return TauriCommandService.instance
    }

    /**
     * 执行命令（类型安全）
     */
    public async execute<T extends AppCommand>(
        command: T,
        payload?: ExtractCommandPayload<T>
    ): Promise<TauriResponse<any>> {
        return tauriService.invokeCommand(command, payload as TauriCommandPayload)
    }

    /**
     * 批量执行命令
     */
    public async executeBatch(
        commands: Array<{
            command: AppCommand
            payload?: TauriCommandPayload
        }>
    ): Promise<TauriResponse<any>[]> {
        return tauriService.invokeBatch(commands)
    }

    // ==================== 窗口管理命令 ====================

    /**
     * 创建窗口
     */
    public async createWindow(config: ExtractCommandPayload<'create_window'>) {
        return this.execute('create_window', config)
    }

    /**
     * 关闭窗口
     */
    public async closeWindow(_label?: string) {
        return this.execute('close_window')
    }

    /**
     * 显示窗口
     */
    public async showWindow(label: string) {
        return this.execute('show_window', { label })
    }

    /**
     * 隐藏窗口
     */
    public async hideWindow(label: string) {
        return this.execute('hide_window', { label })
    }

    /**
     * 聚焦窗口
     */
    public async focusWindow(label: string) {
        return this.execute('focus_window', { label })
    }

    /**
     * 最小化窗口
     */
    public async minimizeWindow(_label?: string) {
        return this.execute('minimize_window')
    }

    /**
     * 最大化窗口
     */
    public async maximizeWindow(_label?: string) {
        return this.execute('maximize_window')
    }

    /**
     * 设置窗口位置
     */
    public async setWindowPosition(_label: string, x: number, y: number) {
        return this.execute('set_window_position', { x, y })
    }

    /**
     * 设置窗口大小
     */
    public async setWindowSize(_label: string, width: number, height: number) {
        return this.execute('set_window_size', { width, height })
    }

    /**
     * 设置窗口标题
     */
    public async setWindowTitle(title: string) {
        return this.execute('set_window_title', { title })
    }

    /**
     * 设置窗口置顶
     */
    public async setAlwaysOnTop(label: string, alwaysOnTop: boolean) {
        return this.execute('set_always_on_top', { label, alwaysOnTop })
    }

    // ==================== 文件操作命令 ====================

    /**
     * 读取文件
     */
    public async readFile(path: string) {
        return this.execute('read_file', { path })
    }

    /**
     * 写入文件
     */
    public async writeFile(path: string, contents: string) {
        return this.execute('write_file', { path, content: contents })
    }

    /**
     * 读取目录
     */
    public async readDir(path: string, recursive = false) {
        return this.execute('read_dir', { path, recursive })
    }

    /**
     * 创建目录
     */
    public async createDir(path: string, recursive = true) {
        return this.execute('create_dir', { path, recursive })
    }

    /**
     * 删除文件
     */
    public async removeFile(path: string) {
        return this.execute('remove_file', { path })
    }

    /**
     * 删除目录
     */
    public async removeDir(path: string, recursive = false) {
        return this.execute('remove_dir', { path, recursive })
    }

    /**
     * 复制文件
     */
    public async copyFile(src: string, dest: string) {
        return this.execute('copy_file', { src, dest })
    }

    /**
     * 移动文件
     */
    public async moveFile(src: string, dest: string) {
        return this.execute('move_file', { src, dest })
    }

    /**
     * 检查文件是否存在
     */
    public async fileExists(path: string) {
        return this.execute('file_exists', { path })
    }

    // ==================== 对话框命令 ====================

    /**
     * 显示消息对话框
     */
    public async showMessage(options: ExtractCommandPayload<'show_message'>) {
        return this.execute('show_message', options)
    }

    /**
     * 显示确认对话框
     */
    public async showConfirm(options: ExtractCommandPayload<'show_confirm'>) {
        return this.execute('show_confirm', options)
    }

    /**
     * 显示打开文件对话框
     */
    public async showOpenDialog(options: any = {}) {
        return this.execute('show_open_dialog', options)
    }

    /**
     * 显示保存文件对话框
     */
    public async showSaveDialog(options: any = {}) {
        return this.execute('show_save_dialog', options)
    }

    // ==================== 系统托盘命令 ====================

    /**
     * 设置托盘菜单
     */
    public async setTrayMenu(menu: any) {
        return this.execute('set_tray_menu', { menu })
    }

    /**
     * 设置托盘图标
     */
    public async setTrayIcon(icon: string) {
        return this.execute('set_tray_icon', { icon })
    }

    /**
     * 设置托盘提示
     */
    public async setTrayTooltip(tooltip: string) {
        return this.execute('set_tray_tooltip', { tooltip })
    }

    // ==================== 通知命令 ====================

    /**
     * 发送通知
     */
    public async sendNotification(options: ExtractCommandPayload<'send_notification'>) {
        return this.execute('send_notification', options)
    }

    // ==================== 剪贴板命令 ====================

    /**
     * 读取剪贴板
     */
    public async readClipboard() {
        return this.execute('read_clipboard')
    }

    /**
     * 写入剪贴板
     */
    public async writeClipboard(text: string) {
        return this.execute('write_clipboard', { text })
    }

    // ==================== 快捷键命令 ====================

    /**
     * 注册快捷键
     */
    public async registerShortcut(shortcut: string) {
        return this.execute('register_shortcut', { shortcut })
    }

    /**
     * 取消注册快捷键
     */
    public async unregisterShortcut(shortcut: string) {
        return this.execute('unregister_shortcut', { shortcut })
    }

    // ==================== 应用特定命令 ====================

    /**
     * 获取角色列表
     */
    public async getCharacterList() {
        return this.execute('get_character_list')
    }

    /**
     * 加载角色
     */
    public async loadCharacter(characterId: string) {
        return this.execute('load_character', { characterId })
    }

    /**
     * 保存设置
     */
    public async saveSettings(settings: any) {
        return this.execute('save_settings', { settings })
    }

    /**
     * 加载设置
     */
    public async loadSettings() {
        return this.execute('load_settings')
    }

    /**
     * 安装适配器
     */
    public async installAdapter(adapterId: string, config: any) {
        return this.execute('install_adapter', { adapterId, config })
    }

    /**
     * 卸载适配器
     */
    public async uninstallAdapter(adapterId: string) {
        return this.execute('uninstall_adapter', { adapterId })
    }

    /**
     * 执行适配器
     */
    public async executeAdapter(adapterId: string, action: string, params: any) {
        return this.execute('execute_adapter', { adapterId, action, params })
    }

    /**
     * 获取适配器列表
     */
    public async getAdapterList() {
        return this.execute('get_adapter_list')
    }
}

/**
 * 获取命令服务实例
 */
export const commandService = TauriCommandService.getInstance()

/**
 * 便捷函数：执行命令
 */
export const executeCommand = <T extends AppCommand>(
    command: T,
    payload?: ExtractCommandPayload<T>
): Promise<TauriResponse<any>> => {
    return commandService.execute(command, payload)
}
