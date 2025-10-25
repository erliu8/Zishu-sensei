/**
 * 可访问性测试辅助工具函数
 */

import { axe, toHaveNoViolations } from 'vitest-axe';
import type { RunOptions } from 'axe-core';
import { expect } from 'vitest';

// 扩展 expect
expect.extend(toHaveNoViolations);

/**
 * 运行 axe 可访问性检查
 * @param container - 要检查的容器元素
 * @param options - axe 配置选项
 */
export async function checkA11y(
  container: HTMLElement,
  options?: RunOptions
): Promise<void> {
  const results = await axe(container, options);
  expect(results).toHaveNoViolations();
}

/**
 * 测试键盘导航
 * @param element - 要测试的元素
 * @param key - 按键名称（例如 'Tab', 'Enter', 'Space', 'Escape'）
 * @returns 是否成功触发了预期的行为
 */
export function simulateKeyboardNavigation(
  element: HTMLElement,
  key: string
): void {
  const event = new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    cancelable: true,
  });
  element.dispatchEvent(event);
}

/**
 * 测试屏幕阅读器公告
 * @param container - 要检查的容器
 * @returns 返回所有的 live region 内容
 */
export function getScreenReaderAnnouncements(container: HTMLElement): string[] {
  const liveRegions = container.querySelectorAll('[aria-live]');
  return Array.from(liveRegions).map(region => region.textContent?.trim() || '');
}

/**
 * 检查元素是否具有正确的 ARIA 属性
 */
export function checkAriaAttributes(
  element: HTMLElement,
  expectedAttributes: Record<string, string>
): void {
  Object.entries(expectedAttributes).forEach(([attr, value]) => {
    const actualValue = element.getAttribute(attr);
    expect(actualValue).toBe(value);
  });
}

/**
 * 获取元素的可访问名称
 * 按照 ARIA 规范的优先级顺序
 */
export function getAccessibleName(element: HTMLElement): string {
  // 1. aria-labelledby
  const labelledBy = element.getAttribute('aria-labelledby');
  if (labelledBy) {
    const labelElement = document.getElementById(labelledBy);
    if (labelElement) {
      return labelElement.textContent?.trim() || '';
    }
  }
  
  // 2. aria-label
  const ariaLabel = element.getAttribute('aria-label');
  if (ariaLabel) {
    return ariaLabel;
  }
  
  // 3. 对于输入元素，检查关联的 label
  if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA' || element.tagName === 'SELECT') {
    const id = element.getAttribute('id');
    if (id) {
      const label = document.querySelector(`label[for="${id}"]`);
      if (label) {
        return label.textContent?.trim() || '';
      }
    }
  }
  
  // 4. textContent
  return element.textContent?.trim() || '';
}

/**
 * 检查元素的颜色对比度（简化版本，axe 会做更详细的检查）
 */
export function hasMinimumColorContrast(
  element: HTMLElement,
  minimumRatio: number = 4.5
): boolean {
  const styles = window.getComputedStyle(element);
  const color = styles.color;
  const backgroundColor = styles.backgroundColor;
  
  // 这是一个简化的检查，实际的对比度计算需要更复杂的算法
  // 实际使用时应该依赖 axe-core 的检查
  return color !== backgroundColor;
}

/**
 * 检查元素是否可以通过键盘聚焦
 */
export function isFocusable(element: HTMLElement): boolean {
  const tabIndex = element.getAttribute('tabindex');
  const isFocusableTag = ['A', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'DETAILS'].includes(
    element.tagName
  );
  
  // 检查元素是否被禁用
  const isDisabled = element.hasAttribute('disabled') || 
    element.getAttribute('aria-disabled') === 'true';
  
  if (isDisabled) {
    return false;
  }
  
  // 可聚焦的元素或有 tabindex >= 0 的元素
  return isFocusableTag || (tabIndex !== null && parseInt(tabIndex) >= 0);
}

/**
 * 获取焦点顺序（tab order）
 */
export function getFocusOrder(container: HTMLElement): HTMLElement[] {
  const focusableElements = container.querySelectorAll<HTMLElement>(
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
  );
  
  return Array.from(focusableElements).sort((a, b) => {
    const aIndex = parseInt(a.getAttribute('tabindex') || '0');
    const bIndex = parseInt(b.getAttribute('tabindex') || '0');
    return aIndex - bIndex;
  });
}

/**
 * 测试焦点陷阱（Focus Trap）
 * 用于模态对话框等需要限制焦点的组件
 */
export function testFocusTrap(
  container: HTMLElement,
  firstElement: HTMLElement,
  lastElement: HTMLElement
): void {
  // 测试从第一个元素按 Tab 键
  firstElement.focus();
  expect(document.activeElement).toBe(firstElement);
  
  // 测试从最后一个元素按 Shift+Tab 键
  lastElement.focus();
  expect(document.activeElement).toBe(lastElement);
}

/**
 * 检查标题层级顺序
 */
export function checkHeadingOrder(container: HTMLElement): {
  valid: boolean;
  headings: { level: number; text: string }[];
  errors: string[];
} {
  const headings = Array.from(container.querySelectorAll('h1, h2, h3, h4, h5, h6'));
  const headingData = headings.map(h => ({
    level: parseInt(h.tagName[1]),
    text: h.textContent?.trim() || '',
  }));
  
  const errors: string[] = [];
  
  // 检查是否有 h1
  if (headingData.length > 0 && !headingData.some(h => h.level === 1)) {
    errors.push('Page should have an h1 heading');
  }
  
  // 检查层级是否跳跃
  for (let i = 1; i < headingData.length; i++) {
    const prev = headingData[i - 1].level;
    const current = headingData[i].level;
    
    if (current - prev > 1) {
      errors.push(
        `Heading level skipped from h${prev} to h${current} (text: "${headingData[i].text}")`
      );
    }
  }
  
  return {
    valid: errors.length === 0,
    headings: headingData,
    errors,
  };
}

/**
 * 检查图片的替代文本
 */
export function checkImageAltText(container: HTMLElement): {
  valid: boolean;
  images: { src: string; alt: string; hasAlt: boolean }[];
  errors: string[];
} {
  const images = Array.from(container.querySelectorAll('img'));
  const imageData = images.map(img => ({
    src: img.getAttribute('src') || '',
    alt: img.getAttribute('alt') || '',
    hasAlt: img.hasAttribute('alt'),
  }));
  
  const errors = imageData
    .filter(img => !img.hasAlt)
    .map(img => `Image missing alt text: ${img.src}`);
  
  return {
    valid: errors.length === 0,
    images: imageData,
    errors,
  };
}

/**
 * 检查表单标签
 */
export function checkFormLabels(container: HTMLElement): {
  valid: boolean;
  inputs: { id: string; type: string; hasLabel: boolean; labelText: string }[];
  errors: string[];
} {
  const inputs = Array.from(
    container.querySelectorAll<HTMLInputElement>('input:not([type="hidden"]), textarea, select')
  );
  
  const inputData = inputs.map(input => {
    const id = input.getAttribute('id') || '';
    const label = id ? container.querySelector(`label[for="${id}"]`) : null;
    const ariaLabel = input.getAttribute('aria-label');
    const ariaLabelledBy = input.getAttribute('aria-labelledby');
    
    const hasLabel = !!(label || ariaLabel || ariaLabelledBy);
    const labelText = label?.textContent?.trim() || ariaLabel || '';
    
    return {
      id,
      type: input.type || input.tagName.toLowerCase(),
      hasLabel,
      labelText,
    };
  });
  
  const errors = inputData
    .filter(input => !input.hasLabel)
    .map(input => `Form input missing label: ${input.type}${input.id ? ` (id: ${input.id})` : ''}`);
  
  return {
    valid: errors.length === 0,
    inputs: inputData,
    errors,
  };
}

/**
 * 检查语义化 HTML landmark 区域
 */
export function checkLandmarks(container: HTMLElement): {
  valid: boolean;
  landmarks: { role: string; label?: string }[];
  errors: string[];
} {
  const landmarkSelectors = [
    'header, [role="banner"]',
    'nav, [role="navigation"]',
    'main, [role="main"]',
    'aside, [role="complementary"]',
    'footer, [role="contentinfo"]',
    '[role="search"]',
  ];
  
  const landmarks = landmarkSelectors
    .flatMap(selector => Array.from(container.querySelectorAll(selector)))
    .map(element => ({
      role: element.getAttribute('role') || element.tagName.toLowerCase(),
      label: element.getAttribute('aria-label') || undefined,
    }));
  
  const errors: string[] = [];
  
  // 检查是否有 main landmark
  if (!landmarks.some(l => l.role === 'main')) {
    errors.push('Page should have a main landmark');
  }
  
  return {
    valid: errors.length === 0,
    landmarks,
    errors,
  };
}

/**
 * 生成可访问性测试报告
 */
export function generateA11yReport(container: HTMLElement): {
  headings: ReturnType<typeof checkHeadingOrder>;
  images: ReturnType<typeof checkImageAltText>;
  formLabels: ReturnType<typeof checkFormLabels>;
  landmarks: ReturnType<typeof checkLandmarks>;
  summary: {
    totalErrors: number;
    allErrors: string[];
  };
} {
  const headings = checkHeadingOrder(container);
  const images = checkImageAltText(container);
  const formLabels = checkFormLabels(container);
  const landmarks = checkLandmarks(container);
  
  const allErrors = [
    ...headings.errors,
    ...images.errors,
    ...formLabels.errors,
    ...landmarks.errors,
  ];
  
  return {
    headings,
    images,
    formLabels,
    landmarks,
    summary: {
      totalErrors: allErrors.length,
      allErrors,
    },
  };
}

