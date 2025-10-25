import { visualTest as test, expect } from '../helpers/BaseVisualTest';

/**
 * 认证页面视觉回归测试
 */
test.describe('Authentication Pages - Visual Tests', () => {
  // 登录页
  test.describe('Login Page', () => {
    test('login page full view', async ({ visualPage, page }) => {
      await visualPage.goto('/login');
      await expect(page).toHaveScreenshot('login-full.png');
    });

    test('login form', async ({ visualPage, page }) => {
      await visualPage.goto('/login');
      const form = page.locator('[data-testid="login-form"]');
      await expect(form).toHaveScreenshot('login-form.png');
    });

    test('login form with filled inputs', async ({ visualPage, page }) => {
      await visualPage.goto('/login');
      await visualPage.fill('[data-testid="email-input"]', 'test@example.com');
      await visualPage.fill('[data-testid="password-input"]', 'password123');
      const form = page.locator('[data-testid="login-form"]');
      await expect(form).toHaveScreenshot('login-form-filled.png');
    });

    test('login form with error', async ({ visualPage, page }) => {
      await visualPage.goto('/login');
      await visualPage.fill('[data-testid="email-input"]', 'invalid@example.com');
      await visualPage.fill('[data-testid="password-input"]', 'wrong');
      await visualPage.click('[data-testid="submit-button"]');
      await page.waitForTimeout(300);
      const form = page.locator('[data-testid="login-form"]');
      await expect(form).toHaveScreenshot('login-form-error.png');
    });

    test('login form loading state', async ({ visualPage, page }) => {
      await page.route('**/api/auth/login', async (route) => {
        await page.waitForTimeout(2000);
        await route.continue();
      });
      
      await visualPage.goto('/login');
      await visualPage.fill('[data-testid="email-input"]', 'test@example.com');
      await visualPage.fill('[data-testid="password-input"]', 'password123');
      await visualPage.click('[data-testid="submit-button"]');
      await page.waitForTimeout(100);
      const form = page.locator('[data-testid="login-form"]');
      await expect(form).toHaveScreenshot('login-loading.png');
    });

    test('login page dark mode', async ({ visualPage, page }) => {
      await visualPage.goto('/login');
      await visualPage.switchTheme('dark');
      await expect(page).toHaveScreenshot('login-dark.png');
    });

    test('login page mobile', async ({ visualPage, page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await visualPage.goto('/login');
      await expect(page).toHaveScreenshot('login-mobile.png');
    });

    test('login social buttons', async ({ visualPage, page }) => {
      await visualPage.goto('/login');
      const social = page.locator('[data-testid="social-login"]');
      await expect(social).toHaveScreenshot('login-social.png');
    });
  });

  // 注册页
  test.describe('Register Page', () => {
    test('register page full view', async ({ visualPage, page }) => {
      await visualPage.goto('/register');
      await expect(page).toHaveScreenshot('register-full.png');
    });

    test('register form', async ({ visualPage, page }) => {
      await visualPage.goto('/register');
      const form = page.locator('[data-testid="register-form"]');
      await expect(form).toHaveScreenshot('register-form.png');
    });

    test('register form step 1', async ({ visualPage, page }) => {
      await visualPage.goto('/register');
      const step1 = page.locator('[data-testid="register-step-1"]');
      await expect(step1).toHaveScreenshot('register-step-1.png');
    });

    test('register form step 2', async ({ visualPage, page }) => {
      await visualPage.goto('/register');
      await visualPage.fill('[data-testid="email-input"]', 'test@example.com');
      await visualPage.fill('[data-testid="password-input"]', 'password123');
      await visualPage.click('[data-testid="next-button"]');
      const step2 = page.locator('[data-testid="register-step-2"]');
      await expect(step2).toHaveScreenshot('register-step-2.png');
    });

    test('register form with validation errors', async ({ visualPage, page }) => {
      await visualPage.goto('/register');
      await visualPage.click('[data-testid="submit-button"]');
      await page.waitForTimeout(300);
      const form = page.locator('[data-testid="register-form"]');
      await expect(form).toHaveScreenshot('register-errors.png');
    });

    test('register page dark mode', async ({ visualPage, page }) => {
      await visualPage.goto('/register');
      await visualPage.switchTheme('dark');
      await expect(page).toHaveScreenshot('register-dark.png');
    });

    test('register page mobile', async ({ visualPage, page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await visualPage.goto('/register');
      await expect(page).toHaveScreenshot('register-mobile.png');
    });

    test('register password strength indicator', async ({ visualPage, page }) => {
      await visualPage.goto('/register');
      await visualPage.fill('[data-testid="password-input"]', 'weak');
      const strength = page.locator('[data-testid="password-strength"]');
      await expect(strength).toHaveScreenshot('register-password-weak.png');
      
      await visualPage.fill('[data-testid="password-input"]', 'StrongP@ssw0rd!');
      await expect(strength).toHaveScreenshot('register-password-strong.png');
    });

    test('register terms checkbox', async ({ visualPage, page }) => {
      await visualPage.goto('/register');
      const terms = page.locator('[data-testid="terms-section"]');
      await expect(terms).toHaveScreenshot('register-terms.png');
    });
  });

  // 忘记密码页
  test.describe('Forgot Password Page', () => {
    test('forgot password page', async ({ visualPage, page }) => {
      await visualPage.goto('/forgot-password');
      await expect(page).toHaveScreenshot('forgot-password.png');
    });

    test('forgot password form', async ({ visualPage, page }) => {
      await visualPage.goto('/forgot-password');
      const form = page.locator('[data-testid="forgot-password-form"]');
      await expect(form).toHaveScreenshot('forgot-password-form.png');
    });

    test('forgot password success message', async ({ visualPage, page }) => {
      await visualPage.goto('/forgot-password');
      await visualPage.fill('[data-testid="email-input"]', 'test@example.com');
      await visualPage.click('[data-testid="submit-button"]');
      await page.waitForTimeout(500);
      await expect(page).toHaveScreenshot('forgot-password-success.png');
    });

    test('forgot password dark mode', async ({ visualPage, page }) => {
      await visualPage.goto('/forgot-password');
      await visualPage.switchTheme('dark');
      await expect(page).toHaveScreenshot('forgot-password-dark.png');
    });
  });

  // 重置密码页
  test.describe('Reset Password Page', () => {
    test('reset password page', async ({ visualPage, page }) => {
      await visualPage.goto('/reset-password?token=test-token');
      await expect(page).toHaveScreenshot('reset-password.png');
    });

    test('reset password form', async ({ visualPage, page }) => {
      await visualPage.goto('/reset-password?token=test-token');
      const form = page.locator('[data-testid="reset-password-form"]');
      await expect(form).toHaveScreenshot('reset-password-form.png');
    });

    test('reset password with validation', async ({ visualPage, page }) => {
      await visualPage.goto('/reset-password?token=test-token');
      await visualPage.fill('[data-testid="password-input"]', 'weak');
      await visualPage.fill('[data-testid="confirm-password-input"]', 'different');
      await visualPage.click('[data-testid="submit-button"]');
      await page.waitForTimeout(300);
      const form = page.locator('[data-testid="reset-password-form"]');
      await expect(form).toHaveScreenshot('reset-password-errors.png');
    });

    test('reset password dark mode', async ({ visualPage, page }) => {
      await visualPage.goto('/reset-password?token=test-token');
      await visualPage.switchTheme('dark');
      await expect(page).toHaveScreenshot('reset-password-dark.png');
    });
  });
});

