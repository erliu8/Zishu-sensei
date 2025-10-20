# Services 服务层测试套件

## 📋 概述

本目录包含了桌面应用所有服务层的单元测试,确保核心业务逻辑的正确性和健壮性。

## ✅ 已完成的测试文件 (12个)

### 1. 适配器服务测试
- **文件**: `adapterService.test.ts`
- **覆盖服务**: `src/services/adapter.ts`
- **测试用例数**: 60+
- **主要测试内容**:
  - ✅ 获取适配器列表
  - ✅ 安装/卸载适配器
  - ✅ 执行适配器操作
  - ✅ 适配器配置管理
  - ✅ 搜索适配器
  - ✅ 获取适配器详情和状态
  - ✅ 工具方法(格式化、验证等)
  - ✅ 错误处理和边界情况
  - ✅ 性能测试

### 2. 适配器管理服务测试
- **文件**: `adapterManagementService.test.ts`
- **覆盖服务**: `src/services/adapterManagementService.ts`
- **测试用例数**: 50+
- **主要测试内容**:
  - ✅ 已安装适配器管理
  - ✅ 版本管理
  - ✅ 依赖管理和检查
  - ✅ 权限管理
  - ✅ 状态和格式化工具
  - ✅ 错误处理
  - ✅ 集成场景测试

### 3. 加密服务测试
- **文件**: `encryptionService.test.ts`
- **覆盖服务**: `src/services/encryptionService.ts`
- **测试用例数**: 70+
- **主要测试内容**:
  - ✅ 文本加密/解密
  - ✅ 密钥管理(生成、加载、轮换、删除)
  - ✅ 加密字段存储
  - ✅ 数据脱敏(API密钥、密码、邮箱、手机等)
  - ✅ 审计日志查询和管理
  - ✅ 辅助方法(密码强度验证、密钥过期检查等)
  - ✅ 错误处理
  - ✅ 集成测试场景

### 4. 聊天服务测试
- **文件**: `chatService.test.ts`
- **覆盖服务**: `src/services/chat/index.ts`
- **测试用例数**: 55+
- **主要测试内容**:
  - ✅ 发送消息(普通、流式、带上下文)
  - ✅ 获取聊天历史
  - ✅ 清空聊天历史
  - ✅ 设置聊天模型
  - ✅ 生成会话ID
  - ✅ 便捷函数测试
  - ✅ 集成测试场景
  - ✅ 性能测试

### 5. 桌面服务测试
- **文件**: `desktopService.test.ts`
- **覆盖服务**: `src/services/desktopApi.ts`
- **测试用例数**: 35+
- **主要测试内容**:
  - ✅ API初始化
  - ✅ 网络连接检查
  - ✅ 系统信息获取
  - ✅ 性能指标监控
  - ✅ 错误报告
  - ✅ 设置同步
  - ✅ 更新检查

### 6. API服务测试
- **文件**: `apiService.test.ts`
- **覆盖服务**: API底层请求功能
- **测试用例数**: 40+
- **主要测试内容**:
  - ✅ HTTP方法(GET、POST、PUT、DELETE)
  - ✅ 错误处理(网络错误、HTTP错误、超时、认证错误)
  - ✅ 请求/响应拦截器
  - ✅ 重试机制
  - ✅ 缓存功能
  - ✅ 并发请求
  - ✅ 查询参数处理
  - ✅ 请求取消

### 7. 市场服务测试
- **文件**: `marketService.test.ts`
- **覆盖服务**: `src/services/marketService.ts`
- **测试用例数**: 35+
- **主要测试内容**:
  - ✅ 搜索产品(高级搜索)
  - ✅ 获取产品详情
  - ✅ 下载产品
  - ✅ 获取产品评论
  - ✅ 获取市场分类
  - ✅ 检查产品更新
  - ✅ 获取特色产品
  - ✅ 工具方法

### 8. 内存管理服务测试
- **文件**: `memoryService.test.ts`
- **覆盖服务**: `src/services/memoryService.ts`
- **测试用例数**: 25+
- **主要测试内容**:
  - ✅ 获取内存使用情况
  - ✅ 内存清理
  - ✅ 内存监控(启动/停止)
  - ✅ 内存优化
  - ✅ 内存泄漏检测

### 9. 文件服务测试
- **文件**: `fileService.test.ts`
- **覆盖服务**: `src/services/fileService.ts`
- **测试用例数**: 30+
- **主要测试内容**:
  - ✅ 文件读取(文本、二进制)
  - ✅ 文件写入
  - ✅ 文件删除
  - ✅ 文件列表
  - ✅ 文件上传
  - ✅ 文件下载
  - ✅ 文件信息获取

### 10. 错误监控服务测试
- **文件**: `errorMonitoringService.test.ts`
- **覆盖服务**: `src/services/errorMonitoringService.ts`
- **测试用例数**: 30+
- **主要测试内容**:
  - ✅ 错误捕获和记录
  - ✅ 错误查询和过滤
  - ✅ 错误统计
  - ✅ 错误报告生成
  - ✅ 错误清理
  - ✅ 错误通知配置

### 11. 日志服务测试
- **文件**: `loggingService.test.ts`
- **覆盖服务**: `src/services/loggingService.ts`
- **测试用例数**: 35+
- **主要测试内容**:
  - ✅ 日志记录(info、error、warning、debug)
  - ✅ 日志查询和过滤
  - ✅ 日志导出(多种格式)
  - ✅ 日志清理
  - ✅ 日志统计
  - ✅ 日志配置

### 12. 主题服务测试
- **文件**: `themeService.test.ts`
- **覆盖服务**: `src/services/themeService.ts`
- **测试用例数**: 35+
- **主要测试内容**:
  - ✅ 获取主题(当前、所有可用)
  - ✅ 切换主题(包括自动主题)
  - ✅ 自定义主题(创建、更新、删除)
  - ✅ 主题导入导出
  - ✅ 主题预览
  - ✅ 主题配置
  - ✅ 颜色工具(验证、转换、配色方案生成)

## 📊 测试覆盖率统计

| 测试文件 | 测试用例数 | 覆盖功能 | 状态 |
|---------|----------|---------|------|
| adapterService.test.ts | 60+ | 适配器核心功能 | ✅ 完成 |
| adapterManagementService.test.ts | 50+ | 适配器管理 | ✅ 完成 |
| encryptionService.test.ts | 70+ | 加密和安全 | ✅ 完成 |
| chatService.test.ts | 55+ | 聊天功能 | ✅ 完成 |
| desktopService.test.ts | 35+ | 桌面操作 | ✅ 完成 |
| apiService.test.ts | 40+ | API请求 | ✅ 完成 |
| marketService.test.ts | 35+ | 市场和商店 | ✅ 完成 |
| memoryService.test.ts | 25+ | 内存管理 | ✅ 完成 |
| fileService.test.ts | 30+ | 文件操作 | ✅ 完成 |
| errorMonitoringService.test.ts | 30+ | 错误监控 | ✅ 完成 |
| loggingService.test.ts | 35+ | 日志管理 | ✅ 完成 |
| themeService.test.ts | 35+ | 主题管理 | ✅ 完成 |
| **总计** | **500+** | **12个服务** | **✅ 100%** |

## 🎯 测试特点

### 全面性
- ✅ 覆盖所有核心服务层
- ✅ 包含正常流程和异常情况
- ✅ 测试边界条件和错误处理
- ✅ 包含性能测试和集成测试

### 健壮性
- ✅ 完整的Mock配置
- ✅ 详细的测试用例描述
- ✅ 错误处理测试
- ✅ 并发和性能测试
- ✅ 边界情况覆盖

### 可维护性
- ✅ 清晰的测试结构
- ✅ 辅助函数提取
- ✅ 统一的测试风格
- ✅ 完善的注释说明
- ✅ 易于扩展

## 🚀 运行测试

### 运行所有服务测试
```bash
npm test tests/unit/services
```

### 运行特定服务测试
```bash
npm test tests/unit/services/adapterService.test.ts
npm test tests/unit/services/encryptionService.test.ts
```

### 运行测试并生成覆盖率报告
```bash
npm run test:coverage -- tests/unit/services
```

### 监听模式运行测试
```bash
npm test tests/unit/services -- --watch
```

## 📝 测试编写规范

### 测试结构
```typescript
describe('ServiceName', () => {
  beforeEach(() => {
    // 测试前置设置
  });

  afterEach(() => {
    // 测试清理
  });

  describe('Feature Group', () => {
    it('应该正确处理正常情况', async () => {
      // Arrange
      const input = ...;
      
      // Act
      const result = await service.method(input);
      
      // Assert
      expect(result).toBe(expected);
    });

    it('应该处理错误情况', async () => {
      // ...
    });
  });
});
```

### Mock使用
```typescript
import { vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

// 在测试中
mockInvoke.mockResolvedValue({ success: true, data: ... });
```

### 断言风格
```typescript
// 使用语义化的断言
expect(result).toBe(expected);
expect(result).toEqual(expected);
expect(result).toBeTruthy();
expect(array).toHaveLength(3);
expect(fn).toHaveBeenCalledWith(arg);
```

## 🔧 Mock工厂函数

所有测试都使用统一的Mock工厂函数,位于 `tests/mocks/factories.ts`:

```typescript
import {
  createMockAdapter,
  createMockAdapterMetadata,
  createMockApiResponse,
  createMockErrorResponse,
} from '../../mocks/factories';
```

## 📚 相关文档

- [测试实施计划](../docs/TEST_IMPLEMENTATION_PLAN.md)
- [测试工具函数](../../utils/test-utils.tsx)
- [Mock配置](../../mocks/README.md)
- [Vitest文档](https://vitest.dev/)

## 🎉 总结

本测试套件包含了**12个服务测试文件**,共计**500+个测试用例**,全面覆盖了桌面应用的核心服务层功能。所有测试都遵循最佳实践,确保代码质量和可维护性。

**测试完成度**: 100% ✅  
**预计覆盖率**: 85%+  
**测试用例总数**: 500+  
**服务数量**: 12个

---

**创建日期**: 2025-10-20  
**最后更新**: 2025-10-20  
**维护者**: Zishu Team

