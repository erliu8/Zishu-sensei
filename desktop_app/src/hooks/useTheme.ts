/**
 * React Hook for Theme Management
 * 提供便捷的主题管理钩子函数
 */

import { useState, useEffect, useCallback } from 'react';
import {
  ThemeName,
  ThemeConfig,
  getThemeManager,
  THEMES,
} from '../styles/themes';

/**
 * useTheme Hook 返回值类型
 */
export interface UseThemeReturn {
  /** 当前主题名称 */
  theme: ThemeName;
  /** 当前主题配置 */
  themeConfig: ThemeConfig;
  /** 设置主题 */
  setTheme: (theme: ThemeName) => void;
  /** 切换深色/浅色主题 */
  toggleTheme: () => void;
  /** 是否为深色主题 */
  isDark: boolean;
  /** 所有可用主题 */
  allThemes: ThemeConfig[];
  /** 重置为系统主题 */
  resetToSystemTheme: () => void;
  /** 获取 CSS 变量 */
  getCSSVariable: (variable: string) => string;
  /** 设置 CSS 变量 */
  setCSSVariable: (variable: string, value: string) => void;
}

/**
 * useTheme - React Hook for theme management
 * 
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { theme, setTheme, isDark, toggleTheme } = useTheme();
 *   
 *   return (
 *     <div>
 *       <p>Current theme: {theme}</p>
 *       <button onClick={toggleTheme}>
 *         Toggle {isDark ? 'Light' : 'Dark'} Mode
 *       </button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useTheme(): UseThemeReturn {
  const manager = getThemeManager();
  
  const [theme, setThemeState] = useState<ThemeName>(() => manager.getTheme());
  const [themeConfig, setThemeConfig] = useState<ThemeConfig>(() =>
    manager.getThemeConfig()
  );

  useEffect(() => {
    // 订阅主题变化
    const unsubscribe = manager.subscribe((newTheme) => {
      setThemeState(newTheme);
      setThemeConfig(THEMES[newTheme]);
    });

    return () => unsubscribe();
  }, [manager]);

  const setTheme = useCallback(
    (newTheme: ThemeName) => {
      manager.setTheme(newTheme);
    },
    [manager]
  );

  const toggleTheme = useCallback(() => {
    manager.toggleTheme();
  }, [manager]);

  const resetToSystemTheme = useCallback(() => {
    manager.resetToSystemTheme();
  }, [manager]);

  const getCSSVariable = useCallback(
    (variable: string) => manager.getCSSVariable(variable),
    [manager]
  );

  const setCSSVariable = useCallback(
    (variable: string, value: string) => manager.setCSSVariable(variable, value),
    [manager]
  );

  return {
    theme,
    themeConfig,
    setTheme,
    toggleTheme,
    isDark: themeConfig.isDark,
    allThemes: Object.values(THEMES),
    resetToSystemTheme,
    getCSSVariable,
    setCSSVariable,
  };
}

/**
 * useThemePreference - Hook to get system theme preference
 * 
 * @returns The system's preferred color scheme
 * 
 * @example
 * ```tsx
 * function MyComponent() {
 *   const systemPreference = useThemePreference();
 *   
 *   return <p>System prefers: {systemPreference}</p>;
 * }
 * ```
 */
export function useThemePreference(): 'light' | 'dark' {
  const [preference, setPreference] = useState<'light' | 'dark'>(() => {
    if (typeof window === 'undefined') return 'light';
    return window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleChange = (e: MediaQueryListEvent) => {
      setPreference(e.matches ? 'dark' : 'light');
    };

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    } else {
      // @ts-ignore - 旧版浏览器支持
      mediaQuery.addListener(handleChange);
      // @ts-ignore
      return () => mediaQuery.removeListener(handleChange);
    }
  }, []);

  return preference;
}

/**
 * useThemeTransition - Hook to detect theme transitions
 * 
 * @returns Boolean indicating if a theme transition is in progress
 */
export function useThemeTransition(): boolean {
  const [isTransitioning, setIsTransitioning] = useState(false);

  useEffect(() => {
    const manager = getThemeManager();

    const handleThemeChange = () => {
      setIsTransitioning(true);
      
      // 重置过渡状态
      const timeout = setTimeout(() => {
        setIsTransitioning(false);
      }, 300); // 匹配 CSS 过渡时间

      return () => clearTimeout(timeout);
    };

    const unsubscribe = manager.subscribe(handleThemeChange);
    return () => unsubscribe();
  }, []);

  return isTransitioning;
}

/**
 * useCSSVariable - Hook to read and write CSS variables
 * 
 * @param variable - CSS variable name (without --)
 * @param initialValue - Initial value if variable doesn't exist
 * 
 * @example
 * ```tsx
 * function MyComponent() {
 *   const [primary, setPrimary] = useCSSVariable('color-primary', '220 100% 50%');
 *   
 *   return (
 *     <button onClick={() => setPrimary('200 100% 60%')}>
 *       Change Primary Color
 *     </button>
 *   );
 * }
 * ```
 */
export function useCSSVariable(
  variable: string,
  initialValue?: string
): [string, (value: string) => void] {
  const manager = getThemeManager();
  
  const [value, setValue] = useState<string>(() => {
    const currentValue = manager.getCSSVariable(variable);
    return currentValue || initialValue || '';
  });

  const setVariable = useCallback(
    (newValue: string) => {
      manager.setCSSVariable(variable, newValue);
      setValue(newValue);
    },
    [manager, variable]
  );

  useEffect(() => {
    // 订阅主题变化以更新变量值
    const unsubscribe = manager.subscribe(() => {
      const newValue = manager.getCSSVariable(variable);
      if (newValue) {
        setValue(newValue);
      }
    });

    return () => unsubscribe();
  }, [manager, variable]);

  return [value, setVariable];
}

/**
 * useMediaQuery - Hook to match media queries
 * 
 * @param query - Media query string
 * 
 * @example
 * ```tsx
 * function MyComponent() {
 *   const isMobile = useMediaQuery('(max-width: 768px)');
 *   
 *   return <div>{isMobile ? 'Mobile' : 'Desktop'}</div>;
 * }
 * ```
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia(query);
    
    const handleChange = (e: MediaQueryListEvent) => {
      setMatches(e.matches);
    };

    setMatches(mediaQuery.matches);

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    } else {
      // @ts-ignore - 旧版浏览器支持
      mediaQuery.addListener(handleChange);
      // @ts-ignore
      return () => mediaQuery.removeListener(handleChange);
    }
  }, [query]);

  return matches;
}

export default useTheme;
