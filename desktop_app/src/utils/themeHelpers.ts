/**
 * 主题系统辅助工具函数
 * 提供主题相关的实用函数
 */

import { ThemeName, THEMES } from '../styles/themes';

/**
 * 颜色工具类
 */
export class ColorUtils {
  /**
   * 将 HSL 字符串转换为 RGB
   * @param hsl HSL 字符串 (例如: "220 100% 50%")
   * @returns RGB 对象 { r, g, b }
   */
  static hslToRgb(hsl: string): { r: number; g: number; b: number } {
    const [h, s, l] = hsl.split(/\s+/).map((val) => {
      const num = parseFloat(val);
      if (val.includes('%')) {
        return num / 100;
      }
      return num / 360;
    });

    let r: number, g: number, b: number;

    if (s === 0) {
      r = g = b = l;
    } else {
      const hue2rgb = (p: number, q: number, t: number) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
      };

      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1 / 3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1 / 3);
    }

    return {
      r: Math.round(r * 255),
      g: Math.round(g * 255),
      b: Math.round(b * 255),
    };
  }

  /**
   * 将 RGB 对象转换为十六进制字符串
   */
  static rgbToHex(r: number, g: number, b: number): string {
    return '#' + [r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('');
  }

  /**
   * 将 HSL 字符串转换为十六进制
   */
  static hslToHex(hsl: string): string {
    const rgb = this.hslToRgb(hsl);
    return this.rgbToHex(rgb.r, rgb.g, rgb.b);
  }

  /**
   * 获取颜色的亮度（0-255）
   */
  static getLuminance(r: number, g: number, b: number): number {
    return 0.299 * r + 0.587 * g + 0.114 * b;
  }

  /**
   * 判断颜色是深色还是浅色
   */
  static isDarkColor(r: number, g: number, b: number): boolean {
    return this.getLuminance(r, g, b) < 128;
  }

  /**
   * 混合两个颜色
   * @param color1 第一个颜色 (RGB)
   * @param color2 第二个颜色 (RGB)
   * @param ratio 混合比例 (0-1)
   */
  static mixColors(
    color1: { r: number; g: number; b: number },
    color2: { r: number; g: number; b: number },
    ratio: number = 0.5
  ): { r: number; g: number; b: number } {
    return {
      r: Math.round(color1.r * (1 - ratio) + color2.r * ratio),
      g: Math.round(color1.g * (1 - ratio) + color2.g * ratio),
      b: Math.round(color1.b * (1 - ratio) + color2.b * ratio),
    };
  }

  /**
   * 生成颜色的透明度变体
   */
  static withAlpha(color: string, alpha: number): string {
    // 如果是 HSL 格式
    if (!color.startsWith('#')) {
      return `hsl(${color} / ${alpha})`;
    }
    
    // 如果是十六进制格式
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
}

/**
 * 主题检测工具
 */
export class ThemeDetector {
  /**
   * 检测系统是否支持深色模式
   */
  static supportsDarkMode(): boolean {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  /**
   * 检测系统是否支持浅色模式
   */
  static supportsLightMode(): boolean {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-color-scheme: light)').matches;
  }

  /**
   * 检测系统颜色方案偏好
   */
  static getSystemColorScheme(): 'light' | 'dark' | 'no-preference' {
    if (typeof window === 'undefined') return 'no-preference';
    
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    if (window.matchMedia('(prefers-color-scheme: light)').matches) {
      return 'light';
    }
    return 'no-preference';
  }

  /**
   * 检测是否支持对比度偏好
   */
  static supportsContrastPreference(): boolean {
    if (typeof window === 'undefined') return false;
    return (
      window.matchMedia('(prefers-contrast: more)').matches ||
      window.matchMedia('(prefers-contrast: less)').matches
    );
  }

  /**
   * 获取对比度偏好
   */
  static getContrastPreference(): 'more' | 'less' | 'no-preference' {
    if (typeof window === 'undefined') return 'no-preference';
    
    if (window.matchMedia('(prefers-contrast: more)').matches) {
      return 'more';
    }
    if (window.matchMedia('(prefers-contrast: less)').matches) {
      return 'less';
    }
    return 'no-preference';
  }

  /**
   * 检测是否偏好减少动画
   */
  static prefersReducedMotion(): boolean {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }
}

/**
 * 主题验证工具
 */
export class ThemeValidator {
  /**
   * 验证主题名称是否有效
   */
  static isValidTheme(theme: string): theme is ThemeName {
    return theme in THEMES;
  }

  /**
   * 验证并返回有效的主题名称
   */
  static validateTheme(theme: string, fallback: ThemeName = 'light'): ThemeName {
    return this.isValidTheme(theme) ? theme : fallback;
  }

  /**
   * 检查两个主题是否都是深色或都是浅色
   */
  static isSameColorScheme(theme1: ThemeName, theme2: ThemeName): boolean {
    return THEMES[theme1].isDark === THEMES[theme2].isDark;
  }

  /**
   * 获取相反色调的主题建议
   */
  static getOppositeSchemeTheme(theme: ThemeName): ThemeName {
    const isDark = THEMES[theme].isDark;
    const oppositeThemes = Object.values(THEMES).filter(
      (t) => t.isDark !== isDark
    );
    return oppositeThemes[0]?.name || 'light';
  }
}

/**
 * 主题性能优化工具
 */
export class ThemePerformance {
  private static transitionTimeout: NodeJS.Timeout | null = null;

  /**
   * 防抖主题切换（避免频繁切换造成性能问题）
   */
  static debounceThemeChange(
    callback: () => void,
    delay: number = 300
  ): void {
    if (this.transitionTimeout) {
      clearTimeout(this.transitionTimeout);
    }
    this.transitionTimeout = setTimeout(callback, delay);
  }

  /**
   * 预加载主题资源
   */
  static preloadTheme(theme: ThemeName): void {
    // 这里可以预加载主题特定的资源
    console.log(`Preloading theme: ${theme}`);
  }

  /**
   * 平滑过渡到新主题
   */
  static smoothTransition(callback: () => void, duration: number = 300): void {
    if (typeof document === 'undefined') {
      callback();
      return;
    }

    // 添加过渡类
    document.documentElement.classList.add('theme-transitioning');

    // 执行回调
    callback();

    // 移除过渡类
    setTimeout(() => {
      document.documentElement.classList.remove('theme-transitioning');
    }, duration);
  }

  /**
   * 检测主题资源是否已加载
   */
  static isThemeLoaded(theme: ThemeName): boolean {
    if (typeof document === 'undefined') return false;
    
    const root = document.documentElement;
    return (
      root.classList.contains(theme) ||
      root.getAttribute('data-theme') === theme
    );
  }
}

/**
 * 主题存储工具
 */
export class ThemeStorage {
  private static readonly STORAGE_KEY = 'zishu-sensei-theme';
  private static readonly PREFERENCE_KEY = 'zishu-sensei-theme-preference';

  /**
   * 保存主题偏好
   */
  static saveTheme(theme: ThemeName): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, theme);
    } catch (error) {
      console.warn('Failed to save theme to localStorage:', error);
    }
  }

  /**
   * 加载主题偏好
   */
  static loadTheme(): ThemeName | null {
    try {
      const theme = localStorage.getItem(this.STORAGE_KEY);
      return theme as ThemeName | null;
    } catch (error) {
      console.warn('Failed to load theme from localStorage:', error);
      return null;
    }
  }

  /**
   * 清除主题偏好
   */
  static clearTheme(): void {
    try {
      localStorage.removeItem(this.STORAGE_KEY);
    } catch (error) {
      console.warn('Failed to clear theme from localStorage:', error);
    }
  }

  /**
   * 保存用户偏好设置
   */
  static savePreference(key: string, value: any): void {
    try {
      const preferences = this.loadPreferences();
      preferences[key] = value;
      localStorage.setItem(this.PREFERENCE_KEY, JSON.stringify(preferences));
    } catch (error) {
      console.warn('Failed to save preference:', error);
    }
  }

  /**
   * 加载用户偏好设置
   */
  static loadPreferences(): Record<string, any> {
    try {
      const data = localStorage.getItem(this.PREFERENCE_KEY);
      return data ? JSON.parse(data) : {};
    } catch (error) {
      console.warn('Failed to load preferences:', error);
      return {};
    }
  }

  /**
   * 导出主题配置
   */
  static exportConfig(): string {
    const config = {
      theme: this.loadTheme(),
      preferences: this.loadPreferences(),
      timestamp: new Date().toISOString(),
    };
    return JSON.stringify(config, null, 2);
  }

  /**
   * 导入主题配置
   */
  static importConfig(configString: string): boolean {
    try {
      const config = JSON.parse(configString);
      if (config.theme) {
        this.saveTheme(config.theme);
      }
      if (config.preferences) {
        localStorage.setItem(
          this.PREFERENCE_KEY,
          JSON.stringify(config.preferences)
        );
      }
      return true;
    } catch (error) {
      console.error('Failed to import config:', error);
      return false;
    }
  }
}

/**
 * 导出所有工具
 */
export default {
  ColorUtils,
  ThemeDetector,
  ThemeValidator,
  ThemePerformance,
  ThemeStorage,
};

