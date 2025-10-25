># 集成测试指南

本目录包含社区平台前端的集成测试。

## 目录结构

```
integration/
├── api/                    # API 集成测试
│   ├── auth.api.test.ts    # 认证 API 测试
│   ├── user.api.test.ts    # 用户 API 测试
│   ├── content.api.test.ts # 内容 API 测试
│   └── activity.api.test.ts# 活动 API 测试
├── state/                  # 状态管理集成测试
│   ├── auth.store.test.ts  # 认证 Store 测试
│   ├── user.store.test.ts  # 用户 Store 测试
│   ├── post.store.test.ts  # 帖子 Store 测试
│   └── social.store.test.ts# 社交 Store 测试
├── features/               # 功能流程测试
│   ├── authentication-flow.test.ts      # 认证流程测试
│   ├── content-creation-flow.test.ts    # 内容创建流程测试
│   └── social-interaction-flow.test.ts  # 社交互动流程测试
├── pages/                  # 页面集成测试
│   ├── home.test.tsx       # 首页测试
│   ├── dashboard.test.tsx  # 仪表盘测试
│   └── profile.test.tsx    # 个人资料页测试
└── utils/                  # 测试辅助工具
    ├── test-helpers.ts     # 测试辅助函数
    └── api-helpers.ts      # API 测试辅助函数
```

## 运行测试

### 运行所有集成测试

```bash
npm run test:integration
```

### 运行特定类别的测试

```bash
# API 测试
npm run test tests/integration/api

# 状态管理测试
npm run test tests/integration/state

# 功能流程测试
npm run test tests/integration/features

# 页面测试
npm run test tests/integration/pages
```

### 运行单个测试文件

```bash
npm run test tests/integration/api/auth.api.test.ts
```

### 监听模式

```bash
npm run test:watch tests/integration
```

### 生成覆盖率报告

```bash
npm run test:coverage tests/integration
```

## 测试类型说明

### 1. API 集成测试 (`api/`)

测试前端与后端 API 的集成，验证：
- API 请求和响应
- 错误处理
- 数据格式转换
- 认证和授权

**示例：**
```typescript
import { mockAuthApi } from '../utils/api-helpers';

it('应该成功登录', async () => {
  mockAuthApi.login({
    success: true,
    data: {
      user: mockUser,
      accessToken: 'token',
      refreshToken: 'refresh-token',
    },
  });
  
  const response = await fetch('/api/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  
  const data = await response.json();
  expect(data.success).toBe(true);
});
```

### 2. 状态管理集成测试 (`state/`)

测试状态管理（Zustand stores）与 API 的集成：
- Store 初始化
- 状态更新
- 持久化
- 并发操作

**示例：**
```typescript
import { useAuthStore } from '@/features/auth/store/auth.store';

it('应该设置用户会话', () => {
  const { result } = renderHook(() => useAuthStore());
  
  act(() => {
    result.current.setSession({
      user: mockUser,
      accessToken: 'token',
      refreshToken: 'refresh-token',
      expiresIn: 3600,
    });
  });
  
  expect(result.current.isAuthenticated).toBe(true);
});
```

### 3. 功能流程测试 (`features/`)

测试完整的用户功能流程：
- 用户注册和登录流程
- 内容创建和编辑流程
- 社交互动流程

**示例：**
```typescript
it('应该完成完整的注册流程', async () => {
  // 1. 提交注册表单
  const registerResponse = await fetch('/api/v1/auth/register', {
    method: 'POST',
    body: JSON.stringify(userData),
  });
  
  // 2. 验证响应
  expect(registerResponse.ok).toBe(true);
  
  // 3. 设置会话
  act(() => {
    authStore.setSession(data);
  });
  
  // 4. 验证认证状态
  expect(authStore.isAuthenticated).toBe(true);
});
```

### 4. 页面集成测试 (`pages/`)

测试页面组件与后端的集成：
- 页面渲染
- 数据加载
- 用户交互
- 路由导航

**示例：**
```typescript
import { renderWithProviders } from '../utils/test-helpers';

it('应该显示首页内容', async () => {
  renderWithProviders(<HomePage />);
  
  await waitFor(() => {
    expect(screen.getByText(/欢迎/i)).toBeInTheDocument();
  });
});
```

## 使用测试辅助工具

### `test-helpers.ts`

提供通用的测试辅助函数：

```typescript
import { renderWithProviders, delay, mockLocalStorage } from '../utils/test-helpers';

// 渲染组件
renderWithProviders(<MyComponent />);

// 延迟
await delay(100);

// Mock localStorage
const storage = mockLocalStorage();
```

### `api-helpers.ts`

提供 API 测试辅助函数：

```typescript
import { mockAuthApi, mockApiError, createSuccessResponse } from '../utils/api-helpers';

// Mock 成功响应
mockAuthApi.login(createSuccessResponse(data));

// Mock 错误响应
mockApiError('post', '/auth/login', {
  message: '登录失败',
  status: 401,
});

// 创建 API spy
const spy = createApiSpy('post', '/posts');
// ... 执行操作
expect(spy.wasCalled()).toBe(true);
```

## 最佳实践

### 1. 测试隔离

每个测试应该独立，不依赖其他测试的状态：

```typescript
beforeEach(() => {
  // 清理状态
  useAuthStore.getState().clearSession();
  localStorage.clear();
  resetApiMocks();
});
```

### 2. 使用真实的用户交互

使用 `@testing-library/user-event` 模拟真实用户操作：

```typescript
import userEvent from '@testing-library/user-event';

const user = userEvent.setup();
await user.click(button);
await user.type(input, 'text');
```

### 3. 等待异步操作

使用 `waitFor` 等待异步操作完成：

```typescript
await waitFor(() => {
  expect(screen.getByText('Success')).toBeInTheDocument();
});
```

### 4. 测试错误场景

不仅测试成功场景，也要测试错误处理：

```typescript
it('应该处理登录失败', async () => {
  mockApiError('post', '/auth/login', {
    message: '用户名或密码错误',
    status: 401,
  });
  
  // ... 执行登录
  
  await waitFor(() => {
    expect(screen.getByText(/错误/i)).toBeInTheDocument();
  });
});
```

### 5. 测试加载状态

验证加载指示器的显示和隐藏：

```typescript
it('应该显示加载状态', async () => {
  render(<MyComponent />);
  
  expect(screen.getByTestId('loading')).toBeInTheDocument();
  
  await waitFor(() => {
    expect(screen.queryByTestId('loading')).not.toBeInTheDocument();
  });
});
```

### 6. 使用语义化查询

优先使用语义化的查询方法：

```typescript
// 好 ✓
screen.getByRole('button', { name: /提交/i });
screen.getByLabelText(/用户名/i);
screen.getByText(/欢迎/i);

// 不好 ✗
screen.getByTestId('submit-btn');
screen.getByClassName('username-input');
```

### 7. 测试可访问性

确保组件具有良好的可访问性：

```typescript
it('应该有正确的 ARIA 属性', () => {
  render(<MyComponent />);
  
  const button = screen.getByRole('button');
  expect(button).toHaveAttribute('aria-label', '关闭');
});
```

## 调试测试

### 查看渲染的 DOM

```typescript
import { screen } from '@testing-library/react';

screen.debug(); // 打印整个文档
screen.debug(element); // 打印特定元素
```

### 查看查询结果

```typescript
screen.logTestingPlaygroundURL(); // 生成 Testing Playground URL
```

### 使用 VS Code 调试器

在测试文件中设置断点，然后：
1. 点击"运行和调试"
2. 选择"Jest: Current File"
3. 测试会在断点处暂停

## 持续集成

集成测试会在以下情况自动运行：
- 提交代码到 Git 仓库
- 创建 Pull Request
- 合并到主分支

确保所有测试通过后再合并代码。

## 故障排查

### 测试超时

如果测试经常超时，可以增加超时时间：

```typescript
it('long running test', async () => {
  // ...
}, 10000); // 10秒超时
```

### Mock 不生效

确保 Mock 在测试之前设置：

```typescript
beforeEach(() => {
  mockAuthApi.login(response);
});
```

### 状态污染

如果测试之间互相影响，检查清理逻辑：

```typescript
afterEach(() => {
  cleanupMocks();
  vi.clearAllMocks();
});
```

## 参考资源

- [Testing Library 文档](https://testing-library.com/docs/react-testing-library/intro/)
- [Vitest 文档](https://vitest.dev/)
- [MSW 文档](https://mswjs.io/)
- [项目测试框架文档](../../docs/TESTING_FRAMEWORK.md)

## 贡献指南

添加新的集成测试时：

1. 选择合适的目录（api/state/features/pages）
2. 使用描述性的测试名称
3. 包含成功和失败场景
4. 添加必要的注释
5. 确保测试独立运行
6. 更新本 README（如需要）

## 联系方式

如有问题或建议，请：
- 提交 Issue
- 联系测试团队
- 查看项目文档

