# 通用组件库

这个目录包含了应用中可复用的通用 UI 组件。

## 组件列表

### 1. Modal（模态框）

功能完善的模态框组件，支持多种尺寸、动画效果和自定义选项。

**特性：**
- ✅ 多种尺寸支持（xs, sm, md, lg, xl, full）
- ✅ 多种动画效果（fade, scale, slide-up, slide-down, slide-left, slide-right）
- ✅ 可配置遮罩层（透明度、点击关闭）
- ✅ 键盘快捷键支持（ESC 关闭）
- ✅ 滚动锁定
- ✅ 可访问性支持（ARIA 属性）
- ✅ Portal 渲染
- ✅ 确认对话框变体

**基础用法：**

```tsx
import { Modal } from '@/components/common/Modal'

function MyComponent() {
  const [open, setOpen] = useState(false)
  
  return (
    <>
      <button onClick={() => setOpen(true)}>打开模态框</button>
      
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="模态框标题"
        footer={
          <button onClick={() => setOpen(false)}>关闭</button>
        }
      >
        <p>这是模态框的内容</p>
      </Modal>
    </>
  )
}
```

**高级用法：**

```tsx
// 不同尺寸
<Modal size="sm" {...props}>小尺寸</Modal>
<Modal size="lg" {...props}>大尺寸</Modal>
<Modal size="full" {...props}>全屏</Modal>

// 不同动画
<Modal animation="scale" {...props}>缩放动画</Modal>
<Modal animation="slide-up" {...props}>上滑动画</Modal>

// 确认对话框
import { ModalConfirm } from '@/components/common/Modal'

<ModalConfirm
  open={open}
  onClose={() => setOpen(false)}
  onConfirm={handleDelete}
  title="确认删除"
  message="确定要删除这个项目吗？此操作不可撤销。"
  confirmText="删除"
  confirmVariant="destructive"
/>

// 自定义配置
<Modal
  open={open}
  onClose={onClose}
  size="md"
  animation="scale"
  showCloseButton={true}
  closeOnOverlayClick={true}
  closeOnEsc={true}
  showOverlay={true}
  overlayOpacity={0.5}
  centered={true}
  lockScroll={true}
  zIndex={1000}
  onOpen={() => console.log('打开')}
  onAfterClose={() => console.log('关闭完成')}
>
  内容
</Modal>
```

**Props：**

| 属性 | 类型 | 默认值 | 说明 |
|-----|------|--------|------|
| `open` | `boolean` | - | 是否显示模态框（必填） |
| `onClose` | `() => void` | - | 关闭回调（必填） |
| `title` | `ReactNode` | - | 模态框标题 |
| `children` | `ReactNode` | - | 模态框内容（必填） |
| `footer` | `ReactNode` | - | 底部操作区 |
| `size` | `'xs' \| 'sm' \| 'md' \| 'lg' \| 'xl' \| 'full'` | `'md'` | 模态框尺寸 |
| `animation` | `'fade' \| 'scale' \| 'slide-up' \| 'slide-down' \| 'slide-left' \| 'slide-right'` | `'scale'` | 动画类型 |
| `showCloseButton` | `boolean` | `true` | 是否显示关闭按钮 |
| `closeOnOverlayClick` | `boolean` | `true` | 点击遮罩层是否关闭 |
| `closeOnEsc` | `boolean` | `true` | 按 ESC 键是否关闭 |
| `showOverlay` | `boolean` | `true` | 是否显示遮罩层 |
| `overlayOpacity` | `number` | `0.5` | 遮罩层透明度（0-1） |
| `centered` | `boolean` | `true` | 是否居中显示 |
| `lockScroll` | `boolean` | `true` | 是否禁用滚动穿透 |
| `zIndex` | `number` | `1000` | z-index 值 |
| `fullScreen` | `boolean` | `false` | 是否全屏 |

---

### 2. Loading（加载指示器）

多样化的加载指示器组件，支持多种样式和配置。

**特性：**
- ✅ 多种加载样式（spinner, dots, bars, pulse, ring, progress）
- ✅ 多种尺寸支持（xs, sm, md, lg, xl）
- ✅ 进度显示
- ✅ 文本提示
- ✅ 全屏覆盖
- ✅ 自定义颜色
- ✅ 内联显示模式

**基础用法：**

```tsx
import { Loading } from '@/components/common/Loading'

// 基础加载器
<Loading />

// 带文本提示
<Loading text="加载中..." />

// 不同样式
<Loading variant="spinner" />
<Loading variant="dots" />
<Loading variant="bars" />
<Loading variant="pulse" />
<Loading variant="ring" />

// 进度条
<Loading variant="progress" progress={60} showProgress />
```

**高级用法：**

```tsx
// 全屏加载
<Loading
  variant="spinner"
  size="lg"
  text="正在加载数据..."
  fullScreen
  overlayOpacity={0.5}
/>

// 自定义颜色
<Loading
  variant="spinner"
  color="#3b82f6"
/>

// 内联加载
import { InlineLoading } from '@/components/common/Loading'

<button>
  <InlineLoading variant="spinner" size="xs" />
  加载中...
</button>

// 条件渲染
<Loading
  variant="dots"
  size="md"
  visible={isLoading}
/>
```

**Props：**

| 属性 | 类型 | 默认值 | 说明 |
|-----|------|--------|------|
| `variant` | `'spinner' \| 'dots' \| 'bars' \| 'pulse' \| 'ring' \| 'progress'` | `'spinner'` | 加载样式 |
| `size` | `'xs' \| 'sm' \| 'md' \| 'lg' \| 'xl'` | `'md'` | 尺寸 |
| `text` | `string` | - | 提示文本 |
| `progress` | `number` | - | 进度值（0-100） |
| `showProgress` | `boolean` | `true` | 是否显示进度文本 |
| `fullScreen` | `boolean` | `false` | 是否全屏显示 |
| `color` | `string` | - | 自定义颜色 |
| `visible` | `boolean` | `true` | 是否显示 |
| `overlayOpacity` | `number` | `0.3` | 遮罩层透明度（0-1） |

---

### 3. Tooltip（工具提示）

功能强大的工具提示组件，支持多方向和多种触发方式。

**特性：**
- ✅ 12 个方向支持（top, bottom, left, right 及各自的 start/end 变体，auto）
- ✅ 多种触发方式（hover, click, focus, manual）
- ✅ 延迟显示/隐藏
- ✅ 自动定位调整
- ✅ 箭头指示器
- ✅ Portal 渲染
- ✅ 边界检测

**基础用法：**

```tsx
import { Tooltip } from '@/components/common/Tooltip'

<Tooltip content="这是一个提示">
  <button>悬停查看</button>
</Tooltip>
```

**高级用法：**

```tsx
// 不同位置
<Tooltip content="顶部提示" placement="top">
  <button>顶部</button>
</Tooltip>

<Tooltip content="底部提示" placement="bottom">
  <button>底部</button>
</Tooltip>

<Tooltip content="左侧提示" placement="left-start">
  <button>左上</button>
</Tooltip>

// 自动定位
<Tooltip content="自动选择最佳位置" placement="auto">
  <button>自动</button>
</Tooltip>

// 点击触发
<Tooltip content="点击显示" trigger="click">
  <button>点击我</button>
</Tooltip>

// 焦点触发
<Tooltip content="聚焦显示" trigger="focus">
  <input placeholder="聚焦输入框" />
</Tooltip>

// 延迟显示
<Tooltip
  content="延迟 500ms 显示"
  showDelay={500}
  hideDelay={200}
>
  <button>延迟提示</button>
</Tooltip>

// 自定义样式
<Tooltip
  content="自定义样式提示"
  showArrow={false}
  className="my-tooltip"
  contentClassName="my-tooltip-content"
  offset={[0, 12]}
>
  <button>自定义</button>
</Tooltip>

// 富文本内容
<Tooltip
  content={
    <div>
      <h4>标题</h4>
      <p>这是一段详细的描述文本</p>
    </div>
  }
>
  <button>富文本</button>
</Tooltip>

// 手动控制
function ManualTooltip() {
  const [open, setOpen] = useState(false)
  
  return (
    <Tooltip
      content="手动控制显示"
      trigger="manual"
      open={open}
      onOpenChange={setOpen}
    >
      <button onClick={() => setOpen(!open)}>
        切换提示
      </button>
    </Tooltip>
  )
}

// 简化版（仅文本）
import { SimpleTooltip } from '@/components/common/Tooltip'

<SimpleTooltip text="简单提示" placement="top">
  <button>简化版</button>
</SimpleTooltip>
```

**Props：**

| 属性 | 类型 | 默认值 | 说明 |
|-----|------|--------|------|
| `content` | `ReactNode` | - | 提示内容（必填） |
| `children` | `ReactElement` | - | 子元素（必填） |
| `placement` | `TooltipPlacement` | `'top'` | 显示位置 |
| `trigger` | `'hover' \| 'click' \| 'focus' \| 'manual'` | `'hover'` | 触发方式 |
| `showArrow` | `boolean` | `true` | 是否显示箭头 |
| `showDelay` | `number` | `200` | 显示延迟（毫秒） |
| `hideDelay` | `number` | `0` | 隐藏延迟（毫秒） |
| `open` | `boolean` | - | 手动控制显示 |
| `disabled` | `boolean` | `false` | 是否禁用 |
| `offset` | `[number, number]` | `[0, 8]` | 偏移量 [x, y] |
| `zIndex` | `number` | `9999` | z-index 值 |
| `onOpenChange` | `(open: boolean) => void` | - | 显示状态变化回调 |

**TooltipPlacement 类型：**
- `'top'`, `'top-start'`, `'top-end'`
- `'bottom'`, `'bottom-start'`, `'bottom-end'`
- `'left'`, `'left-start'`, `'left-end'`
- `'right'`, `'right-start'`, `'right-end'`
- `'auto'` - 自动选择最佳位置

---

## 样式主题

所有组件都支持深色模式，并使用 CSS 变量进行主题配置。主题变量定义在 `src/styles/variables.css` 中。

### 主要 CSS 变量

```css
/* 颜色 */
--color-background
--color-foreground
--color-primary
--color-border
--color-muted

/* 动画 */
--duration-fast: 150ms
--duration-normal: 300ms
--ease-out: cubic-bezier(0, 0, 0.2, 1)

/* 圆角 */
--radius-sm: 0.25rem
--radius-md: 0.375rem
--radius-lg: 0.5rem

/* 模糊 */
--backdrop-blur-sm: 4px
```

## 可访问性

所有组件都遵循 WAI-ARIA 规范：

- **Modal**: 使用 `role="dialog"` 和 `aria-modal="true"`
- **Loading**: 提供适当的加载状态反馈
- **Tooltip**: 使用 `role="tooltip"` 和适当的 ARIA 属性

支持键盘导航和屏幕阅读器。

## 性能优化

- 使用 Portal 渲染弹出层组件，避免 z-index 问题
- 支持 `prefers-reduced-motion` 媒体查询
- 使用 CSS 变量实现主题切换，无需 JavaScript
- 优化动画性能，使用 GPU 加速

## 浏览器兼容性

- Chrome/Edge: 最新版本
- Firefox: 最新版本  
- Safari: 最新版本

## 示例

完整的示例代码请参考各组件目录下的源文件。

