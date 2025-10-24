# 前端测试框架文档

## 📚 目录

- [概述](#概述)
- [测试策略](#测试策略)
- [文件架构](#文件架构)
- [测试工具栈](#测试工具栈)
- [测试类型](#测试类型)
- [命名规范](#命名规范)
- [最佳实践](#最佳实践)
- [CI/CD集成](#cicd集成)

---

## 概述

本测试框架旨在为整个前端应用提供全面的测试覆盖，确保代码质量、可靠性和可维护性。

### 测试金字塔

```
           /\
          /  \  E2E测试 (10%)
         /____\
        /      \  集成测试 (30%)
       /________\
      /          \  单元测试 (60%)
     /____________\
```

### 覆盖率目标

| 测试类型 | 覆盖率目标 | 优先级 |
|---------|-----------|--------|
| 单元测试 | ≥ 80% | 高 |
| 集成测试 | ≥ 60% | 中 |
| E2E测试 | 关键流程 100% | 高 |
| 组件测试 | ≥ 70% | 高 |

---

## 测试策略

### 1. 单元测试（Unit Tests）
- 测试独立的函数、工具类、hooks
- 使用 Vitest + React Testing Library
- 快速执行，高覆盖率

### 2. 组件测试（Component Tests）
- 测试React组件的渲染和交互
- 测试用户交互和状态变化
- 测试无障碍性（A11y）

### 3. 集成测试（Integration Tests）
- 测试多个模块之间的交互
- 测试API集成
- 测试状态管理

### 4. E2E测试（End-to-End Tests）
- 测试完整的用户流程
- 使用 Playwright
- 覆盖关键业务场景

### 5. 视觉回归测试（Visual Regression Tests）
- 检测UI变化
- 使用 Playwright + Storybook

### 6. 性能测试（Performance Tests）
- 测试加载时间
- 测试渲染性能
- 监控Web Vitals

### 7. 可访问性测试（Accessibility Tests）
- 测试ARIA属性
- 测试键盘导航
- 使用 axe-core

---

## 文件架构

### 整体目录结构

```
community_platform/frontend/
├── src/
│   ├── tests/                          # 所有测试文件的根目录
│   │   ├── setup.ts                    # 全局测试设置
│   │   ├── test-utils.tsx              # 测试工具函数
│   │   ├── test-ids.ts                 # 测试ID常量
│   │   │
│   │   ├── unit/                       # 单元测试
│   │   │   ├── domain/                 # 领域逻辑测试
│   │   │   │   ├── user/
│   │   │   │   │   ├── user.entity.test.ts
│   │   │   │   │   ├── user.service.test.ts
│   │   │   │   │   └── user.repository.test.ts
│   │   │   │   ├── content/
│   │   │   │   │   ├── content.entity.test.ts
│   │   │   │   │   └── content.service.test.ts
│   │   │   │   └── activity/
│   │   │   │       └── activity.service.test.ts
│   │   │   │
│   │   │   ├── shared/                 # 共享模块测试
│   │   │   │   ├── utils/
│   │   │   │   │   ├── date.test.ts
│   │   │   │   │   ├── string.test.ts
│   │   │   │   │   ├── validation.test.ts
│   │   │   │   │   └── format.test.ts
│   │   │   │   ├── hooks/
│   │   │   │   │   ├── useAuth.test.ts
│   │   │   │   │   ├── useLocalStorage.test.ts
│   │   │   │   │   └── useDebounce.test.ts
│   │   │   │   └── lib/
│   │   │   │       ├── api-client.test.ts
│   │   │   │       └── storage.test.ts
│   │   │   │
│   │   │   └── infrastructure/          # 基础设施测试
│   │   │       ├── http/
│   │   │       │   └── http-client.test.ts
│   │   │       ├── cache/
│   │   │       │   └── cache-manager.test.ts
│   │   │       └── storage/
│   │   │           └── local-storage.test.ts
│   │   │
│   │   ├── component/                   # 组件测试
│   │   │   ├── ui/                      # UI组件测试
│   │   │   │   ├── Button.test.tsx
│   │   │   │   ├── Input.test.tsx
│   │   │   │   ├── Card.test.tsx
│   │   │   │   ├── Dialog.test.tsx
│   │   │   │   ├── Dropdown.test.tsx
│   │   │   │   └── Form.test.tsx
│   │   │   │
│   │   │   ├── features/                # 功能组件测试
│   │   │   │   ├── auth/
│   │   │   │   │   ├── LoginForm.test.tsx
│   │   │   │   │   ├── RegisterForm.test.tsx
│   │   │   │   │   └── ProfileForm.test.tsx
│   │   │   │   ├── content/
│   │   │   │   │   ├── ContentCard.test.tsx
│   │   │   │   │   ├── ContentList.test.tsx
│   │   │   │   │   └── ContentEditor.test.tsx
│   │   │   │   └── learning/
│   │   │   │       ├── LearningDashboard.test.tsx
│   │   │   │       └── ProgressTracker.test.tsx
│   │   │   │
│   │   │   └── layouts/                 # 布局组件测试
│   │   │       ├── MainLayout.test.tsx
│   │   │       ├── AuthLayout.test.tsx
│   │   │       └── DashboardLayout.test.tsx
│   │   │
│   │   ├── integration/                 # 集成测试
│   │   │   ├── api/                     # API集成测试
│   │   │   │   ├── auth.api.test.ts
│   │   │   │   ├── user.api.test.ts
│   │   │   │   ├── content.api.test.ts
│   │   │   │   └── activity.api.test.ts
│   │   │   │
│   │   │   ├── state/                   # 状态管理测试
│   │   │   │   ├── auth.store.test.ts
│   │   │   │   ├── user.store.test.ts
│   │   │   │   └── content.store.test.ts
│   │   │   │
│   │   │   ├── features/                # 功能集成测试
│   │   │   │   ├── authentication-flow.test.ts
│   │   │   │   ├── content-creation-flow.test.ts
│   │   │   │   └── learning-flow.test.ts
│   │   │   │
│   │   │   └── pages/                   # 页面集成测试
│   │   │       ├── home.integration.test.tsx
│   │   │       ├── dashboard.integration.test.tsx
│   │   │       └── profile.integration.test.tsx
│   │   │
│   │   ├── e2e/                         # E2E测试
│   │   │   ├── specs/                   # 测试规范
│   │   │   │   ├── auth/
│   │   │   │   │   ├── login.spec.ts
│   │   │   │   │   ├── register.spec.ts
│   │   │   │   │   └── logout.spec.ts
│   │   │   │   ├── user/
│   │   │   │   │   ├── profile.spec.ts
│   │   │   │   │   ├── settings.spec.ts
│   │   │   │   │   └── preferences.spec.ts
│   │   │   │   ├── content/
│   │   │   │   │   ├── browse.spec.ts
│   │   │   │   │   ├── create.spec.ts
│   │   │   │   │   ├── edit.spec.ts
│   │   │   │   │   └── delete.spec.ts
│   │   │   │   ├── learning/
│   │   │   │   │   ├── study-session.spec.ts
│   │   │   │   │   ├── progress-tracking.spec.ts
│   │   │   │   │   └── achievements.spec.ts
│   │   │   │   └── social/
│   │   │   │       ├── follow.spec.ts
│   │   │   │       ├── comments.spec.ts
│   │   │   │       └── share.spec.ts
│   │   │   │
│   │   │   ├── page-objects/            # 页面对象模式
│   │   │   │   ├── BasePage.ts
│   │   │   │   ├── LoginPage.ts
│   │   │   │   ├── DashboardPage.ts
│   │   │   │   ├── ContentPage.ts
│   │   │   │   └── ProfilePage.ts
│   │   │   │
│   │   │   └── workflows/               # 用户流程
│   │   │       ├── auth-workflows.ts
│   │   │       ├── content-workflows.ts
│   │   │       └── learning-workflows.ts
│   │   │
│   │   ├── visual/                      # 视觉回归测试
│   │   │   ├── components/
│   │   │   │   ├── Button.visual.test.ts
│   │   │   │   ├── Card.visual.test.ts
│   │   │   │   └── Form.visual.test.ts
│   │   │   └── pages/
│   │   │       ├── home.visual.test.ts
│   │   │       └── dashboard.visual.test.ts
│   │   │
│   │   ├── performance/                 # 性能测试
│   │   │   ├── lighthouse/
│   │   │   │   ├── home.perf.test.ts
│   │   │   │   ├── dashboard.perf.test.ts
│   │   │   │   └── content.perf.test.ts
│   │   │   ├── load-testing/
│   │   │   │   └── stress.test.ts
│   │   │   └── benchmarks/
│   │   │       ├── rendering.bench.ts
│   │   │       └── api.bench.ts
│   │   │
│   │   ├── accessibility/               # 可访问性测试
│   │   │   ├── components/
│   │   │   │   ├── Button.a11y.test.ts
│   │   │   │   ├── Form.a11y.test.ts
│   │   │   │   └── Navigation.a11y.test.ts
│   │   │   └── pages/
│   │   │       ├── home.a11y.test.ts
│   │   │       └── dashboard.a11y.test.ts
│   │   │
│   │   ├── mocks/                       # Mock数据和服务
│   │   │   ├── handlers/                # MSW请求处理器
│   │   │   │   ├── auth.handlers.ts
│   │   │   │   ├── user.handlers.ts
│   │   │   │   ├── content.handlers.ts
│   │   │   │   └── activity.handlers.ts
│   │   │   ├── data/                    # Mock数据
│   │   │   │   ├── users.mock.ts
│   │   │   │   ├── contents.mock.ts
│   │   │   │   └── activities.mock.ts
│   │   │   ├── factories/               # 数据工厂
│   │   │   │   ├── user.factory.ts
│   │   │   │   ├── content.factory.ts
│   │   │   │   └── activity.factory.ts
│   │   │   ├── server.ts                # MSW服务器配置
│   │   │   └── browser.ts               # MSW浏览器配置
│   │   │
│   │   ├── fixtures/                    # 测试固件
│   │   │   ├── database/
│   │   │   │   ├── users.json
│   │   │   │   ├── contents.json
│   │   │   │   └── activities.json
│   │   │   ├── api-responses/
│   │   │   │   ├── success.json
│   │   │   │   └── errors.json
│   │   │   └── files/
│   │   │       ├── sample.pdf
│   │   │       └── sample-image.jpg
│   │   │
│   │   └── helpers/                     # 测试辅助函数
│   │       ├── render.tsx               # 自定义渲染函数
│   │       ├── wait.ts                  # 等待工具
│   │       ├── assertions.ts            # 自定义断言
│   │       ├── mock-router.tsx          # Router Mock
│   │       ├── mock-providers.tsx       # Provider Mock
│   │       └── test-data.ts             # 测试数据生成器
│   │
│   ├── domain/                          # 领域层（与测试并行）
│   ├── features/                        # 功能层
│   ├── infrastructure/                  # 基础设施层
│   └── shared/                          # 共享层
│
├── playwright.config.ts                 # Playwright配置
├── vitest.config.ts                     # Vitest配置
├── .lighthouserc.js                     # Lighthouse配置
│
└── scripts/                             # 测试脚本
    ├── test-all.sh                      # 运行所有测试
    ├── test-coverage.sh                 # 生成覆盖率报告
    ├── test-ci.sh                       # CI测试脚本
    └── generate-test-report.js          # 生成测试报告
```

---

## 测试工具栈

### 核心测试框架

| 工具 | 用途 | 版本 |
|-----|------|------|
| **Vitest** | 单元测试运行器 | ^1.0.0 |
| **React Testing Library** | React组件测试 | ^14.0.0 |
| **Playwright** | E2E测试 | ^1.40.0 |
| **MSW (Mock Service Worker)** | API Mock | ^2.0.0 |
| **@testing-library/user-event** | 用户交互模拟 | ^14.5.0 |
| **@testing-library/jest-dom** | DOM断言 | ^6.1.0 |

### 辅助工具

| 工具 | 用途 |
|-----|------|
| **@axe-core/react** | 可访问性测试 |
| **@percy/playwright** | 视觉回归测试 |
| **lighthouse-ci** | 性能测试 |
| **@faker-js/faker** | 测试数据生成 |
| **@testing-library/react-hooks** | Hook测试 |
| **c8** | 代码覆盖率 |

### 测试报告工具

- **vitest-sonar-reporter** - SonarQube报告
- **@vitest/ui** - 交互式测试UI
- **playwright-html-reporter** - Playwright HTML报告
- **istanbul** - 覆盖率报告

---

## 测试类型

### 1. 单元测试（Unit Tests）

**目录**: `src/tests/unit/`

**文件命名**: `*.test.ts` 或 `*.test.tsx`

**示例结构**:
```typescript
// src/tests/unit/shared/utils/date.test.ts
describe('Date Utils', () => {
  describe('formatDate', () => {
    it('should format date correctly', () => {
      // 测试逻辑
    });
    
    it('should handle invalid dates', () => {
      // 测试逻辑
    });
  });
});
```

**覆盖范围**:
- 纯函数
- 工具类
- 服务类
- 自定义Hooks
- 实体（Entities）
- 值对象（Value Objects）

---

### 2. 组件测试（Component Tests）

**目录**: `src/tests/component/`

**文件命名**: `ComponentName.test.tsx`

**示例结构**:
```typescript
// src/tests/component/ui/Button.test.tsx
describe('Button Component', () => {
  it('should render with text', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button')).toHaveTextContent('Click me');
  });
  
  it('should handle click events', async () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click me</Button>);
    
    await userEvent.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
  
  it('should be disabled when disabled prop is true', () => {
    render(<Button disabled>Click me</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });
});
```

**测试重点**:
- 组件渲染
- Props处理
- 用户交互
- 状态变化
- 条件渲染
- 错误边界

---

### 3. 集成测试（Integration Tests）

**目录**: `src/tests/integration/`

**文件命名**: `feature-name.integration.test.ts`

**示例结构**:
```typescript
// src/tests/integration/features/authentication-flow.test.ts
describe('Authentication Flow', () => {
  it('should login user with valid credentials', async () => {
    // 测试登录流程
  });
  
  it('should show error with invalid credentials', async () => {
    // 测试错误处理
  });
  
  it('should redirect to dashboard after login', async () => {
    // 测试导航
  });
});
```

**测试重点**:
- 多个模块协作
- API调用
- 状态管理
- 路由导航
- 数据流

---

### 4. E2E测试（End-to-End Tests）

**目录**: `src/tests/e2e/specs/`

**文件命名**: `feature-name.spec.ts`

**示例结构**:
```typescript
// src/tests/e2e/specs/auth/login.spec.ts
import { test, expect } from '@playwright/test';
import { LoginPage } from '../../page-objects/LoginPage';

test.describe('User Login', () => {
  let loginPage: LoginPage;
  
  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    await loginPage.goto();
  });
  
  test('should login successfully with valid credentials', async () => {
    await loginPage.login('user@example.com', 'password123');
    await expect(loginPage.page).toHaveURL('/dashboard');
  });
  
  test('should show error with invalid credentials', async () => {
    await loginPage.login('invalid@example.com', 'wrong');
    await expect(loginPage.errorMessage).toBeVisible();
  });
});
```

**页面对象示例**:
```typescript
// src/tests/e2e/page-objects/LoginPage.ts
export class LoginPage {
  constructor(public readonly page: Page) {}
  
  readonly emailInput = this.page.getByLabel('Email');
  readonly passwordInput = this.page.getByLabel('Password');
  readonly submitButton = this.page.getByRole('button', { name: 'Login' });
  readonly errorMessage = this.page.getByTestId('error-message');
  
  async goto() {
    await this.page.goto('/login');
  }
  
  async login(email: string, password: string) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }
}
```

**测试重点**:
- 完整用户流程
- 跨页面交互
- 真实浏览器行为
- 关键业务场景

---

### 5. 视觉回归测试（Visual Regression Tests）

**目录**: `src/tests/visual/`

**文件命名**: `ComponentName.visual.test.ts`

**示例结构**:
```typescript
// src/tests/visual/components/Button.visual.test.ts
import { test, expect } from '@playwright/test';

test.describe('Button Visual Tests', () => {
  test('default button', async ({ page }) => {
    await page.goto('/storybook/button-default');
    await expect(page).toHaveScreenshot('button-default.png');
  });
  
  test('primary button', async ({ page }) => {
    await page.goto('/storybook/button-primary');
    await expect(page).toHaveScreenshot('button-primary.png');
  });
  
  test('disabled button', async ({ page }) => {
    await page.goto('/storybook/button-disabled');
    await expect(page).toHaveScreenshot('button-disabled.png');
  });
});
```

---

### 6. 性能测试（Performance Tests）

**目录**: `src/tests/performance/`

**文件命名**: `page-name.perf.test.ts`

**示例结构**:
```typescript
// src/tests/performance/lighthouse/home.perf.test.ts
import { test, expect } from '@playwright/test';
import { playAudit } from 'playwright-lighthouse';

test.describe('Home Page Performance', () => {
  test('should meet performance thresholds', async ({ page }) => {
    await page.goto('/');
    
    const results = await playAudit({
      page,
      port: 9222,
      thresholds: {
        performance: 90,
        accessibility: 90,
        'best-practices': 90,
        seo: 90,
      },
    });
    
    expect(results).toBeDefined();
  });
});
```

---

### 7. 可访问性测试（Accessibility Tests）

**目录**: `src/tests/accessibility/`

**文件命名**: `ComponentName.a11y.test.ts`

**示例结构**:
```typescript
// src/tests/accessibility/components/Button.a11y.test.ts
import { axe, toHaveNoViolations } from 'jest-axe';

expect.extend(toHaveNoViolations);

describe('Button Accessibility', () => {
  it('should have no accessibility violations', async () => {
    const { container } = render(<Button>Click me</Button>);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
  
  it('should be keyboard accessible', async () => {
    render(<Button onClick={handleClick}>Click me</Button>);
    const button = screen.getByRole('button');
    
    button.focus();
    expect(button).toHaveFocus();
    
    await userEvent.keyboard('{Enter}');
    expect(handleClick).toHaveBeenCalled();
  });
});
```

---

## 命名规范

### 文件命名

| 测试类型 | 命名模式 | 示例 |
|---------|---------|------|
| 单元测试 | `*.test.ts` | `date.test.ts` |
| 组件测试 | `ComponentName.test.tsx` | `Button.test.tsx` |
| 集成测试 | `*.integration.test.ts` | `auth-flow.integration.test.ts` |
| E2E测试 | `*.spec.ts` | `login.spec.ts` |
| 视觉测试 | `*.visual.test.ts` | `Button.visual.test.ts` |
| 性能测试 | `*.perf.test.ts` | `home.perf.test.ts` |
| 可访问性测试 | `*.a11y.test.ts` | `Button.a11y.test.ts` |

### 测试套件命名

```typescript
// ✅ 好的命名
describe('UserService', () => {});
describe('Login Component', () => {});
describe('Authentication Flow', () => {});

// ❌ 避免的命名
describe('Test', () => {});
describe('Main', () => {});
```

### 测试用例命名

使用 "should" 模式：

```typescript
// ✅ 好的命名
it('should render user name', () => {});
it('should validate email format', () => {});
it('should throw error when user not found', () => {});

// ❌ 避免的命名
it('test user name', () => {});
it('validation', () => {});
```

### Test ID命名

```typescript
// src/tests/test-ids.ts
export const TEST_IDS = {
  AUTH: {
    LOGIN_FORM: 'auth-login-form',
    EMAIL_INPUT: 'auth-email-input',
    PASSWORD_INPUT: 'auth-password-input',
    SUBMIT_BUTTON: 'auth-submit-button',
    ERROR_MESSAGE: 'auth-error-message',
  },
  USER: {
    PROFILE_CARD: 'user-profile-card',
    AVATAR: 'user-avatar',
    NAME: 'user-name',
  },
} as const;
```

---

## 最佳实践

### 1. 测试独立性

```typescript
// ✅ 每个测试都是独立的
describe('User Service', () => {
  let userService: UserService;
  
  beforeEach(() => {
    userService = new UserService();
  });
  
  it('should create user', () => {
    // 独立测试
  });
  
  it('should update user', () => {
    // 独立测试
  });
});
```

### 2. 使用AAA模式（Arrange-Act-Assert）

```typescript
it('should add item to cart', () => {
  // Arrange - 准备测试数据
  const cart = new ShoppingCart();
  const item = createMockItem();
  
  // Act - 执行操作
  cart.addItem(item);
  
  // Assert - 验证结果
  expect(cart.items).toHaveLength(1);
  expect(cart.items[0]).toBe(item);
});
```

### 3. 避免测试实现细节

```typescript
// ❌ 测试实现细节
it('should call setState with new value', () => {
  const setState = vi.fn();
  // 测试useState的实现
});

// ✅ 测试行为
it('should update counter when button is clicked', () => {
  render(<Counter />);
  userEvent.click(screen.getByRole('button'));
  expect(screen.getByText('Count: 1')).toBeInTheDocument();
});
```

### 4. 使用工厂函数创建测试数据

```typescript
// src/tests/mocks/factories/user.factory.ts
export const createMockUser = (overrides?: Partial<User>): User => ({
  id: faker.string.uuid(),
  name: faker.person.fullName(),
  email: faker.internet.email(),
  createdAt: faker.date.past(),
  ...overrides,
});
```

### 5. 合理使用Mock

```typescript
// ✅ Mock外部依赖
vi.mock('@/shared/lib/api-client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

// ✅ 使用MSW Mock HTTP请求
import { rest } from 'msw';
import { server } from '@/tests/mocks/server';

server.use(
  rest.get('/api/users', (req, res, ctx) => {
    return res(ctx.json({ users: [] }));
  })
);
```

### 6. 测试边界情况

```typescript
describe('validateEmail', () => {
  it('should validate correct email', () => {
    expect(validateEmail('user@example.com')).toBe(true);
  });
  
  // 测试边界情况
  it('should reject empty string', () => {
    expect(validateEmail('')).toBe(false);
  });
  
  it('should reject email without @', () => {
    expect(validateEmail('userexample.com')).toBe(false);
  });
  
  it('should reject email without domain', () => {
    expect(validateEmail('user@')).toBe(false);
  });
});
```

### 7. 异步测试

```typescript
// ✅ 使用 async/await
it('should fetch user data', async () => {
  const data = await fetchUser('123');
  expect(data).toBeDefined();
});

// ✅ 使用 waitFor
it('should show loading state', async () => {
  render(<UserProfile userId="123" />);
  
  expect(screen.getByText('Loading...')).toBeInTheDocument();
  
  await waitFor(() => {
    expect(screen.getByText('John Doe')).toBeInTheDocument();
  });
});
```

### 8. 快照测试谨慎使用

```typescript
// ⚠️ 仅用于稳定的UI组件
it('should match snapshot', () => {
  const { container } = render(<Button>Click me</Button>);
  expect(container).toMatchSnapshot();
});
```

---

## CI/CD集成

### GitHub Actions工作流

```yaml
# .github/workflows/test.yml
name: Test

on: [push, pull_request]

jobs:
  unit-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: '20'
      - name: Install dependencies
        run: npm ci
      - name: Run unit tests
        run: npm run test:unit -- --coverage
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        
  e2e-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Setup Node
        uses: actions/setup-node@v3
      - name: Install dependencies
        run: npm ci
      - name: Install Playwright
        run: npx playwright install --with-deps
      - name: Run E2E tests
        run: npm run test:e2e
      - name: Upload test results
        uses: actions/upload-artifact@v3
        if: always()
        with:
          name: playwright-report
          path: playwright-report/
```

### NPM脚本

```json
{
  "scripts": {
    "test": "vitest",
    "test:unit": "vitest run src/tests/unit",
    "test:component": "vitest run src/tests/component",
    "test:integration": "vitest run src/tests/integration",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:visual": "playwright test src/tests/visual",
    "test:a11y": "vitest run src/tests/accessibility",
    "test:perf": "vitest run src/tests/performance",
    "test:coverage": "vitest run --coverage",
    "test:watch": "vitest watch",
    "test:all": "npm run test:unit && npm run test:integration && npm run test:e2e",
    "test:ci": "npm run test:coverage && npm run test:e2e"
  }
}
```

---

## 测试覆盖率报告

### 生成覆盖率报告

```bash
# 生成HTML报告
npm run test:coverage

# 查看报告
open coverage/index.html
```

### 覆盖率配置

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    coverage: {
      provider: 'c8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'src/tests/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/mockData',
      ],
      lines: 80,
      functions: 80,
      branches: 80,
      statements: 80,
    },
  },
});
```

---

## 附录

### A. 常用测试工具函数

```typescript
// src/tests/helpers/render.tsx
export const renderWithProviders = (
  ui: React.ReactElement,
  options?: RenderOptions
) => {
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
  
  return render(ui, { wrapper: Wrapper, ...options });
};
```

### B. Mock服务器设置

```typescript
// src/tests/mocks/server.ts
import { setupServer } from 'msw/node';
import { handlers } from './handlers';

export const server = setupServer(...handlers);

// src/tests/setup.ts
import { server } from './mocks/server';

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

### C. 测试数据生成器

```typescript
// src/tests/helpers/test-data.ts
import { faker } from '@faker-js/faker';

export const generateTestUser = () => ({
  id: faker.string.uuid(),
  name: faker.person.fullName(),
  email: faker.internet.email(),
  avatar: faker.image.avatar(),
});

export const generateTestContent = () => ({
  id: faker.string.uuid(),
  title: faker.lorem.sentence(),
  content: faker.lorem.paragraphs(),
  author: generateTestUser(),
  createdAt: faker.date.past(),
});
```

---

## 参考资料

- [Vitest Documentation](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/react)
- [Playwright Documentation](https://playwright.dev/)
- [Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
- [MSW Documentation](https://mswjs.io/)

---

**最后更新**: 2025-10-24
**维护者**: Frontend Team
**版本**: 1.0.0

