# Zishu 工作流系统

完整的工作流编排和执行系统，提供统一的 API 供桌面应用和 Web 界面调用。

## 架构概览

```
┌─────────────────────┐       ┌─────────────────────┐
│  Desktop App        │       │   Web App           │
│  (Tauri)            │       │   (Browser)         │
└──────────┬──────────┘       └──────────┬──────────┘
           │                              │
           │  HTTP API                    │  HTTP API
           │                              │
           └──────────────┬───────────────┘
                          │
                ┌─────────▼──────────┐
                │  FastAPI Routes    │
                │  /api/workflows    │
                └─────────┬──────────┘
                          │
                ┌─────────▼──────────┐
                │  Workflow Service  │
                │  业务逻辑层         │
                └─────────┬──────────┘
                          │
           ┌──────────────┼──────────────┐
           │              │              │
  ┌────────▼────────┐ ┌──▼──────────┐ ┌─▼────────────┐
  │ Workflow Engine │ │  Scheduler  │ │  Repository  │
  │  执行引擎       │ │  调度器     │ │  数据访问    │
  └─────────────────┘ └─────────────┘ └──────────────┘
```

## 核心模块

### 1. 工作流服务 (`workflow_service.py`)

提供工作流的完整生命周期管理：

- **CRUD 操作**：创建、读取、更新、删除工作流
- **状态管理**：发布、归档、克隆工作流
- **执行管理**：启动、取消、监控工作流执行
- **模板管理**：从模板创建工作流

```python
from zishu.api.services.workflow_service import workflow_service

# 创建工作流
workflow = await workflow_service.create_workflow(
    session,
    user_id="user_123",
    workflow_data=WorkflowCreate(
        name="数据处理流程",
        slug="data-processing",
        definition={
            "nodes": [...],
            "edges": [...]
        }
    )
)

# 执行工作流
execution = await workflow_service.execute_workflow(
    session,
    workflow_id=workflow.id,
    user_id="user_123",
    input_data={"file_path": "/data/input.csv"}
)
```

### 2. 工作流引擎 (`engine.py`)

负责解析和执行工作流定义：

- 解析工作流节点和连接
- 构建执行图
- 按拓扑顺序执行节点
- 管理执行上下文和变量
- 处理节点间的数据传递

**支持的节点类型：**

- `START`: 开始节点
- `END`: 结束节点
- `ADAPTER`: 适配器调用节点
- `CONDITION`: 条件判断节点
- `LOOP`: 循环节点
- `DELAY`: 延迟节点
- `TRANSFORM`: 数据转换节点
- `HTTP`: HTTP 请求节点
- `SCRIPT`: 脚本执行节点

### 3. 节点执行器 (`executor.py`)

为每种节点类型提供具体的执行逻辑：

```python
class StartNodeExecutor(NodeExecutor):
    """开始节点执行器"""
    async def execute(self, node, context, results):
        # 标记工作流开始
        return {"message": "workflow_started"}

class AdapterNodeExecutor(NodeExecutor):
    """适配器节点执行器"""
    async def execute(self, node, context, results):
        # 调用适配器服务
        adapter_id = node["config"]["adapter_id"]
        result = await adapter_service.execute(adapter_id, params)
        return result
```

### 4. 工作流调度器 (`scheduler.py`)

提供定时和延迟执行功能：

- **Cron 调度**：使用 Cron 表达式定时执行
- **延迟执行**：指定延迟时间后执行
- **周期性执行**：周期性触发工作流

```python
from zishu.workflow.scheduler import workflow_scheduler

# 启动调度器
await workflow_scheduler.start()

# 添加定时任务（每天凌晨 2 点执行）
await workflow_scheduler.schedule_workflow(
    workflow_id="workflow_123",
    cron_expression="0 2 * * *",
    callback=execute_callback
)

# 延迟执行（1小时后执行）
await workflow_scheduler.schedule_delayed_execution(
    workflow_id="workflow_123",
    delay_seconds=3600,
    callback=execute_callback
)
```

## API 路由

### 工作流管理

#### 创建工作流
```http
POST /api/workflows
Content-Type: application/json

{
  "name": "我的工作流",
  "slug": "my-workflow",
  "description": "工作流描述",
  "definition": {
    "nodes": [
      {
        "id": "start_1",
        "type": "start",
        "config": {}
      },
      {
        "id": "adapter_1",
        "type": "adapter",
        "config": {
          "adapter_id": "text-generation",
          "parameters": {...}
        }
      },
      {
        "id": "end_1",
        "type": "end",
        "config": {
          "output": {
            "result": "${adapter_1.output}"
          }
        }
      }
    ],
    "edges": [
      {"source": "start_1", "target": "adapter_1"},
      {"source": "adapter_1", "target": "end_1"}
    ]
  },
  "trigger_type": "manual"
}
```

#### 获取工作流列表
```http
GET /api/workflows?skip=0&limit=20
```

#### 获取工作流详情
```http
GET /api/workflows/{workflow_id}
```

#### 更新工作流
```http
PUT /api/workflows/{workflow_id}
Content-Type: application/json

{
  "name": "更新后的名称",
  "description": "更新后的描述"
}
```

#### 删除工作流
```http
DELETE /api/workflows/{workflow_id}
```

### 工作流执行

#### 执行工作流
```http
POST /api/workflows/{workflow_id}/execute
Content-Type: application/json

{
  "input_data": {
    "param1": "value1",
    "param2": "value2"
  },
  "execution_mode": "manual"
}
```

#### 获取执行历史
```http
GET /api/workflows/{workflow_id}/executions?skip=0&limit=20
```

#### 获取执行详情
```http
GET /api/workflows/executions/{execution_id}
```

#### 取消执行
```http
POST /api/workflows/executions/{execution_id}/cancel
```

### 工作流状态管理

#### 发布工作流
```http
POST /api/workflows/{workflow_id}/publish
```

#### 归档工作流
```http
POST /api/workflows/{workflow_id}/archive
```

#### 克隆工作流
```http
POST /api/workflows/{workflow_id}/clone
Content-Type: application/json

{
  "new_name": "克隆的工作流"
}
```

### 搜索

#### 搜索工作流
```http
GET /api/workflows/search/query?keyword=数据处理&status=active&category=ai
```

### 模板

#### 获取模板列表
```http
GET /api/workflows/templates/list?limit=20
```

#### 从模板创建工作流
```http
POST /api/workflows/templates/{template_id}/create
Content-Type: application/json

{
  "name": "从模板创建的工作流",
  "parameters": {
    "param1": "value1"
  }
}
```

## 工作流定义格式

### 基本结构

```json
{
  "nodes": [
    {
      "id": "node_id",
      "type": "node_type",
      "config": {
        // 节点特定配置
      }
    }
  ],
  "edges": [
    {
      "source": "source_node_id",
      "target": "target_node_id",
      "condition": "optional_condition"
    }
  ]
}
```

### 节点配置示例

#### 开始节点
```json
{
  "id": "start_1",
  "type": "start",
  "config": {}
}
```

#### 适配器节点
```json
{
  "id": "adapter_1",
  "type": "adapter",
  "config": {
    "adapter_id": "text-generation",
    "parameters": {
      "prompt": "生成一段文本",
      "max_tokens": 100
    },
    "output_variable": "generated_text"
  }
}
```

#### 条件节点
```json
{
  "id": "condition_1",
  "type": "condition",
  "config": {
    "condition": "variables['score'] > 0.8"
  }
}
```

#### 延迟节点
```json
{
  "id": "delay_1",
  "type": "delay",
  "config": {
    "delay_seconds": 5
  }
}
```

#### 结束节点
```json
{
  "id": "end_1",
  "type": "end",
  "config": {
    "output": {
      "result": "${generated_text}",
      "timestamp": "${current_time}"
    }
  }
}
```

## 数据库模型

### Workflow（工作流）

- `id`: UUID，主键
- `user_id`: 所属用户
- `name`: 工作流名称
- `slug`: 唯一标识符
- `description`: 描述
- `category`: 分类
- `tags`: 标签列表
- `workflow_status`: 状态（draft/active/paused/archived/deleted）
- `definition`: 工作流定义（JSONB）
- `trigger_type`: 触发器类型
- `trigger_config`: 触发器配置
- `execution_count`: 执行次数
- `success_count`: 成功次数
- `failure_count`: 失败次数

### WorkflowExecution（执行记录）

- `id`: UUID，主键
- `workflow_id`: 关联的工作流
- `user_id`: 执行用户
- `execution_status`: 执行状态（pending/running/completed/failed/cancelled）
- `execution_mode`: 执行模式（manual/scheduled/webhook/event）
- `input_data`: 输入数据（JSONB）
- `output_data`: 输出数据（JSONB）
- `node_results`: 节点执行结果（JSONB）
- `error_message`: 错误信息
- `started_at`: 开始时间
- `completed_at`: 完成时间
- `duration_ms`: 执行时长（毫秒）

## 集成到桌面应用

### Tauri 命令调用

桌面应用不再需要本地的工作流引擎，直接通过 HTTP API 调用核心服务：

```typescript
// 创建工作流
const workflow = await fetch('http://localhost:8000/api/workflows', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: '数据处理流程',
    slug: 'data-processing',
    definition: workflowDefinition,
  }),
});

// 执行工作流
const execution = await fetch(`http://localhost:8000/api/workflows/${workflowId}/execute`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    input_data: { file_path: '/data/input.csv' },
  }),
});

// 查询执行状态
const status = await fetch(`http://localhost:8000/api/workflows/executions/${executionId}`);
```

## 扩展节点类型

要添加新的节点类型：

1. 在 `executor.py` 中创建新的执行器类
2. 在 `engine.py` 中注册执行器
3. 更新 `NodeType` 枚举（在模型中）

示例：

```python
# executor.py
class CustomNodeExecutor(NodeExecutor):
    """自定义节点执行器"""
    
    async def execute(self, node, context, results):
        config = node.get("config", {})
        # 实现自定义逻辑
        result = await custom_processing(config)
        return result

# engine.py
def _register_default_executors(self):
    # ... 现有注册
    self.node_executors[NodeType.CUSTOM] = CustomNodeExecutor()
```

## TODO

- [ ] 实现工作流版本控制
- [ ] 添加工作流导入/导出功能
- [ ] 实现 Webhook 触发器
- [ ] 实现事件触发器
- [ ] 添加工作流可视化编辑器
- [ ] 实现工作流执行暂停/恢复
- [ ] 添加工作流执行日志查看
- [ ] 实现工作流权限控制
- [ ] 添加工作流执行统计和分析
- [ ] 实现安全的脚本节点沙箱

## 许可证

MIT License
