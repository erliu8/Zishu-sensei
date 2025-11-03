# 桌面应用下载功能

## 功能概述

此功能模块提供桌面应用的打包和下载功能，用户可以：

1. 选择目标平台（Windows、macOS、Linux）
2. 创建打包任务
3. 实时查看打包进度
4. 下载打包完成的应用

## 特性

- ✅ 纯净桌面应用（不包含AI模型或工具）
- ✅ 默认集成官方紫舒 Live2D 模型
- ✅ 实时进度追踪
- ✅ 支持多平台打包
- ✅ 自动轮询任务状态

## 文件结构

```
desktop-download/
├── api/
│   ├── types.ts          # 类型定义
│   └── client.ts         # API客户端
├── hooks/
│   └── useDesktopDownload.ts  # React Hooks
├── components/
│   └── PackagingProgress.tsx  # 进度组件
└── index.ts              # 导出入口
```

## API 端点

### 创建打包任务
```typescript
POST /api/packaging
Body: {
  config: {
    app_name: string;
    version: string;
    models: string[];
    adapters: string[];
    character?: object;
    settings: object;
  },
  platform: 'windows' | 'macos' | 'linux'
}
```

### 获取任务状态
```typescript
GET /api/packaging/{task_id}/status
Response: {
  id: string;
  status: 'pending' | 'packaging' | 'completed' | 'failed';
  progress: number;
  download_url?: string;
  error_message?: string;
}
```

### 取消任务
```typescript
DELETE /api/packaging/{task_id}
```

## 使用示例

### 创建打包任务

```typescript
import { useCreatePackagingTask } from '@/features/desktop-download';

function MyComponent() {
  const createTask = useCreatePackagingTask();

  const handlePackage = async () => {
    const response = await createTask.mutateAsync({
      config: {
        app_name: '紫舒桌面应用',
        version: '1.0.0',
        models: [],
        adapters: [],
        character: {
          id: 'zishu_official',
          name: '紫舒',
          model_type: 'live2d',
        },
        settings: {},
      },
      platform: 'windows',
    });
    
    console.log('任务ID:', response.data.id);
  };

  return <button onClick={handlePackage}>创建打包任务</button>;
}
```

### 轮询任务状态

```typescript
import { usePackagingTaskStatus } from '@/features/desktop-download';

function TaskStatus({ taskId }: { taskId: string }) {
  const { data } = usePackagingTaskStatus(taskId, true);

  if (!data) return <div>加载中...</div>;

  const task = data.data;

  return (
    <div>
      <p>状态: {task.status}</p>
      <p>进度: {task.progress}%</p>
      {task.download_url && (
        <a href={task.download_url}>下载</a>
      )}
    </div>
  );
}
```

## 配置说明

### 官方紫舒角色配置

默认使用的角色配置：

```typescript
{
  id: 'zishu_official',
  name: '紫舒',
  model_type: 'live2d'
}
```

这是官方提供的紫舒 Live2D 模型，会默认打包到应用中。

### 平台要求

#### Windows
- OS: Windows 10 (64-bit) 或更高版本
- CPU: 4核心以上 (推荐 8核心)
- RAM: 16GB (推荐 32GB)
- Storage: 20GB (推荐 SSD)

#### macOS
- OS: macOS 11 Big Sur 或更高版本
- CPU: Apple Silicon 或 Intel Core i5 以上
- RAM: 16GB (推荐 32GB)
- Storage: 20GB (推荐 SSD)

#### Linux
- OS: Ubuntu 20.04+ / Fedora 35+ / Debian 11+
- CPU: 4核心以上 (推荐 8核心)
- RAM: 16GB (推荐 32GB)
- Storage: 20GB (推荐 SSD)

## 注意事项

1. **需要登录**: 创建打包任务需要用户登录
2. **轮询间隔**: 任务状态自动每2秒轮询一次
3. **任务限制**: 每个用户同时只能有一个正在进行的打包任务
4. **下载链接**: 完成后的下载链接有效期为24小时

## 开发指南

### 添加新平台

1. 在 `api/types.ts` 的 `Platform` 枚举中添加新平台
2. 在下载页面的 `PLATFORMS` 数组中添加平台信息
3. 确保后端支持该平台的打包

### 自定义打包配置

可以通过修改 `CreatePackagingTaskRequest` 来自定义打包配置：

```typescript
const request: CreatePackagingTaskRequest = {
  config: {
    app_name: '自定义应用名',
    version: '1.0.0',
    models: ['model1', 'model2'],  // 添加AI模型
    adapters: ['adapter1'],         // 添加适配器
    character: {
      id: 'custom_character',
      name: '自定义角色',
      model_type: 'live2d',
    },
    settings: {
      theme: 'dark',
      language: 'en-US',
    },
    branding: {
      logo: 'https://...',
      primary_color: '#1890ff',
    },
  },
  platform: 'windows',
};
```

## 故障排查

### 打包失败

1. 检查网络连接
2. 确认用户已登录
3. 查看错误消息
4. 检查后端服务日志

### 下载链接失效

下载链接有24小时有效期，过期后需要重新创建打包任务。

### 轮询未自动停止

确保任务状态为 `completed` 或 `failed` 时，`refetchInterval` 返回 `false`。

## 后续改进

- [ ] 支持打包历史记录
- [ ] 添加打包配置模板
- [ ] 支持批量打包
- [ ] 添加打包进度详细日志
- [ ] 支持断点续传下载

