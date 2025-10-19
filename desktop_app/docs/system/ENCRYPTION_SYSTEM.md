# 紫舒老师桌面应用 - 数据加密系统文档

> 生成日期：2025-10-19  
> 版本：v1.0.0  
> 状态：已完成并可用

---

## 📋 概述

本文档详细描述了紫舒老师桌面应用的数据加密系统，该系统提供了全面且健壮的数据保护功能，包括：

- **本地数据加密存储** - 保护敏感配置和用户数据
- **密钥管理** - 安全的密钥生成、存储和轮换
- **通信加密** - 保护网络传输的数据
- **敏感信息脱敏** - 防止敏感信息泄露
- **安全审计日志** - 记录所有安全相关操作

---

## 🏗️ 系统架构

### 技术栈

**后端（Rust）**:
- `aes-gcm 0.10` - AES-256-GCM 加密
- `argon2 0.5` - 密钥派生（PBKDF2/Argon2）
- `keyring 2.2` - 系统密钥链集成
- `ring 0.17` - 额外的加密工具
- `rusqlite 0.29` - 加密字段存储

**前端（TypeScript/React）**:
- Tauri API - 与后端通信
- React Hooks - 状态管理和业务逻辑
- TypeScript - 类型安全

### 核心模块

```
src-tauri/src/
├── utils/
│   ├── encryption.rs          # AES-GCM 加密工具
│   ├── key_manager.rs         # 密钥管理器
│   ├── security_audit.rs      # 安全审计日志
│   └── data_masking.rs        # 敏感信息脱敏
├── database/
│   └── encrypted_storage.rs   # 加密字段存储
└── commands/
    └── encryption.rs          # Tauri 命令接口

src/
├── types/
│   └── encryption.ts          # TypeScript 类型定义
├── services/
│   └── encryptionService.ts   # 加密服务封装
└── hooks/
    └── useEncryption.ts       # React Hooks
```

---

## 🔐 核心功能

### 1. 数据加密/解密

#### AES-256-GCM 加密

使用业界标准的 AES-256-GCM 认证加密算法，提供：
- **机密性** - 数据加密
- **完整性** - 防止篡改
- **认证** - 验证数据来源

**Rust 示例**:
```rust
use crate::utils::encryption::{EncryptionManager, generate_random_key};

// 生成随机密钥
let key = generate_random_key()?;
let manager = EncryptionManager::new(key);

// 加密
let plaintext = "敏感数据";
let encrypted = manager.encrypt_string(plaintext)?;

// 解密
let decrypted = manager.decrypt_string(&encrypted)?;
assert_eq!(plaintext, decrypted);
```

**TypeScript 示例**:
```typescript
import { encryptionService } from '@/services/encryptionService';

// 加密
const { encrypted_data, derivation_params } = await encryptionService.quickEncrypt(
  password,
  plaintext
);

// 解密
const decrypted = await encryptionService.quickDecrypt(
  password,
  encrypted_data,
  derivation_params
);
```

**React Hook 示例**:
```typescript
import { useEncryption } from '@/hooks/useEncryption';

function MyComponent() {
  const { encryptText, decryptText, isEncrypting } = useEncryption();

  const handleEncrypt = async () => {
    try {
      const result = await encryptText('my-password', 'secret data');
      console.log('加密成功:', result);
    } catch (error) {
      console.error('加密失败:', error);
    }
  };

  return <button onClick={handleEncrypt} disabled={isEncrypting}>加密</button>;
}
```

---

### 2. 密钥管理

#### 系统密钥链集成

使用操作系统的密钥链安全存储主密钥：
- **Windows** - Windows Credential Manager
- **macOS** - Keychain
- **Linux** - Secret Service API

#### Argon2 密钥派生

使用 Argon2id 算法从密码派生加密密钥：
- **内存困难** - 防止 GPU 暴力破解
- **时间困难** - 增加暴力破解成本
- **并行化** - 利用多核 CPU

**生成主密钥**:
```rust
use crate::utils::key_manager::GLOBAL_KEY_MANAGER;

// 生成新的主密钥
let key_info = GLOBAL_KEY_MANAGER.generate_master_key(
    "app-main-key",
    "user-password",
    "应用主密钥",
    Some(365), // 365 天后过期
)?;
```

**TypeScript 示例**:
```typescript
import { encryptionService } from '@/services/encryptionService';

// 生成主密钥
const keyInfo = await encryptionService.generateMasterKey({
  key_id: 'app-main-key',
  password: 'user-password',
  purpose: '应用主密钥',
  expires_in_days: 365,
});

// 加载密钥
await encryptionService.loadKey('app-main-key', 'user-password');

// 轮换密钥
await encryptionService.rotateKey({
  key_id: 'app-main-key',
  old_password: 'old-password',
  new_password: 'new-password',
});
```

**React Hook 示例**:
```typescript
import { useKeyManager } from '@/hooks/useEncryption';

function KeyManagement() {
  const { generateKey, loadKey, rotateKey, keys } = useKeyManager();

  const handleGenerateKey = async () => {
    await generateKey('my-key', 'password', '测试密钥', 365);
  };

  return (
    <div>
      <button onClick={handleGenerateKey}>生成密钥</button>
      {Object.entries(keys).map(([id, info]) => (
        <div key={id}>{info.purpose}</div>
      ))}
    </div>
  );
}
```

---

### 3. 加密字段存储

#### 透明加密

在数据库中透明地加密敏感字段：

**支持的字段类型**:
- `ApiKey` - API 密钥
- `Password` - 密码
- `Token` - 访问令牌
- `SensitiveConfig` - 敏感配置
- `PersonalInfo` - 个人信息
- `Custom(String)` - 自定义类型

**Rust 示例**:
```rust
use crate::database::encrypted_storage::{EncryptedStorage, EncryptedFieldType};

let storage = EncryptedStorage::new(&db_path)?;

// 存储加密字段
storage.store(
    "openai-api-key",
    EncryptedFieldType::ApiKey,
    "sk-1234567890abcdef",
    Some("adapter-openai"),
    &manager,
)?;

// 检索并解密
let api_key = storage.retrieve("openai-api-key", &manager)?;

// 删除
storage.delete("openai-api-key")?;
```

**TypeScript 示例**:
```typescript
// 存储加密字段
await encryptionService.storeEncryptedField({
  id: 'openai-api-key',
  field_type: 'api_key',
  plaintext: 'sk-1234567890abcdef',
  entity_id: 'adapter-openai',
  key_id: 'app-main-key',
  password: 'user-password',
});

// 检索
const apiKey = await encryptionService.retrieveEncryptedField({
  id: 'openai-api-key',
  key_id: 'app-main-key',
  password: 'user-password',
});

// 删除
await encryptionService.deleteEncryptedField('openai-api-key');
```

---

### 4. 敏感信息脱敏

#### 自动检测和脱敏

自动检测并脱敏日志、调试输出中的敏感信息：

**支持的数据类型**:
- API 密钥（OpenAI, Anthropic 等）
- JWT Token
- Bearer Token
- 电子邮件
- 电话号码
- 身份证号
- 信用卡号
- IP 地址

**Rust 示例**:
```rust
use crate::utils::data_masking::{DataMasker, quick_mask, SensitiveDataType};

let masker = DataMasker::new();

// 自动检测并脱敏
let text = "API Key: sk-1234567890abcdef, Email: user@example.com";
let masked = masker.mask_all_sensitive(text);
// 输出: "API Key: sk-1234********cdef, Email: us***@example.com"

// 脱敏特定类型
let api_key = "sk-1234567890abcdef";
let masked_key = quick_mask(api_key, SensitiveDataType::ApiKey);
// 输出: "sk-1234********cdef"
```

**TypeScript 示例**:
```typescript
// 自动脱敏所有敏感信息
const masked = await encryptionService.maskAllSensitive(
  'API Key: sk-123456, Email: user@example.com'
);

// 脱敏特定类型
const maskedApiKey = await encryptionService.maskApiKey('sk-1234567890abcdef');
const maskedEmail = await encryptionService.maskEmail('user@example.com');
const maskedPhone = await encryptionService.maskPhone('13812345678');
```

**React Hook 示例**:
```typescript
import { useDataMasking } from '@/hooks/useEncryption';

function LogViewer({ logs }: { logs: string[] }) {
  const { maskAllSensitive } = useDataMasking();

  const maskedLogs = logs.map(async (log) => await maskAllSensitive(log));

  return (
    <div>
      {maskedLogs.map((log, i) => (
        <div key={i}>{log}</div>
      ))}
    </div>
  );
}
```

---

### 5. 安全审计日志

#### 完整的审计追踪

记录所有安全相关操作，用于合规性和故障排查：

**事件类型**:
- 加密/解密操作
- 密钥生成/加载/轮换/删除
- 敏感数据访问
- 认证尝试
- 授权检查
- 配置更改
- 数据导出/导入
- 权限变更
- 安全错误

**事件级别**:
- `Debug` - 调试信息
- `Info` - 一般信息
- `Warning` - 警告
- `Error` - 错误
- `Critical` - 严重错误

**Rust 示例**:
```rust
use crate::utils::security_audit::{log_audit_success, log_audit_failure, AuditEventType};

// 记录成功事件
log_audit_success(
    AuditEventType::KeyGeneration,
    "生成新的主密钥",
    Some("app-main-key"),
);

// 记录失败事件
log_audit_failure(
    AuditEventType::Decryption,
    "解密失败",
    "密钥不匹配",
    Some("data-001"),
);
```

**TypeScript 示例**:
```typescript
// 查询审计日志
const logs = await encryptionService.queryAuditLogs({
  event_type: 'key_generation',
  level: 'info',
  limit: 100,
});

// 获取失败的操作
const failedLogs = await encryptionService.getFailedAuditLogs(50);

// 获取严重事件
const criticalLogs = await encryptionService.getCriticalAuditLogs(50);

// 获取统计信息
const stats = await encryptionService.getAuditStatistics();
console.log(`总事件: ${stats.total_events}, 失败: ${stats.failed_events}`);

// 清理旧日志（保留最近 90 天）
const removed = await encryptionService.cleanupAuditLogs(90);
```

**React Hook 示例**:
```typescript
import { useAuditLogs } from '@/hooks/useEncryption';

function AuditLogViewer() {
  const { logs, statistics, fetchLogs, cleanupOldLogs } = useAuditLogs();

  return (
    <div>
      <h2>审计统计</h2>
      {statistics && (
        <div>
          <p>总事件: {statistics.total_events}</p>
          <p>失败事件: {statistics.failed_events}</p>
          <p>严重事件: {statistics.critical_events}</p>
        </div>
      )}
      
      <h2>最近的审计日志</h2>
      {logs.map((log) => (
        <div key={log.id}>
          {log.timestamp}: {log.description} - {log.success ? '成功' : '失败'}
        </div>
      ))}
      
      <button onClick={() => cleanupOldLogs(90)}>清理 90 天前的日志</button>
    </div>
  );
}
```

---

## 🚀 使用场景

### 场景 1：存储适配器 API 密钥

```typescript
// 1. 确保主密钥已生成和加载
const keyExists = await encryptionService.keyExists('app-main-key');
if (!keyExists) {
  await encryptionService.generateMasterKey({
    key_id: 'app-main-key',
    password: userMasterPassword,
    purpose: '应用主密钥',
    expires_in_days: 365,
  });
}

await encryptionService.loadKey('app-main-key', userMasterPassword);

// 2. 存储 API 密钥
await encryptionService.storeEncryptedField({
  id: 'adapter-openai-key',
  field_type: 'api_key',
  plaintext: apiKey,
  entity_id: 'adapter-openai',
  key_id: 'app-main-key',
  password: userMasterPassword,
});

// 3. 使用时检索
const apiKey = await encryptionService.retrieveEncryptedField({
  id: 'adapter-openai-key',
  key_id: 'app-main-key',
  password: userMasterPassword,
});
```

### 场景 2：脱敏日志输出

```typescript
// 在记录日志前自动脱敏
const logMessage = `用户登录，API Key: ${apiKey}, Email: ${email}`;
const maskedLog = await encryptionService.maskAllSensitive(logMessage);
console.log(maskedLog);
// 输出: "用户登录，API Key: sk-1234********cdef, Email: us***@example.com"
```

### 场景 3：密钥轮换

```typescript
// 定期轮换密钥（推荐每 90 天）
await encryptionService.rotateKey({
  key_id: 'app-main-key',
  old_password: currentPassword,
  new_password: newPassword,
});

// 轮换后，所有加密字段会自动使用新密钥重新加密
```

### 场景 4：审计追踪

```typescript
// 查看最近的安全事件
const recentEvents = await encryptionService.getRecentAuditLogs(100);

// 查找失败的操作
const failures = recentEvents.filter((e) => !e.success);

// 生成安全报告
const stats = await encryptionService.getAuditStatistics();
const report = {
  总事件数: stats.total_events,
  成功率: ((stats.total_events - stats.failed_events) / stats.total_events * 100).toFixed(2) + '%',
  严重事件: stats.critical_events,
};
```

---

## 🔒 安全最佳实践

### 1. 密码管理

✅ **推荐**:
- 使用强密码（至少 12 个字符，包含大小写、数字、特殊字符）
- 定期更换密码（90 天）
- 使用密码管理器
- 启用多因素认证（如果可用）

❌ **避免**:
- 在代码中硬编码密码
- 使用弱密码或默认密码
- 在不安全的渠道传输密码
- 重复使用密码

```typescript
// 生成强随机密码
const strongPassword = encryptionService.generateStrongPassword(32);

// 验证密码强度
const strength = encryptionService.validatePasswordStrength(userPassword);
if (!strength.isStrong) {
  console.error('密码不够强:', strength.feedback);
}
```

### 2. 密钥管理

✅ **推荐**:
- 使用系统密钥链存储主密钥
- 定期轮换密钥
- 设置密钥过期时间
- 限制密钥访问权限

❌ **避免**:
- 在文件系统中明文存储密钥
- 共享密钥
- 长期使用同一密钥
- 在日志中输出密钥

### 3. 数据加密

✅ **推荐**:
- 加密所有敏感数据（API 密钥、密码、Token、个人信息）
- 使用认证加密（AES-GCM）
- 加密传输中的数据（HTTPS）
- 加密静态数据

❌ **避免**:
- 使用弱加密算法（MD5, DES）
- 自己实现加密算法
- 重复使用 nonce
- 忽略加密错误

### 4. 审计和监控

✅ **推荐**:
- 记录所有安全相关操作
- 定期审查审计日志
- 设置告警规则
- 保留足够的审计历史

❌ **避免**:
- 禁用审计日志
- 忽略安全告警
- 记录敏感信息的明文
- 过早删除审计日志

---

## 📊 性能考量

### 加密性能

- **AES-256-GCM**: ~1-10 GB/s（取决于 CPU）
- **Argon2 密钥派生**: ~100-500 ms（根据参数调整）
- **系统密钥链访问**: ~10-50 ms

### 优化建议

1. **缓存密钥管理器**: 避免重复加载密钥
2. **批量加密**: 一次加密多个字段
3. **异步操作**: 使用 async/await 避免阻塞
4. **合理的 Argon2 参数**: 平衡安全性和性能

```typescript
// 缓存密钥管理器
let cachedManager: any = null;

async function getManager() {
  if (!cachedManager) {
    await encryptionService.loadKey('app-main-key', password);
    cachedManager = true;
  }
  return cachedManager;
}
```

---

## 🧪 测试

### 单元测试（Rust）

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_encryption_decryption() {
        let key = generate_random_key().unwrap();
        let manager = EncryptionManager::new(key);
        
        let plaintext = "Hello, World!";
        let encrypted = manager.encrypt_string(plaintext).unwrap();
        let decrypted = manager.decrypt_string(&encrypted).unwrap();
        
        assert_eq!(plaintext, decrypted);
    }
}
```

### 集成测试（TypeScript）

```typescript
import { describe, it, expect } from 'vitest';
import { encryptionService } from '@/services/encryptionService';

describe('Encryption Service', () => {
  it('should encrypt and decrypt text', async () => {
    const password = 'test-password';
    const plaintext = 'secret data';
    
    const { encrypted_data, derivation_params } = 
      await encryptionService.quickEncrypt(password, plaintext);
    
    const decrypted = await encryptionService.quickDecrypt(
      password,
      encrypted_data,
      derivation_params
    );
    
    expect(decrypted).toBe(plaintext);
  });
});
```

---

## 🐛 故障排查

### 常见问题

**Q: 解密失败，提示"DecryptionFailed"**

A: 检查以下几点：
1. 密码是否正确
2. 密钥是否已加载
3. 加密数据是否完整
4. 密钥是否已过期

**Q: 密钥链访问失败**

A: 可能的原因：
1. 系统密钥链未解锁（macOS/Linux）
2. 权限不足
3. 密钥链服务未运行

**Q: 性能问题，加密太慢**

A: 优化方案：
1. 调整 Argon2 参数（降低 memory_cost 和 time_cost）
2. 缓存密钥管理器
3. 使用批量操作
4. 在后台线程执行

---

## 📚 参考资料

### 加密算法

- [AES-GCM 规范](https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-38d.pdf)
- [Argon2 白皮书](https://www.password-hashing.net/argon2-specs.pdf)

### 安全标准

- [OWASP 加密最佳实践](https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html)
- [NIST 密钥管理指南](https://csrc.nist.gov/publications/detail/sp/800-57-part-1/rev-5/final)

### 相关文档

- [API 系统文档](./API_SYSTEM.md)
- [文件系统文档](./FILE_SYSTEM.md)
- [适配器系统文档](./ADAPTER_SYSTEM.md)

---

## 📝 更新日志

### v1.0.0 (2025-10-19)

**新增功能**:
- ✅ AES-256-GCM 加密/解密
- ✅ Argon2 密钥派生
- ✅ 系统密钥链集成
- ✅ 密钥轮换
- ✅ 加密字段存储
- ✅ 敏感信息脱敏
- ✅ 安全审计日志
- ✅ TypeScript 类型定义
- ✅ React Hooks
- ✅ 完整的文档和示例

---

**文档维护者**: 开发团队  
**最后更新**: 2025-10-19  
**下次审查**: 每季度更新

