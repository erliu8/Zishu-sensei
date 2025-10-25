import { visualTest as test, expect } from '../helpers/BaseVisualTest';

/**
 * Form 组件视觉回归测试
 */
test.describe('Form Components - Visual Tests', () => {
  test.beforeEach(async ({ visualPage }) => {
    await visualPage.goto('/test/components/form');
  });

  // Input 组件
  test.describe('Input', () => {
    test('input default', async ({ page }) => {
      const input = page.locator('[data-testid="input-default"]');
      await expect(input).toHaveScreenshot('input-default.png');
    });

    test('input with placeholder', async ({ page }) => {
      const input = page.locator('[data-testid="input-placeholder"]');
      await expect(input).toHaveScreenshot('input-placeholder.png');
    });

    test('input with value', async ({ visualPage, page }) => {
      await visualPage.fill('[data-testid="input-with-value"]', 'Test Input');
      const input = page.locator('[data-testid="input-with-value"]');
      await expect(input).toHaveScreenshot('input-with-value.png');
    });

    test('input focused', async ({ page }) => {
      const input = page.locator('[data-testid="input-default"]');
      await input.focus();
      await page.waitForTimeout(200);
      await expect(input).toHaveScreenshot('input-focused.png');
    });

    test('input disabled', async ({ page }) => {
      const input = page.locator('[data-testid="input-disabled"]');
      await expect(input).toHaveScreenshot('input-disabled.png');
    });

    test('input with error', async ({ page }) => {
      const input = page.locator('[data-testid="input-error"]');
      await expect(input).toHaveScreenshot('input-error.png');
    });

    test('input with icon', async ({ page }) => {
      const input = page.locator('[data-testid="input-with-icon"]');
      await expect(input).toHaveScreenshot('input-with-icon.png');
    });
  });

  // Select 组件
  test.describe('Select', () => {
    test('select default', async ({ page }) => {
      const select = page.locator('[data-testid="select-default"]');
      await expect(select).toHaveScreenshot('select-default.png');
    });

    test('select open', async ({ visualPage, page }) => {
      await visualPage.click('[data-testid="select-default"]');
      const dropdown = page.locator('[role="listbox"]');
      await expect(dropdown).toHaveScreenshot('select-open.png');
    });

    test('select with value', async ({ page }) => {
      const select = page.locator('[data-testid="select-with-value"]');
      await expect(select).toHaveScreenshot('select-with-value.png');
    });
  });

  // Checkbox 组件
  test.describe('Checkbox', () => {
    test('checkbox unchecked', async ({ page }) => {
      const checkbox = page.locator('[data-testid="checkbox-unchecked"]');
      await expect(checkbox).toHaveScreenshot('checkbox-unchecked.png');
    });

    test('checkbox checked', async ({ page }) => {
      const checkbox = page.locator('[data-testid="checkbox-checked"]');
      await expect(checkbox).toHaveScreenshot('checkbox-checked.png');
    });

    test('checkbox indeterminate', async ({ page }) => {
      const checkbox = page.locator('[data-testid="checkbox-indeterminate"]');
      await expect(checkbox).toHaveScreenshot('checkbox-indeterminate.png');
    });

    test('checkbox disabled', async ({ page }) => {
      const checkbox = page.locator('[data-testid="checkbox-disabled"]');
      await expect(checkbox).toHaveScreenshot('checkbox-disabled.png');
    });
  });

  // Radio 组件
  test.describe('Radio', () => {
    test('radio group', async ({ page }) => {
      const radioGroup = page.locator('[data-testid="radio-group"]');
      await expect(radioGroup).toHaveScreenshot('radio-group.png');
    });

    test('radio selected', async ({ page }) => {
      const radio = page.locator('[data-testid="radio-selected"]');
      await expect(radio).toHaveScreenshot('radio-selected.png');
    });
  });

  // Textarea 组件
  test.describe('Textarea', () => {
    test('textarea default', async ({ page }) => {
      const textarea = page.locator('[data-testid="textarea-default"]');
      await expect(textarea).toHaveScreenshot('textarea-default.png');
    });

    test('textarea with content', async ({ visualPage, page }) => {
      await visualPage.fill(
        '[data-testid="textarea-with-content"]',
        'This is a test content\nWith multiple lines'
      );
      const textarea = page.locator('[data-testid="textarea-with-content"]');
      await expect(textarea).toHaveScreenshot('textarea-with-content.png');
    });
  });

  // Switch 组件
  test.describe('Switch', () => {
    test('switch off', async ({ page }) => {
      const switchEl = page.locator('[data-testid="switch-off"]');
      await expect(switchEl).toHaveScreenshot('switch-off.png');
    });

    test('switch on', async ({ page }) => {
      const switchEl = page.locator('[data-testid="switch-on"]');
      await expect(switchEl).toHaveScreenshot('switch-on.png');
    });
  });

  // 完整表单
  test('complete form', async ({ page }) => {
    const form = page.locator('[data-testid="complete-form"]');
    await expect(form).toHaveScreenshot('complete-form.png');
  });

  // 深色主题
  test('form in dark mode', async ({ visualPage, page }) => {
    await visualPage.switchTheme('dark');
    const form = page.locator('[data-testid="form-container"]');
    await expect(form).toHaveScreenshot('form-dark-mode.png');
  });
});

