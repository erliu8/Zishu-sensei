# 📝 Changelog

所有重要的项目变更都会记录在这个文件中。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/)，
项目遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [Unreleased] - 待发布

### Added
- API框架开发计划
- 适配器框架设计
- 桌面自动化模块规划

### Changed
- 项目结构重组为企业级架构

### Deprecated
- 旧版训练脚本将在v0.2.0中移除

### Removed
- 未使用的依赖包

### Fixed
- 配置文件加载问题
- **修复聊天无AI回复问题** (2024-11-17)
  - 修正 `zishu/api/routes/chat.py` 推理引擎导入路径
  - 修正 `desktop_app/src-tauri/src/utils/bridge.rs` API调用路径 (`/api/chat/completions`)
  - 创建缺失的配置目录 `configs/prompts/models`
  - 扩展本地LLM模型识别逻辑，支持从本地索引查询验证

### Security
- 改进了模型推理的安全性

## [0.1.0] - 2024-01-XX - 初始版本

### Added
- 基础项目结构
- Qwen2.5-7B模型集成
- 基础训练框架
- LoRA微调支持
- 模型量化功能
- 推理引擎实现
- Live2D角色系统
- 基础配置管理
- MIT开源许可证

### Framework
- 企业级5层架构设计
- 适配器框架概念验证
- 训练模块完整实现
- 模型管理系统

### Documentation
- README.md项目介绍
- CONTRIBUTING.md贡献指南
- LICENSE MIT许可证
- 项目构建配置(pyproject.toml)
- 开发工具配置(Makefile)

### Infrastructure
- Python 3.8+支持
- 依赖管理和环境配置
- 代码格式化和linting配置
- 测试框架配置

---

## 版本说明

### 版本格式
项目采用语义化版本号：`主版本号.次版本号.修订号`

- **主版本号**：不兼容的API修改
- **次版本号**：向下兼容的功能性新增
- **修订号**：向下兼容的问题修正

### 变更类型
- **Added** - 新增功能
- **Changed** - 功能变更
- **Deprecated** - 即将移除的功能
- **Removed** - 已移除的功能
- **Fixed** - 问题修复
- **Security** - 安全性改进

### 发布计划

#### v0.2.0 (计划中) - API框架
- FastAPI后端服务
- RESTful API接口
- 适配器注册系统
- 基础认证和权限

#### v0.3.0 (计划中) - 适配器生态
- 软适配器框架
- 硬适配器框架
- 适配器商店原型
- 开发者SDK

#### v0.4.0 (计划中) - 桌面Agent
- 桌面自动化引擎
- GUI操作框架
- 办公软件集成
- 多媒体处理

#### v0.5.0 (计划中) - 社区平台
- 适配器商店上线
- 用户评价系统
- 社区论坛集成
- 开发者激励机制

#### v1.0.0 (计划中) - 正式发布
- 完整功能集成
- 生产环境优化
- 企业级部署支持
- 完整文档和教程
 