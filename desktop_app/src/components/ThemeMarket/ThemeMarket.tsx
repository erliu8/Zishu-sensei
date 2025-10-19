/**
 * 主题商店组件
 * 
 * 功能特性：
 * - 🛍️ 主题浏览和搜索
 * - 📊 主题排序和过滤
 * - 💾 主题安装和管理
 * - ⭐ 主题收藏
 * - 💬 主题评论和评分
 * - 📈 主题统计
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react'
import clsx from 'clsx'
import toast from 'react-hot-toast'
import { motion, AnimatePresence } from 'framer-motion'
import type {
    ThemeCard,
    ThemeDetail,
    ThemeSearchOptions,
    ThemeSearchFilters,
    ThemeSortBy,
    ThemeCategory
} from '@/types/theme'
import { ThemePreview } from '../ThemeCustomizer/ThemePreview'

/**
 * 组件属性
 */
export interface ThemeMarketProps {
    /** 初始搜索选项 */
    initialOptions?: ThemeSearchOptions
    /** 主题安装回调 */
    onInstall?: (themeId: string) => Promise<void>
    /** 主题卸载回调 */
    onUninstall?: (themeId: string) => Promise<void>
    /** 主题收藏回调 */
    onFavorite?: (themeId: string) => Promise<void>
    /** 主题详情点击回调 */
    onViewDetails?: (themeId: string) => void
    /** 自定义类名 */
    className?: string
}

/**
 * 模拟主题数据（实际应从API获取）
 */
const MOCK_THEMES: ThemeCard[] = [
    {
        id: 'anime-sakura',
        name: 'anime-sakura',
        displayName: '樱花动漫',
        description: '温柔的粉色系动漫风格主题，灵感来自樱花盛开的季节',
        author: '主题设计师',
        category: 'anime',
        tags: ['粉色', '温柔', '可爱'],
        thumbnail: 'https://via.placeholder.com/400x300/ffb6c1/ffffff?text=Sakura',
        isDark: false,
        downloads: 15230,
        rating: 4.8,
        ratingCount: 892,
        installed: false,
        favorited: false,
        updatedAt: '2025-10-15'
    },
    {
        id: 'cyberpunk-neon',
        name: 'cyberpunk-neon',
        displayName: '赛博霓虹',
        description: '炫酷的赛博朋克风格，霓虹灯效果，未来感十足',
        author: '主题设计师',
        category: 'dark',
        tags: ['霓虹', '科技', '深色'],
        thumbnail: 'https://via.placeholder.com/400x300/00ffff/000000?text=Cyberpunk',
        isDark: true,
        downloads: 28950,
        rating: 4.9,
        ratingCount: 1520,
        installed: false,
        favorited: false,
        updatedAt: '2025-10-18'
    },
    {
        id: 'minimal-zen',
        name: 'minimal-zen',
        displayName: '极简禅意',
        description: '简洁优雅的极简设计，专注于内容本身',
        author: '主题设计师',
        category: 'minimalist',
        tags: ['简洁', '优雅', '禅意'],
        thumbnail: 'https://via.placeholder.com/400x300/f5f5f5/333333?text=Zen',
        isDark: false,
        downloads: 12450,
        rating: 4.7,
        ratingCount: 654,
        installed: true,
        favorited: true,
        updatedAt: '2025-10-12'
    },
    {
        id: 'nature-forest',
        name: 'nature-forest',
        displayName: '自然森林',
        description: '清新的绿色系主题，让你仿佛置身于森林之中',
        author: '主题设计师',
        category: 'light',
        tags: ['绿色', '自然', '清新'],
        thumbnail: 'https://via.placeholder.com/400x300/90ee90/ffffff?text=Forest',
        isDark: false,
        downloads: 9870,
        rating: 4.6,
        ratingCount: 432,
        installed: false,
        favorited: false,
        updatedAt: '2025-10-10'
    },
    {
        id: 'sunset-gradient',
        name: 'sunset-gradient',
        displayName: '日落渐变',
        description: '温暖的日落色彩渐变主题，充满浪漫气息',
        author: '主题设计师',
        category: 'gradient',
        tags: ['渐变', '温暖', '浪漫'],
        thumbnail: 'https://via.placeholder.com/400x300/ff6b6b/ffffff?text=Sunset',
        isDark: false,
        downloads: 18640,
        rating: 4.8,
        ratingCount: 1098,
        installed: false,
        favorited: true,
        updatedAt: '2025-10-16'
    },
    {
        id: 'retro-80s',
        name: 'retro-80s',
        displayName: '复古80年代',
        description: '充满怀旧感的80年代复古风格',
        author: '主题设计师',
        category: 'retro',
        tags: ['复古', '怀旧', '80年代'],
        thumbnail: 'https://via.placeholder.com/400x300/ff00ff/ffffff?text=Retro+80s',
        isDark: false,
        downloads: 7650,
        rating: 4.5,
        ratingCount: 321,
        installed: false,
        favorited: false,
        updatedAt: '2025-10-08'
    }
]

/**
 * 类别选项
 */
const CATEGORY_OPTIONS: Array<{ value: ThemeCategory; label: string; icon: string }> = [
    { value: 'official', label: '官方主题', icon: '⭐' },
    { value: 'community', label: '社区主题', icon: '👥' },
    { value: 'anime', label: '动漫风格', icon: '🎨' },
    { value: 'dark', label: '深色系列', icon: '🌙' },
    { value: 'light', label: '浅色系列', icon: '☀️' },
    { value: 'colorful', label: '多彩系列', icon: '🌈' },
    { value: 'minimalist', label: '极简风格', icon: '⬜' },
    { value: 'retro', label: '复古风格', icon: '📼' },
    { value: 'gradient', label: '渐变风格', icon: '🎭' },
    { value: 'seasonal', label: '季节主题', icon: '🍂' }
]

/**
 * 排序选项
 */
const SORT_OPTIONS: Array<{ value: ThemeSortBy; label: string }> = [
    { value: 'popular', label: '最受欢迎' },
    { value: 'downloads', label: '下载量' },
    { value: 'rating', label: '评分' },
    { value: 'newest', label: '最新' },
    { value: 'updated', label: '最近更新' }
]

/**
 * 主题商店组件
 */
export const ThemeMarket: React.FC<ThemeMarketProps> = ({
    initialOptions,
    onInstall,
    onUninstall,
    onFavorite,
    onViewDetails,
    className
}) => {
    // ==================== 状态 ====================
    
    const [searchKeyword, setSearchKeyword] = useState(initialOptions?.filters?.keyword || '')
    const [selectedCategories, setSelectedCategories] = useState<ThemeCategory[]>(
        initialOptions?.filters?.categories || []
    )
    const [sortBy, setSortBy] = useState<ThemeSortBy>(initialOptions?.sortBy || 'popular')
    const [installedOnly, setInstalledOnly] = useState(initialOptions?.filters?.installedOnly || false)
    const [favoritedOnly, setFavoritedOnly] = useState(initialOptions?.filters?.favoritedOnly || false)
    const [themes, setThemes] = useState<ThemeCard[]>(MOCK_THEMES)
    const [loading, setLoading] = useState(false)
    const [selectedTheme, setSelectedTheme] = useState<string | null>(null)
    
    // ==================== 过滤和排序 ====================
    
    const filteredThemes = useMemo(() => {
        let result = [...themes]
        
        // 关键词搜索
        if (searchKeyword) {
            const keyword = searchKeyword.toLowerCase()
            result = result.filter(theme =>
                theme.displayName.toLowerCase().includes(keyword) ||
                theme.description.toLowerCase().includes(keyword) ||
                theme.tags.some(tag => tag.toLowerCase().includes(keyword))
            )
        }
        
        // 类别过滤
        if (selectedCategories.length > 0) {
            result = result.filter(theme => selectedCategories.includes(theme.category))
        }
        
        // 已安装过滤
        if (installedOnly) {
            result = result.filter(theme => theme.installed)
        }
        
        // 收藏过滤
        if (favoritedOnly) {
            result = result.filter(theme => theme.favorited)
        }
        
        // 排序
        switch (sortBy) {
            case 'popular':
                result.sort((a, b) => (b.downloads + b.ratingCount) - (a.downloads + a.ratingCount))
                break
            case 'downloads':
                result.sort((a, b) => b.downloads - a.downloads)
                break
            case 'rating':
                result.sort((a, b) => b.rating - a.rating)
                break
            case 'newest':
            case 'updated':
                result.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
                break
            case 'name':
                result.sort((a, b) => a.displayName.localeCompare(b.displayName))
                break
        }
        
        return result
    }, [themes, searchKeyword, selectedCategories, sortBy, installedOnly, favoritedOnly])
    
    // ==================== 事件处理 ====================
    
    const handleCategoryToggle = useCallback((category: ThemeCategory) => {
        setSelectedCategories(prev =>
            prev.includes(category)
                ? prev.filter(c => c !== category)
                : [...prev, category]
        )
    }, [])
    
    const handleInstall = useCallback(async (themeId: string) => {
        try {
            setLoading(true)
            if (onInstall) {
                await onInstall(themeId)
            }
            
            // 更新本地状态
            setThemes(prev => prev.map(theme =>
                theme.id === themeId ? { ...theme, installed: true } : theme
            ))
            
            toast.success('主题安装成功')
        } catch (error) {
            console.error('安装主题失败:', error)
            toast.error('安装失败，请重试')
        } finally {
            setLoading(false)
        }
    }, [onInstall])
    
    const handleUninstall = useCallback(async (themeId: string) => {
        if (!window.confirm('确定要卸载这个主题吗？')) {
            return
        }
        
        try {
            setLoading(true)
            if (onUninstall) {
                await onUninstall(themeId)
            }
            
            // 更新本地状态
            setThemes(prev => prev.map(theme =>
                theme.id === themeId ? { ...theme, installed: false } : theme
            ))
            
            toast.success('主题已卸载')
        } catch (error) {
            console.error('卸载主题失败:', error)
            toast.error('卸载失败，请重试')
        } finally {
            setLoading(false)
        }
    }, [onUninstall])
    
    const handleFavorite = useCallback(async (themeId: string) => {
        try {
            if (onFavorite) {
                await onFavorite(themeId)
            }
            
            // 更新本地状态
            setThemes(prev => prev.map(theme =>
                theme.id === themeId ? { ...theme, favorited: !theme.favorited } : theme
            ))
            
            const theme = themes.find(t => t.id === themeId)
            if (theme?.favorited) {
                toast.success('已取消收藏')
            } else {
                toast.success('已添加到收藏')
            }
        } catch (error) {
            console.error('收藏操作失败:', error)
            toast.error('操作失败，请重试')
        }
    }, [onFavorite, themes])
    
    const handleViewDetails = useCallback((themeId: string) => {
        setSelectedTheme(themeId)
        if (onViewDetails) {
            onViewDetails(themeId)
        }
    }, [onViewDetails])
    
    // ==================== 渲染 ====================
    
    return (
        <div className={clsx('theme-market', className)}>
            {/* 搜索和过滤栏 */}
            <div className="mb-6 space-y-4">
                {/* 搜索框 */}
                <div className="flex gap-3">
                    <div className="flex-1">
                        <input
                            type="text"
                            value={searchKeyword}
                            onChange={e => setSearchKeyword(e.target.value)}
                            placeholder="搜索主题..."
                            className={clsx(
                                'w-full px-4 py-2 rounded-lg border',
                                'bg-white dark:bg-gray-800',
                                'border-gray-300 dark:border-gray-600',
                                'text-gray-900 dark:text-white',
                                'placeholder-gray-500 dark:placeholder-gray-400',
                                'focus:ring-2 focus:ring-primary-500 focus:border-primary-500',
                                'transition-colors'
                            )}
                        />
                    </div>
                    
                    {/* 排序选择 */}
                    <select
                        value={sortBy}
                        onChange={e => setSortBy(e.target.value as ThemeSortBy)}
                        className={clsx(
                            'px-4 py-2 rounded-lg border',
                            'bg-white dark:bg-gray-800',
                            'border-gray-300 dark:border-gray-600',
                            'text-gray-900 dark:text-white',
                            'focus:ring-2 focus:ring-primary-500 focus:border-primary-500',
                            'transition-colors'
                        )}
                    >
                        {SORT_OPTIONS.map(option => (
                            <option key={option.value} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </select>
                </div>
                
                {/* 类别过滤 */}
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            类别筛选:
                        </span>
                        {selectedCategories.length > 0 && (
                            <button
                                onClick={() => setSelectedCategories([])}
                                className="text-xs text-primary-500 hover:text-primary-600"
                            >
                                清除全部
                            </button>
                        )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {CATEGORY_OPTIONS.map(option => (
                            <button
                                key={option.value}
                                onClick={() => handleCategoryToggle(option.value)}
                                className={clsx(
                                    'px-3 py-1.5 rounded-full text-sm font-medium transition-colors',
                                    selectedCategories.includes(option.value)
                                        ? 'bg-primary-500 text-white'
                                        : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                                )}
                            >
                                <span className="mr-1">{option.icon}</span>
                                {option.label}
                            </button>
                        ))}
                    </div>
                </div>
                
                {/* 快捷过滤 */}
                <div className="flex gap-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={installedOnly}
                            onChange={e => setInstalledOnly(e.target.checked)}
                            className="w-4 h-4 text-primary-500 rounded focus:ring-2 focus:ring-primary-500"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                            仅显示已安装
                        </span>
                    </label>
                    
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={favoritedOnly}
                            onChange={e => setFavoritedOnly(e.target.checked)}
                            className="w-4 h-4 text-primary-500 rounded focus:ring-2 focus:ring-primary-500"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                            仅显示收藏
                        </span>
                    </label>
                </div>
            </div>
            
            {/* 结果统计 */}
            <div className="mb-4 text-sm text-gray-600 dark:text-gray-400">
                找到 <span className="font-semibold text-gray-900 dark:text-white">{filteredThemes.length}</span> 个主题
            </div>
            
            {/* 主题列表 */}
            <AnimatePresence mode="popLayout">
                {filteredThemes.length === 0 ? (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="text-center py-12"
                    >
                        <p className="text-gray-500 dark:text-gray-400 mb-2">
                            😢 没有找到匹配的主题
                        </p>
                        <button
                            onClick={() => {
                                setSearchKeyword('')
                                setSelectedCategories([])
                                setInstalledOnly(false)
                                setFavoritedOnly(false)
                            }}
                            className="text-primary-500 hover:text-primary-600 text-sm"
                        >
                            清除所有筛选条件
                        </button>
                    </motion.div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredThemes.map(theme => (
                            <ThemeMarketCard
                                key={theme.id}
                                theme={theme}
                                onInstall={() => handleInstall(theme.id)}
                                onUninstall={() => handleUninstall(theme.id)}
                                onFavorite={() => handleFavorite(theme.id)}
                                onViewDetails={() => handleViewDetails(theme.id)}
                                loading={loading}
                            />
                        ))}
                    </div>
                )}
            </AnimatePresence>
        </div>
    )
}

/**
 * 主题卡片组件属性
 */
interface ThemeMarketCardProps {
    theme: ThemeCard
    onInstall: () => void
    onUninstall: () => void
    onFavorite: () => void
    onViewDetails: () => void
    loading?: boolean
}

/**
 * 主题卡片组件
 */
const ThemeMarketCard: React.FC<ThemeMarketCardProps> = ({
    theme,
    onInstall,
    onUninstall,
    onFavorite,
    onViewDetails,
    loading
}) => {
    return (
        <motion.div
            layout
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            whileHover={{ y: -4 }}
            className="bg-white dark:bg-gray-800 rounded-lg border-2 border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm hover:shadow-md transition-shadow"
        >
            {/* 缩略图 */}
            <div className="relative aspect-video bg-gray-100 dark:bg-gray-900 overflow-hidden">
                <img
                    src={theme.thumbnail}
                    alt={theme.displayName}
                    className="w-full h-full object-cover"
                />
                
                {/* 收藏按钮 */}
                <button
                    onClick={onFavorite}
                    disabled={loading}
                    className={clsx(
                        'absolute top-2 right-2 w-8 h-8 rounded-full flex items-center justify-center transition-colors',
                        theme.favorited
                            ? 'bg-red-500 text-white hover:bg-red-600'
                            : 'bg-white/90 text-gray-700 hover:bg-white'
                    )}
                >
                    {theme.favorited ? '❤️' : '🤍'}
                </button>
                
                {/* 已安装标识 */}
                {theme.installed && (
                    <div className="absolute top-2 left-2 px-2 py-1 bg-green-500 text-white text-xs rounded-full">
                        ✓ 已安装
                    </div>
                )}
            </div>
            
            {/* 主题信息 */}
            <div className="p-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1 truncate">
                    {theme.displayName}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 line-clamp-2">
                    {theme.description}
                </p>
                
                {/* 标签 */}
                <div className="flex flex-wrap gap-1 mb-3">
                    {theme.tags.slice(0, 3).map(tag => (
                        <span
                            key={tag}
                            className="px-2 py-0.5 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded"
                        >
                            {tag}
                        </span>
                    ))}
                </div>
                
                {/* 统计信息 */}
                <div className="flex items-center gap-4 mb-3 text-xs text-gray-500 dark:text-gray-400">
                    <span>⭐ {theme.rating.toFixed(1)}</span>
                    <span>📥 {theme.downloads.toLocaleString()}</span>
                    <span>{theme.isDark ? '🌙' : '☀️'}</span>
                </div>
                
                {/* 操作按钮 */}
                <div className="flex gap-2">
                    {theme.installed ? (
                        <button
                            onClick={onUninstall}
                            disabled={loading}
                            className="flex-1 px-3 py-2 text-sm font-medium text-red-600 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors disabled:opacity-50"
                        >
                            卸载
                        </button>
                    ) : (
                        <button
                            onClick={onInstall}
                            disabled={loading}
                            className="flex-1 px-3 py-2 text-sm font-medium text-white bg-primary-500 hover:bg-primary-600 rounded-lg transition-colors disabled:opacity-50"
                        >
                            安装
                        </button>
                    )}
                    <button
                        onClick={onViewDetails}
                        disabled={loading}
                        className="px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors disabled:opacity-50"
                    >
                        详情
                    </button>
                </div>
            </div>
        </motion.div>
    )
}

export default ThemeMarket

