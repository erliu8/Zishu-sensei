# 🤝 Contributing to Zishu-sensei

感谢您对紫舒老师项目的兴趣！我们欢迎所有形式的贡献。

## 🎯 贡献方式

### **🐛 Bug报告**
- 在[Issues](https://github.com/zishu-sensei/zishu-sensei/issues)中提交bug报告
- 提供详细的复现步骤和环境信息
- 如果可能，请附上日志或截图

### **💡 功能建议**
- 在[Issues](https://github.com/zishu-sensei/zishu-sensei/issues)中提交功能请求
- 说明功能的使用场景和预期效果
- 欢迎提供设计思路或原型

### **🔧 代码贡献**
1. Fork本仓库
2. 创建功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add some amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 创建Pull Request

### **🎨 适配器开发**
- 使用适配器框架创建新功能
- 遵循适配器开发规范
- 提供完整的测试和文档

## 📝 开发规范

### **代码风格**
```bash
# 格式化代码
make format

# 运行linting
make lint

# 运行测试
make test
```

### **提交信息格式**
```
<类型>: <简短描述>

<详细描述>

<Footer>
```

类型包括：
- `feat`: 新功能
- `fix`: 修复bug
- `docs`: 文档更新
- `style`: 代码格式化
- `refactor`: 代码重构
- `test`: 测试相关
- `chore`: 构建/工具相关

### **分支命名**
- `feature/功能名称` - 新功能开发
- `bugfix/问题描述` - bug修复
- `hotfix/紧急修复` - 紧急修复
- `docs/文档更新` - 文档更新

## 🧪 测试要求

### **单元测试**
- 新功能必须包含相应的单元测试
- 测试覆盖率不低于80%
- 运行 `make test` 确保所有测试通过

### **集成测试**
- API接口需要提供集成测试
- 适配器需要提供端到端测试

## 📖 文档要求

### **代码文档**
- 公共API必须有详细的docstring
- 复杂逻辑需要内联注释
- 遵循Google风格的文档格式

### **用户文档**
- 新功能需要更新用户文档
- 提供清晰的使用示例
- 包含常见问题解答

## 🎨 适配器贡献

### **适配器类型**
- **软适配器**: RAG+Prompt实现，无需模型训练
- **硬适配器**: LoRA微调实现，需要训练数据

### **提交要求**
- 完整的适配器代码
- 详细的README说明
- 测试用例和示例
- 许可证兼容性声明

### **审核流程**
1. 技术审核 - 代码质量和安全性
2. 功能测试 - 功能完整性和稳定性
3. 社区投票 - 社区成员评价和建议
4. 最终批准 - 维护者最终审批

## 👥 社区准则

### **行为准则**
- 尊重所有社区成员
- 友好、包容、耐心
- 建设性的讨论和反馈
- 不容忍任何形式的骚扰

### **沟通渠道**
- **GitHub Issues**: 问题报告和功能讨论
- **GitHub Discussions**: 技术讨论和经验分享
- **Discord**: 实时交流和协作

## 🏆 贡献者奖励

### **认可方式**
- 项目贡献者列表展示
- 优秀适配器推荐和展示
- 社区年度贡献者奖励

### **成长机会**
- 参与项目核心开发
- 成为适配器审核员
- 加入项目维护团队

## 📞 获取帮助

如果您有任何问题，可以通过以下方式获取帮助：

- 📧 邮件: contributors@zishu-sensei.com
- 💬 Discord: [Zishu Community](https://discord.gg/zishu-sensei)
- 📖 文档: [docs.zishu-sensei.com](https://docs.zishu-sensei.com)

感谢您为紫舒老师项目做出贡献！🎉
