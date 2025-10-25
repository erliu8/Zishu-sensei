# E2E 测试文档

## 📖 概述

本目录包含完整的端到端(E2E)测试套件，使用 Playwright 构建，遵循页面对象模式(Page Object Model)和测试最佳实践。

## 🏗️ 架构

```
e2e/
├── fixtures/              # 测试固件和数据
│   ├── test-data.ts      # 测试数据常量
│   └── auth.setup.ts     # 认证设置
├── helpers/              # 测试辅助函数
│   ├── global-setup.ts   # 全局设置
│   ├── global-teardown.ts # 全局清理
│   └── test-utils.ts     # 工具函数
├── page-objects/         # 页面对象
│   ├── BasePage.ts       # 基础页面类
│   ├── LoginPage.ts      # 登录页面
│   ├── RegisterPage.ts   # 注册页面
│   ├── DashboardPage.ts  # Dashboard 页面
│   ├── ContentPage.ts    # 内容页面
│   └── ProfilePage.ts    # 个人资料页面
├── workflows/            # 测试工作流
│   ├── auth-workflows.ts      # 认证相关流程
│   ├── content-workflows.ts   # 内容相关流程
│   └── learning-workflows.ts  # 学习相关流程
└── specs/                # 测试用例
    ├── auth/             # 认证测试
    │   ├── login.spec.ts
    │   ├── register.spec.ts
    │   └── logout.spec.ts
    ├── user/             # 用户测试
    │   ├── profile.spec.ts
    │   └── settings.spec.ts
    ├── content/          # 内容测试
    │   ├── create.spec.ts
    │   ├── browse.spec.ts
    │   └── edit-delete.spec.ts
    ├── learning/         # 学习测试
    │   └── dashboard.spec.ts
    └── social/           # 社交测试
        └── follow.spec.ts
```

## 🚀 快速开始

### 安装依赖

```bash
npm install
```

### 安装 Playwright 浏览器

```bash
npx playwright install
```

### 运行测试

```bash
# 运行所有 E2E 测试
npm run test:e2e

# 运行测试并打开 UI
npm run test:e2e:ui

# 运行特定测试文件
npx playwright test src/tests/e2e/specs/auth/login.spec.ts

# 在特定浏览器运行
npx playwright test --project=chromium

# 调试模式
npx playwright test --debug
```

## 📝 测试用例组织

### 认证测试 (auth/)

- **login.spec.ts**: 登录功能测试
  - ✅ 成功登录
  - ✅ 登录验证
  - ✅ 错误处理
  - ✅ 安全性测试
  - ✅ 响应式设计

- **register.spec.ts**: 注册功能测试
  - ✅ 成功注册
  - ✅ 表单验证
  - ✅ 密码强度检测
  - ✅ 重复注册检测

- **logout.spec.ts**: 登出功能测试
  - ✅ 成功登出
  - ✅ 会话清理
  - ✅ 权限验证

### 用户测试 (user/)

- **profile.spec.ts**: 个人资料测试
  - ✅ 查看个人资料
  - ✅ 编辑个人资料
  - ✅ 关注/取消关注
  - ✅ 内容和活动列表

- **settings.spec.ts**: 设置功能测试
  - ✅ 账户设置
  - ✅ 隐私设置
  - ✅ 通知设置
  - ✅ 主题切换

### 内容测试 (content/)

- **create.spec.ts**: 内容创建测试
  - ✅ 创建新内容
  - ✅ 表单验证
  - ✅ 草稿保存
  - ✅ Markdown 支持

- **browse.spec.ts**: 内容浏览测试
  - ✅ 内容列表
  - ✅ 搜索功能
  - ✅ 筛选和排序
  - ✅ 点赞和分享

- **edit-delete.spec.ts**: 内容编辑和删除测试
  - ✅ 编辑内容
  - ✅ 删除内容
  - ✅ 权限控制
  - ✅ 版本控制

### 学习测试 (learning/)

- **dashboard.spec.ts**: 学习 Dashboard 测试
  - ✅ 学习统计
  - ✅ 进度追踪
  - ✅ 成就系统
  - ✅ 学习目标

### 社交测试 (social/)

- **follow.spec.ts**: 社交功能测试
  - ✅ 关注用户
  - ✅ 评论功能
  - ✅ 分享功能

## 🎯 页面对象模式

### 基础页面类 (BasePage)

所有页面对象都继承自 `BasePage`，提供通用功能：

```typescript
class BasePage {
  async goto(path?: string)          // 访问页面
  async waitForLoad()                 // 等待加载
  async click(locator)                // 点击元素
  async fill(locator, value)          // 填写输入
  async expectToast(message)          // 验证提示
  async screenshot(name)              // 截图
  // ... 更多方法
}
```

### 页面对象示例

```typescript
// LoginPage.ts
export class LoginPage extends BasePage {
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;
  
  async login(email: string, password: string) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }
}
```

## 🔄 工作流模式

工作流封装常见的多步骤操作：

```typescript
// auth-workflows.ts
export async function quickLoginWorkflow(page: Page) {
  const loginPage = new LoginPage(page);
  await loginPage.goto();
  await loginPage.quickLogin();
  return new DashboardPage(page);
}

export async function registerAndLoginWorkflow(page: Page) {
  // 注册 -> 登录 -> 返回 Dashboard
  // ...
}
```

## 📊 测试数据

### 测试用户

```typescript
testUsers = {
  admin: { email: 'admin@example.com', password: 'Admin123456!' },
  regularUser: { email: 'user@example.com', password: 'User123456!' },
}
```

### 测试内容

```typescript
testContents = {
  article: { title: '测试文章', description: '...', content: '...' },
  tutorial: { title: '日语教程', description: '...', content: '...' },
}
```

## 🛠️ 辅助函数

### 常用工具

```typescript
// 等待页面加载
await waitForPageLoad(page);

// 等待 Toast 消息
await waitForToast(page, '操作成功');

// Mock API 响应
await mockApiResponse(page, '/api/users', { data: [] });

// 设置本地存储
await setLocalStorageItem(page, 'token', 'test-token');

// 生成测试数据
const user = generateTestUser();
const email = generateRandomEmail();
```

## ⚙️ 配置

### Playwright 配置 (playwright.config.ts)

```typescript
export default defineConfig({
  testDir: './src/tests/e2e',
  timeout: 60 * 1000,
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium' },
    { name: 'firefox' },
    { name: 'webkit' },
  ],
});
```

### 环境变量

```bash
# 测试基础 URL
PLAYWRIGHT_BASE_URL=http://localhost:3000

# 测试用户凭证
TEST_USER_EMAIL=test@example.com
TEST_USER_PASSWORD=test123456
```

## 📈 最佳实践

### 1. 使用页面对象模式

✅ **好的做法**:
```typescript
const loginPage = new LoginPage(page);
await loginPage.login(email, password);
```

❌ **不好的做法**:
```typescript
await page.fill('input[name="email"]', email);
await page.fill('input[name="password"]', password);
await page.click('button[type="submit"]');
```

### 2. 使用工作流简化复杂操作

✅ **好的做法**:
```typescript
await quickLoginWorkflow(page);
await createContentWorkflow(page, contentData);
```

❌ **不好的做法**:
```typescript
// 在每个测试中重复登录步骤
const loginPage = new LoginPage(page);
await loginPage.goto();
await loginPage.login(email, password);
```

### 3. 使用 Test ID 而非 CSS 选择器

✅ **好的做法**:
```typescript
page.getByTestId('login-button')
```

❌ **不好的做法**:
```typescript
page.locator('.btn.btn-primary.login-btn')
```

### 4. 合理使用等待

✅ **好的做法**:
```typescript
await expect(element).toBeVisible();
await page.waitForURL('**/dashboard');
```

❌ **不好的做法**:
```typescript
await page.waitForTimeout(5000); // 固定等待
```

### 5. 独立的测试

每个测试应该：
- ✅ 独立运行（不依赖其他测试）
- ✅ 清理自己创建的数据
- ✅ 有明确的测试目标
- ✅ 使用描述性的测试名称

## 🐛 调试

### 调试单个测试

```bash
# 调试模式运行
npx playwright test login.spec.ts --debug

# 显示浏览器
npx playwright test --headed

# 慢速执行
npx playwright test --slow-mo=1000
```

### 查看测试报告

```bash
# 生成并打开 HTML 报告
npx playwright show-report
```

### 查看 Trace

```bash
# 查看失败测试的 trace
npx playwright show-trace trace.zip
```

## 🔍 常见问题

### 测试超时

```typescript
// 增加特定操作的超时时间
await page.waitForSelector('.slow-element', { timeout: 30000 });
```

### 元素未找到

```typescript
// 确保元素可见再操作
await element.waitFor({ state: 'visible' });
await element.click();
```

### 认证状态

```typescript
// 使用预认证状态加速测试
test.use({ storageState: 'playwright/.auth/user.json' });
```

## 📚 参考资源

- [Playwright 文档](https://playwright.dev/)
- [测试最佳实践](https://playwright.dev/docs/best-practices)
- [页面对象模式](https://playwright.dev/docs/pom)
- [调试指南](https://playwright.dev/docs/debug)

## 🤝 贡献

添加新测试时：
1. 遵循现有的文件结构
2. 使用页面对象模式
3. 编写清晰的测试名称
4. 添加适当的注释
5. 确保测试独立运行

---

**维护者**: Frontend Team  
**最后更新**: 2025-10-25

