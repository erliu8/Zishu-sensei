# 无障碍性开发指南

**版本**: 1.0.0  
**制定日期**: 2025-10-23  
**目标**: WCAG 2.1 AA 级别合规

---

## 📋 目录

- [概述](#概述)
- [标准与合规](#标准与合规)
- [开发指南](#开发指南)
- [组件使用](#组件使用)
- [测试方法](#测试方法)
- [常见问题](#常见问题)
- [资源链接](#资源链接)

---

## 概述

Zishu 社区平台致力于为所有用户提供无障碍的使用体验，包括使用辅助技术的用户。本指南提供了开发过程中需要遵循的无障碍性最佳实践。

### 为什么无障碍性很重要

1. **法律合规**: 许多国家和地区要求网站符合无障碍标准
2. **包容性**: 让所有人都能使用我们的产品
3. **更好的用户体验**: 无障碍性改进通常会提升所有用户的体验
4. **SEO 优化**: 语义化的 HTML 有助于搜索引擎优化
5. **扩大用户群**: 全球约 15% 的人口有某种形式的残障

---

## 标准与合规

### WCAG 2.1 标准

我们遵循 **WCAG 2.1 AA 级别** 标准，包括以下四个核心原则：

#### 1. 可感知 (Perceivable)

用户必须能够感知呈现给他们的信息和用户界面组件。

- ✅ 提供文本替代（alt text）
- ✅ 提供多媒体的字幕和替代内容
- ✅ 内容可以多种方式呈现而不丢失信息
- ✅ 确保足够的颜色对比度

#### 2. 可操作 (Operable)

用户界面组件和导航必须是可操作的。

- ✅ 所有功能都可通过键盘访问
- ✅ 为用户提供足够的时间阅读和使用内容
- ✅ 不使用已知会引起癫痫发作的内容
- ✅ 帮助用户导航、查找内容和确定位置

#### 3. 可理解 (Understandable)

用户界面和信息必须是可理解的。

- ✅ 文本内容可读且可理解
- ✅ 网页以可预测的方式出现和操作
- ✅ 帮助用户避免和纠正错误

#### 4. 健壮 (Robust)

内容必须足够健壮，可以被各种用户代理（包括辅助技术）可靠地解释。

- ✅ 与当前和未来的用户工具兼容
- ✅ 使用有效的、语义化的 HTML

---

## 开发指南

### 1. 语义化 HTML

使用正确的 HTML 元素来表达内容的含义。

#### ✅ 正确示例

```tsx
// 使用正确的标题层级
<article>
  <h1>文章标题</h1>
  <h2>章节标题</h2>
  <h3>小节标题</h3>
</article>

// 使用语义化元素
<nav aria-label="主导航">
  <ul>
    <li><a href="/">首页</a></li>
    <li><a href="/about">关于</a></li>
  </ul>
</nav>

// 使用 button 而不是 div
<button onClick={handleClick}>点击我</button>
```

#### ❌ 错误示例

```tsx
// 不要跳过标题层级
<h1>标题</h1>
<h3>跳过了 h2</h3> ❌

// 不要用 div 模拟按钮
<div onClick={handleClick}>点击我</div> ❌

// 不要忽略链接的语义
<span onClick={navigate}>去另一个页面</span> ❌
```

---

### 2. ARIA 标签

ARIA (Accessible Rich Internet Applications) 用于增强动态内容和交互组件的可访问性。

#### 基本原则

1. **优先使用语义化 HTML**: 只在必要时使用 ARIA
2. **不要改变原生语义**: 除非绝对必要
3. **确保交互元素可访问**: 所有交互元素都需要标签
4. **保持 ARIA 状态同步**: 动态更新 ARIA 属性

#### 常用 ARIA 属性

```tsx
import { getAriaLabel, getAriaExpanded } from '@/shared/utils/accessibility';

// 标签
<button aria-label="关闭对话框">×</button>

// 描述
<input
  aria-describedby="password-hint"
/>
<span id="password-hint">至少 8 个字符</span>

// 状态
<button {...getAriaExpanded(isOpen)}>
  展开菜单
</button>

// 实时区域
<div role="status" aria-live="polite">
  表单已提交
</div>

// 隐藏装饰性内容
<span aria-hidden="true">🎉</span>
```

---

### 3. 键盘导航

确保所有功能都可以通过键盘访问。

#### 标准键盘操作

| 键 | 操作 |
|---|------|
| `Tab` | 移动到下一个可聚焦元素 |
| `Shift + Tab` | 移动到上一个可聚焦元素 |
| `Enter` | 激活链接或按钮 |
| `Space` | 激活按钮、选中复选框 |
| `Esc` | 关闭对话框或菜单 |
| `↑` `↓` | 在列表或菜单中导航 |
| `Home` | 跳到开始 |
| `End` | 跳到结束 |

#### 实现示例

```tsx
import { useKeyboardNavigation } from '@/shared/hooks/useKeyboardNavigation';

function Menu() {
  const { containerRef } = useKeyboardNavigation({
    orientation: 'vertical',
    loop: true,
  });

  return (
    <ul ref={containerRef} role="menu">
      <li role="menuitem" tabIndex={0}>选项 1</li>
      <li role="menuitem" tabIndex={-1}>选项 2</li>
      <li role="menuitem" tabIndex={-1}>选项 3</li>
    </ul>
  );
}
```

---

### 4. 焦点管理

正确管理焦点对键盘用户至关重要。

#### 焦点陷阱（Modal/Dialog）

```tsx
import { FocusTrap } from '@/shared/components/accessibility';

function Modal({ isOpen, onClose, children }) {
  if (!isOpen) return null;

  return (
    <FocusTrap
      enabled={isOpen}
      autoFocus
      restoreFocus
      initialFocusSelector="[data-autofocus]"
    >
      <div role="dialog" aria-modal="true">
        {children}
        <button onClick={onClose}>关闭</button>
      </div>
    </FocusTrap>
  );
}
```

#### 自动聚焦

```tsx
import { useAutoFocus } from '@/shared/hooks/useFocusManagement';

function SearchBar() {
  const inputRef = useAutoFocus({ delay: 100 });

  return <input ref={inputRef} type="search" />;
}
```

---

### 5. 颜色对比度

确保文本与背景有足够的对比度。

#### WCAG 标准

- **AA 级别**（我们的目标）:
  - 正常文本: 4.5:1
  - 大文本（18pt+ 或 14pt+ 加粗）: 3:1
  
- **AAA 级别**（推荐）:
  - 正常文本: 7:1
  - 大文本: 4.5:1

#### 检查工具

```bash
# 运行对比度检查
npm run check:contrast

# 生成报告
npm run check:contrast -- --output docs/accessibility/contrast-report.md
```

#### 代码中检查

```tsx
import { checkContrast } from '@/shared/utils/accessibility';

const result = checkContrast('#000000', '#ffffff', 'AA', 'normal');
console.log(result);
// { ratio: 21, passes: true, level: 'AA', requiredRatio: 4.5 }
```

---

### 6. 屏幕阅读器

确保内容对屏幕阅读器友好。

#### 仅屏幕阅读器可见的内容

```tsx
import { ScreenReaderOnly } from '@/shared/components/accessibility';

function IconButton() {
  return (
    <button>
      <TrashIcon aria-hidden="true" />
      <ScreenReaderOnly>删除</ScreenReaderOnly>
    </button>
  );
}
```

#### 实时通知

```tsx
import { LiveRegion, useAnnouncer } from '@/shared/components/accessibility';

function Form() {
  const { announce, Announcer } = useAnnouncer();

  const handleSubmit = async () => {
    await submitForm();
    announce('表单已成功提交', 'polite');
  };

  return (
    <>
      <form onSubmit={handleSubmit}>
        {/* 表单内容 */}
      </form>
      <Announcer />
    </>
  );
}
```

---

### 7. 图片和媒体

为非文本内容提供替代文本。

#### 图片

```tsx
// 内容图片
<img src="/photo.jpg" alt="一只金色的拉布拉多犬在公园里奔跑" />

// 装饰性图片
<img src="/decoration.png" alt="" role="presentation" />

// 使用 Next.js Image
import Image from 'next/image';
<Image src="/photo.jpg" alt="描述性文本" width={500} height={300} />
```

#### 图标

```tsx
// 有文本标签的图标
<button>
  <IconComponent aria-hidden="true" />
  <span>保存</span>
</button>

// 仅图标按钮
<button aria-label="保存">
  <IconComponent aria-hidden="true" />
</button>
```

---

### 8. 表单无障碍性

表单是用户交互的关键部分，必须完全可访问。

#### 标签关联

```tsx
// 显式关联
<label htmlFor="email">邮箱地址</label>
<input id="email" type="email" />

// 隐式关联
<label>
  邮箱地址
  <input type="email" />
</label>

// 使用 aria-label（仅在无法使用 label 时）
<input type="search" aria-label="搜索文章" />
```

#### 错误提示

```tsx
function EmailInput() {
  const [error, setError] = useState('');
  const errorId = 'email-error';

  return (
    <div>
      <label htmlFor="email">邮箱</label>
      <input
        id="email"
        type="email"
        aria-invalid={!!error}
        aria-describedby={error ? errorId : undefined}
        aria-required="true"
      />
      {error && (
        <span id={errorId} role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
```

#### 必填字段

```tsx
<label htmlFor="name">
  姓名
  <abbr title="必填" aria-label="必填">*</abbr>
</label>
<input
  id="name"
  type="text"
  required
  aria-required="true"
/>
```

---

## 组件使用

### 跳转到主内容

在页面顶部添加跳转链接，让键盘用户快速跳到主内容。

```tsx
import { SkipToContent } from '@/shared/components/accessibility';

function Layout({ children }) {
  return (
    <>
      <SkipToContent targetId="main-content" />
      <Header />
      <main id="main-content" tabIndex={-1}>
        {children}
      </main>
    </>
  );
}
```

### 键盘快捷键帮助

提供键盘快捷键说明。

```tsx
import { KeyboardShortcutHelp } from '@/shared/components/accessibility';

const shortcuts = [
  { keys: ['?'], description: '显示快捷键帮助', category: '通用' },
  { keys: ['/', 's'], description: '搜索', category: '通用' },
  { keys: ['n'], description: '新建帖子', category: '帖子' },
  { keys: ['Escape'], description: '关闭对话框', category: '通用' },
];

function App() {
  return (
    <div>
      <KeyboardShortcutHelp shortcuts={shortcuts} />
      {/* 其他内容 */}
    </div>
  );
}
```

### 焦点可见性

全局启用焦点可见性检测。

```tsx
// app/layout.tsx
'use client';

import { useFocusVisible } from '@/shared/hooks/useFocusManagement';

export default function RootLayout({ children }) {
  useFocusVisible();

  return (
    <html>
      <body>{children}</body>
    </html>
  );
}
```

---

## 测试方法

### 1. 自动化测试

#### ESLint 插件

```bash
npm install --save-dev eslint-plugin-jsx-a11y
```

```json
// .eslintrc.json
{
  "extends": [
    "plugin:jsx-a11y/recommended"
  ]
}
```

#### 单元测试

```tsx
import { render, screen } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';

expect.extend(toHaveNoViolations);

test('Button should be accessible', async () => {
  const { container } = render(<Button>Click me</Button>);
  const results = await axe(container);
  expect(results).toHaveNoViolations();
});
```

### 2. 手动测试

#### 键盘导航测试

- [ ] 使用 `Tab` 键浏览整个页面
- [ ] 确保所有交互元素都可聚焦
- [ ] 检查焦点顺序是否符合逻辑
- [ ] 确保焦点指示器清晰可见
- [ ] 测试 `Enter` 和 `Space` 键激活按钮
- [ ] 测试 `Esc` 键关闭对话框

#### 屏幕阅读器测试

推荐工具:
- **macOS**: VoiceOver (内置)
- **Windows**: NVDA (免费) 或 JAWS
- **Linux**: Orca

测试清单:
- [ ] 所有图片都有 alt 文本
- [ ] 表单标签正确关联
- [ ] 标题层级正确
- [ ] 动态内容变化有通知
- [ ] 错误消息可以被读取

#### 颜色对比度测试

```bash
# 运行对比度检查脚本
npm run check:contrast
```

或使用浏览器工具:
- Chrome DevTools: Lighthouse
- Firefox: Accessibility Inspector

### 3. 浏览器工具

#### Chrome DevTools

1. 打开 DevTools (F12)
2. Lighthouse 标签
3. 选择 "Accessibility" 类别
4. 运行审计

#### Firefox Accessibility Inspector

1. 打开 DevTools (F12)
2. Accessibility 标签
3. 启用 Accessibility features
4. 检查问题

---

## 常见问题

### Q: 什么时候应该使用 ARIA？

**A**: 遵循 "第一规则: 不要使用 ARIA"。优先使用语义化 HTML，只在以下情况使用 ARIA：
- 需要提供额外的语义信息
- 原生 HTML 无法满足需求
- 创建自定义组件时

### Q: 如何处理装饰性图片？

**A**: 使用空 alt 属性和 `role="presentation"`：
```tsx
<img src="/decoration.png" alt="" role="presentation" />
```

### Q: 焦点顺序如何确定？

**A**: 焦点顺序由 DOM 结构决定。避免使用 `tabIndex` 大于 0 的值。

### Q: 如何测试我的应用？

**A**: 
1. 使用自动化工具（ESLint, axe）
2. 进行手动键盘导航测试
3. 使用屏幕阅读器测试
4. 运行对比度检查脚本

### Q: 动态内容如何通知屏幕阅读器？

**A**: 使用 `LiveRegion` 组件或 `aria-live` 属性：
```tsx
<LiveRegion priority="polite">
  新消息已到达
</LiveRegion>
```

---

## 资源链接

### 标准和规范

- [WCAG 2.1 规范](https://www.w3.org/TR/WCAG21/)
- [ARIA 规范](https://www.w3.org/TR/wai-aria/)
- [ARIA 实践指南](https://www.w3.org/WAI/ARIA/apg/)

### 工具

- [axe DevTools](https://www.deque.com/axe/devtools/)
- [WAVE](https://wave.webaim.org/)
- [Lighthouse](https://developers.google.com/web/tools/lighthouse)
- [Color Contrast Checker](https://webaim.org/resources/contrastchecker/)

### 学习资源

- [WebAIM](https://webaim.org/)
- [A11y Project](https://www.a11yproject.com/)
- [MDN Accessibility](https://developer.mozilla.org/en-US/docs/Web/Accessibility)

---

**文档维护者**: Zishu Frontend Team  
**最后更新**: 2025-10-23  
**反馈**: 如有问题或建议，请提交 Issue

