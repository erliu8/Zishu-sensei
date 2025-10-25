/**
 * Playwright E2E 可访问性测试配置
 */

import { test as base } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';

/**
 * 扩展的 test 对象，包含可访问性测试工具
 */
export const test = base.extend<{
  makeAxeBuilder: () => AxeBuilder;
}>({
  makeAxeBuilder: async ({ page }, use) => {
    const makeAxeBuilder = () =>
      new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice'])
        .exclude('#webpack-dev-server-client-overlay'); // 排除开发服务器覆盖层
    
    await use(makeAxeBuilder);
  },
});

export { expect } from '@playwright/test';

/**
 * 运行完整的可访问性检查
 * @param page - Playwright 页面对象
 * @param options - axe 配置选项
 */
export async function checkPageA11y(
  page: Page,
  options?: {
    include?: string[];
    exclude?: string[];
    rules?: Record<string, { enabled: boolean }>;
  }
): Promise<void> {
  let builder = new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice']);
  
  if (options?.include) {
    builder = builder.include(options.include);
  }
  
  if (options?.exclude) {
    builder = builder.exclude(options.exclude);
  }
  
  if (options?.rules) {
    Object.entries(options.rules).forEach(([ruleId, config]) => {
      if (config.enabled === false) {
        builder = builder.disableRules([ruleId]);
      }
    });
  }
  
  const accessibilityScanResults = await builder.analyze();
  
  // 如果有违规，抛出错误
  if (accessibilityScanResults.violations.length > 0) {
    const violationMessages = accessibilityScanResults.violations.map(
      (violation) => {
        const nodes = violation.nodes
          .map((node) => ` - ${node.html}`)
          .join('\n');
        
        return `[${violation.id}] ${violation.help}
Impact: ${violation.impact}
Description: ${violation.description}
Affected nodes:
${nodes}
Help URL: ${violation.helpUrl}`;
      }
    );
    
    throw new Error(
      `Accessibility violations found:\n\n${violationMessages.join('\n\n')}`
    );
  }
}

/**
 * 检查特定元素的可访问性
 * @param page - Playwright 页面对象
 * @param selector - CSS 选择器
 */
export async function checkElementA11y(
  page: Page,
  selector: string
): Promise<void> {
  const builder = new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .include(selector);
  
  const results = await builder.analyze();
  
  if (results.violations.length > 0) {
    const messages = results.violations.map(v => `${v.id}: ${v.help}`).join('\n');
    throw new Error(`Accessibility violations in ${selector}:\n${messages}`);
  }
}

/**
 * 生成可访问性报告
 * @param page - Playwright 页面对象
 */
export async function generateA11yReport(page: Page): Promise<{
  violations: any[];
  passes: any[];
  incomplete: any[];
  inapplicable: any[];
}> {
  const builder = new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice']);
  
  const results = await builder.analyze();
  
  return {
    violations: results.violations,
    passes: results.passes,
    incomplete: results.incomplete,
    inapplicable: results.inapplicable,
  };
}

/**
 * 测试键盘导航
 */
export async function testKeyboardNavigation(
  page: Page,
  expectedFocusOrder: string[]
): Promise<void> {
  for (const selector of expectedFocusOrder) {
    await page.keyboard.press('Tab');
    const focusedElement = await page.locator(':focus');
    const matches = await focusedElement.locator(selector).count();
    
    if (matches === 0) {
      throw new Error(`Expected focus on ${selector}, but focus is elsewhere`);
    }
  }
}

/**
 * 测试屏幕阅读器公告
 */
export async function checkScreenReaderAnnouncement(
  page: Page,
  expectedText: string
): Promise<void> {
  const liveRegion = await page.locator('[aria-live], [role="status"], [role="alert"]');
  const text = await liveRegion.textContent();
  
  if (!text?.includes(expectedText)) {
    throw new Error(
      `Expected screen reader announcement "${expectedText}", but got "${text}"`
    );
  }
}

/**
 * 检查页面标题
 */
export async function checkPageTitle(
  page: Page,
  expectedTitle: string | RegExp
): Promise<void> {
  const title = await page.title();
  
  if (typeof expectedTitle === 'string') {
    if (title !== expectedTitle) {
      throw new Error(`Expected page title "${expectedTitle}", but got "${title}"`);
    }
  } else {
    if (!expectedTitle.test(title)) {
      throw new Error(
        `Expected page title to match ${expectedTitle}, but got "${title}"`
      );
    }
  }
}

/**
 * 检查焦点陷阱（用于模态框等）
 */
export async function testFocusTrap(
  page: Page,
  containerSelector: string
): Promise<void> {
  // 获取容器内的所有可聚焦元素
  const focusableElements = await page.locator(
    `${containerSelector} a[href], ${containerSelector} button:not([disabled]), ${containerSelector} input:not([disabled])`
  );
  
  const count = await focusableElements.count();
  
  if (count === 0) {
    throw new Error(`No focusable elements found in ${containerSelector}`);
  }
  
  // 聚焦到第一个元素
  await focusableElements.first().focus();
  
  // Tab 到最后一个元素
  for (let i = 1; i < count; i++) {
    await page.keyboard.press('Tab');
  }
  
  // 再按 Tab 应该回到第一个元素（焦点陷阱）
  await page.keyboard.press('Tab');
  
  const firstElement = focusableElements.first();
  const isFocused = await firstElement.evaluate((el) => el === document.activeElement);
  
  if (!isFocused) {
    throw new Error('Focus trap is not working correctly');
  }
}

/**
 * 等待页面加载完成并检查可访问性
 */
export async function waitAndCheckA11y(
  page: Page,
  url: string,
  options?: Parameters<typeof checkPageA11y>[1]
): Promise<void> {
  await page.goto(url);
  await page.waitForLoadState('networkidle');
  await checkPageA11y(page, options);
}

/**
 * 截图并保存可访问性报告
 */
export async function captureA11yReport(
  page: Page,
  testName: string
): Promise<void> {
  const report = await generateA11yReport(page);
  
  // 保存报告为 JSON
  const fs = require('fs');
  const path = require('path');
  
  const reportsDir = path.join(process.cwd(), 'test-results', 'a11y-reports');
  
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }
  
  const reportPath = path.join(reportsDir, `${testName}-a11y-report.json`);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  
  console.log(`Accessibility report saved to: ${reportPath}`);
}

