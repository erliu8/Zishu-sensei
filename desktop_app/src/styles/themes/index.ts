/**
 * 主题管理系统
 * 提供主题切换、加载、持久化等功能
 */

import './light.css';
import './dark.css';
import './anime.css';
import './cyberpunk.css';

/**
 * 可用主题列表
 */
export type ThemeName = 'light' | 'dark' | 'anime' | 'cyberpunk';

/**
 * 主题配置接口
 */
export interface ThemeConfig {
  /** 主题名称 */
  name: ThemeName;
  /** 主题显示名称 */
  label: string;
  /** 主题描述 */
  description: string;
  /** 主题图标（可选） */
  icon?: string;
  /** 是否为深色主题 */
  isDark: boolean;
  /** 主题预览色 */
  previewColor: string;
}

/**
 * 所有主题配置
 */
export const THEMES: Record<ThemeName, ThemeConfig> = {
  light: {
    name: 'light',
    label: '浅色主题',
    description: '明亮清新的浅色主题，适合白天使用',
    icon: '☀️',
    isDark: false,
    previewColor: '#ffffff',
  },
  dark: {
    name: 'dark',
    label: '深色主题',
    description: '护眼舒适的深色主题，适合夜间使用',
    icon: '🌙',
    isDark: true,
    previewColor: '#09090b',
  },
  anime: {
    name: 'anime',
    label: '动漫主题',
    description: '色彩鲜艳活泼的动漫风格主题',
    icon: '🎨',
    isDark: false,
    previewColor: '#8751fb',
  },
  cyberpunk: {
    name: 'cyberpunk',
    label: '赛博朋克',
    description: '霓虹闪烁的赛博朋克未来主义风格',
    icon: '🌃',
    isDark: true,
    previewColor: '#00ffff',
  },
};

/**
 * 默认主题
 */
export const DEFAULT_THEME: ThemeName = 'light';

/**
 * 本地存储键名
 */
const STORAGE_KEY = 'zishu-sensei-theme';

/**
 * 主题管理器类
 */
export class ThemeManager {
  private currentTheme: ThemeName;
  private listeners: Set<(theme: ThemeName) => void>;

  constructor() {
    this.currentTheme = this.loadTheme();
    this.listeners = new Set();
    this.applyTheme(this.currentTheme);
    this.setupSystemThemeListener();
  }

  /**
   * 从本地存储加载主题
   */
  private loadTheme(): ThemeName {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && this.isValidTheme(saved)) {
        return saved as ThemeName;
      }
    } catch (error) {
      console.warn('无法从本地存储加载主题:', error);
    }
    return this.getSystemTheme();
  }

  /**
   * 保存主题到本地存储
   */
  private saveTheme(theme: ThemeName): void {
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch (error) {
      console.warn('无法保存主题到本地存储:', error);
    }
  }

  /**
   * 验证主题名称是否有效
   */
  private isValidTheme(theme: string): theme is ThemeName {
    return theme in THEMES;
  }

  /**
   * 获取系统主题偏好
   */
  private getSystemTheme(): ThemeName {
    if (typeof window === 'undefined') {
      return DEFAULT_THEME;
    }

    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    return prefersDark ? 'dark' : 'light';
  }

  /**
   * 监听系统主题变化
   */
  private setupSystemThemeListener(): void {
    if (typeof window === 'undefined') {
      return;
    }

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      // 只有在用户未手动设置主题时才跟随系统
      const hasManualTheme = localStorage.getItem(STORAGE_KEY);
      if (!hasManualTheme) {
        const systemTheme = e.matches ? 'dark' : 'light';
        this.setTheme(systemTheme, false);
      }
    };

    // 兼容性处理
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
    } else {
      // @ts-ignore - 旧版浏览器支持
      mediaQuery.addListener(handleChange);
    }
  }

  /**
   * 应用主题到 DOM
   */
  private applyTheme(theme: ThemeName): void {
    if (typeof document === 'undefined') {
      return;
    }

    const root = document.documentElement;
    const body = document.body;

    // 移除所有主题类
    Object.keys(THEMES).forEach((themeName) => {
      root.classList.remove(themeName);
      body.classList.remove(themeName);
    });

    // 添加新主题类
    root.classList.add(theme);
    body.classList.add(theme);

    // 设置 data-theme 属性
    root.setAttribute('data-theme', theme);
    body.setAttribute('data-theme', theme);

    // 设置颜色方案（用于浏览器原生控件）
    const isDark = THEMES[theme].isDark;
    root.style.colorScheme = isDark ? 'dark' : 'light';
  }

  /**
   * 获取当前主题
   */
  getTheme(): ThemeName {
    return this.currentTheme;
  }

  /**
   * 获取当前主题配置
   */
  getThemeConfig(): ThemeConfig {
    return THEMES[this.currentTheme];
  }

  /**
   * 设置主题
   * @param theme 主题名称
   * @param save 是否保存到本地存储（默认 true）
   */
  setTheme(theme: ThemeName, save: boolean = true): void {
    if (!this.isValidTheme(theme)) {
      console.warn(`无效的主题名称: ${theme}`);
      return;
    }

    const oldTheme = this.currentTheme;
    this.currentTheme = theme;

    this.applyTheme(theme);

    if (save) {
      this.saveTheme(theme);
    }

    // 通知监听器
    this.notifyListeners(theme);

    // 触发自定义事件
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('themechange', {
          detail: { oldTheme, newTheme: theme },
        })
      );
    }
  }

  /**
   * 切换主题（在深色和浅色之间切换）
   */
  toggleTheme(): void {
    const isDark = THEMES[this.currentTheme].isDark;
    const newTheme = isDark ? 'light' : 'dark';
    this.setTheme(newTheme);
  }

  /**
   * 获取所有可用主题
   */
  getAvailableThemes(): ThemeConfig[] {
    return Object.values(THEMES);
  }

  /**
   * 判断当前是否为深色主题
   */
  isDarkTheme(): boolean {
    return THEMES[this.currentTheme].isDark;
  }

  /**
   * 添加主题变化监听器
   * @param listener 监听回调函数
   * @returns 取消监听的函数
   */
  subscribe(listener: (theme: ThemeName) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * 通知所有监听器
   */
  private notifyListeners(theme: ThemeName): void {
    this.listeners.forEach((listener) => {
      try {
        listener(theme);
      } catch (error) {
        console.error('主题监听器执行错误:', error);
      }
    });
  }

  /**
   * 获取 CSS 变量值
   * @param variable CSS 变量名（不含 --）
   * @returns CSS 变量值
   */
  getCSSVariable(variable: string): string {
    if (typeof window === 'undefined') {
      return '';
    }
    return getComputedStyle(document.documentElement)
      .getPropertyValue(`--${variable}`)
      .trim();
  }

  /**
   * 设置 CSS 变量值
   * @param variable CSS 变量名（不含 --）
   * @param value CSS 变量值
   */
  setCSSVariable(variable: string, value: string): void {
    if (typeof document === 'undefined') {
      return;
    }
    document.documentElement.style.setProperty(`--${variable}`, value);
  }

  /**
   * 重置为系统主题
   */
  resetToSystemTheme(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.warn('无法清除本地存储的主题设置:', error);
    }
    const systemTheme = this.getSystemTheme();
    this.setTheme(systemTheme, false);
  }

  /**
   * 销毁主题管理器
   */
  destroy(): void {
    this.listeners.clear();
  }
}

/**
 * 创建全局主题管理器实例
 */
let themeManagerInstance: ThemeManager | null = null;

/**
 * 获取主题管理器实例（单例模式）
 */
export function getThemeManager(): ThemeManager {
  if (!themeManagerInstance) {
    themeManagerInstance = new ThemeManager();
  }
  return themeManagerInstance;
}

/**
 * 便捷的主题操作函数
 */

/** 获取当前主题 */
export function getCurrentTheme(): ThemeName {
  return getThemeManager().getTheme();
}

/** 设置主题 */
export function setTheme(theme: ThemeName): void {
  getThemeManager().setTheme(theme);
}

/** 切换主题 */
export function toggleTheme(): void {
  getThemeManager().toggleTheme();
}

/** 获取所有主题 */
export function getAllThemes(): ThemeConfig[] {
  return getThemeManager().getAvailableThemes();
}

/** 判断是否为深色主题 */
export function isDarkTheme(): boolean {
  return getThemeManager().isDarkTheme();
}

/** 订阅主题变化 */
export function subscribeToTheme(
  listener: (theme: ThemeName) => void
): () => void {
  return getThemeManager().subscribe(listener);
}

/** 重置为系统主题 */
export function resetToSystemTheme(): void {
  getThemeManager().resetToSystemTheme();
}

/**
 * React Hook（如果项目使用 React）
 */
export function useTheme() {
  if (typeof window === 'undefined') {
    return {
      theme: DEFAULT_THEME,
      themeConfig: THEMES[DEFAULT_THEME],
      setTheme: () => {},
      toggleTheme: () => {},
      isDark: false,
      allThemes: Object.values(THEMES),
    };
  }

  const manager = getThemeManager();

  return {
    theme: manager.getTheme(),
    themeConfig: manager.getThemeConfig(),
    setTheme: (theme: ThemeName) => manager.setTheme(theme),
    toggleTheme: () => manager.toggleTheme(),
    isDark: manager.isDarkTheme(),
    allThemes: manager.getAvailableThemes(),
    subscribe: (listener: (theme: ThemeName) => void) =>
      manager.subscribe(listener),
    resetToSystemTheme: () => manager.resetToSystemTheme(),
    getCSSVariable: (variable: string) => manager.getCSSVariable(variable),
    setCSSVariable: (variable: string, value: string) =>
      manager.setCSSVariable(variable, value),
  };
}

/**
 * 初始化主题系统
 * 应该在应用启动时调用一次
 */
export function initThemeSystem(): ThemeManager {
  const manager = getThemeManager();
  console.log(`🎨 主题系统已初始化，当前主题: ${manager.getTheme()}`);
  return manager;
}

// 默认导出
export default {
  ThemeManager,
  getThemeManager,
  initThemeSystem,
  THEMES,
  DEFAULT_THEME,
  getCurrentTheme,
  setTheme,
  toggleTheme,
  getAllThemes,
  isDarkTheme,
  subscribeToTheme,
  resetToSystemTheme,
  useTheme,
};

