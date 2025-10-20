# 性能测试套件

本目录包含桌面应用的性能测试，用于确保应用在各种场景下保持流畅和高效。

## 📋 测试文件

### 1. `render-performance.test.tsx`
**渲染性能测试**

测试组件的渲染性能，确保应用响应迅速。

**测试用例**:
- ✅ **ChatWindow 组件性能**
  - 首次渲染 < 50ms
  - 重新渲染 < 16ms (60fps)
  
- ✅ **MessageList 组件性能**
  - 100条消息渲染 < 200ms
  - 500条消息渲染 < 500ms
  - 1000条消息(虚拟滚动) < 300ms
  - 添加新消息 < 16ms
  
- ✅ **大列表滚动性能**
  - 1000条消息滚动平均FPS > 30
  - 虚拟滚动模式平均FPS > 50
  
- ✅ **复杂内容渲染**
  - 长文本消息 < 100ms
  - 代码块消息 < 50ms
  - 混合内容 < 80ms
  
- ✅ **并发渲染**
  - 连续添加消息性能稳定
  - 流式响应更新高效 (< 10ms/次)
  
- ✅ **内存使用**
  - 1000条消息内存增长 < 50MB
  - 卸载后释放 > 80% 内存

### 2. `memory-leak.test.tsx`
**内存泄漏测试**

测试组件是否正确清理资源，防止内存泄漏。

**测试用例**:
- ✅ **事件监听器清理**
  - ChatWindow 卸载清理所有监听器
  - MessageList 清理滚动监听器
  - 多次挂载不累积监听器
  
- ✅ **定时器清理**
  - setTimeout 正确清理
  - setInterval 正确清理
  - 流式响应定时器清理
  
- ✅ **requestAnimationFrame 清理**
  - 组件卸载取消所有RAF
  - 动画组件正确清理RAF
  
- ✅ **DOM 引用清理**
  - 卸载后无残留DOM节点
  - 虚拟滚动清理所有节点
  
- ✅ **长时间运行测试**
  - 长期运行内存增长 < 20MB
  - 持续更新释放 > 70% 内存
  
- ✅ **订阅和观察者清理**
  - IntersectionObserver 清理
  - ResizeObserver 清理

## 🚀 运行测试

### 运行所有性能测试
```bash
npm run test:performance
```

### 运行单个测试文件
```bash
# 渲染性能测试
npm run test -- tests/performance/render-performance.test.tsx

# 内存泄漏测试
npm run test -- tests/performance/memory-leak.test.tsx
```

### 运行特定测试用例
```bash
# 只测试 ChatWindow 性能
npm run test -- tests/performance/render-performance.test.tsx -t "ChatWindow"

# 只测试事件监听器清理
npm run test -- tests/performance/memory-leak.test.tsx -t "事件监听器清理"
```

### 启用垃圾回收（获取更准确的内存测试结果）
```bash
node --expose-gc ./node_modules/.bin/vitest run tests/performance/
```

## 📊 性能基准

### 渲染性能基准

| 指标 | 基准值 | 说明 |
|------|--------|------|
| 首次渲染 | < 50ms | ChatWindow 组件首次加载时间 |
| 重新渲染 | < 16ms | 保持 60fps 流畅度 |
| 100条消息 | < 200ms | 中等消息列表渲染时间 |
| 500条消息 | < 500ms | 大型消息列表渲染时间 |
| 1000条消息 (虚拟滚动) | < 300ms | 超大列表优化渲染 |
| 新消息添加 | < 16ms | 保持实时聊天流畅 |
| 流式更新 | < 10ms | 每次流式内容更新 |

### 滚动性能基准

| 场景 | 平均FPS | 最低FPS |
|------|---------|---------|
| 普通滚动 (1000条) | > 30 | > 20 |
| 虚拟滚动 (1000条) | > 50 | > 40 |
| 快速滚动 | > 40 | > 30 |

### 内存使用基准

| 指标 | 基准值 | 说明 |
|------|--------|------|
| 1000条消息内存 | < 50MB | 大列表内存占用 |
| 卸载后内存释放 | > 80% | 内存回收效率 |
| 长期运行增长 | < 20MB | 1小时内存增长 |
| 持续更新释放 | > 70% | 更新后内存回收 |

## 🔍 监控工具

测试套件包含以下监控工具：

### 1. EventListenerMonitor
监控事件监听器的添加和移除，检测监听器泄漏。

```typescript
const monitor = new EventListenerMonitor()
monitor.install()

// ... 执行测试 ...

const leakedListeners = monitor.getListenerCount()
monitor.uninstall()
```

### 2. TimerMonitor
监控 setTimeout 和 setInterval，检测定时器泄漏。

```typescript
const monitor = new TimerMonitor()
monitor.install()

// ... 执行测试 ...

const activeTimers = monitor.getTotalActiveCount()
monitor.uninstall()
```

### 3. RAFMonitor
监控 requestAnimationFrame，检测动画帧泄漏。

```typescript
const monitor = new RAFMonitor()
monitor.install()

// ... 执行测试 ...

const activeRAFs = monitor.getActiveRAFCount()
monitor.uninstall()
```

### 4. FPSMeter
测量帧率，评估滚动和动画性能。

```typescript
const meter = new FPSMeter()
meter.start()

// ... 执行滚动/动画 ...

const { average, min, max } = meter.stop()
console.log(`FPS: ${average.toFixed(2)} (min: ${min}, max: ${max})`)
```

## 🎯 最佳实践

### 编写性能测试

1. **设定明确的性能基准**
   ```typescript
   const renderTime = measureRenderTime(() => {
     render(<Component />)
   })
   expect(renderTime).toBeLessThan(50) // 明确的时间阈值
   ```

2. **测试真实场景**
   ```typescript
   // ❌ 不好 - 太少数据
   const messages = generateMessages(5)
   
   // ✅ 好 - 真实使用量
   const messages = generateMessages(100)
   ```

3. **包含清理验证**
   ```typescript
   const beforeCount = eventMonitor.getListenerCount()
   const { unmount } = render(<Component />)
   unmount()
   expect(eventMonitor.getListenerCount()).toBeLessThanOrEqual(beforeCount)
   ```

4. **记录性能数据**
   ```typescript
   console.log(`渲染时间: ${renderTime.toFixed(2)}ms`)
   console.log(`FPS: ${fpsStats.average.toFixed(2)}`)
   console.log(`内存增长: ${memoryGrowth.toFixed(2)}MB`)
   ```

### 调试性能问题

1. **使用 Chrome DevTools**
   ```bash
   # 运行应用
   npm run dev
   
   # 打开 DevTools
   # Performance tab -> Record -> 执行操作 -> Stop
   ```

2. **使用 React DevTools Profiler**
   ```bash
   # 在浏览器安装 React DevTools
   # Profiler tab -> Record -> 执行操作 -> Stop
   ```

3. **内存分析**
   ```bash
   # Chrome DevTools
   # Memory tab -> Take heap snapshot
   # 执行操作后再次 snapshot
   # Compare snapshots
   ```

4. **性能标记**
   ```typescript
   performance.mark('render-start')
   render(<Component />)
   performance.mark('render-end')
   performance.measure('render', 'render-start', 'render-end')
   ```

## 🐛 常见问题

### Q1: 测试运行很慢怎么办？

A: 性能测试通常比单元测试慢，但如果特别慢：
- 减少迭代次数
- 使用 `--run` 而不是 watch 模式
- 并行运行: `--threads`

```bash
npm run test -- tests/performance/ --run --threads
```

### Q2: 内存测试结果不稳定？

A: 内存测试受垃圾回收影响，可以：
- 启用 GC: `node --expose-gc`
- 增加等待时间让 GC 执行
- 多次运行取平均值
- 放宽阈值范围

### Q3: Performance.memory API 不可用？

A: 该 API 仅在 Chrome/Chromium 中可用：
- 使用 Chrome 浏览器运行测试
- 或跳过内存相关测试

### Q4: 如何设置合理的性能阈值？

A: 
1. 在开发机器上运行测试，记录基准值
2. 设置阈值为基准值的 1.2-1.5 倍
3. 根据 CI 环境调整
4. 定期审查和更新阈值

## 📈 持续监控

### 本地开发
```bash
# 在代码变更后运行性能测试
npm run test:performance

# 如果性能下降，分析原因并优化
```

### CI/CD 集成
```yaml
# .github/workflows/test.yml
- name: Run Performance Tests
  run: npm run test:performance
  
- name: Upload Performance Report
  uses: actions/upload-artifact@v2
  with:
    name: performance-report
    path: coverage/performance/
```

### 性能趋势跟踪
- 记录每次测试的性能数据
- 生成性能趋势图表
- 设置性能回归警报

## 🔗 相关资源

- [Vitest 文档](https://vitest.dev/)
- [React 性能优化](https://react.dev/learn/render-and-commit)
- [Web 性能](https://web.dev/performance/)
- [Chrome DevTools](https://developer.chrome.com/docs/devtools/)
- [Performance API](https://developer.mozilla.org/en-US/docs/Web/API/Performance)

## 📝 维护清单

- [ ] 定期审查和更新性能基准
- [ ] 添加新组件的性能测试
- [ ] 监控性能测试执行时间
- [ ] 优化缓慢的性能测试
- [ ] 记录性能优化历史
- [ ] 更新文档和最佳实践

---

**最后更新**: 2025-10-20  
**维护者**: Zishu Team

