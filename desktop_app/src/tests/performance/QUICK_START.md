# 性能测试快速开始指南

## 🚀 5分钟快速上手

### 1. 运行所有性能测试

```bash
npm run test:performance
```

这将运行所有性能测试并输出详细的性能指标。

### 2. 查看测试结果

测试运行后，你会看到类似以下的输出：

```
✓ tests/performance/render-performance.test.tsx (12) 3421ms
  ✓ 渲染性能测试 (12) 3420ms
    ✓ ChatWindow 组件 (3) 145ms
      ✓ 首次渲染应该在 50ms 内完成 42ms
        ChatWindow 首次渲染时间: 38.42ms
      ✓ 有少量消息时渲染应该很快 (< 30ms) 28ms
        ChatWindow 10条消息渲染时间: 24.15ms
      ✓ 重新渲染应该在 16ms 内完成 (60fps) 12ms
        ChatWindow 重新渲染时间: 8.93ms

✓ tests/performance/memory-leak.test.tsx (18) 5234ms
  ✓ 内存泄漏测试 (18) 5233ms
    ✓ 事件监听器清理 (3) 892ms
      ✓ ChatWindow 卸载后应该清理所有事件监听器 324ms
        ChatWindow - 挂载前: 0, 挂载中: 12, 卸载后: 0
```

### 3. 监视模式运行

如果你正在优化性能，可以使用监视模式：

```bash
npm run test:performance:watch
```

这样在你修改代码后，测试会自动重新运行。

### 4. 运行特定测试

```bash
# 只运行渲染性能测试
npm run test:performance -- render-performance

# 只运行内存泄漏测试
npm run test:performance -- memory-leak

# 只测试特定组件
npm run test:performance -- -t "ChatWindow"
```

## 📊 理解性能指标

### 渲染时间指标

| 指标 | 含义 | 目标值 |
|------|------|--------|
| 首次渲染 | 组件第一次加载的时间 | < 50ms |
| 重新渲染 | 组件更新的时间 | < 16ms (60fps) |
| 大列表渲染 | 渲染多条消息的时间 | 根据数量而定 |

**如何解读:**
- ✅ 绿色：性能良好
- ⚠️ 黄色：接近阈值，需要关注
- ❌ 红色：性能不佳，需要优化

### 内存指标

| 指标 | 含义 | 目标值 |
|------|------|--------|
| 内存增长 | 组件挂载后增加的内存 | < 50MB |
| 内存释放率 | 卸载后释放的内存百分比 | > 80% |
| 长期增长 | 长时间运行的内存增长 | < 20MB/小时 |

**如何解读:**
- 如果内存释放率 < 70%，可能存在内存泄漏
- 如果长期增长 > 50MB/小时，需要检查是否有未清理的资源

### FPS 指标

| 场景 | 目标 FPS | 说明 |
|------|----------|------|
| 普通滚动 | > 30 | 可接受的流畅度 |
| 虚拟滚动 | > 50 | 优秀的性能 |
| 动画播放 | > 55 | 接近完美的 60fps |

**如何解读:**
- 60 FPS = 完美流畅
- 30-60 FPS = 可接受
- < 30 FPS = 需要优化

## 🔍 常见性能问题和解决方案

### 问题 1: 渲染时间过长

**症状:**
```
❌ ChatWindow 首次渲染时间: 125.42ms (应该 < 50ms)
```

**可能原因:**
- 组件层级过深
- 不必要的重新计算
- 大量的 DOM 操作

**解决方案:**
```typescript
// ❌ 不好
function MyComponent() {
  const expensiveValue = calculateExpensiveValue() // 每次渲染都计算
  return <div>{expensiveValue}</div>
}

// ✅ 好
function MyComponent() {
  const expensiveValue = useMemo(() => calculateExpensiveValue(), [])
  return <div>{expensiveValue}</div>
}
```

### 问题 2: 内存泄漏

**症状:**
```
❌ ChatWindow - 挂载前: 5, 卸载后: 18 (监听器未清理)
```

**可能原因:**
- 事件监听器未移除
- 定时器未清除
- 订阅未取消

**解决方案:**
```typescript
// ❌ 不好
useEffect(() => {
  window.addEventListener('resize', handleResize)
  // 没有清理
}, [])

// ✅ 好
useEffect(() => {
  window.addEventListener('resize', handleResize)
  return () => {
    window.removeEventListener('resize', handleResize)
  }
}, [])
```

### 问题 3: 滚动不流畅

**症状:**
```
❌ 滚动性能 - 平均FPS: 22.15 (应该 > 30)
```

**可能原因:**
- 渲染的 DOM 节点过多
- 滚动处理函数执行耗时
- 没有使用虚拟滚动

**解决方案:**
```typescript
// ❌ 不好 - 渲染所有 1000 条消息
<div>
  {messages.map(msg => <Message key={msg.id} {...msg} />)}
</div>

// ✅ 好 - 使用虚拟滚动
<MessageList
  messages={messages}
  enableVirtualScroll={true}
  virtualScrollThreshold={100}
/>
```

## 🛠️ 性能优化技巧

### 1. 使用 React.memo

```typescript
// 防止不必要的重新渲染
const MessageItem = React.memo(({ message }) => {
  return <div>{message.content}</div>
}, (prevProps, nextProps) => {
  // 只在 message.id 改变时重新渲染
  return prevProps.message.id === nextProps.message.id
})
```

### 2. 使用 useMemo 和 useCallback

```typescript
// 缓存计算结果
const sortedMessages = useMemo(() => {
  return messages.sort((a, b) => a.timestamp - b.timestamp)
}, [messages])

// 缓存函数引用
const handleClick = useCallback(() => {
  console.log('clicked')
}, [])
```

### 3. 代码分割和懒加载

```typescript
// 懒加载大组件
const HeavyComponent = lazy(() => import('./HeavyComponent'))

function App() {
  return (
    <Suspense fallback={<Loading />}>
      <HeavyComponent />
    </Suspense>
  )
}
```

### 4. 虚拟化长列表

```typescript
import { VirtualList } from '@/components/VirtualList'

<VirtualList
  items={largeArray}
  itemHeight={50}
  renderItem={(item) => <ListItem {...item} />}
/>
```

## 🎯 性能优化检查清单

在提交代码前，确保：

- [ ] 所有性能测试通过
- [ ] 没有新的内存泄漏
- [ ] 滚动保持流畅 (FPS > 30)
- [ ] 大列表使用虚拟滚动
- [ ] 组件正确使用 memo/useMemo/useCallback
- [ ] 所有事件监听器都有清理
- [ ] 所有定时器都被清除
- [ ] 没有不必要的重新渲染

## 📝 编写新的性能测试

### 模板：渲染性能测试

```typescript
import { measureRenderTime } from './utils'

it('MyComponent 应该快速渲染', () => {
  const renderTime = measureRenderTime(() => {
    render(<MyComponent />)
  })
  
  console.log(`MyComponent 渲染时间: ${renderTime.toFixed(2)}ms`)
  expect(renderTime).toBeLessThan(50)
})
```

### 模板：内存泄漏测试

```typescript
import { EventListenerMonitor } from './utils'

it('MyComponent 应该清理事件监听器', async () => {
  const monitor = new EventListenerMonitor()
  monitor.install()
  
  const beforeCount = monitor.getListenerCount()
  const { unmount } = render(<MyComponent />)
  unmount()
  
  await waitFor(() => {
    expect(monitor.getListenerCount()).toBeLessThanOrEqual(beforeCount)
  })
  
  monitor.uninstall()
})
```

## 🔗 更多资源

- 📖 [完整性能测试文档](./README.md)
- 🎨 [性能优化最佳实践](https://react.dev/learn/render-and-commit)
- 🔍 [Chrome DevTools 性能分析](https://developer.chrome.com/docs/devtools/performance/)
- 📊 [React Profiler](https://react.dev/reference/react/Profiler)

## 💡 提示

1. **定期运行性能测试** - 不要等到出现问题才运行
2. **记录性能数据** - 跟踪性能趋势
3. **优化前先测量** - 先确定瓶颈在哪里
4. **优化后再测量** - 验证优化效果
5. **真实数据测试** - 使用接近生产环境的数据量

---

**祝你优化愉快！** 🚀


