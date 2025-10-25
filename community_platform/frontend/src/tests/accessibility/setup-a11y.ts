/**
 * 可访问性测试设置文件
 * 配置 axe-core 和扩展自定义匹配器
 */

import { expect } from 'vitest';
import { configureAxe } from 'vitest-axe';

// 配置 axe-core 规则
export const axeConfig = configureAxe({
  rules: {
    // 启用的规则
    'color-contrast': { enabled: true },
    'valid-aria-role': { enabled: true },
    'aria-required-attr': { enabled: true },
    'aria-valid-attr-value': { enabled: true },
    'button-name': { enabled: true },
    'image-alt': { enabled: true },
    'input-image-alt': { enabled: true },
    'label': { enabled: true },
    'link-name': { enabled: true },
    'list': { enabled: true },
    'listitem': { enabled: true },
    'heading-order': { enabled: true },
    'landmark-one-main': { enabled: true },
    'page-has-heading-one': { enabled: true },
    'region': { enabled: true },
    
    // 可以根据项目需求禁用某些规则
    // 'color-contrast': { enabled: false },
  },
  
  // 可访问性标准级别: 'wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'
  runOnly: {
    type: 'tag',
    values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice'],
  },
});

// 导出用于测试的 axe 配置选项
export const defaultAxeOptions = {
  rules: {
    // 对于某些组件可能需要临时禁用某些规则
    // 例如在测试隔离组件时可能没有完整的页面结构
    'region': { enabled: false }, // 在组件测试中可能没有完整的 landmark 区域
  },
};

// 组件测试专用的 axe 配置（更宽松）
export const componentAxeOptions = {
  rules: {
    'region': { enabled: false },
    'landmark-one-main': { enabled: false },
    'page-has-heading-one': { enabled: false },
  },
};

// 页面测试专用的 axe 配置（更严格）
export const pageAxeOptions = {
  rules: {
    // 页面测试应该包含所有规则
  },
};

// 自定义匹配器：检查元素是否具有无障碍名称
export const toHaveAccessibleName = (
  element: HTMLElement,
  expectedName?: string
) => {
  const accessibleName = element.getAttribute('aria-label') ||
    element.getAttribute('aria-labelledby') ||
    element.textContent?.trim();
  
  const pass = expectedName 
    ? accessibleName === expectedName
    : !!accessibleName;
  
  return {
    pass,
    message: () => pass
      ? `Expected element not to have accessible name "${accessibleName}"`
      : expectedName
        ? `Expected element to have accessible name "${expectedName}", but got "${accessibleName}"`
        : `Expected element to have an accessible name`,
  };
};

// 自定义匹配器：检查元素是否可以被键盘聚焦
export const toBeFocusable = (element: HTMLElement) => {
  const tabIndex = element.getAttribute('tabindex');
  const isFocusableElement = ['A', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA'].includes(
    element.tagName
  );
  const pass = isFocusableElement || (tabIndex !== null && parseInt(tabIndex) >= 0);
  
  return {
    pass,
    message: () => pass
      ? `Expected element not to be focusable`
      : `Expected element to be focusable (interactive element or tabindex >= 0)`,
  };
};

// 扩展 expect 匹配器
declare module 'vitest' {
  interface Assertion {
    toHaveAccessibleName(expectedName?: string): void;
    toBeFocusable(): void;
  }
}

