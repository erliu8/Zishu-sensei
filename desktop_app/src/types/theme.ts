/**
 * 主题系统类型定义
 * 
 * 提供完整的主题系统类型约束，包括：
 * - 主题配置
 * - 主题商店
 * - 主题评分和评论
 * - 主题导入/导出
 */

/**
 * 主题类别
 */
export type ThemeCategory = 
    | 'official'      // 官方主题
    | 'community'     // 社区主题
    | 'anime'         // 动漫风格
    | 'dark'          // 深色系列
    | 'light'         // 浅色系列
    | 'colorful'      // 多彩系列
    | 'minimalist'    // 极简风格
    | 'retro'         // 复古风格
    | 'gradient'      // 渐变风格
    | 'seasonal'      // 季节主题
    | 'custom'        // 自定义

/**
 * 主题标签
 */
export type ThemeTag = string

/**
 * 颜色模式
 */
export type ColorMode = 'light' | 'dark' | 'auto'

/**
 * 颜色配置
 */
export interface ColorConfig {
    /** HSL格式 */
    hsl: string
    /** RGB格式 */
    rgb: string
    /** HEX格式 */
    hex: string
}

/**
 * 主题颜色系统
 */
export interface ThemeColors {
    /** 主色调 */
    primary: ColorConfig
    /** 次要色 */
    secondary: ColorConfig
    /** 背景色 */
    background: ColorConfig
    /** 前景色（文字等） */
    foreground: ColorConfig
    /** 强调色 */
    accent: ColorConfig
    /** 柔和色 */
    muted: ColorConfig
    /** 成功色 */
    success: ColorConfig
    /** 警告色 */
    warning: ColorConfig
    /** 错误色 */
    destructive: ColorConfig
    /** 信息色 */
    info: ColorConfig
    /** 边框色 */
    border: ColorConfig
    /** 卡片背景色 */
    card: ColorConfig
}

/**
 * 主题变量
 */
export interface ThemeVariables {
    /** 颜色系统 */
    colors: ThemeColors
    /** 圆角半径 */
    radius: {
        sm: string
        md: string
        lg: string
        xl: string
        full: string
    }
    /** 间距 */
    spacing: {
        xs: string
        sm: string
        md: string
        lg: string
        xl: string
    }
    /** 字体大小 */
    fontSize: {
        xs: string
        sm: string
        base: string
        lg: string
        xl: string
    }
    /** 阴影 */
    shadow: {
        sm: string
        md: string
        lg: string
        xl: string
    }
    /** 动画时长 */
    duration: {
        fast: string
        normal: string
        slow: string
    }
}

/**
 * 主题详情
 */
export interface ThemeDetail {
    /** 主题唯一ID */
    id: string
    /** 主题名称 */
    name: string
    /** 主题显示名称（多语言） */
    displayName: string
    /** 主题描述 */
    description: string
    /** 主题作者 */
    author: {
        id: string
        name: string
        avatar?: string
        website?: string
    }
    /** 主题版本 */
    version: string
    /** 主题类别 */
    category: ThemeCategory
    /** 主题标签 */
    tags: ThemeTag[]
    /** 颜色模式 */
    mode: ColorMode
    /** 是否为深色主题 */
    isDark: boolean
    /** 主题预览图 */
    preview: {
        /** 缩略图 */
        thumbnail: string
        /** 预览大图 */
        images: string[]
        /** 预览视频 */
        video?: string
    }
    /** 主题变量 */
    variables: ThemeVariables
    /** 自定义CSS */
    customCss?: string
    /** 下载次数 */
    downloads: number
    /** 平均评分 (1-5) */
    rating: number
    /** 评分人数 */
    ratingCount: number
    /** 创建时间 */
    createdAt: string
    /** 更新时间 */
    updatedAt: string
    /** 是否已安装 */
    installed?: boolean
    /** 是否已收藏 */
    favorited?: boolean
    /** 主题文件大小（字节） */
    size: number
    /** 兼容的应用版本 */
    compatibility: {
        minVersion: string
        maxVersion?: string
    }
    /** 依赖的其他主题或资源 */
    dependencies?: string[]
    /** 许可证 */
    license: string
}

/**
 * 主题卡片（列表显示用）
 */
export interface ThemeCard {
    id: string
    name: string
    displayName: string
    description: string
    author: string
    category: ThemeCategory
    tags: ThemeTag[]
    thumbnail: string
    isDark: boolean
    downloads: number
    rating: number
    ratingCount: number
    installed: boolean
    favorited: boolean
    updatedAt: string
}

/**
 * 主题评论
 */
export interface ThemeReview {
    /** 评论ID */
    id: string
    /** 主题ID */
    themeId: string
    /** 用户信息 */
    user: {
        id: string
        name: string
        avatar?: string
    }
    /** 评分 (1-5) */
    rating: number
    /** 评论内容 */
    content: string
    /** 评论图片 */
    images?: string[]
    /** 点赞数 */
    likes: number
    /** 是否已点赞 */
    liked: boolean
    /** 创建时间 */
    createdAt: string
    /** 更新时间 */
    updatedAt: string
}

/**
 * 主题搜索过滤器
 */
export interface ThemeSearchFilters {
    /** 搜索关键词 */
    keyword?: string
    /** 类别过滤 */
    categories?: ThemeCategory[]
    /** 标签过滤 */
    tags?: ThemeTag[]
    /** 颜色模式过滤 */
    mode?: ColorMode
    /** 评分过滤（最低评分） */
    minRating?: number
    /** 是否仅显示已安装 */
    installedOnly?: boolean
    /** 是否仅显示收藏 */
    favoritedOnly?: boolean
}

/**
 * 主题搜索排序
 */
export type ThemeSortBy = 
    | 'popular'      // 最受欢迎
    | 'downloads'    // 下载量
    | 'rating'       // 评分
    | 'newest'       // 最新
    | 'updated'      // 最近更新
    | 'name'         // 名称

/**
 * 主题搜索选项
 */
export interface ThemeSearchOptions {
    /** 过滤器 */
    filters?: ThemeSearchFilters
    /** 排序方式 */
    sortBy?: ThemeSortBy
    /** 排序方向 */
    sortOrder?: 'asc' | 'desc'
    /** 页码（从1开始） */
    page?: number
    /** 每页数量 */
    pageSize?: number
}

/**
 * 主题搜索结果
 */
export interface ThemeSearchResult {
    /** 主题列表 */
    themes: ThemeCard[]
    /** 总数量 */
    total: number
    /** 当前页码 */
    page: number
    /** 每页数量 */
    pageSize: number
    /** 总页数 */
    totalPages: number
    /** 是否有下一页 */
    hasNextPage: boolean
}

/**
 * 主题安装选项
 */
export interface ThemeInstallOptions {
    /** 主题ID */
    themeId: string
    /** 是否设为当前主题 */
    setAsCurrent?: boolean
    /** 是否覆盖已存在的主题 */
    overwrite?: boolean
}

/**
 * 主题卸载选项
 */
export interface ThemeUninstallOptions {
    /** 主题ID */
    themeId: string
    /** 是否删除用户数据 */
    removeUserData?: boolean
    /** 是否备份 */
    backup?: boolean
}

/**
 * 主题导出格式
 */
export type ThemeExportFormat = 
    | 'json'         // JSON格式
    | 'css'          // CSS文件
    | 'zip'          // 压缩包（包含所有资源）

/**
 * 主题导出选项
 */
export interface ThemeExportOptions {
    /** 主题ID */
    themeId: string
    /** 导出格式 */
    format: ThemeExportFormat
    /** 是否包含预览图 */
    includePreview?: boolean
    /** 是否包含元数据 */
    includeMetadata?: boolean
    /** 输出路径 */
    outputPath?: string
}

/**
 * 主题导入验证结果
 */
export interface ThemeImportValidation {
    /** 是否有效 */
    valid: boolean
    /** 验证错误 */
    errors: Array<{
        field: string
        message: string
    }>
    /** 验证警告 */
    warnings: Array<{
        field: string
        message: string
    }>
    /** 主题信息（如果有效） */
    theme?: ThemeDetail
}

/**
 * 主题导入选项
 */
export interface ThemeImportOptions {
    /** 文件路径或URL */
    source: string
    /** 是否验证 */
    validate?: boolean
    /** 是否覆盖已存在的主题 */
    overwrite?: boolean
    /** 是否设为当前主题 */
    setAsCurrent?: boolean
}

/**
 * 主题编辑器状态
 */
export interface ThemeEditorState {
    /** 编辑的主题 */
    theme: ThemeDetail
    /** 是否修改过 */
    modified: boolean
    /** 历史记录 */
    history: ThemeDetail[]
    /** 当前历史位置 */
    historyIndex: number
    /** 是否可以撤销 */
    canUndo: boolean
    /** 是否可以重做 */
    canRedo: boolean
}

/**
 * 主题统计信息
 */
export interface ThemeStatistics {
    /** 总主题数 */
    totalThemes: number
    /** 已安装主题数 */
    installedThemes: number
    /** 收藏主题数 */
    favoritedThemes: number
    /** 自定义主题数 */
    customThemes: number
    /** 按类别统计 */
    byCategory: Record<ThemeCategory, number>
    /** 按颜色模式统计 */
    byMode: Record<ColorMode, number>
    /** 最受欢迎的主题 */
    popularThemes: ThemeCard[]
    /** 最新主题 */
    latestThemes: ThemeCard[]
}

/**
 * 主题市场配置
 */
export interface ThemeMarketConfig {
    /** API端点 */
    apiEndpoint: string
    /** CDN地址 */
    cdnUrl: string
    /** 是否启用缓存 */
    enableCache: boolean
    /** 缓存时长（秒） */
    cacheDuration: number
    /** 每页默认数量 */
    defaultPageSize: number
    /** 最大页面大小 */
    maxPageSize: number
}

/**
 * 颜色选择器值
 */
export interface ColorPickerValue {
    /** HEX格式 (#rrggbb) */
    hex: string
    /** RGB格式 */
    rgb: {
        r: number
        g: number
        b: number
    }
    /** HSL格式 */
    hsl: {
        h: number
        s: number
        l: number
    }
    /** HSV格式 */
    hsv: {
        h: number
        s: number
        v: number
    }
    /** 透明度 (0-1) */
    alpha: number
}

/**
 * 主题预设
 */
export interface ThemePreset {
    /** 预设ID */
    id: string
    /** 预设名称 */
    name: string
    /** 预设描述 */
    description: string
    /** 预设颜色 */
    colors: Partial<ThemeColors>
    /** 预览图 */
    preview: string
}

/**
 * 主题操作事件
 */
export type ThemeEventType =
    | 'theme:installed'
    | 'theme:uninstalled'
    | 'theme:updated'
    | 'theme:applied'
    | 'theme:favorited'
    | 'theme:unfavorited'
    | 'theme:reviewed'

/**
 * 主题事件
 */
export interface ThemeEvent {
    type: ThemeEventType
    payload: {
        themeId: string
        theme?: ThemeDetail
        [key: string]: any
    }
    timestamp: number
}

/**
 * 主题事件监听器
 */
export type ThemeEventListener = (event: ThemeEvent) => void

/**
 * 主题仓库接口
 */
export interface ThemeRepository {
    /** 搜索主题 */
    searchThemes(options: ThemeSearchOptions): Promise<ThemeSearchResult>
    
    /** 获取主题详情 */
    getTheme(themeId: string): Promise<ThemeDetail>
    
    /** 获取主题评论 */
    getThemeReviews(themeId: string, page?: number, pageSize?: number): Promise<{
        reviews: ThemeReview[]
        total: number
        page: number
        pageSize: number
    }>
    
    /** 安装主题 */
    installTheme(options: ThemeInstallOptions): Promise<void>
    
    /** 卸载主题 */
    uninstallTheme(options: ThemeUninstallOptions): Promise<void>
    
    /** 收藏主题 */
    favoriteTheme(themeId: string): Promise<void>
    
    /** 取消收藏主题 */
    unfavoriteTheme(themeId: string): Promise<void>
    
    /** 评价主题 */
    reviewTheme(themeId: string, rating: number, content: string): Promise<ThemeReview>
    
    /** 导出主题 */
    exportTheme(options: ThemeExportOptions): Promise<string>
    
    /** 导入主题 */
    importTheme(options: ThemeImportOptions): Promise<ThemeDetail>
    
    /** 验证主题 */
    validateTheme(source: string): Promise<ThemeImportValidation>
    
    /** 获取统计信息 */
    getStatistics(): Promise<ThemeStatistics>
    
    /** 订阅事件 */
    subscribe(listener: ThemeEventListener): () => void
}

/**
 * 类型守卫
 */
export const ThemeTypeGuards = {
    /**
     * 检查是否为有效的主题类别
     */
    isValidCategory(value: any): value is ThemeCategory {
        return typeof value === 'string' && [
            'official', 'community', 'anime', 'dark', 'light',
            'colorful', 'minimalist', 'retro', 'gradient', 'seasonal', 'custom'
        ].includes(value)
    },
    
    /**
     * 检查是否为有效的颜色模式
     */
    isValidColorMode(value: any): value is ColorMode {
        return typeof value === 'string' && ['light', 'dark', 'auto'].includes(value)
    },
    
    /**
     * 检查是否为有效的评分
     */
    isValidRating(value: any): value is number {
        return typeof value === 'number' && value >= 1 && value <= 5
    },
    
    /**
     * 检查是否为有效的HEX颜色
     */
    isValidHexColor(value: any): value is string {
        return typeof value === 'string' && /^#[0-9A-Fa-f]{6}$/.test(value)
    },
    
    /**
     * 检查是否为完整的主题详情
     */
    isThemeDetail(value: any): value is ThemeDetail {
        return (
            value &&
            typeof value === 'object' &&
            typeof value.id === 'string' &&
            typeof value.name === 'string' &&
            typeof value.version === 'string' &&
            ThemeTypeGuards.isValidCategory(value.category) &&
            ThemeTypeGuards.isValidColorMode(value.mode) &&
            typeof value.isDark === 'boolean'
        )
    }
}

/**
 * 默认值
 */
export const ThemeDefaults = {
    /** 默认页面大小 */
    pageSize: 20,
    
    /** 默认排序方式 */
    sortBy: 'popular' as ThemeSortBy,
    
    /** 默认排序方向 */
    sortOrder: 'desc' as 'asc' | 'desc',
    
    /** 默认缓存时长（1小时） */
    cacheDuration: 3600,
    
    /** 默认主题评分 */
    defaultRating: 5,
}

