# 可访问性测试框架

本目录包含应用程序的可访问性（A11y）测试，确保符合 WCAG 2.1 AA 标准。

## 📋 目录

- [概述](#概述)
- [测试结构](#测试结构)
- [运行测试](#运行测试)
- [编写测试](#编写测试)
- [工具和配置](#工具和配置)
- [最佳实践](#最佳实践)
- [常见问题](#常见问题)

## 📖 概述

### 测试覆盖范围

我们的可访问性测试覆盖以下方面：

- ✅ **WCAG 2.1 AA 合规性** - 符合国际可访问性标准
- ⌨️ **键盘导航** - 所有功能都可以通过键盘访问
- 🔊 **屏幕阅读器支持** - ARIA 属性和语义化 HTML
- 🎨 **颜色对比度** - 符合最低对比度要求
- 🎯 **焦点管理** - 清晰的焦点指示器和逻辑焦点顺序
- 📝 **表单可访问性** - 标签、错误消息和验证
- 🖼️ **图像替代文本** - 所有图像都有适当的 alt 属性
- 🏗️ **语义化结构** - 正确使用 landmark 区域和标题层级

### 测试工具

- **axe-core** - 自动化可访问性规则检查
- **vitest-axe** - Vitest 集成
- **@axe-core/playwright** - E2E 测试中的可访问性检查
- **React Testing Library** - 测试组件的可访问性
- **Playwright** - E2E 可访问性测试

## 📁 测试结构

```
src/tests/accessibility/
├── setup-a11y.ts                      # 可访问性测试配置
├── README.md                          # 本文档
│
├── helpers/                           # 辅助工具函数
│   ├── a11y-utils.ts                 # 通用可访问性检查工具
│   ├── keyboard-testing.ts           # 键盘导航测试工具
│   └── screen-reader-testing.ts      # 屏幕阅读器测试工具
│
├── components/                        # UI 组件可访问性测试
│   ├── Button.a11y.test.tsx
│   ├── Input.a11y.test.tsx
│   ├── Form.a11y.test.tsx
│   ├── Dialog.a11y.test.tsx
│   ├── Card.a11y.test.tsx
│   ├── Navigation.a11y.test.tsx
│   └── SearchBar.a11y.test.tsx
│
├── pages/                             # 页面可访问性测试
│   ├── home.a11y.test.tsx
│   └── dashboard.a11y.test.tsx
│
└── e2e/                               # E2E 可访问性测试
    ├── a11y-config.ts                # Playwright 可访问性配置
    └── home.a11y.e2e.test.ts
```

## 🚀 运行测试

### 单元和组件测试

```bash
# 运行所有可访问性测试
npm run test:a11y

# 监视模式（开发时使用）
npm run test:a11y:watch

# 运行特定测试文件
npm run test:a11y -- Button.a11y.test.tsx
```

### E2E 测试

```bash
# 运行 E2E 可访问性测试
npm run test:a11y:e2e

# 运行特定页面的测试
npm run test:a11y:e2e -- home.a11y.e2e.test.ts

# 使用 UI 模式
npm run test:a11y:e2e -- --ui
```

### 使用测试脚本

```bash
# 运行所有测试
bash scripts/a11y-test.sh all

# 只运行单元测试
bash scripts/a11y-test.sh unit

# 只运行 E2E 测试
bash scripts/a11y-test.sh e2e

# 生成报告
bash scripts/a11y-test.sh report

# CI 模式（测试 + 报告）
bash scripts/a11y-test.sh ci
```

## ✍️ 编写测试

### 基本组件测试

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { checkA11y } from '../helpers/a11y-utils';
import { componentAxeOptions } from '../setup-a11y';

describe('YourComponent Accessibility', () => {
  it('应该没有可访问性违规', async () => {
    const { container } = render(<YourComponent />);
    await checkA11y(container, componentAxeOptions);
  });

  it('应该有可访问的名称', () => {
    render(<YourComponent />);
    const element = screen.getByRole('button', { name: /expected name/i });
    expect(element).toBeInTheDocument();
  });

  it('应该支持键盘导航', async () => {
    const user = userEvent.setup();
    render(<YourComponent />);
    
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole('button'));
  });
});
```

### 测试键盘交互

```typescript
import { testEnterKeyActivation, testSpaceKeyActivation } from '../helpers/keyboard-testing';

it('应该响应 Enter 键', async () => {
  let activated = false;
  const handleActivate = () => { activated = true; };
  
  render(<Button onClick={handleActivate}>Click me</Button>);
  const button = screen.getByRole('button');
  
  await testEnterKeyActivation(button, () => {
    expect(activated).toBe(true);
  });
});
```

### 测试屏幕阅读器支持

```typescript
import { getAccessibleDescription, getAriaStates } from '../helpers/screen-reader-testing';

it('应该有正确的 ARIA 属性', () => {
  render(<YourComponent />);
  const element = screen.getByRole('button');
  
  const description = getAccessibleDescription(element);
  expect(description.name).toBeTruthy();
  expect(description.role).toBe('button');
  
  const states = getAriaStates(element);
  expect(states.pressed).toBe(false);
});
```

### E2E 测试

```typescript
import { test, expect } from './a11y-config';
import { checkPageA11y } from './a11y-config';

test.describe('Your Page Accessibility', () => {
  test('should have no violations', async ({ page, makeAxeBuilder }) => {
    await page.goto('/your-page');
    
    const results = await makeAxeBuilder().analyze();
    expect(results.violations).toEqual([]);
  });

  test('should support keyboard navigation', async ({ page }) => {
    await page.goto('/your-page');
    
    await page.keyboard.press('Tab');
    const focused = page.locator(':focus');
    await expect(focused).toBeVisible();
  });
});
```

## 🛠️ 工具和配置

### Axe 配置

`setup-a11y.ts` 文件包含 axe-core 的配置：

```typescript
export const axeConfig = configureAxe({
  rules: {
    'color-contrast': { enabled: true },
    'valid-aria-role': { enabled: true },
    'aria-required-attr': { enabled: true },
    // ... 更多规则
  },
  runOnly: {
    type: 'tag',
    values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'best-practice'],
  },
});
```

### 组件测试配置

对于组件测试，某些规则会被禁用（因为组件可能不包含完整的页面结构）：

```typescript
export const componentAxeOptions = {
  rules: {
    'region': { enabled: false },
    'landmark-one-main': { enabled: false },
    'page-has-heading-one': { enabled: false },
  },
};
```

### 页面测试配置

页面测试使用完整的规则集：

```typescript
export const pageAxeOptions = {
  rules: {},
};
```

## 📚 最佳实践

### 1. 语义化 HTML

✅ **推荐**:
```tsx
<button onClick={handleClick}>Submit</button>
<nav aria-label="Main navigation">...</nav>
<main>...</main>
```

❌ **避免**:
```tsx
<div onClick={handleClick}>Submit</div>
<div className="nav">...</div>
<div className="main">...</div>
```

### 2. ARIA 属性

只在必要时使用 ARIA，优先使用语义化 HTML：

✅ **推荐**:
```tsx
<button aria-label="Close dialog">×</button>
<input type="checkbox" aria-checked="true" />
```

❌ **避免**:
```tsx
<div role="button">Close</div>  // 应该使用 <button>
<span role="checkbox">[]</span>  // 应该使用 <input>
```

### 3. 键盘导航

确保所有交互元素都可以通过键盘访问：

```tsx
// ✅ 可以聚焦
<button>Click me</button>
<a href="/page">Link</a>
<input type="text" />

// ✅ 使用 tabindex 使自定义元素可聚焦
<div tabIndex={0} role="button" onKeyDown={handleKeyDown}>
  Custom Button
</div>

// ❌ 不可聚焦的交互元素
<div onClick={handleClick}>Click me</div>
```

### 4. 标签和描述

所有表单输入都应该有标签：

✅ **推荐**:
```tsx
<label htmlFor="email">Email</label>
<input id="email" type="email" />

// 或使用 aria-label
<input type="search" aria-label="Search" />
```

❌ **避免**:
```tsx
<input type="email" placeholder="Email" />  // 占位符不能替代标签
```

### 5. 图像替代文本

```tsx
// ✅ 内容图片
<img src="chart.png" alt="Sales chart showing 20% growth" />

// ✅ 装饰性图片
<img src="decoration.png" alt="" />

// ❌ 缺少 alt
<img src="important.png" />
```

### 6. 焦点管理

```tsx
// ✅ 模态框打开时聚焦到第一个元素
useEffect(() => {
  if (isOpen) {
    firstFocusableElement.current?.focus();
  }
}, [isOpen]);

// ✅ 模态框关闭时返回焦点
const handleClose = () => {
  setIsOpen(false);
  triggerElement.current?.focus();
};
```

### 7. 实时区域（Live Regions）

用于通知屏幕阅读器动态内容变化：

```tsx
// ✅ 礼貌地通知（不打断用户）
<div role="status" aria-live="polite" aria-atomic="true">
  {message}
</div>

// ✅ 紧急通知（立即通知用户）
<div role="alert" aria-live="assertive">
  {errorMessage}
</div>
```

### 8. 标题层级

保持标题的逻辑层级：

```tsx
// ✅ 正确的层级
<h1>Page Title</h1>
  <h2>Section 1</h2>
    <h3>Subsection 1.1</h3>
  <h2>Section 2</h2>

// ❌ 跳过层级
<h1>Page Title</h1>
  <h3>Section 1</h3>  // 跳过了 h2
```

## 🐛 常见问题

### Q: 如何禁用特定的 axe 规则？

A: 在测试中传递配置选项：

```typescript
await checkA11y(container, {
  rules: {
    'color-contrast': { enabled: false },
  },
});
```

### Q: 如何测试仅在悬停时显示的元素？

A: 使用 `user.hover()` 或设置组件状态：

```typescript
await user.hover(triggerElement);
await waitFor(() => {
  expect(screen.getByRole('tooltip')).toBeVisible();
});
```

### Q: 如何排除某些元素不进行检查？

A: 使用 `exclude` 选项：

```typescript
await checkA11y(container, {
  exclude: [['.third-party-widget']],
});
```

### Q: E2E 测试中如何等待动态内容？

A: 使用 Playwright 的等待方法：

```typescript
await page.waitForLoadState('networkidle');
await page.waitForSelector('[role="main"]');
```

### Q: 如何测试颜色对比度？

A: axe-core 会自动检查，或单独测试：

```typescript
await checkA11y(container, {
  runOnly: {
    type: 'rule',
    values: ['color-contrast'],
  },
});
```

## 📊 报告和 CI

### 本地报告

运行测试后，报告会保存在 `test-results/a11y-reports/` 目录：

```bash
bash scripts/a11y-test.sh report
```

### CI 集成

GitHub Actions 会自动运行可访问性测试并生成报告。查看 `.github/workflows/a11y-tests.yml` 了解详情。

违规会在 PR 评论中显示，并上传为工件供查看。

## 🔗 资源

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [axe-core Rules](https://github.com/dequelabs/axe-core/blob/develop/doc/rule-descriptions.md)
- [ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/)
- [MDN Accessibility](https://developer.mozilla.org/en-US/docs/Web/Accessibility)
- [WebAIM](https://webaim.org/)

## 🤝 贡献

添加新组件时，请：

1. 为组件创建可访问性测试
2. 确保所有测试通过
3. 更新本文档（如果添加了新的测试模式）
4. 在 PR 中包含可访问性测试报告

---

**记住**: 可访问性不是可选的，它是基本要求！让我们共同创建一个人人都能使用的应用程序。♿️✨

