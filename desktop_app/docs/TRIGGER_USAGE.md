# 工作流触发器使用指南

本文档介绍了 Zishu Sensei 工作流系统中的触发器功能及其使用方法。

## 概述

触发器是自动启动工作流执行的机制。Zishu Sensei 支持三种类型的触发器:

1. **事件触发器** - 响应系统事件
2. **Webhook 触发器** - 通过 HTTP 请求触发
3. **定时任务** - 按计划自动执行

## 事件触发器

### 支持的事件类型

- `FileCreated` - 文件创建事件
- `FileModified` - 文件修改事件
- `FileDeleted` - 文件删除事件
- `SystemStartup` - 系统启动事件
- `SystemShutdown` - 系统关闭事件
- `TimeSchedule` - 时间调度事件
- `UserLogin` - 用户登录事件
- `UserLogout` - 用户登出事件
- `Custom` - 自定义事件

### 创建事件触发器

```typescript
import workflowService from './services/workflowService';

// 创建文件创建事件触发器
const triggerId = await workflowService.eventTrigger.createTrigger({
  workflow_id: 'my-workflow-id',
  event_type: 'FileCreated',
  condition: "event.path.endsWith('.txt')", // 可选: 仅对 .txt 文件触发
  enabled: true,
  description: '当创建文本文件时触发',
});
```

### 条件表达式

条件表达式是可选的 JavaScript 表达式，用于过滤事件。表达式中可以访问 `event` 对象。

示例:

```javascript
// 只处理特定目录下的文件
event.path.startsWith('/data/')

// 只处理大于 1MB 的文件
event.size > 1024 * 1024

// 复杂条件
event.path.endsWith('.pdf') && event.size < 10 * 1024 * 1024
```

### 列出事件触发器

```typescript
// 列出特定工作流的触发器
const triggers = await workflowService.eventTrigger.listTriggers('workflow-id');

// 列出所有触发器
const allTriggers = await workflowService.eventTrigger.listTriggers();
```

### 删除事件触发器

```typescript
await workflowService.eventTrigger.removeTrigger('trigger-id');
```

### 手动触发事件

用于测试或手动触发工作流:

```typescript
const executionIds = await workflowService.eventTrigger.triggerEvent(
  'FileCreated',
  {
    path: '/test/file.txt',
    size: 1024,
    timestamp: new Date().toISOString(),
  }
);

console.log(`触发了 ${executionIds.length} 个工作流执行`);
```

## Webhook 触发器

### 创建 Webhook

```typescript
import workflowService from './services/workflowService';

const webhookId = await workflowService.webhookTrigger.createWebhook(
  'my-workflow-id',
  {
    secret: 'my-secret-key',           // 可选: 用于验证请求
    allowed_ips: ['192.168.1.100'],    // 可选: IP 白名单
    require_auth: true,                 // 是否需要认证
    timeout_seconds: 30,                // 超时时间
  }
);

console.log(`Webhook URL: http://localhost:3000/api/webhook/${webhookId}`);
```

### 调用 Webhook

使用 curl:

```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Secret: my-secret-key" \
  -d '{"data": "value"}' \
  http://localhost:3000/api/webhook/YOUR-WEBHOOK-ID
```

使用 JavaScript:

```javascript
const response = await fetch('http://localhost:3000/api/webhook/YOUR-WEBHOOK-ID', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Webhook-Secret': 'my-secret-key',
  },
  body: JSON.stringify({
    data: 'value',
    timestamp: new Date().toISOString(),
  }),
});

const result = await response.json();
console.log('Execution ID:', result.execution_id);
```

### 列出 Webhooks

```typescript
const webhooks = await workflowService.webhookTrigger.listWebhooks('workflow-id');

webhooks.forEach(([id, workflowId, config]) => {
  console.log(`Webhook ${id} for workflow ${workflowId}`);
  console.log(`Config:`, config);
});
```

### 删除 Webhook

```typescript
await workflowService.webhookTrigger.removeWebhook('webhook-id');
```

### Webhook 安全最佳实践

1. **使用密钥验证**: 设置 `secret` 并在请求中包含 `X-Webhook-Secret` 头
2. **IP 白名单**: 限制可以调用 webhook 的 IP 地址
3. **启用认证**: 设置 `require_auth: true`
4. **合理设置超时**: 根据工作流复杂度设置 `timeout_seconds`

## 定时任务

定时任务使用 Cron 表达式来配置执行计划。详见工作流调度器文档。

### 常用 Cron 表达式

```
# 每天凌晨 2 点执行
0 2 * * *

# 每小时执行一次
0 * * * *

# 每周一上午 9 点执行
0 9 * * 1

# 每月 1 号中午 12 点执行
0 12 1 * *

# 每 5 分钟执行一次
*/5 * * * *
```

## 触发器管理界面

### 访问触发器管理页面

1. 导航到工作流详情页面
2. 点击"触发器"标签
3. 或直接访问: `/workflows/{workflowId}/triggers`

### 界面功能

- **查看触发器列表**: 显示所有配置的触发器
- **添加触发器**: 创建新的事件、Webhook 或定时触发器
- **编辑触发器**: 修改触发器配置
- **删除触发器**: 移除不需要的触发器
- **手动触发**: 测试触发器功能
- **查看历史**: 查看触发器执行历史记录

## 触发器执行流程

```
事件发生/Webhook调用/定时任务到期
        ↓
检查触发器是否启用
        ↓
评估条件表达式 (如有)
        ↓
创建工作流执行
        ↓
执行工作流
        ↓
记录执行结果
```

## 使用场景

### 1. 自动文件处理

```typescript
// 当有新的 CSV 文件上传时，自动处理
await workflowService.eventTrigger.createTrigger({
  workflow_id: 'csv-processor',
  event_type: 'FileCreated',
  condition: "event.path.endsWith('.csv') && event.path.startsWith('/uploads/')",
  enabled: true,
  description: '自动处理上传的 CSV 文件',
});
```

### 2. 远程触发部署

```typescript
// 创建部署 Webhook
const webhookId = await workflowService.webhookTrigger.createWebhook(
  'deployment-workflow',
  {
    secret: process.env.DEPLOY_SECRET,
    require_auth: true,
    timeout_seconds: 300, // 5 分钟
  }
);

// 在 CI/CD 中调用
// curl -X POST -H "X-Webhook-Secret: ${DEPLOY_SECRET}" \
//   http://server/api/webhook/${webhookId}
```

### 3. 定期数据备份

使用定时任务每天自动备份数据:

```
Cron: 0 3 * * *  (每天凌晨 3 点)
工作流: 数据库备份工作流
```

### 4. 系统监控和告警

```typescript
// 监控系统资源，定期检查
await workflowService.eventTrigger.createTrigger({
  workflow_id: 'system-monitor',
  event_type: 'TimeSchedule',
  enabled: true,
  description: '每 5 分钟检查系统资源使用情况',
});
```

## 故障排查

### 触发器未执行

1. 检查触发器是否启用
2. 检查条件表达式是否正确
3. 查看触发器历史记录中的错误信息
4. 验证工作流本身是否可以正常执行

### Webhook 调用失败

1. 检查 URL 是否正确
2. 验证密钥是否匹配
3. 确认 IP 地址在白名单中
4. 检查请求格式是否正确

### 性能优化

1. 使用条件表达式减少不必要的触发
2. 合理设置触发器数量
3. 避免在高频事件上使用复杂工作流
4. 使用异步执行模式

## API 参考

详细的 API 文档请参考:

- [Event Trigger API](./API.md#event-triggers)
- [Webhook API](./API.md#webhooks)
- [Scheduler API](./API.md#scheduler)

## 相关文档

- [工作流执行文档](./WORKFLOW_EXECUTION.md)
- [工作流调度器文档](./SCHEDULER.md)
- [表达式语法文档](./EXPRESSION_SYNTAX.md)

