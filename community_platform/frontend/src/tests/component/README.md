
# 组件测试指南

本目录包含所有组件测试，按照测试金字塔原则组织。

## 📁 目录结构

```
component/
├── ui/                      # UI 基础组件测试
│   ├── Button.test.tsx
│   ├── Input.test.tsx
│   ├── Card.test.tsx
│   ├── Dialog.test.tsx
│   ├── Form.test.tsx
│   └── ...
├── common/                  # 通用组件测试
│   ├── SearchBar.test.tsx
│   ├── Pagination.test.tsx
│   ├── ImageUploader.test.tsx
│   └── ...
├── features/                # 功能组件测试
│   ├── LoginForm.test.tsx
│   ├── ContentCard.test.tsx
│   ├── UserProfile.test.tsx
│   └── ...
└── layouts/                 # 布局组件测试
    ├── MainLayout.test.tsx
    ├── AuthLayout.test.tsx
    └── ...
```

## 🧪 测试规范

### 命名规范

- 文件名：`ComponentName.test.tsx`
- 测试套件：`describe('ComponentName', () => {})`
- 测试用例：`it('should do something', () => {})`

### 测试结构

每个组件测试应包含以下部分：

```typescript
describe('ComponentName', () => {
  describe('渲染', () => {
    // 测试组件的基本渲染
  });

  describe('交互行为', () => {
    // 测试用户交互
  });

  describe('状态管理', () => {
    // 测试组件状态变化
  });

  describe('可访问性', () => {
    // 测试 ARIA 属性和键盘导航
  });

  describe('边界情况', () => {
    // 测试边界条件和错误处理
  });
});
```

## ✅ 测试检查清单

### 基础组件测试

- [ ] 正确渲染
- [ ] Props 处理
- [ ] 默认值
- [ ] 样式变体
- [ ] 自定义样式
- [ ] Ref 转发
- [ ] HTML 属性传递

### 交互测试

- [ ] 点击事件
- [ ] 输入事件
- [ ] 键盘事件
- [ ] 焦点管理
- [ ] 表单提交
- [ ] 状态变化

### 表单组件测试

- [ ] 受控/非受控模式
- [ ] 验证逻辑
- [ ] 错误消息
- [ ] 提交处理
- [ ] 重置功能
- [ ] 禁用状态
- [ ] 加载状态

### 可访问性测试

- [ ] ARIA 属性
- [ ] 键盘导航
- [ ] 焦点管理
- [ ] 屏幕阅读器支持
- [ ] 语义化 HTML

## 🛠️ 工具和辅助函数

### 测试工具

```typescript
import { renderWithProviders } from '@/tests/test-utils';
import { setupUser } from '@/tests/helpers/component-test-utils';
import { createMockUser } from '@/tests/helpers/mock-data-generators';
```

### 常用模式

```typescript
// 1. 基本渲染
it('should render component', () => {
  render(<Component />);
  expect(screen.getByRole('button')).toBeInTheDocument();
});

// 2. 用户交互
it('should handle click', async () => {
  const user = userEvent.setup();
  const handleClick = vi.fn();
  
  render(<Component onClick={handleClick} />);
  await user.click(screen.getByRole('button'));
  
  expect(handleClick).toHaveBeenCalled();
});

// 3. 异步操作
it('should show loading state', async () => {
  render(<Component />);
  
  await waitFor(() => {
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });
});

// 4. 表单测试
it('should validate input', async () => {
  const user = userEvent.setup();
  render(<Form />);
  
  await user.type(screen.getByLabelText('Email'), 'invalid');
  await user.click(screen.getByRole('button', { name: 'Submit' }));
  
  expect(screen.getByText('Invalid email')).toBeInTheDocument();
});
```

## 📊 覆盖率目标

- **UI 组件**: ≥ 80%
- **功能组件**: ≥ 70%
- **布局组件**: ≥ 60%

## 🚀 运行测试

```bash
# 运行所有组件测试
npm run test:component

# 运行特定文件
npm run test src/tests/component/ui/Button.test.tsx

# 监听模式
npm run test:watch

# 生成覆盖率报告
npm run test:coverage
```

## 📝 最佳实践

### 1. 使用用户视角

```typescript
// ✅ 好 - 使用用户可见的内容
screen.getByRole('button', { name: '登录' });
screen.getByLabelText('邮箱');

// ❌ 避免 - 使用实现细节
screen.getByClassName('login-button');
screen.getByTestId('email-input'); // 仅在必要时使用
```

### 2. 避免测试实现细节

```typescript
// ❌ 避免 - 测试内部状态
expect(component.state.count).toBe(1);

// ✅ 好 - 测试用户可见的结果
expect(screen.getByText('Count: 1')).toBeInTheDocument();
```

### 3. 使用 waitFor 处理异步

```typescript
// ✅ 好
await waitFor(() => {
  expect(screen.getByText('Success')).toBeInTheDocument();
});

// ❌ 避免
await new Promise(resolve => setTimeout(resolve, 1000));
expect(screen.getByText('Success')).toBeInTheDocument();
```

### 4. 清理副作用

```typescript
describe('Component', () => {
  beforeEach(() => {
    // 设置
  });

  afterEach(() => {
    // 清理
    vi.clearAllMocks();
  });
});
```

### 5. 一个测试一个断言

```typescript
// ✅ 好
it('should render title', () => {
  render(<Component />);
  expect(screen.getByText('Title')).toBeInTheDocument();
});

it('should render description', () => {
  render(<Component />);
  expect(screen.getByText('Description')).toBeInTheDocument();
});

// ❌ 避免 - 测试太多内容
it('should render everything', () => {
  render(<Component />);
  expect(screen.getByText('Title')).toBeInTheDocument();
  expect(screen.getByText('Description')).toBeInTheDocument();
  expect(screen.getByRole('button')).toBeInTheDocument();
  // ... 更多断言
});
```

## 🔍 调试技巧

```typescript
import { screen, debug } from '@testing-library/react';

// 打印当前 DOM
screen.debug();

// 打印特定元素
screen.debug(screen.getByRole('button'));

// 查看所有可用角色
screen.logTestingPlaygroundURL();
```

## 参考资源

- [Testing Library 文档](https://testing-library.com/react)
- [Vitest 文档](https://vitest.dev/)
- [常见测试错误](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)

