/**
 * 主题服务
 * 
 * 提供主题相关的所有API调用和业务逻辑：
 * - 主题搜索和浏览
 * - 主题安装和卸载
 * - 主题收藏和评论
 * - 主题导入和导出
 * - 主题应用和管理
 */

import { invoke } from '@tauri-apps/api/tauri'
import type {
    ThemeDetail,
    ThemeCard,
    ThemeSearchOptions,
    ThemeSearchResult,
    ThemeInstallOptions,
    ThemeUninstallOptions,
    ThemeExportOptions,
    ThemeImportOptions,
    ThemeImportValidation,
    ThemeReview,
    ThemeStatistics,
    ThemeRepository,
    ThemeEventListener,
    ThemeEvent
} from '@/types/theme'

/**
 * 主题服务类
 */
class ThemeService implements ThemeRepository {
    private listeners: Set<ThemeEventListener> = new Set()
    private cache: Map<string, { data: any; timestamp: number }> = new Map()
    private cacheDuration = 5 * 60 * 1000 // 5分钟缓存
    
    /**
     * 搜索主题
     */
    async searchThemes(options: ThemeSearchOptions = {}): Promise<ThemeSearchResult> {
        const cacheKey = `search:${JSON.stringify(options)}`
        const cached = this.getCache(cacheKey)
        if (cached) return cached
        
        try {
            const result = await invoke<ThemeSearchResult>('search_themes', { options })
            this.setCache(cacheKey, result)
            return result
        } catch (error) {
            console.error('搜索主题失败:', error)
            throw new Error(`搜索主题失败: ${error}`)
        }
    }
    
    /**
     * 获取主题详情
     */
    async getTheme(themeId: string): Promise<ThemeDetail> {
        const cacheKey = `theme:${themeId}`
        const cached = this.getCache(cacheKey)
        if (cached) return cached
        
        try {
            const theme = await invoke<ThemeDetail>('get_theme', { themeId })
            this.setCache(cacheKey, theme)
            return theme
        } catch (error) {
            console.error('获取主题失败:', error)
            throw new Error(`获取主题失败: ${error}`)
        }
    }
    
    /**
     * 获取主题评论
     */
    async getThemeReviews(
        themeId: string,
        page: number = 1,
        pageSize: number = 20
    ): Promise<{
        reviews: ThemeReview[]
        total: number
        page: number
        pageSize: number
    }> {
        const cacheKey = `reviews:${themeId}:${page}:${pageSize}`
        const cached = this.getCache(cacheKey)
        if (cached) return cached
        
        try {
            const result = await invoke('get_theme_reviews', {
                themeId,
                page,
                pageSize
            })
            this.setCache(cacheKey, result)
            return result
        } catch (error) {
            console.error('获取主题评论失败:', error)
            throw new Error(`获取主题评论失败: ${error}`)
        }
    }
    
    /**
     * 安装主题
     */
    async installTheme(options: ThemeInstallOptions): Promise<void> {
        try {
            await invoke('install_theme', { options })
            
            // 清除相关缓存
            this.clearCacheByPattern(`theme:${options.themeId}`)
            
            // 触发事件
            this.emitEvent({
                type: 'theme:installed',
                payload: { themeId: options.themeId },
                timestamp: Date.now()
            })
        } catch (error) {
            console.error('安装主题失败:', error)
            throw new Error(`安装主题失败: ${error}`)
        }
    }
    
    /**
     * 卸载主题
     */
    async uninstallTheme(options: ThemeUninstallOptions): Promise<void> {
        try {
            await invoke('uninstall_theme', { options })
            
            // 清除相关缓存
            this.clearCacheByPattern(`theme:${options.themeId}`)
            
            // 触发事件
            this.emitEvent({
                type: 'theme:uninstalled',
                payload: { themeId: options.themeId },
                timestamp: Date.now()
            })
        } catch (error) {
            console.error('卸载主题失败:', error)
            throw new Error(`卸载主题失败: ${error}`)
        }
    }
    
    /**
     * 收藏主题
     */
    async favoriteTheme(themeId: string): Promise<void> {
        try {
            await invoke('favorite_theme', { themeId })
            
            // 清除相关缓存
            this.clearCacheByPattern(`theme:${themeId}`)
            
            // 触发事件
            this.emitEvent({
                type: 'theme:favorited',
                payload: { themeId },
                timestamp: Date.now()
            })
        } catch (error) {
            console.error('收藏主题失败:', error)
            throw new Error(`收藏主题失败: ${error}`)
        }
    }
    
    /**
     * 取消收藏主题
     */
    async unfavoriteTheme(themeId: string): Promise<void> {
        try {
            await invoke('unfavorite_theme', { themeId })
            
            // 清除相关缓存
            this.clearCacheByPattern(`theme:${themeId}`)
            
            // 触发事件
            this.emitEvent({
                type: 'theme:unfavorited',
                payload: { themeId },
                timestamp: Date.now()
            })
        } catch (error) {
            console.error('取消收藏失败:', error)
            throw new Error(`取消收藏失败: ${error}`)
        }
    }
    
    /**
     * 评价主题
     */
    async reviewTheme(
        themeId: string,
        rating: number,
        content: string
    ): Promise<ThemeReview> {
        try {
            const review = await invoke<ThemeReview>('review_theme', {
                themeId,
                rating,
                content
            })
            
            // 清除相关缓存
            this.clearCacheByPattern(`theme:${themeId}`)
            this.clearCacheByPattern(`reviews:${themeId}`)
            
            // 触发事件
            this.emitEvent({
                type: 'theme:reviewed',
                payload: { themeId, rating, content },
                timestamp: Date.now()
            })
            
            return review
        } catch (error) {
            console.error('评价主题失败:', error)
            throw new Error(`评价主题失败: ${error}`)
        }
    }
    
    /**
     * 导出主题
     */
    async exportTheme(options: ThemeExportOptions): Promise<string> {
        try {
            const filePath = await invoke<string>('export_theme', { options })
            return filePath
        } catch (error) {
            console.error('导出主题失败:', error)
            throw new Error(`导出主题失败: ${error}`)
        }
    }
    
    /**
     * 导入主题
     */
    async importTheme(options: ThemeImportOptions): Promise<ThemeDetail> {
        try {
            const theme = await invoke<ThemeDetail>('import_theme', { options })
            
            // 触发事件
            this.emitEvent({
                type: 'theme:installed',
                payload: { themeId: theme.id, theme },
                timestamp: Date.now()
            })
            
            return theme
        } catch (error) {
            console.error('导入主题失败:', error)
            throw new Error(`导入主题失败: ${error}`)
        }
    }
    
    /**
     * 验证主题
     */
    async validateTheme(source: string): Promise<ThemeImportValidation> {
        try {
            const validation = await invoke<ThemeImportValidation>('validate_theme', {
                source
            })
            return validation
        } catch (error) {
            console.error('验证主题失败:', error)
            throw new Error(`验证主题失败: ${error}`)
        }
    }
    
    /**
     * 获取统计信息
     */
    async getStatistics(): Promise<ThemeStatistics> {
        const cacheKey = 'statistics'
        const cached = this.getCache(cacheKey)
        if (cached) return cached
        
        try {
            const stats = await invoke<ThemeStatistics>('get_theme_statistics')
            this.setCache(cacheKey, stats, 60 * 1000) // 1分钟缓存
            return stats
        } catch (error) {
            console.error('获取统计信息失败:', error)
            throw new Error(`获取统计信息失败: ${error}`)
        }
    }
    
    /**
     * 应用主题
     */
    async applyTheme(themeId: string): Promise<void> {
        try {
            await invoke('apply_theme', { themeId })
            
            // 触发事件
            this.emitEvent({
                type: 'theme:applied',
                payload: { themeId },
                timestamp: Date.now()
            })
        } catch (error) {
            console.error('应用主题失败:', error)
            throw new Error(`应用主题失败: ${error}`)
        }
    }
    
    /**
     * 获取已安装的主题
     */
    async getInstalledThemes(): Promise<ThemeCard[]> {
        const cacheKey = 'installed'
        const cached = this.getCache(cacheKey)
        if (cached) return cached
        
        try {
            const themes = await invoke<ThemeCard[]>('get_installed_themes')
            this.setCache(cacheKey, themes, 10 * 1000) // 10秒缓存
            return themes
        } catch (error) {
            console.error('获取已安装主题失败:', error)
            throw new Error(`获取已安装主题失败: ${error}`)
        }
    }
    
    /**
     * 获取收藏的主题
     */
    async getFavoritedThemes(): Promise<ThemeCard[]> {
        const cacheKey = 'favorited'
        const cached = this.getCache(cacheKey)
        if (cached) return cached
        
        try {
            const themes = await invoke<ThemeCard[]>('get_favorited_themes')
            this.setCache(cacheKey, themes, 10 * 1000) // 10秒缓存
            return themes
        } catch (error) {
            console.error('获取收藏主题失败:', error)
            throw new Error(`获取收藏主题失败: ${error}`)
        }
    }
    
    /**
     * 订阅事件
     */
    subscribe(listener: ThemeEventListener): () => void {
        this.listeners.add(listener)
        return () => {
            this.listeners.delete(listener)
        }
    }
    
    /**
     * 触发事件
     */
    private emitEvent(event: ThemeEvent): void {
        this.listeners.forEach(listener => {
            try {
                listener(event)
            } catch (error) {
                console.error('事件监听器执行错误:', error)
            }
        })
    }
    
    /**
     * 获取缓存
     */
    private getCache<T>(key: string): T | null {
        const cached = this.cache.get(key)
        if (!cached) return null
        
        // 检查缓存是否过期
        if (Date.now() - cached.timestamp > this.cacheDuration) {
            this.cache.delete(key)
            return null
        }
        
        return cached.data as T
    }
    
    /**
     * 设置缓存
     */
    private setCache(key: string, data: any, duration?: number): void {
        this.cache.set(key, {
            data,
            timestamp: Date.now()
        })
        
        // 设置自动清除
        const timeout = duration || this.cacheDuration
        setTimeout(() => {
            this.cache.delete(key)
        }, timeout)
    }
    
    /**
     * 清除匹配模式的缓存
     */
    private clearCacheByPattern(pattern: string): void {
        const keys = Array.from(this.cache.keys())
        keys.forEach(key => {
            if (key.includes(pattern)) {
                this.cache.delete(key)
            }
        })
    }
    
    /**
     * 清除所有缓存
     */
    clearCache(): void {
        this.cache.clear()
    }
}

/**
 * 创建单例实例
 */
const themeService = new ThemeService()

/**
 * 导出实例和类
 */
export { ThemeService, themeService }
export default themeService

