/**
 * 桌面应用 API 集成
 * 
 * 提供桌面应用与后端服务的 API 接口，包括：
 * - 系统信息同步
 * - 性能监控数据上传
 * - 设置同步
 * - 错误报告
 * - 更新检查
 */

import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import type { ApiResponse } from '@/types/app'
import type { AppSettings, AppConfig } from '@/types/settings'
import type { DesktopAppState, DesktopOperationState } from '@/stores/desktopStore'

/**
 * API 配置
 */
interface DesktopApiConfig {
    baseUrl: string
    timeout: number
    retryAttempts: number
    retryDelay: number
    enableLogging: boolean
}

/**
 * 系统信息
 */
interface SystemInfo {
    platform: string
    arch: string
    version: string
    os: string
    tauriVersion: string
    webviewVersion: string
    memory: {
        total: number
        used: number
        available: number
    }
    cpu: {
        cores: number
        usage: number
        frequency: number
    }
    disk: {
        total: number
        used: number
        available: number
    }
}

/**
 * 性能指标
 */
interface PerformanceMetrics {
    memoryUsage: number
    cpuUsage: number
    uptime: number
    timestamp: number
    networkLatency?: number
    diskIO?: {
        read: number
        write: number
    }
    gpuUsage?: number
}

/**
 * 错误报告
 */
interface ErrorReport {
    id: string
    timestamp: number
    level: 'error' | 'warning' | 'info'
    message: string
    stack?: string
    context?: Record<string, any>
    userAgent?: string
    systemInfo?: SystemInfo
    operation?: string
    retryCount?: number
}

/**
 * 更新信息
 */
interface UpdateInfo {
    version: string
    releaseNotes: string
    downloadUrl: string
    publishedAt: string
    size: number
    checksum: string
    isRequired: boolean
    features: string[]
    bugFixes: string[]
}

/**
 * 同步状态
 */
interface SyncStatus {
    lastSync: number
    pendingChanges: number
    conflicts: Array<{
        key: string
        local: any
        remote: any
        timestamp: number
    }>
    isOnline: boolean
    syncInProgress: boolean
}

/**
 * 桌面 API 类
 */
export class DesktopApi {
    private config: DesktopApiConfig
    private isOnline: boolean = false
    private syncStatus: SyncStatus = {
        lastSync: 0,
        pendingChanges: 0,
        conflicts: [],
        isOnline: false,
        syncInProgress: false,
    }

    constructor(config: Partial<DesktopApiConfig> = {}) {
        this.config = {
            baseUrl: 'http://127.0.0.1:8000',
            timeout: 10000,
            retryAttempts: 3,
            retryDelay: 1000,
            enableLogging: true,
            ...config,
        }
    }

    /**
     * 初始化 API
     */
    async initialize(): Promise<void> {
        try {
            // 检查网络连接
            await this.checkConnectivity()
            
            // 设置事件监听
            await this.setupEventListeners()
            
            // 开始定期同步
            this.startPeriodicSync()
            
            this.log('Desktop API initialized successfully')
        } catch (error) {
            this.log('Failed to initialize Desktop API:', error)
            throw error
        }
    }

    /**
     * 检查网络连接
     */
    async checkConnectivity(): Promise<boolean> {
        try {
            const startTime = Date.now()
            const response = await fetch(`${this.config.baseUrl}/health`, {
                method: 'GET',
                signal: AbortSignal.timeout(this.config.timeout),
            })
            
            const latency = Date.now() - startTime
            this.isOnline = response.ok
            this.syncStatus.isOnline = this.isOnline
            this.syncStatus.lastSync = Date.now()
            
            this.log(`Connectivity check: ${this.isOnline ? 'online' : 'offline'}, latency: ${latency}ms`)
            return this.isOnline
        } catch (error) {
            this.isOnline = false
            this.syncStatus.isOnline = false
            this.log('Connectivity check failed:', error)
            return false
        }
    }

    /**
     * 获取系统信息
     */
    async getSystemInfo(): Promise<SystemInfo> {
        try {
            const systemInfo = await invoke<SystemInfo>('get_system_info')
            return systemInfo
        } catch (error) {
            this.log('Failed to get system info:', error)
            throw error
        }
    }

    /**
     * 上传系统信息
     */
    async uploadSystemInfo(systemInfo: SystemInfo): Promise<ApiResponse<{ id: string }>> {
        return await this.makeRequest('/api/desktop/system-info', {
            method: 'POST',
            body: JSON.stringify(systemInfo),
        })
    }

    /**
     * 上传性能指标
     */
    async uploadPerformanceMetrics(metrics: PerformanceMetrics): Promise<ApiResponse<{ received: boolean }>> {
        return await this.makeRequest('/api/desktop/performance', {
            method: 'POST',
            body: JSON.stringify(metrics),
        })
    }

    /**
     * 同步设置
     */
    async syncSettings(settings: AppSettings): Promise<ApiResponse<{ synced: boolean; conflicts?: any[] }>> {
        return await this.makeRequest('/api/desktop/settings/sync', {
            method: 'POST',
            body: JSON.stringify({
                settings,
                timestamp: Date.now(),
                deviceId: await this.getDeviceId(),
            }),
        })
    }

    /**
     * 获取远程设置
     */
    async getRemoteSettings(): Promise<ApiResponse<AppSettings>> {
        return await this.makeRequest('/api/desktop/settings', {
            method: 'GET',
        })
    }

    /**
     * 上传错误报告
     */
    async uploadErrorReport(errorReport: ErrorReport): Promise<ApiResponse<{ id: string; processed: boolean }>> {
        return await this.makeRequest('/api/desktop/errors', {
            method: 'POST',
            body: JSON.stringify(errorReport),
        })
    }

    /**
     * 检查更新
     */
    async checkForUpdates(): Promise<ApiResponse<UpdateInfo | null>> {
        try {
            const currentVersion = await invoke<string>('get_app_version')
            const response = await this.makeRequest('/api/desktop/updates/check', {
                method: 'POST',
                body: JSON.stringify({
                    currentVersion,
                    platform: await invoke<string>('get_platform'),
                    arch: await invoke<string>('get_arch'),
                }),
            })
            
            return response
        } catch (error) {
            this.log('Failed to check for updates:', error)
            throw error
        }
    }

    /**
     * 下载更新
     */
    async downloadUpdate(updateInfo: UpdateInfo): Promise<ApiResponse<{ downloadUrl: string; progress?: number }>> {
        return await this.makeRequest('/api/desktop/updates/download', {
            method: 'POST',
            body: JSON.stringify(updateInfo),
        })
    }

    /**
     * 获取设备统计
     */
    async getDeviceStats(): Promise<ApiResponse<{
        totalDevices: number
        activeDevices: number
        lastSeen: number
        usageStats: {
            daily: number
            weekly: number
            monthly: number
        }
    }>> {
        return await this.makeRequest('/api/desktop/stats', {
            method: 'GET',
        })
    }

    /**
     * 上传使用统计
     */
    async uploadUsageStats(stats: {
        sessionDuration: number
        operationsCount: number
        errorsCount: number
        featuresUsed: string[]
        timestamp: number
    }): Promise<ApiResponse<{ received: boolean }>> {
        return await this.makeRequest('/api/desktop/usage', {
            method: 'POST',
            body: JSON.stringify(stats),
        })
    }

    /**
     * 获取配置
     */
    async getRemoteConfig(): Promise<ApiResponse<AppConfig>> {
        return await this.makeRequest('/api/desktop/config', {
            method: 'GET',
        })
    }

    /**
     * 上传配置
     */
    async uploadConfig(config: AppConfig): Promise<ApiResponse<{ synced: boolean }>> {
        return await this.makeRequest('/api/desktop/config', {
            method: 'POST',
            body: JSON.stringify(config),
        })
    }

    /**
     * 获取通知
     */
    async getNotifications(): Promise<ApiResponse<Array<{
        id: string
        title: string
        body: string
        type: 'info' | 'warning' | 'error' | 'update'
        timestamp: number
        read: boolean
        actions?: Array<{ label: string; action: string }>
    }>>> {
        return await this.makeRequest('/api/desktop/notifications', {
            method: 'GET',
        })
    }

    /**
     * 标记通知为已读
     */
    async markNotificationRead(notificationId: string): Promise<ApiResponse<{ marked: boolean }>> {
        return await this.makeRequest(`/api/desktop/notifications/${notificationId}/read`, {
            method: 'POST',
        })
    }

    /**
     * 获取同步状态
     */
    getSyncStatus(): SyncStatus {
        return { ...this.syncStatus }
    }

    /**
     * 强制同步
     */
    async forceSync(): Promise<void> {
        if (this.syncStatus.syncInProgress) {
            this.log('Sync already in progress')
            return
        }

        this.syncStatus.syncInProgress = true
        
        try {
            // 同步设置
            const settings = await this.getStoredSettings()
            if (settings) {
                await this.syncSettings(settings)
            }

            // 同步配置
            const config = await this.getStoredConfig()
            if (config) {
                await this.uploadConfig(config)
            }

            // 上传性能指标
            const metrics = await this.getCurrentPerformanceMetrics()
            if (metrics) {
                await this.uploadPerformanceMetrics(metrics)
            }

            this.syncStatus.lastSync = Date.now()
            this.syncStatus.pendingChanges = 0
            
            this.log('Force sync completed successfully')
        } catch (error) {
            this.log('Force sync failed:', error)
            throw error
        } finally {
            this.syncStatus.syncInProgress = false
        }
    }

    /**
     * 设置事件监听
     */
    private async setupEventListeners(): Promise<void> {
        try {
            // 监听网络状态变化
            await listen('network-status-changed', (event: any) => {
                this.isOnline = event.payload.isOnline
                this.syncStatus.isOnline = this.isOnline
                
                if (this.isOnline) {
                    this.forceSync().catch(error => {
                        this.log('Auto sync after reconnection failed:', error)
                    })
                }
            })

            // 监听性能指标更新
            await listen('performance-updated', async (event: any) => {
                if (this.isOnline) {
                    try {
                        await this.uploadPerformanceMetrics(event.payload)
                    } catch (error) {
                        this.log('Failed to upload performance metrics:', error)
                    }
                }
            })

            // 监听错误事件
            await listen('error-occurred', async (event: any) => {
                if (this.isOnline) {
                    try {
                        const errorReport: ErrorReport = {
                            id: `error-${Date.now()}`,
                            timestamp: Date.now(),
                            level: 'error',
                            message: event.payload.message,
                            stack: event.payload.stack,
                            context: event.payload.context,
                            operation: event.payload.operation,
                        }
                        
                        await this.uploadErrorReport(errorReport)
                    } catch (error) {
                        this.log('Failed to upload error report:', error)
                    }
                }
            })

            this.log('Event listeners setup completed')
        } catch (error) {
            this.log('Failed to setup event listeners:', error)
            throw error
        }
    }

    /**
     * 开始定期同步
     */
    private startPeriodicSync(): void {
        // 每5分钟同步一次
        setInterval(async () => {
            if (this.isOnline && !this.syncStatus.syncInProgress) {
                try {
                    await this.forceSync()
                } catch (error) {
                    this.log('Periodic sync failed:', error)
                }
            }
        }, 5 * 60 * 1000)

        // 每30秒检查连接状态
        setInterval(async () => {
            await this.checkConnectivity()
        }, 30 * 1000)
    }

    /**
     * 发起 HTTP 请求
     */
    private async makeRequest<T>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
        const url = `${this.config.baseUrl}${endpoint}`
        
        const requestOptions: RequestInit = {
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Zishu-Sensei-Desktop/1.0.0',
                ...options.headers,
            },
            signal: AbortSignal.timeout(this.config.timeout),
            ...options,
        }

        let lastError: Error | null = null
        
        for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
            try {
                this.log(`Making request to ${url} (attempt ${attempt}/${this.config.retryAttempts})`)
                
                const response = await fetch(url, requestOptions)
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`)
                }
                
                const data = await response.json()
                
                this.log(`Request successful: ${url}`)
                return data
                
            } catch (error) {
                lastError = error as Error
                this.log(`Request failed (attempt ${attempt}/${this.config.retryAttempts}):`, error)
                
                if (attempt < this.config.retryAttempts) {
                    await this.delay(this.config.retryDelay * attempt)
                }
            }
        }
        
        throw lastError || new Error('Request failed after all retry attempts')
    }

    /**
     * 获取设备ID
     */
    private async getDeviceId(): Promise<string> {
        try {
            return await invoke<string>('get_device_id')
        } catch (error) {
            // 如果获取失败，生成一个临时ID
            return `device-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        }
    }

    /**
     * 获取存储的设置
     */
    private async getStoredSettings(): Promise<AppSettings | null> {
        try {
            // 这里应该从实际的存储中获取设置
            // 简化实现，返回 null
            return null
        } catch (error) {
            this.log('Failed to get stored settings:', error)
            return null
        }
    }

    /**
     * 获取存储的配置
     */
    private async getStoredConfig(): Promise<AppConfig | null> {
        try {
            // 这里应该从实际的存储中获取配置
            // 简化实现，返回 null
            return null
        } catch (error) {
            this.log('Failed to get stored config:', error)
            return null
        }
    }

    /**
     * 获取当前性能指标
     */
    private async getCurrentPerformanceMetrics(): Promise<PerformanceMetrics | null> {
        try {
            const systemInfo = await this.getSystemInfo()
            
            return {
                memoryUsage: systemInfo.memory.used,
                cpuUsage: systemInfo.cpu.usage,
                uptime: Date.now() - (await invoke<number>('get_app_start_time')),
                timestamp: Date.now(),
            }
        } catch (error) {
            this.log('Failed to get current performance metrics:', error)
            return null
        }
    }

    /**
     * 延迟函数
     */
    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms))
    }

    /**
     * 日志记录
     */
    private log(message: string, ...args: any[]): void {
        if (this.config.enableLogging) {
            console.log(`[DesktopApi] ${message}`, ...args)
        }
    }
}

/**
 * 桌面 API 实例
 */
export const desktopApi = new DesktopApi()

/**
 * 桌面 API Hook
 */
export const useDesktopApi = () => {
    return {
        api: desktopApi,
        isOnline: desktopApi.getSyncStatus().isOnline,
        syncStatus: desktopApi.getSyncStatus(),
        
        // 便捷方法
        checkConnectivity: () => desktopApi.checkConnectivity(),
        getSystemInfo: () => desktopApi.getSystemInfo(),
        uploadPerformanceMetrics: (metrics: PerformanceMetrics) => desktopApi.uploadPerformanceMetrics(metrics),
        syncSettings: (settings: AppSettings) => desktopApi.syncSettings(settings),
        getRemoteSettings: () => desktopApi.getRemoteSettings(),
        uploadErrorReport: (errorReport: ErrorReport) => desktopApi.uploadErrorReport(errorReport),
        checkForUpdates: () => desktopApi.checkForUpdates(),
        downloadUpdate: (updateInfo: UpdateInfo) => desktopApi.downloadUpdate(updateInfo),
        getDeviceStats: () => desktopApi.getDeviceStats(),
        uploadUsageStats: (stats: any) => desktopApi.uploadUsageStats(stats),
        getRemoteConfig: () => desktopApi.getRemoteConfig(),
        uploadConfig: (config: AppConfig) => desktopApi.uploadConfig(config),
        getNotifications: () => desktopApi.getNotifications(),
        markNotificationRead: (id: string) => desktopApi.markNotificationRead(id),
        forceSync: () => desktopApi.forceSync(),
    }
}

/**
 * 导出类型
 */
export type {
    DesktopApiConfig,
    SystemInfo,
    PerformanceMetrics,
    ErrorReport,
    UpdateInfo,
    SyncStatus,
}
