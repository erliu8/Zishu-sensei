/**
 * 主题选择器组件
 * 提供友好的主题切换界面
 */

import React, { useState, useEffect } from 'react';
import {
  ThemeName,
  ThemeConfig,
  getThemeManager,
  THEMES,
} from '../../styles/themes';
import styles from './ThemeSelector.module.css';

interface ThemeSelectorProps {
  /** 选择器样式（默认为 'grid'） */
  variant?: 'grid' | 'list' | 'dropdown';
  /** 是否显示主题描述 */
  showDescription?: boolean;
  /** 是否显示图标 */
  showIcon?: boolean;
  /** 自定义类名 */
  className?: string;
  /** 主题改变回调 */
  onThemeChange?: (theme: ThemeName) => void;
}

/**
 * 主题选择器组件
 */
export const ThemeSelector: React.FC<ThemeSelectorProps> = ({
  variant = 'grid',
  showDescription = true,
  showIcon = true,
  className = '',
  onThemeChange,
}) => {
  const [currentTheme, setCurrentTheme] = useState<ThemeName>(() =>
    getThemeManager().getTheme()
  );

  useEffect(() => {
    const unsubscribe = getThemeManager().subscribe((theme) => {
      setCurrentTheme(theme);
      onThemeChange?.(theme);
    });

    return () => unsubscribe();
  }, [onThemeChange]);

  const handleThemeSelect = (theme: ThemeName) => {
    getThemeManager().setTheme(theme);
  };

  const themes = Object.values(THEMES);

  if (variant === 'dropdown') {
    return (
      <div className={`${styles.dropdown} ${className}`}>
        <select
          value={currentTheme}
          onChange={(e) => handleThemeSelect(e.target.value as ThemeName)}
          className={styles.select}
        >
          {themes.map((theme) => (
            <option key={theme.name} value={theme.name}>
              {showIcon && theme.icon} {theme.label}
            </option>
          ))}
        </select>
      </div>
    );
  }

  if (variant === 'list') {
    return (
      <div className={`${styles.list} ${className}`}>
        {themes.map((theme) => (
          <button
            key={theme.name}
            onClick={() => handleThemeSelect(theme.name)}
            className={`${styles.listItem} ${
              currentTheme === theme.name ? styles.active : ''
            }`}
            aria-label={`切换到${theme.label}`}
          >
            {showIcon && <span className={styles.icon}>{theme.icon}</span>}
            <div className={styles.content}>
              <span className={styles.label}>{theme.label}</span>
              {showDescription && (
                <span className={styles.description}>{theme.description}</span>
              )}
            </div>
            {currentTheme === theme.name && (
              <span className={styles.checkmark}>✓</span>
            )}
          </button>
        ))}
      </div>
    );
  }

  // 默认为 grid 布局
  return (
    <div className={`${styles.grid} ${className}`}>
      {themes.map((theme) => (
        <button
          key={theme.name}
          onClick={() => handleThemeSelect(theme.name)}
          className={`${styles.gridItem} ${
            currentTheme === theme.name ? styles.active : ''
          }`}
          style={{
            '--theme-preview-color': theme.previewColor,
          } as React.CSSProperties}
          aria-label={`切换到${theme.label}`}
        >
          <div className={styles.preview}>
            {showIcon && <span className={styles.icon}>{theme.icon}</span>}
            {currentTheme === theme.name && (
              <span className={styles.checkmark}>✓</span>
            )}
          </div>
          <div className={styles.info}>
            <span className={styles.label}>{theme.label}</span>
            {showDescription && (
              <span className={styles.description}>{theme.description}</span>
            )}
          </div>
        </button>
      ))}
    </div>
  );
};

/**
 * 简单的主题切换按钮
 */
export const ThemeToggle: React.FC<{
  className?: string;
  showLabel?: boolean;
}> = ({ className = '', showLabel = false }) => {
  const [currentTheme, setCurrentTheme] = useState<ThemeName>(() =>
    getThemeManager().getTheme()
  );

  useEffect(() => {
    const unsubscribe = getThemeManager().subscribe(setCurrentTheme);
    return () => unsubscribe();
  }, []);

  const handleToggle = () => {
    getThemeManager().toggleTheme();
  };

  const isDark = THEMES[currentTheme].isDark;
  const icon = isDark ? '☀️' : '🌙';
  const label = isDark ? '切换到浅色' : '切换到深色';

  return (
    <button
      onClick={handleToggle}
      className={`${styles.toggle} ${className}`}
      aria-label={label}
      title={label}
    >
      <span className={styles.toggleIcon}>{icon}</span>
      {showLabel && <span className={styles.toggleLabel}>{label}</span>}
    </button>
  );
};

/**
 * 主题预览卡片
 */
export const ThemePreview: React.FC<{
  theme: ThemeConfig;
  isActive?: boolean;
  onClick?: () => void;
}> = ({ theme, isActive = false, onClick }) => {
  return (
    <div
      className={`${styles.previewCard} ${isActive ? styles.active : ''}`}
      onClick={onClick}
      style={{
        '--theme-preview-color': theme.previewColor,
      } as React.CSSProperties}
    >
      <div className={styles.previewHeader}>
        <span className={styles.icon}>{theme.icon}</span>
        {isActive && <span className={styles.badge}>当前</span>}
      </div>
      <div className={styles.previewBody}>
        <h3 className={styles.previewTitle}>{theme.label}</h3>
        <p className={styles.previewDescription}>{theme.description}</p>
      </div>
      <div className={styles.previewFooter}>
        <span className={styles.previewType}>
          {theme.isDark ? '深色' : '浅色'}
        </span>
      </div>
    </div>
  );
};

export default ThemeSelector;

