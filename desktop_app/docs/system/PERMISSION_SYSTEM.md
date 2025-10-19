# 权限系统文档

## 概述

Zishu Sensei 的权限系统是一个完整的、基于角色的权限管理系统（RBAC），用于控制适配器、工作流等组件对系统资源的访问。权限系统提供了细粒度的访问控制、审计日志、权限组管理等功能。

## 架构设计

### 核心组件

1. **权限定义层** (`permission.ts`)
   - 定义权限类型、权限级别、权限分类
   - 提供权限元数据和描述信息
   - 支持权限继承和权限组

2. **数据库层** (`database/permission.rs`)
   - 管理权限定义、权限授权、使用日志
   - 提供高效的权限查询和存储
   - 支持权限历史和审计

3. **权限检查器** (`utils/permission_checker.rs`)
   - 实时权限验证
   - 权限级别检查（只读、读写、完全控制）
   - 范围（Scope）限制检查

4. **命令层** (`commands/permission.rs`)
   - 提供 Tauri 命令接口
   - 处理前端权限请求
   - 发送权限事件通知

5. **前端服务层** (`services/permissionService.ts`)
   - 封装权限 API 调用
   - 提供便捷的权限管理方法
   - 权限配置导入导出

6. **React 组件层**
   - 权限对话框 (`PermissionDialog.tsx`)
   - 权限管理面板 (`PermissionManagementPanel.tsx`)
   - 权限使用日志 (`PermissionUsageLogs.tsx`)

## 权限类型

### 文件系统权限

| 权限类型 | 描述 | 危险级别 |
|---------|------|----------|
| `FILE_READ` | 读取文件内容 | 中等 |
| `FILE_WRITE` | 写入文件内容 | 高 |
| `FILE_DELETE` | 删除文件 | 严重 |
| `FILE_EXECUTE` | 执行文件 | 严重 |
| `DIRECTORY_LIST` | 列出目录内容 | 低 |
| `DIRECTORY_CREATE` | 创建目录 | 中等 |

### 网络权限

| 权限类型 | 描述 | 危险级别 |
|---------|------|----------|
| `NETWORK_HTTP` | HTTP 请求 | 中等 |
| `NETWORK_HTTPS` | HTTPS 请求 | 中等 |
| `NETWORK_WEBSOCKET` | WebSocket 连接 | 中等 |
| `NETWORK_TCP` | TCP 连接 | 高 |
| `NETWORK_UDP` | UDP 连接 | 高 |
| `NETWORK_DNS` | DNS 查询 | 低 |

### 系统权限

| 权限类型 | 描述 | 危险级别 |
|---------|------|----------|
| `SYSTEM_INFO` | 系统信息 | 低 |
| `SYSTEM_ENV` | 环境变量 | 高 |
| `SYSTEM_SHELL` | Shell 执行 | 严重 |
| `SYSTEM_PROCESS` | 进程管理 | 严重 |
| `SYSTEM_CLIPBOARD` | 剪贴板访问 | 中等 |
| `SYSTEM_NOTIFICATION` | 通知 | 低 |

### 应用权限

| 权限类型 | 描述 | 危险级别 |
|---------|------|----------|
| `APP_DATABASE` | 应用数据库 | 高 |
| `APP_CONFIG` | 应用配置 | 高 |
| `APP_STORAGE` | 应用存储 | 中等 |
| `APP_CHAT_HISTORY` | 聊天记录 | 高 |
| `APP_FILE_UPLOAD` | 文件上传 | 中等 |

### 用户数据权限

| 权限类型 | 描述 | 危险级别 |
|---------|------|----------|
| `USER_PROFILE` | 用户信息 | 高 |
| `USER_CONTACTS` | 联系人 | 高 |
| `USER_LOCATION` | 地理位置 | 严重 |
| `USER_CAMERA` | 摄像头 | 严重 |
| `USER_MICROPHONE` | 麦克风 | 严重 |

## 权限级别

权限系统支持三个权限级别：

### 1. 只读 (READ_ONLY)
- 仅允许读取操作
- 不能修改或删除数据
- 适用于查看类功能

### 2. 读写 (READ_WRITE)
- 允许读取和写入操作
- 可以创建和修改数据
- 不能执行危险操作

### 3. 完全控制 (FULL)
- 允许所有操作
- 包括删除和执行
- 需要特别授权

## 权限范围 (Scope)

权限可以通过 Scope 进一步限制访问范围：

### 文件系统 Scope
```
/path/to/directory/*      - 目录及子文件
/path/to/specific/file    - 特定文件
~/Documents/*             - 用户文档目录
```

### 网络 Scope
```
https://api.example.com/*  - 特定域名
https://*.example.com/*    - 域名及子域
http://localhost:*         - 本地服务
```

### 数据库 Scope
```
table:users               - 特定表
schema:public             - 特定模式
database:main             - 特定数据库
```

## 权限状态

权限授权具有以下状态：

| 状态 | 描述 |
|------|------|
| `PENDING` | 等待用户批准 |
| `GRANTED` | 已授予 |
| `DENIED` | 已拒绝 |
| `REVOKED` | 已撤销 |
| `EXPIRED` | 已过期 |

## 使用示例

### 前端使用

#### 1. 检查权限

```typescript
import { checkPermission } from '@/services/permissionService';
import { PermissionType, PermissionLevel } from '@/types/permission';

// 检查适配器是否有文件读取权限
const hasPermission = await checkPermission({
  entity_type: 'adapter',
  entity_id: 'my-adapter',
  permission_type: PermissionType.FILE_READ,
  level: PermissionLevel.READ_ONLY,
});

if (hasPermission) {
  // 执行需要权限的操作
}
```

#### 2. 请求权限

```typescript
import { requestPermission } from '@/services/permissionService';

// 请求网络访问权限
const grantId = await requestPermission({
  entity_type: 'adapter',
  entity_id: 'my-adapter',
  permission_type: PermissionType.NETWORK_HTTP,
  level: PermissionLevel.READ_WRITE,
  scope: 'https://api.example.com/*',
  reason: '需要访问外部 API',
});
```

#### 3. 使用 React Hooks

```typescript
import { useEntityGrants, usePermissionCheck } from '@/hooks/usePermission';

function MyComponent() {
  // 获取实体的所有权限
  const { grants, loading, grant, revoke } = useEntityGrants('adapter', 'my-adapter');
  
  // 检查特定权限
  const { granted } = usePermissionCheck(
    'adapter',
    'my-adapter',
    PermissionType.FILE_READ,
    PermissionLevel.READ_ONLY
  );
  
  return (
    <div>
      {granted ? <p>有权限</p> : <p>无权限</p>}
      <button onClick={() => grant(PermissionType.FILE_READ, PermissionLevel.READ_ONLY)}>
        授予权限
      </button>
    </div>
  );
}
```

#### 4. 使用权限预设

```typescript
import { applyPermissionPreset, PERMISSION_PRESETS } from '@/services/permissionService';

// 应用基础适配器权限预设
await applyPermissionPreset('adapter', 'my-adapter', 'BASIC_ADAPTER', 'user');

// 应用受信任适配器权限预设
await applyPermissionPreset('adapter', 'my-adapter', 'TRUSTED', 'user');
```

### 后端使用

#### 1. 在适配器中检查权限

```rust
use crate::utils::permission_checker::PermissionChecker;
use crate::database::permission::{PermissionType, PermissionLevel};

async fn read_file(adapter_id: &str, file_path: &str) -> Result<String, String> {
    let checker = PermissionChecker::new(db_pool).await?;
    
    // 检查权限
    let has_permission = checker
        .check_permission(
            "adapter",
            adapter_id,
            PermissionType::FileRead,
            PermissionLevel::ReadOnly,
            Some(file_path),
        )
        .await?;
    
    if !has_permission {
        return Err("没有文件读取权限".to_string());
    }
    
    // 记录权限使用
    checker
        .log_usage(
            "adapter",
            adapter_id,
            PermissionType::FileRead,
            PermissionLevel::ReadOnly,
            Some(file_path),
            true,
            None,
            None,
        )
        .await?;
    
    // 执行文件读取
    // ...
}
```

#### 2. 在命令中请求权限

```rust
use crate::commands::permission::request_permission;

#[tauri::command]
async fn my_command(app: AppHandle) -> Result<(), String> {
    let request = PermissionRequest {
        entity_type: "adapter".to_string(),
        entity_id: "my-adapter".to_string(),
        permission_type: PermissionType::NetworkHttp,
        level: PermissionLevel::ReadWrite,
        scope: Some("https://api.example.com/*".to_string()),
        reason: Some("需要访问外部 API".to_string()),
    };
    
    let grant_id = request_permission(app, request).await?;
    
    // 等待用户批准...
    
    Ok(())
}
```

## 权限对话框

当适配器或工作流请求权限时，会弹出权限对话框：

### 对话框功能

1. **显示请求信息**
   - 请求者身份（适配器/应用）
   - 权限名称和描述
   - 权限级别
   - 访问范围

2. **风险提示**
   - 危险权限警告
   - 风险级别标识
   - 安全建议

3. **授权选项**
   - 授权有效期（永久/1小时/1天/7天/30天）
   - 批准/拒绝操作
   - 拒绝原因记录

### 自定义对话框

```typescript
import { PermissionDialog } from '@/components/Permission/PermissionDialog';
import { usePermissionDialog } from '@/hooks/usePermissionDialog';

function MyApp() {
  const dialog = usePermissionDialog();
  
  return (
    <PermissionDialog
      visible={dialog.visible}
      grant={dialog.grant}
      permission={dialog.permission}
      loading={dialog.loading}
      onApprove={dialog.approve}
      onReject={dialog.reject}
      onClose={dialog.hide}
    />
  );
}
```

## 权限管理面板

权限管理面板提供完整的权限管理功能：

### 功能特性

1. **权限列表**
   - 查看所有可用权限
   - 按分类筛选
   - 按状态筛选
   - 搜索权限

2. **权限授权**
   - 批量授予权限
   - 单个授予/撤销
   - 设置有效期
   - 设置访问范围

3. **统计信息**
   - 总授权数
   - 活跃授权数
   - 待审核数
   - 已拒绝数

4. **快速预设**
   - 基础适配器
   - 文件处理器
   - 网络服务
   - 数据分析器
   - 系统工具
   - 受信任

### 使用管理面板

```typescript
import { PermissionManagementPanel } from '@/components/Permission/PermissionManagementPanel';

function AdapterSettings() {
  return (
    <PermissionManagementPanel
      entityType="adapter"
      entityId="my-adapter"
      entityName="我的适配器"
    />
  );
}
```

## 权限使用日志

权限系统会记录所有权限使用情况：

### 日志内容

- 使用时间
- 实体信息（类型、ID）
- 权限类型和级别
- 访问范围
- 成功/失败状态
- 错误信息（如果失败）
- 元数据

### 查看日志

```typescript
import { PermissionUsageLogs } from '@/components/Permission/PermissionUsageLogs';

function LogsView() {
  return (
    <PermissionUsageLogs
      entityType="adapter"
      entityId="my-adapter"
      limit={50}
    />
  );
}
```

### 获取统计信息

```typescript
import { getPermissionStats } from '@/services/permissionService';

const stats = await getPermissionStats('adapter', 'my-adapter');

console.log('总使用次数:', stats.total_usage);
console.log('成功次数:', stats.successful_usage);
console.log('失败次数:', stats.failed_usage);
console.log('最后使用时间:', stats.last_used);
```

## 权限组

权限组允许将多个权限打包在一起：

### 创建权限组

```typescript
import { createPermissionGroup } from '@/services/permissionService';

const groupId = await createPermissionGroup({
  name: 'web_scraper',
  display_name: 'Web 抓取器',
  description: '网页抓取所需的权限组',
  permissions: [
    { 
      permission_type: PermissionType.NETWORK_HTTP,
      level: PermissionLevel.READ_ONLY 
    },
    { 
      permission_type: PermissionType.FILE_WRITE,
      level: PermissionLevel.READ_WRITE,
      scope: '/tmp/scraped_data/*'
    },
  ],
});
```

### 授予权限组

```typescript
import { grantPermissionGroup } from '@/services/permissionService';

await grantPermissionGroup({
  entity_type: 'adapter',
  entity_id: 'my-scraper',
  group_name: 'web_scraper',
  granted_by: 'user',
});
```

## 安全最佳实践

### 1. 最小权限原则

只请求必需的权限，避免过度请求：

```typescript
// ❌ 不好 - 请求过多权限
await requestPermission({
  permission_type: PermissionType.FILE_WRITE,
  level: PermissionLevel.FULL,  // 完全控制
});

// ✅ 好 - 只请求必需的权限
await requestPermission({
  permission_type: PermissionType.FILE_WRITE,
  level: PermissionLevel.READ_WRITE,  // 读写
  scope: '/tmp/my-app/*',  // 限制范围
});
```

### 2. 明确权限原因

在请求权限时提供清晰的原因：

```typescript
await requestPermission({
  permission_type: PermissionType.NETWORK_HTTP,
  level: PermissionLevel.READ_ONLY,
  reason: '需要从天气 API 获取实时天气数据',  // 清晰的原因
});
```

### 3. 设置合理的有效期

对于临时操作，设置权限有效期：

```typescript
const expiresAt = new Date();
expiresAt.setHours(expiresAt.getHours() + 1);  // 1小时后过期

await grantPermission({
  permission_type: PermissionType.FILE_READ,
  level: PermissionLevel.READ_ONLY,
  expires_at: expiresAt.toISOString(),
});
```

### 4. 定期审计权限

定期检查和清理不必要的权限：

```typescript
// 清理过期权限
const cleaned = await cleanupExpiredGrants();
console.log(`清理了 ${cleaned} 个过期权限`);

// 查看待审核权限
const pending = await getPendingGrants();
if (pending.length > 0) {
  console.log(`有 ${pending.length} 个待审核权限`);
}
```

### 5. 监控权限使用

定期查看权限使用日志，发现异常行为：

```typescript
const logs = await getPermissionUsageLogs({
  permissionType: PermissionType.FILE_WRITE,
  limit: 100,
});

// 检查失败的权限使用
const failed = logs.filter(log => !log.success);
if (failed.length > 10) {
  console.warn('检测到大量权限失败，可能存在问题');
}
```

## 数据库结构

### permissions 表

存储权限定义：

```sql
CREATE TABLE permissions (
    id INTEGER PRIMARY KEY,
    permission_type TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    display_name TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL,
    is_dangerous INTEGER NOT NULL DEFAULT 0,
    requires_user_approval INTEGER NOT NULL DEFAULT 1,
    can_be_revoked INTEGER NOT NULL DEFAULT 1,
    default_level TEXT NOT NULL DEFAULT 'readonly',
    metadata TEXT,
    created_at TEXT NOT NULL
);
```

### permission_grants 表

存储权限授权：

```sql
CREATE TABLE permission_grants (
    id INTEGER PRIMARY KEY,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    permission_type TEXT NOT NULL,
    level TEXT NOT NULL,
    status TEXT NOT NULL,
    scope TEXT,
    granted_at TEXT NOT NULL,
    granted_by TEXT,
    expires_at TEXT,
    revoked_at TEXT,
    revoked_by TEXT,
    revoke_reason TEXT,
    request_reason TEXT,
    metadata TEXT
);
```

### permission_usage_logs 表

存储权限使用日志：

```sql
CREATE TABLE permission_usage_logs (
    id INTEGER PRIMARY KEY,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    permission_type TEXT NOT NULL,
    level TEXT NOT NULL,
    scope TEXT,
    used_at TEXT NOT NULL,
    success INTEGER NOT NULL,
    error_message TEXT,
    metadata TEXT
);
```

## 性能优化

### 1. 权限缓存

权限检查结果会被缓存，减少数据库查询：

```rust
// 权限检查器内部使用缓存
let checker = PermissionChecker::new(db_pool).await?;
let has_permission = checker.check_permission(...).await?;  // 首次查询
let has_permission = checker.check_permission(...).await?;  // 使用缓存
```

### 2. 批量操作

使用批量操作提高效率：

```typescript
// 批量授予权限
await batchGrantPermissions(
  'adapter',
  'my-adapter',
  [
    { type: PermissionType.FILE_READ, level: PermissionLevel.READ_ONLY },
    { type: PermissionType.FILE_WRITE, level: PermissionLevel.READ_WRITE },
    { type: PermissionType.NETWORK_HTTP, level: PermissionLevel.READ_ONLY },
  ]
);
```

### 3. 定期清理

定期清理过期权限和旧日志：

```typescript
// 清理过期权限
await cleanupExpiredGrants();

// 清理旧日志（保留最近30天）
await cleanupOldLogs(30);
```

## 故障排查

### 权限检查失败

如果权限检查失败，检查以下几点：

1. 权限是否已授予
2. 权限级别是否足够
3. 权限是否已过期
4. 访问范围是否匹配

### 权限对话框不显示

检查以下问题：

1. 是否正确监听权限事件
2. 是否正确注册对话框组件
3. 是否存在 JavaScript 错误

### 权限持久化问题

如果权限无法持久化：

1. 检查数据库连接
2. 检查数据库表是否存在
3. 检查文件权限

## 总结

Zishu Sensei 的权限系统提供了：

- ✅ 细粒度的权限控制
- ✅ 完整的审计日志
- ✅ 用户友好的界面
- ✅ 灵活的权限组
- ✅ 安全的权限检查
- ✅ 高性能的实现

通过合理使用权限系统，可以确保应用的安全性和用户数据的隐私。

