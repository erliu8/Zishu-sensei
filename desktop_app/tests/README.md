# 🧪 测试框架指南

## 📋 测试框架概览

本项目使用多层次的测试策略，确保代码质量和功能稳定性：

### 🎯 测试金字塔

```
    E2E 测试 (Playwright)
   ┌─────────────────────┐
  │  用户交互流程测试    │
 └─────────────────────┘
        ▲
        │
   ┌─────────────────────┐
  │   集成测试 (Vitest)   │
 │  组件间交互测试        │
└─────────────────────┘
        ▲
        │
   ┌─────────────────────┐
  │   单元测试 (Vitest)   │
 │  组件和函数测试        │
└─────────────────────┘
```

## 🛠️ 测试工具配置

### 1. 单元测试 - Vitest + Testing Library

**配置文件**: `vitest.config.ts`

**特点**:
- ⚡ 快速执行
- 🔄 热重载支持
- 📊 覆盖率报告
- 🎭 DOM 环境模拟

**使用场景**:
- React 组件测试
- 工具函数测试
- Hook 测试
- 状态管理测试

### 2. 集成测试 - Vitest + MSW

**配置文件**: `vitest.integration.config.ts`

**特点**:
- 🌐 API 模拟
- 🔗 组件间交互
- 📡 网络请求测试
- ⏱️ 异步操作测试

**使用场景**:
- 适配器管理流程
- 聊天功能集成
- 设置面板交互
- 数据流测试

### 3. E2E 测试 - Playwright

**配置文件**: `playwright.config.ts`

**特点**:
- 🌍 真实浏览器环境
- 🖱️ 完整用户交互
- 📱 多设备测试
- 🎬 录制和回放

**使用场景**:
- 完整用户流程
- 跨浏览器兼容性
- 性能测试
- 可访问性测试

## 🚀 快速开始

### 安装依赖

```bash
# 安装测试依赖
npm install

# 安装 Playwright 浏览器
npx playwright install
```

### 运行测试

```bash
# 运行所有单元测试
npm run test

# 运行测试并监听文件变化
npm run test:watch

# 运行测试并生成覆盖率报告
npm run test:coverage

# 运行集成测试
npm run test:integration

# 运行 E2E 测试
npm run test:e2e

# 运行所有测试
npm run test:all
```

## 📝 测试编写指南

### 单元测试示例

```typescript
// tests/unit/components.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Button } from '@/components/common/Button'

describe('Button 组件', () => {
  it('应该正确渲染', () => {
    render(<Button>点击我</Button>)
    expect(screen.getByText('点击我')).toBeInTheDocument()
  })
})
```

### 集成测试示例

```typescript
// tests/integration/adapter-manager.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { server } from '../mocks/handlers'

describe('适配器管理', () => {
  it('应该能够加载适配器列表', async () => {
    render(<AdapterManager />)
    
    await waitFor(() => {
      expect(screen.getByTestId('adapter-list')).toBeInTheDocument()
    })
  })
})
```

### E2E 测试示例

```typescript
// tests/e2e/app.spec.ts
import { test, expect } from '@playwright/test'

test('应用应该正常启动', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('[data-testid="app"]')).toBeVisible()
})
```

## 🎨 测试最佳实践

### 1. 测试命名规范

```typescript
// ✅ 好的命名
describe('Button 组件', () => {
  it('应该在点击时调用 onClick 回调', () => {})
  it('应该在禁用状态下不响应点击', () => {})
})

// ❌ 不好的命名
describe('Button', () => {
  it('test 1', () => {})
  it('should work', () => {})
})
```

### 2. 测试结构 (AAA 模式)

```typescript
it('应该能够发送消息', async () => {
  // Arrange - 准备
  render(<ChatComponent />)
  const input = screen.getByTestId('message-input')
  
  // Act - 执行
  await userEvent.type(input, 'Hello')
  await userEvent.click(screen.getByTestId('send-button'))
  
  // Assert - 断言
  expect(screen.getByText('Hello')).toBeInTheDocument()
})
```

### 3. 使用 data-testid

```tsx
// ✅ 使用 data-testid
<button data-testid="send-button">发送</button>

// ❌ 避免使用文本内容
<button>发送</button>
```

### 4. 异步测试处理

```typescript
// ✅ 使用 waitFor
await waitFor(() => {
  expect(screen.getByText('加载完成')).toBeInTheDocument()
})

// ✅ 使用 findBy
const element = await screen.findByText('加载完成')
expect(element).toBeInTheDocument()
```

## 🔧 测试工具和技巧

### 1. Mock 和 Spy

```typescript
// Mock 函数
const mockFn = vi.fn()
mockFn('test')
expect(mockFn).toHaveBeenCalledWith('test')

// Mock 模块
vi.mock('@/utils/api', () => ({
  fetchData: vi.fn().mockResolvedValue({ data: 'mocked' })
}))

// Spy 对象方法
const spy = vi.spyOn(obj, 'method')
expect(spy).toHaveBeenCalled()
```

### 2. 用户交互模拟

```typescript
import userEvent from '@testing-library/user-event'

const user = userEvent.setup()

// 点击
await user.click(screen.getByTestId('button'))

// 输入
await user.type(screen.getByTestId('input'), 'Hello')

// 选择
await user.selectOptions(screen.getByTestId('select'), 'option1')
```

### 3. API 模拟 (MSW)

```typescript
// 在测试中覆盖 API 响应
server.use(
  rest.get('/api/adapters', (req, res, ctx) => {
    return res(ctx.json({ adapters: [] }))
  })
)
```

## 📊 测试覆盖率

### 覆盖率目标

- **行覆盖率**: 80%
- **函数覆盖率**: 80%
- **分支覆盖率**: 80%
- **语句覆盖率**: 80%

### 查看覆盖率报告

```bash
npm run test:coverage
```

报告将生成在 `coverage/` 目录中。

## 🐛 调试测试

### 1. 使用测试 UI

```bash
npm run test:ui
```

### 2. 使用 Playwright UI

```bash
npm run test:e2e:ui
```

### 3. 调试技巧

```typescript
// 在测试中添加调试信息
it('调试测试', async () => {
  render(<Component />)
  
  // 打印 DOM 结构
  screen.debug()
  
  // 暂停测试
  await page.pause()
})
```

## 📚 测试资源

### 官方文档

- [Vitest 文档](https://vitest.dev/)
- [Testing Library 文档](https://testing-library.com/)
- [Playwright 文档](https://playwright.dev/)
- [MSW 文档](https://mswjs.io/)

### 推荐阅读

- [测试金字塔](https://martinfowler.com/articles/practical-test-pyramid.html)
- [React 测试最佳实践](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
- [E2E 测试策略](https://playwright.dev/docs/best-practices)

## 🤝 贡献指南

### 添加新测试

1. 确定测试类型（单元/集成/E2E）
2. 选择合适的测试文件位置
3. 编写测试用例
4. 确保测试通过
5. 更新覆盖率

### 测试审查清单

- [ ] 测试覆盖了主要功能
- [ ] 测试名称清晰描述测试内容
- [ ] 使用了合适的断言
- [ ] 处理了异步操作
- [ ] 清理了测试副作用
- [ ] 测试独立且可重复

## 🚨 常见问题

### Q: 测试运行缓慢怎么办？

A: 
- 使用 `test.only()` 运行单个测试
- 检查是否有不必要的等待
- 优化测试数据大小

### Q: 如何处理 Tauri API 测试？

A: 
- 使用 `vi.mock()` 模拟 Tauri API
- 在测试设置中配置全局 mock
- 使用 MSW 模拟后端响应

### Q: E2E 测试不稳定怎么办？

A: 
- 增加适当的等待时间
- 使用更稳定的选择器
- 检查网络请求是否完成
- 使用 `page.waitForLoadState()`

---

**记住**: 好的测试是代码质量的保证，也是重构的信心来源！ 🎯
