/**
 * 设置存储服务
 * 
 * 提供前端配置管理功能，包括：
 * - 本地缓存配置
 * - 与后端同步
 * - 配置变更监听
 * - 配置验证
 * - 导入/导出
 */

import { invoke } from '@tauri-apps/api/tauri'
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
    PartialConfigUpdate,
    ConfigPaths,
    ConfigValidationResult,
    ConfigChangeEvent
} from '../../types/settings'
import { DEFAULT_CONFIG, CONFIG_VALIDATION_RULES } from '../../types/settings'
import type { TauriResponse } from '../../types/tauri'

/**
 * 配置变更监听器类型
 */
export type ConfigChangeListener = (event: ConfigChangeEvent) => void

/**
 * 设置存储服务类
 */
export class SettingsStorageService {
    private static instance: SettingsStorageService | null = null
    
    /** 当前配置缓存 */
    private _config: AppConfig | null = null
    
    /** 配置变更监听器 */
    private _listeners: Set<ConfigChangeListener> = new Set()
    
    /** 是否已初始化 */
    private _initialized = false
    
    /** 初始化 Promise */
    private _initPromise: Promise<void> | null = null

    private constructor() {
        // 私有构造函数，确保单例
    }

    /**
     * 获取服务实例（单例模式）
     */
    public static getInstance(): SettingsStorageService {
        if (!SettingsStorageService.instance) {
            SettingsStorageService.instance = new SettingsStorageService()
        }
        return SettingsStorageService.instance
    }

    /**
     * 初始化服务
     */
    public async initialize(): Promise<void> {
        if (this._initPromise) {
            return this._initPromise
        }

        this._initPromise = this._performInitialization()
        return this._initPromise
    }

    /**
     * 执行初始化
     */
    private async _performInitialization(): Promise<void> {
        try {
            // 从后端加载配置
            const config = await this.loadFromBackend()
            this._config = config
            this._initialized = true
            
            console.log('设置存储服务初始化成功', config)
        } catch (error) {
            console.error('设置存储服务初始化失败:', error)
            // 使用默认配置
            this._config = { ...DEFAULT_CONFIG }
            this._initialized = true
        }
    }

    /**
     * 等待服务准备就绪
     */
    public async waitForReady(): Promise<void> {
        if (this._initialized) return

        if (!this._initPromise) {
            await this.initialize()
        } else {
            await this._initPromise
        }
    }

    /**
     * 检查服务是否已准备就绪
     */
    public isReady(): boolean {
        return this._initialized
    }

    // ==================== 配置获取 ====================

    /**
     * 获取完整配置
     */
    public async getConfig(): Promise<AppConfig> {
        await this.waitForReady()
        
        if (this._config) {
            return { ...this._config }
        }

        // 如果缓存为空，从后端重新加载
        return this.loadFromBackend()
    }

    /**
     * 获取窗口配置
     */
    public async getWindowConfig(): Promise<WindowConfig> {
        const config = await this.getConfig()
        return config.window
    }

    /**
     * 获取角色配置
     */
    public async getCharacterConfig(): Promise<CharacterConfig> {
        const config = await this.getConfig()
        return config.character
    }

    /**
     * 获取主题配置
     */
    public async getThemeConfig(): Promise<ThemeConfig> {
        const config = await this.getConfig()
        return config.theme
    }

    /**
     * 获取系统配置
     */
    public async getSystemConfig(): Promise<SystemConfig> {
        const config = await this.getConfig()
        return config.system
    }

    // ==================== 配置更新 ====================

    /**
     * 更新完整配置
     */
    public async updateConfig(config: AppConfig): Promise<AppConfig> {
        await this.waitForReady()

        // 验证配置
        const validation = this.validateConfig(config)
        if (!validation.valid) {
            throw new Error(`配置验证失败: ${validation.errors.join(', ')}`)
        }

        // 保存旧配置用于事件
        const oldConfig = this._config ? { ...this._config } : null

        // 调用后端保存
        const response = await invoke<TauriResponse<AppConfig>>('update_settings', { config })
        
        if (!response.success || !response.data) {
            throw new Error(response.error || '更新配置失败')
        }

        // 更新缓存
        this._config = response.data

        // 触发变更事件
        if (oldConfig) {
            this._notifyListeners({
                type: 'full',
                before: oldConfig,
                after: this._config,
                timestamp: Date.now()
            })
        }

        return { ...this._config }
    }

    /**
     * 部分更新配置
     */
    public async updatePartialConfig(updates: PartialConfigUpdate): Promise<AppConfig> {
        await this.waitForReady()

        const oldConfig = this._config ? { ...this._config } : null

        // 调用后端部分更新
        const response = await invoke<TauriResponse<AppConfig>>('update_partial_settings', { updates })
        
        if (!response.success || !response.data) {
            throw new Error(response.error || '部分更新配置失败')
        }

        // 更新缓存
        this._config = response.data

        // 触发变更事件
        if (oldConfig) {
            this._notifyListeners({
                type: 'full',
                before: oldConfig,
                after: this._config,
                timestamp: Date.now()
            })
        }

        return { ...this._config }
    }

    /**
     * 更新窗口配置
     */
    public async updateWindowConfig(updates: UpdateWindowConfigRequest): Promise<WindowConfig> {
        await this.waitForReady()

        const oldConfig = this._config?.window ? { ...this._config.window } : null

        const response = await invoke<TauriResponse<WindowConfig>>('update_window_config', { updates })
        
        if (!response.success || !response.data) {
            throw new Error(response.error || '更新窗口配置失败')
        }

        // 更新缓存
        if (this._config) {
            this._config.window = response.data
        }

        // 触发变更事件
        if (oldConfig) {
            this._notifyListeners({
                type: 'window',
                before: oldConfig,
                after: response.data,
                timestamp: Date.now()
            })
        }

        return response.data
    }

    /**
     * 更新角色配置
     */
    public async updateCharacterConfig(updates: UpdateCharacterConfigRequest): Promise<CharacterConfig> {
        await this.waitForReady()

        const oldConfig = this._config?.character ? { ...this._config.character } : null

        const response = await invoke<TauriResponse<CharacterConfig>>('update_character_config', { updates })
        
        if (!response.success || !response.data) {
            throw new Error(response.error || '更新角色配置失败')
        }

        // 更新缓存
        if (this._config) {
            this._config.character = response.data
        }

        // 触发变更事件
        if (oldConfig) {
            this._notifyListeners({
                type: 'character',
                before: oldConfig,
                after: response.data,
                timestamp: Date.now()
            })
        }

        return response.data
    }

    /**
     * 更新主题配置
     */
    public async updateThemeConfig(updates: UpdateThemeConfigRequest): Promise<ThemeConfig> {
        await this.waitForReady()

        const oldConfig = this._config?.theme ? { ...this._config.theme } : null

        const response = await invoke<TauriResponse<ThemeConfig>>('update_theme_config', { updates })
        
        if (!response.success || !response.data) {
            throw new Error(response.error || '更新主题配置失败')
        }

        // 更新缓存
        if (this._config) {
            this._config.theme = response.data
        }

        // 触发变更事件
        if (oldConfig) {
            this._notifyListeners({
                type: 'theme',
                before: oldConfig,
                after: response.data,
                timestamp: Date.now()
            })
        }

        return response.data
    }

    /**
     * 更新系统配置
     */
    public async updateSystemConfig(updates: UpdateSystemConfigRequest): Promise<SystemConfig> {
        await this.waitForReady()

        const oldConfig = this._config?.system ? { ...this._config.system } : null

        const response = await invoke<TauriResponse<SystemConfig>>('update_system_config', { updates })
        
        if (!response.success || !response.data) {
            throw new Error(response.error || '更新系统配置失败')
        }

        // 更新缓存
        if (this._config) {
            this._config.system = response.data
        }

        // 触发变更事件
        if (oldConfig) {
            this._notifyListeners({
                type: 'system',
                before: oldConfig,
                after: response.data,
                timestamp: Date.now()
            })
        }

        return response.data
    }

    // ==================== 配置管理 ====================

    /**
     * 重置配置为默认值
     */
    public async resetConfig(): Promise<AppConfig> {
        await this.waitForReady()

        const oldConfig = this._config ? { ...this._config } : null

        const response = await invoke<TauriResponse<AppConfig>>('reset_settings')
        
        if (!response.success || !response.data) {
            throw new Error(response.error || '重置配置失败')
        }

        // 更新缓存
        this._config = response.data

        // 触发变更事件
        if (oldConfig) {
            this._notifyListeners({
                type: 'full',
                before: oldConfig,
                after: this._config,
                timestamp: Date.now()
            })
        }

        return { ...this._config }
    }

    /**
     * 导出配置到文件
     */
    public async exportConfig(filePath: string): Promise<void> {
        await this.waitForReady()

        const response = await invoke<TauriResponse<string>>('export_settings', { filePath })
        
        if (!response.success) {
            throw new Error(response.error || '导出配置失败')
        }
    }

    /**
     * 从文件导入配置
     */
    public async importConfig(filePath: string): Promise<AppConfig> {
        await this.waitForReady()

        const oldConfig = this._config ? { ...this._config } : null

        const response = await invoke<TauriResponse<AppConfig>>('import_settings', { filePath })
        
        if (!response.success || !response.data) {
            throw new Error(response.error || '导入配置失败')
        }

        // 更新缓存
        this._config = response.data

        // 触发变更事件
        if (oldConfig) {
            this._notifyListeners({
                type: 'full',
                before: oldConfig,
                after: this._config,
                timestamp: Date.now()
            })
        }

        return { ...this._config }
    }

    /**
     * 获取配置文件路径
     */
    public async getConfigPaths(): Promise<ConfigPaths> {
        const response = await invoke<TauriResponse<ConfigPaths>>('get_config_paths')
        
        if (!response.success || !response.data) {
            throw new Error(response.error || '获取配置路径失败')
        }

        return response.data
    }

    /**
     * 从后端加载配置
     */
    public async loadFromBackend(): Promise<AppConfig> {
        const response = await invoke<TauriResponse<AppConfig>>('get_settings')
        
        if (!response.success || !response.data) {
            throw new Error(response.error || '加载配置失败')
        }

        this._config = response.data
        return { ...response.data }
    }

    /**
     * 刷新配置（从后端重新加载）
     */
    public async refreshConfig(): Promise<AppConfig> {
        const oldConfig = this._config ? { ...this._config } : null
        const newConfig = await this.loadFromBackend()

        // 触发变更事件
        if (oldConfig && JSON.stringify(oldConfig) !== JSON.stringify(newConfig)) {
            this._notifyListeners({
                type: 'full',
                before: oldConfig,
                after: newConfig,
                timestamp: Date.now()
            })
        }

        return newConfig
    }

    // ==================== 配置验证 ====================

    /**
     * 验证配置
     */
    public validateConfig(config: AppConfig): ConfigValidationResult {
        const errors: string[] = []
        const warnings: string[] = []

        // 验证窗口配置
        if (config.window.width < CONFIG_VALIDATION_RULES.window.width.min ||
            config.window.width > CONFIG_VALIDATION_RULES.window.width.max) {
            errors.push(`窗口宽度必须在 ${CONFIG_VALIDATION_RULES.window.width.min}-${CONFIG_VALIDATION_RULES.window.width.max} 之间`)
        }

        if (config.window.height < CONFIG_VALIDATION_RULES.window.height.min ||
            config.window.height > CONFIG_VALIDATION_RULES.window.height.max) {
            errors.push(`窗口高度必须在 ${CONFIG_VALIDATION_RULES.window.height.min}-${CONFIG_VALIDATION_RULES.window.height.max} 之间`)
        }

        // 验证角色配置
        if (config.character.scale < CONFIG_VALIDATION_RULES.character.scale.min ||
            config.character.scale > CONFIG_VALIDATION_RULES.character.scale.max) {
            errors.push(`角色缩放比例必须在 ${CONFIG_VALIDATION_RULES.character.scale.min}-${CONFIG_VALIDATION_RULES.character.scale.max} 之间`)
        }

        if (!config.character.current_character || config.character.current_character.trim() === '') {
            errors.push('角色名称不能为空')
        }

        // 验证主题配置
        if (!config.theme.current_theme || config.theme.current_theme.trim() === '') {
            errors.push('主题名称不能为空')
        }

        return {
            valid: errors.length === 0,
            errors,
            warnings
        }
    }

    // ==================== 事件监听 ====================

    /**
     * 添加配置变更监听器
     */
    public addChangeListener(listener: ConfigChangeListener): () => void {
        this._listeners.add(listener)
        
        // 返回取消监听的函数
        return () => {
            this._listeners.delete(listener)
        }
    }

    /**
     * 移除配置变更监听器
     */
    public removeChangeListener(listener: ConfigChangeListener): void {
        this._listeners.delete(listener)
    }

    /**
     * 移除所有监听器
     */
    public removeAllListeners(): void {
        this._listeners.clear()
    }

    /**
     * 通知所有监听器
     */
    private _notifyListeners(event: ConfigChangeEvent): void {
        this._listeners.forEach(listener => {
            try {
                listener(event)
            } catch (error) {
                console.error('配置变更监听器执行失败:', error)
            }
        })
    }

    // ==================== 工具方法 ====================

    /**
     * 获取缓存的配置（同步方法，不保证最新）
     */
    public getCachedConfig(): AppConfig | null {
        return this._config ? { ...this._config } : null
    }

    /**
     * 清空缓存
     */
    public clearCache(): void {
        this._config = null
    }

    /**
     * 销毁服务实例
     */
    public destroy(): void {
        this._config = null
        this._listeners.clear()
        this._initialized = false
        this._initPromise = null
        SettingsStorageService.instance = null
    }
}

/**
 * 获取设置存储服务实例
 */
export const settingsStorage = SettingsStorageService.getInstance()

/**
 * 便捷函数：获取配置
 */
export const getConfig = (): Promise<AppConfig> => {
    return settingsStorage.getConfig()
}

/**
 * 便捷函数：更新配置
 */
export const updateConfig = (config: AppConfig): Promise<AppConfig> => {
    return settingsStorage.updateConfig(config)
}

/**
 * 便捷函数：部分更新配置
 */
export const updatePartialConfig = (updates: PartialConfigUpdate): Promise<AppConfig> => {
    return settingsStorage.updatePartialConfig(updates)
}

/**
 * 便捷函数：重置配置
 */
export const resetConfig = (): Promise<AppConfig> => {
    return settingsStorage.resetConfig()
}

/**
 * 便捷函数：添加配置变更监听器
 */
export const onConfigChange = (listener: ConfigChangeListener): (() => void) => {
    return settingsStorage.addChangeListener(listener)
}

