/**
 * 主题商店 Hook
 * 
 * 提供主题商店相关功能的 React Hook：
 * - 主题搜索和浏览
 * - 主题安装和卸载
 * - 主题收藏
 * - 主题评论
 * - 状态管理
 */

import { useState, useCallback, useEffect, useMemo } from 'react'
import toast from 'react-hot-toast'
import themeService from '@/services/themeService'
import type {
    ThemeCard,
    ThemeDetail,
    ThemeSearchOptions,
    ThemeSearchResult,
    ThemeReview,
    ThemeStatistics,
    ThemeEvent
} from '@/types/theme'

/**
 * Hook 返回值类型
 */
export interface UseThemeMarketReturn {
    // 数据
    themes: ThemeCard[]
    selectedTheme: ThemeDetail | null
    reviews: ThemeReview[]
    statistics: ThemeStatistics | null
    total: number
    page: number
    pageSize: number
    totalPages: number
    hasNextPage: boolean
    
    // 状态
    loading: boolean
    error: Error | null
    
    // 操作
    searchThemes: (options?: ThemeSearchOptions) => Promise<void>
    loadMore: () => Promise<void>
    selectTheme: (themeId: string) => Promise<void>
    installTheme: (themeId: string, setAsCurrent?: boolean) => Promise<void>
    uninstallTheme: (themeId: string) => Promise<void>
    favoriteTheme: (themeId: string) => Promise<void>
    reviewTheme: (themeId: string, rating: number, content: string) => Promise<void>
    getInstalledThemes: () => Promise<void>
    getFavoritedThemes: () => Promise<void>
    refreshStatistics: () => Promise<void>
    clearError: () => void
}

/**
 * Hook 选项
 */
export interface UseThemeMarketOptions {
    /** 初始搜索选项 */
    initialOptions?: ThemeSearchOptions
    /** 是否自动加载 */
    autoLoad?: boolean
    /** 是否启用缓存 */
    enableCache?: boolean
}

/**
 * 主题商店 Hook
 */
export function useThemeMarket(options: UseThemeMarketOptions = {}): UseThemeMarketReturn {
    const {
        initialOptions = {},
        autoLoad = true,
        enableCache = true
    } = options
    
    // ==================== 状态 ====================
    
    const [themes, setThemes] = useState<ThemeCard[]>([])
    const [selectedTheme, setSelectedTheme] = useState<ThemeDetail | null>(null)
    const [reviews, setReviews] = useState<ThemeReview[]>([])
    const [statistics, setStatistics] = useState<ThemeStatistics | null>(null)
    const [total, setTotal] = useState(0)
    const [page, setPage] = useState(initialOptions.page || 1)
    const [pageSize] = useState(initialOptions.pageSize || 20)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<Error | null>(null)
    const [currentOptions, setCurrentOptions] = useState<ThemeSearchOptions>(initialOptions)
    
    // ==================== 计算属性 ====================
    
    const totalPages = useMemo(() => Math.ceil(total / pageSize), [total, pageSize])
    const hasNextPage = useMemo(() => page < totalPages, [page, totalPages])
    
    // ==================== 搜索主题 ====================
    
    const searchThemes = useCallback(async (options: ThemeSearchOptions = {}) => {
        try {
            setLoading(true)
            setError(null)
            
            const searchOptions = {
                ...currentOptions,
                ...options,
                page: options.page || 1,
                pageSize
            }
            
            const result = await themeService.searchThemes(searchOptions)
            
            setThemes(result.themes)
            setTotal(result.total)
            setPage(result.page)
            setCurrentOptions(searchOptions)
        } catch (err) {
            const error = err instanceof Error ? err : new Error(String(err))
            setError(error)
            console.error('搜索主题失败:', error)
            toast.error('搜索失败，请重试')
        } finally {
            setLoading(false)
        }
    }, [currentOptions, pageSize])
    
    // ==================== 加载更多 ====================
    
    const loadMore = useCallback(async () => {
        if (!hasNextPage || loading) return
        
        try {
            setLoading(true)
            setError(null)
            
            const nextPage = page + 1
            const result = await themeService.searchThemes({
                ...currentOptions,
                page: nextPage,
                pageSize
            })
            
            setThemes(prev => [...prev, ...result.themes])
            setPage(nextPage)
        } catch (err) {
            const error = err instanceof Error ? err : new Error(String(err))
            setError(error)
            console.error('加载更多失败:', error)
            toast.error('加载失败，请重试')
        } finally {
            setLoading(false)
        }
    }, [hasNextPage, loading, page, currentOptions, pageSize])
    
    // ==================== 选择主题 ====================
    
    const selectTheme = useCallback(async (themeId: string) => {
        try {
            setLoading(true)
            setError(null)
            
            const [theme, reviewsResult] = await Promise.all([
                themeService.getTheme(themeId),
                themeService.getThemeReviews(themeId, 1, 10)
            ])
            
            setSelectedTheme(theme)
            setReviews(reviewsResult.reviews)
        } catch (err) {
            const error = err instanceof Error ? err : new Error(String(err))
            setError(error)
            console.error('获取主题详情失败:', error)
            toast.error('获取详情失败')
        } finally {
            setLoading(false)
        }
    }, [])
    
    // ==================== 安装主题 ====================
    
    const installTheme = useCallback(async (themeId: string, setAsCurrent: boolean = false) => {
        try {
            setLoading(true)
            setError(null)
            
            await themeService.installTheme({
                themeId,
                setAsCurrent,
                overwrite: false
            })
            
            // 更新本地状态
            setThemes(prev => prev.map(theme =>
                theme.id === themeId ? { ...theme, installed: true } : theme
            ))
            
            if (selectedTheme?.id === themeId) {
                setSelectedTheme(prev => prev ? { ...prev, installed: true } : null)
            }
            
            toast.success('主题安装成功')
            
            // 如果设置为当前主题，刷新页面应用主题
            if (setAsCurrent) {
                setTimeout(() => {
                    window.location.reload()
                }, 500)
            }
        } catch (err) {
            const error = err instanceof Error ? err : new Error(String(err))
            setError(error)
            console.error('安装主题失败:', error)
            toast.error('安装失败，请重试')
        } finally {
            setLoading(false)
        }
    }, [selectedTheme])
    
    // ==================== 卸载主题 ====================
    
    const uninstallTheme = useCallback(async (themeId: string) => {
        try {
            setLoading(true)
            setError(null)
            
            await themeService.uninstallTheme({
                themeId,
                removeUserData: false,
                backup: true
            })
            
            // 更新本地状态
            setThemes(prev => prev.map(theme =>
                theme.id === themeId ? { ...theme, installed: false } : theme
            ))
            
            if (selectedTheme?.id === themeId) {
                setSelectedTheme(prev => prev ? { ...prev, installed: false } : null)
            }
            
            toast.success('主题已卸载')
        } catch (err) {
            const error = err instanceof Error ? err : new Error(String(err))
            setError(error)
            console.error('卸载主题失败:', error)
            toast.error('卸载失败，请重试')
        } finally {
            setLoading(false)
        }
    }, [selectedTheme])
    
    // ==================== 收藏主题 ====================
    
    const favoriteTheme = useCallback(async (themeId: string) => {
        try {
            const theme = themes.find(t => t.id === themeId)
            if (!theme) return
            
            if (theme.favorited) {
                await themeService.unfavoriteTheme(themeId)
            } else {
                await themeService.favoriteTheme(themeId)
            }
            
            // 更新本地状态
            setThemes(prev => prev.map(t =>
                t.id === themeId ? { ...t, favorited: !t.favorited } : t
            ))
            
            if (selectedTheme?.id === themeId) {
                setSelectedTheme(prev => prev ? { ...prev, favorited: !prev.favorited } : null)
            }
            
            toast.success(theme.favorited ? '已取消收藏' : '已添加到收藏')
        } catch (err) {
            const error = err instanceof Error ? err : new Error(String(err))
            setError(error)
            console.error('收藏操作失败:', error)
            toast.error('操作失败，请重试')
        }
    }, [themes, selectedTheme])
    
    // ==================== 评论主题 ====================
    
    const reviewTheme = useCallback(async (
        themeId: string,
        rating: number,
        content: string
    ) => {
        try {
            setLoading(true)
            setError(null)
            
            const review = await themeService.reviewTheme(themeId, rating, content)
            
            // 更新评论列表
            if (selectedTheme?.id === themeId) {
                setReviews(prev => [review, ...prev])
            }
            
            toast.success('评论发布成功')
        } catch (err) {
            const error = err instanceof Error ? err : new Error(String(err))
            setError(error)
            console.error('发布评论失败:', error)
            toast.error('发布失败，请重试')
        } finally {
            setLoading(false)
        }
    }, [selectedTheme])
    
    // ==================== 获取已安装主题 ====================
    
    const getInstalledThemes = useCallback(async () => {
        try {
            setLoading(true)
            setError(null)
            
            const installedThemes = await themeService.getInstalledThemes()
            setThemes(installedThemes)
            setTotal(installedThemes.length)
        } catch (err) {
            const error = err instanceof Error ? err : new Error(String(err))
            setError(error)
            console.error('获取已安装主题失败:', error)
            toast.error('获取失败，请重试')
        } finally {
            setLoading(false)
        }
    }, [])
    
    // ==================== 获取收藏主题 ====================
    
    const getFavoritedThemes = useCallback(async () => {
        try {
            setLoading(true)
            setError(null)
            
            const favoritedThemes = await themeService.getFavoritedThemes()
            setThemes(favoritedThemes)
            setTotal(favoritedThemes.length)
        } catch (err) {
            const error = err instanceof Error ? err : new Error(String(err))
            setError(error)
            console.error('获取收藏主题失败:', error)
            toast.error('获取失败，请重试')
        } finally {
            setLoading(false)
        }
    }, [])
    
    // ==================== 刷新统计 ====================
    
    const refreshStatistics = useCallback(async () => {
        try {
            const stats = await themeService.getStatistics()
            setStatistics(stats)
        } catch (err) {
            console.error('获取统计信息失败:', err)
        }
    }, [])
    
    // ==================== 清除错误 ====================
    
    const clearError = useCallback(() => {
        setError(null)
    }, [])
    
    // ==================== 监听主题事件 ====================
    
    useEffect(() => {
        const unsubscribe = themeService.subscribe((event: ThemeEvent) => {
            // 根据事件类型更新状态
            if (event.type === 'theme:installed' || event.type === 'theme:uninstalled') {
                // 刷新主题列表
                searchThemes(currentOptions)
            }
            
            if (event.type === 'theme:favorited' || event.type === 'theme:unfavorited') {
                // 更新收藏状态
                const themeId = event.payload.themeId
                setThemes(prev => prev.map(theme =>
                    theme.id === themeId
                        ? { ...theme, favorited: event.type === 'theme:favorited' }
                        : theme
                ))
            }
        })
        
        return unsubscribe
    }, [currentOptions, searchThemes])
    
    // ==================== 自动加载 ====================
    
    useEffect(() => {
        if (autoLoad) {
            searchThemes(initialOptions)
            refreshStatistics()
        }
    }, []) // eslint-disable-line react-hooks/exhaustive-deps
    
    // ==================== 返回 ====================
    
    return {
        // 数据
        themes,
        selectedTheme,
        reviews,
        statistics,
        total,
        page,
        pageSize,
        totalPages,
        hasNextPage,
        
        // 状态
        loading,
        error,
        
        // 操作
        searchThemes,
        loadMore,
        selectTheme,
        installTheme,
        uninstallTheme,
        favoriteTheme,
        reviewTheme,
        getInstalledThemes,
        getFavoritedThemes,
        refreshStatistics,
        clearError
    }
}

export default useThemeMarket

