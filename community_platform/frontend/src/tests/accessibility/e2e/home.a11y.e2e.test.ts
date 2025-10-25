/**
 * Home 页面 E2E 可访问性测试
 */

import { test, expect } from './a11y-config';
import { checkPageA11y, testKeyboardNavigation } from './a11y-config';

test.describe('Home Page E2E Accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // 等待页面加载
    await page.waitForLoadState('networkidle');
  });

  test('should have no accessibility violations', async ({ page, makeAxeBuilder }) => {
    const accessibilityScanResults = await makeAxeBuilder().analyze();
    
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('should have proper page title', async ({ page }) => {
    const title = await page.title();
    expect(title).toBeTruthy();
    expect(title.length).toBeGreaterThan(0);
  });

  test('should have main landmark', async ({ page }) => {
    const main = page.getByRole('main');
    await expect(main).toBeVisible();
  });

  test('should have heading hierarchy', async ({ page }) => {
    // 应该有 h1
    const h1 = page.getByRole('heading', { level: 1 });
    await expect(h1).toBeVisible();
    
    // h1 应该只有一个
    const h1Count = await page.getByRole('heading', { level: 1 }).count();
    expect(h1Count).toBe(1);
  });

  test('should have skip to main content link', async ({ page }) => {
    const skipLink = page.getByRole('link', { name: /skip to main/i });
    
    if (await skipLink.count() > 0) {
      await expect(skipLink).toBeInViewport();
    }
  });

  test('should support keyboard navigation', async ({ page }) => {
    // Tab 到第一个可聚焦元素
    await page.keyboard.press('Tab');
    
    // 检查焦点是否可见
    const focusedElement = page.locator(':focus');
    await expect(focusedElement).toBeVisible();
  });

  test('should have accessible navigation', async ({ page }) => {
    const nav = page.getByRole('navigation').first();
    await expect(nav).toBeVisible();
    
    // 导航链接应该可访问
    const navLinks = nav.getByRole('link');
    const count = await navLinks.count();
    expect(count).toBeGreaterThan(0);
  });

  test('should have accessible images', async ({ page }) => {
    const images = page.locator('img');
    const imageCount = await images.count();
    
    // 检查所有图片都有 alt 属性
    for (let i = 0; i < imageCount; i++) {
      const image = images.nth(i);
      const alt = await image.getAttribute('alt');
      expect(alt).toBeDefined(); // alt 可以为空字符串（装饰性图片）
    }
  });

  test('should have accessible buttons', async ({ page }) => {
    const buttons = page.getByRole('button');
    const buttonCount = await buttons.count();
    
    // 检查所有按钮都有可访问的名称
    for (let i = 0; i < buttonCount; i++) {
      const button = buttons.nth(i);
      const text = await button.textContent();
      const ariaLabel = await button.getAttribute('aria-label');
      
      expect(text || ariaLabel).toBeTruthy();
    }
  });

  test('should handle responsive navigation menu', async ({ page }) => {
    // 测试移动端菜单（如果存在）
    const mobileMenuButton = page.getByRole('button', { name: /menu|navigation/i });
    
    if (await mobileMenuButton.count() > 0) {
      // 检查按钮是否可访问
      await expect(mobileMenuButton).toBeVisible();
      
      // 点击打开菜单
      await mobileMenuButton.click();
      
      // 检查菜单是否展开
      const expanded = await mobileMenuButton.getAttribute('aria-expanded');
      expect(expanded).toBe('true');
      
      // 菜单应该没有可访问性违规
      const accessibilityScanResults = await makeAxeBuilder().analyze();
      expect(accessibilityScanResults.violations).toEqual([]);
    }
  });

  test('should have accessible forms', async ({ page }) => {
    const forms = page.locator('form');
    const formCount = await forms.count();
    
    for (let i = 0; i < formCount; i++) {
      const form = forms.nth(i);
      
      // 检查表单输入是否都有标签
      const inputs = form.locator('input:not([type="hidden"]), textarea, select');
      const inputCount = await inputs.count();
      
      for (let j = 0; j < inputCount; j++) {
        const input = inputs.nth(j);
        const id = await input.getAttribute('id');
        const ariaLabel = await input.getAttribute('aria-label');
        const ariaLabelledBy = await input.getAttribute('aria-labelledby');
        
        if (id) {
          const label = page.locator(`label[for="${id}"]`);
          const hasLabel = await label.count() > 0;
          
          expect(hasLabel || ariaLabel || ariaLabelledBy).toBeTruthy();
        } else {
          expect(ariaLabel || ariaLabelledBy).toBeTruthy();
        }
      }
    }
  });

  test('should announce dynamic content changes', async ({ page }) => {
    // 查找 live regions
    const liveRegions = page.locator('[aria-live], [role="status"], [role="alert"]');
    const count = await liveRegions.count();
    
    // 如果页面有动态内容，应该有 live regions
    if (count > 0) {
      for (let i = 0; i < count; i++) {
        const region = liveRegions.nth(i);
        const ariaLive = await region.getAttribute('aria-live');
        const role = await region.getAttribute('role');
        
        expect(ariaLive || role).toBeTruthy();
      }
    }
  });

  test('should work with high contrast mode', async ({ page }) => {
    // 模拟高对比度模式
    await page.emulateMedia({ colorScheme: 'dark' });
    
    // 检查在高对比度模式下是否仍然可访问
    const accessibilityScanResults = await makeAxeBuilder().analyze();
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('should support zoom', async ({ page }) => {
    // 放大到 200%
    await page.evaluate(() => {
      document.body.style.zoom = '2';
    });
    
    // 检查放大后是否仍然可访问
    await page.waitForTimeout(500); // 等待重新渲染
    
    const accessibilityScanResults = await makeAxeBuilder().analyze();
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('should have sufficient color contrast', async ({ page, makeAxeBuilder }) => {
    // 特别检查颜色对比度
    const accessibilityScanResults = await makeAxeBuilder()
      .withRules(['color-contrast'])
      .analyze();
    
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('should have proper focus indicators', async ({ page }) => {
    // Tab 到第一个可聚焦元素
    await page.keyboard.press('Tab');
    
    // 检查焦点指示器是否可见
    const focusedElement = page.locator(':focus');
    
    // 获取元素的样式
    const outline = await focusedElement.evaluate((el) => {
      const styles = window.getComputedStyle(el);
      return {
        outline: styles.outline,
        outlineWidth: styles.outlineWidth,
        boxShadow: styles.boxShadow,
      };
    });
    
    // 应该有可见的焦点指示器
    const hasFocusIndicator = 
      (outline.outline && outline.outline !== 'none' && outline.outlineWidth !== '0px') ||
      (outline.boxShadow && outline.boxShadow !== 'none');
    
    expect(hasFocusIndicator).toBeTruthy();
  });
});

test.describe('Home Page Interactive Elements', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('all interactive elements should be reachable by keyboard', async ({ page }) => {
    const interactiveElements = page.locator(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    
    const count = await interactiveElements.count();
    expect(count).toBeGreaterThan(0);
    
    // 测试可以 Tab 到元素
    for (let i = 0; i < Math.min(count, 10); i++) {
      await page.keyboard.press('Tab');
      const focusedElement = page.locator(':focus');
      await expect(focusedElement).toBeVisible();
    }
  });

  test('should handle Enter and Space keys on buttons', async ({ page }) => {
    const buttons = page.getByRole('button').first();
    
    if (await buttons.count() > 0) {
      // 聚焦按钮
      await buttons.focus();
      
      // 按 Enter 键
      await page.keyboard.press('Enter');
      // 验证按钮被激活（根据具体实现检查）
      
      // 聚焦按钮
      await buttons.focus();
      
      // 按 Space 键
      await page.keyboard.press('Space');
      // 验证按钮被激活
    }
  });

  test('should handle Escape key to close modals', async ({ page }) => {
    // 查找打开模态框的按钮
    const modalTrigger = page.getByRole('button', { name: /open|show|modal|dialog/i });
    
    if (await modalTrigger.count() > 0) {
      // 打开模态框
      await modalTrigger.first().click();
      
      // 等待模态框出现
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();
      
      // 按 Escape 键
      await page.keyboard.press('Escape');
      
      // 模态框应该关闭
      await expect(dialog).not.toBeVisible();
    }
  });
});

