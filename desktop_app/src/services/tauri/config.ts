/**
 * Tauri 配置管理服务
 * 
 * 提供与后端配置管理的 Tauri 命令封装
 */

import { invoke } from '@tauri-apps/api/tauri'
import { dialog } from '@tauri-apps/api'
import type {
    AppConfig,
    WindowConfig,
    CharacterConfig,
    ThemeConfig,
    SystemConfig,
    UpdateWindowConfigRequest,
    UpdateCharacterConfigRequest,
    UpdateThemeConfigRequest,
    UpdateSystemConfigRequest,
    ConfigPaths
} from '../../types/settings'
import type { TauriResponse } from '../../types/tauri'

/**
 * Tauri 配置管理服务类
 */
export class TauriConfigService {
    private static instance: TauriConfigService | null = null

    private constructor() {
        // 私有构造函数，确保单例
    }

    /**
     * 获取服务实例（单例模式）
     */
    public static getInstance(): TauriConfigService {
        if (!TauriConfigService.instance) {
            TauriConfigService.instance = new TauriConfigService()
        }
        return TauriConfigService.instance
    }

    // ==================== 配置获取 ====================

    /**
     * 获取完整应用配置
     */
    public async getSettings(): Promise<AppConfig> {
        const response = await invoke<TauriResponse<AppConfig>>('get_settings')
        
        if (!response.success || !response.data) {
            throw new Error(response.error || '获取配置失败')
        }

        return response.data
    }

    /**
     * 获取窗口配置
     */
    public async getWindowConfig(): Promise<WindowConfig> {
        const response = await invoke<TauriResponse<WindowConfig>>('get_window_config')
        
        if (!response.success || !response.data) {
            throw new Error(response.error || '获取窗口配置失败')
        }

        return response.data
    }

    /**
     * 获取角色配置
     */
    public async getCharacterConfig(): Promise<CharacterConfig> {
        const response = await invoke<TauriResponse<CharacterConfig>>('get_character_config')
        
        if (!response.success || !response.data) {
            throw new Error(response.error || '获取角色配置失败')
        }

        return response.data
    }

    /**
     * 获取主题配置
     */
    public async getThemeConfig(): Promise<ThemeConfig> {
        const response = await invoke<TauriResponse<ThemeConfig>>('get_theme_config')
        
        if (!response.success || !response.data) {
            throw new Error(response.error || '获取主题配置失败')
        }

        return response.data
    }

    /**
     * 获取系统配置
     */
    public async getSystemConfig(): Promise<SystemConfig> {
        const response = await invoke<TauriResponse<SystemConfig>>('get_system_config')
        
        if (!response.success || !response.data) {
            throw new Error(response.error || '获取系统配置失败')
        }

        return response.data
    }

    // ==================== 配置更新 ====================

    /**
     * 更新完整应用配置
     */
    public async updateSettings(config: AppConfig): Promise<AppConfig> {
        const response = await invoke<TauriResponse<AppConfig>>('update_settings', { config })
        
        if (!response.success || !response.data) {
            throw new Error(response.error || '更新配置失败')
        }

        return response.data
    }

    /**
     * 部分更新应用配置
     */
    public async updatePartialSettings(updates: Record<string, any>): Promise<AppConfig> {
        const response = await invoke<TauriResponse<AppConfig>>('update_partial_settings', { updates })
        
        if (!response.success || !response.data) {
            throw new Error(response.error || '部分更新配置失败')
        }

        return response.data
    }

    /**
     * 更新窗口配置
     */
    public async updateWindowConfig(updates: UpdateWindowConfigRequest): Promise<WindowConfig> {
        const response = await invoke<TauriResponse<WindowConfig>>('update_window_config', { updates })
        
        if (!response.success || !response.data) {
            throw new Error(response.error || '更新窗口配置失败')
        }

        return response.data
    }

    /**
     * 更新角色配置
     */
    public async updateCharacterConfig(updates: UpdateCharacterConfigRequest): Promise<CharacterConfig> {
        const response = await invoke<TauriResponse<CharacterConfig>>('update_character_config', { updates })
        
        if (!response.success || !response.data) {
            throw new Error(response.error || '更新角色配置失败')
        }

        return response.data
    }

    /**
     * 更新主题配置
     */
    public async updateThemeConfig(updates: UpdateThemeConfigRequest): Promise<ThemeConfig> {
        const response = await invoke<TauriResponse<ThemeConfig>>('update_theme_config', { updates })
        
        if (!response.success || !response.data) {
            throw new Error(response.error || '更新主题配置失败')
        }

        return response.data
    }

    /**
     * 更新系统配置
     */
    public async updateSystemConfig(updates: UpdateSystemConfigRequest): Promise<SystemConfig> {
        const response = await invoke<TauriResponse<SystemConfig>>('update_system_config', { updates })
        
        if (!response.success || !response.data) {
            throw new Error(response.error || '更新系统配置失败')
        }

        return response.data
    }

    // ==================== 配置管理 ====================

    /**
     * 重置配置为默认值
     */
    public async resetSettings(): Promise<AppConfig> {
        const response = await invoke<TauriResponse<AppConfig>>('reset_settings')
        
        if (!response.success || !response.data) {
            throw new Error(response.error || '重置配置失败')
        }

        return response.data
    }

    /**
     * 导出配置到文件
     */
    public async exportSettings(filePath?: string): Promise<string> {
        // 如果没有提供路径，打开保存对话框
        let exportPath = filePath
        if (!exportPath) {
            const selected = await dialog.save({
                title: '导出配置',
                defaultPath: 'zishu-sensei-config.json',
                filters: [{
                    name: 'JSON 配置文件',
                    extensions: ['json']
                }]
            })

            if (!selected) {
                throw new Error('用户取消导出')
            }

            exportPath = selected
        }

        const response = await invoke<TauriResponse<string>>('export_settings', { 
            filePath: exportPath 
        })
        
        if (!response.success) {
            throw new Error(response.error || '导出配置失败')
        }

        return exportPath
    }

    /**
     * 从文件导入配置
     */
    public async importSettings(filePath?: string): Promise<AppConfig> {
        // 如果没有提供路径，打开文件选择对话框
        let importPath = filePath
        if (!importPath) {
            const selected = await dialog.open({
                title: '导入配置',
                filters: [{
                    name: 'JSON 配置文件',
                    extensions: ['json']
                }],
                multiple: false
            })

            if (!selected || Array.isArray(selected)) {
                throw new Error('用户取消导入')
            }

            importPath = selected
        }

        const response = await invoke<TauriResponse<AppConfig>>('import_settings', { 
            filePath: importPath 
        })
        
        if (!response.success || !response.data) {
            throw new Error(response.error || '导入配置失败')
        }

        return response.data
    }

    /**
     * 获取配置文件路径信息
     */
    public async getConfigPaths(): Promise<ConfigPaths> {
        const response = await invoke<TauriResponse<ConfigPaths>>('get_config_paths')
        
        if (!response.success || !response.data) {
            throw new Error(response.error || '获取配置路径失败')
        }

        return response.data
    }

    // ==================== 高级功能 ====================

    /**
     * 批量更新配置
     */
    public async batchUpdateConfig(updates: {
        window?: UpdateWindowConfigRequest
        character?: UpdateCharacterConfigRequest
        theme?: UpdateThemeConfigRequest
        system?: UpdateSystemConfigRequest
    }): Promise<AppConfig> {
        // 构造部分更新对象
        const partialUpdate: Record<string, any> = {}

        if (updates.window) {
            partialUpdate.window = updates.window
        }
        if (updates.character) {
            partialUpdate.character = updates.character
        }
        if (updates.theme) {
            partialUpdate.theme = updates.theme
        }
        if (updates.system) {
            partialUpdate.system = updates.system
        }

        return this.updatePartialSettings(partialUpdate)
    }

    /**
     * 重置特定部分的配置
     */
    public async resetConfigSection(section: 'window' | 'character' | 'theme' | 'system'): Promise<AppConfig> {
        // 获取默认配置
        const defaultConfig = await this.resetSettings()
        
        // 只保留指定部分的重置
        const currentConfig = await this.getSettings()
        
        const updates: Record<string, any> = {
            window: section === 'window' ? defaultConfig.window : currentConfig.window,
            character: section === 'character' ? defaultConfig.character : currentConfig.character,
            theme: section === 'theme' ? defaultConfig.theme : currentConfig.theme,
            system: section === 'system' ? defaultConfig.system : currentConfig.system
        }

        return this.updateSettings(updates as AppConfig)
    }

    /**
     * 导出配置为 JSON 字符串
     */
    public async exportSettingsAsJson(pretty = true): Promise<string> {
        const config = await this.getSettings()
        return JSON.stringify(config, null, pretty ? 2 : 0)
    }

    /**
     * 从 JSON 字符串导入配置
     */
    public async importSettingsFromJson(json: string): Promise<AppConfig> {
        try {
            const config = JSON.parse(json) as AppConfig
            return this.updateSettings(config)
        } catch (error) {
            throw new Error(`解析 JSON 配置失败: ${error}`)
        }
    }

    /**
     * 复制当前配置到剪贴板
     */
    public async copyConfigToClipboard(): Promise<void> {
        const json = await this.exportSettingsAsJson(true)
        await navigator.clipboard.writeText(json)
    }

    /**
     * 从剪贴板粘贴配置
     */
    public async pasteConfigFromClipboard(): Promise<AppConfig> {
        const json = await navigator.clipboard.readText()
        return this.importSettingsFromJson(json)
    }

    /**
     * 打开配置文件所在目录
     */
    public async openConfigDirectory(): Promise<void> {
        const paths = await this.getConfigPaths()
        await invoke('show_in_folder', { path: paths.data_dir })
    }

    /**
     * 检查配置文件是否存在
     */
    public async configFileExists(): Promise<boolean> {
        try {
            const paths = await this.getConfigPaths()
            const response = await invoke<boolean>('file_exists', { path: paths.config })
            return response
        } catch {
            return false
        }
    }

    /**
     * 销毁服务实例
     */
    public destroy(): void {
        TauriConfigService.instance = null
    }
}

/**
 * 获取 Tauri 配置服务实例
 */
export const tauriConfigService = TauriConfigService.getInstance()

/**
 * 便捷函数：获取配置
 */
export const getSettings = (): Promise<AppConfig> => {
    return tauriConfigService.getSettings()
}

/**
 * 便捷函数：更新配置
 */
export const updateSettings = (config: AppConfig): Promise<AppConfig> => {
    return tauriConfigService.updateSettings(config)
}

/**
 * 便捷函数：重置配置
 */
export const resetSettings = (): Promise<AppConfig> => {
    return tauriConfigService.resetSettings()
}

/**
 * 便捷函数：导出配置
 */
export const exportSettings = (filePath?: string): Promise<string> => {
    return tauriConfigService.exportSettings(filePath)
}

/**
 * 便捷函数：导入配置
 */
export const importSettings = (filePath?: string): Promise<AppConfig> => {
    return tauriConfigService.importSettings(filePath)
}

