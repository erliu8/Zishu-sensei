# 优先级修复计划

## 立即执行的修复 (今日必须完成)

### 1. 安装pytest-asyncio并配置 
**优先级**: P0 - 阻塞性问题
**预估时间**: 30分钟
**操作步骤**:
```bash
# 1. 安装依赖
pip install pytest-asyncio pytest-mock

# 2. 更新pytest配置
echo "[tool:pytest]" >> pytest.ini
echo "asyncio_mode = auto" >> pytest.ini
echo "testpaths = tests" >> pytest.ini
echo "python_files = test_*.py" >> pytest.ini
echo "python_functions = test_*" >> pytest.ini
```

### 2. 修复RAG引擎导入错误
**优先级**: P0 - 阻塞性问题  
**预估时间**: 2小时
**修复文件**: 
- `zishu/adapters/soft/rag_engine.py`
- `tests/unit/adapters/test_rag_engine.py`

**具体修复内容**:
```python
# 在rag_engine.py中添加缺失的类
class Document:
    """文档类"""
    def __init__(self, id: str, content: str, metadata: dict = None):
        self.id = id
        self.content = content  
        self.metadata = metadata or {}

class QueryResult:
    """查询结果类"""
    def __init__(self, document: Document, score: float, retrieval_method: str = ""):
        self.document = document
        self.score = score
        self.retrieval_method = retrieval_method

class RAGEngineError(Exception):
    """RAG引擎异常类"""
    pass

# 其他缺失的类...
```

### 3. 修复基础fixture问题
**优先级**: P0 - 阻塞性问题
**预估时间**: 1小时
**修复策略**: 将所有async fixture转换为正确的异步模式

## 第一周修复计划

### Day 1: 解决阻塞性问题
- [x] 配置pytest-asyncio
- [ ] 修复RAG引擎导入
- [ ] 修复基础fixture
- **目标**: 使测试能够运行

### Day 2-3: 修复适配器管理器
- [ ] 修复AdapterManager初始化
- [ ] 修复适配器注册/注销
- [ ] 修复生命周期管理
- **目标**: 核心管理功能可用

### Day 4-5: 修复事件服务
- [ ] 修复事件订阅/发布
- [ ] 修复异步事件处理  
- [ ] 修复批量事件处理
- **目标**: 事件系统基本可用

## 第二周修复计划

### Day 6-7: 修复健康服务
- [ ] 修复健康监控
- [ ] 修复指标收集
- [ ] 修复自动恢复
- **目标**: 监控系统可用

### Day 8-10: 修复验证服务
- [ ] 修复验证规则
- [ ] 修复缓存机制
- [ ] 修复并发验证
- **目标**: 验证系统可用

## 后续修复计划

### Week 3-4: 智能功能修复
1. **智能适配器**
   - 代码生成引擎
   - 学习引擎
   - 安全执行器

2. **多模态适配器**
   - 模态处理器
   - 融合策略
   - 对齐算法

### Week 5-6: 系统优化
1. **性能优化**
   - 并发处理
   - 内存优化
   - 缓存策略

2. **稳定性提升**
   - 错误处理
   - 资源管理
   - 监控告警

## 修复检查清单

### 每日检查项
- [ ] 新修复的测试是否通过
- [ ] 是否引入新的测试失败
- [ ] 代码覆盖率是否提升
- [ ] 是否有新的警告或错误

### 每周检查项  
- [ ] 整体测试通过率
- [ ] 代码质量指标
- [ ] 性能基准测试
- [ ] 文档更新状态

### 修复完成标准
1. **P0问题**: 必须100%修复
2. **P1问题**: 修复率 > 90%  
3. **P2问题**: 修复率 > 80%
4. **P3问题**: 修复率 > 60%

## 风险控制措施

### 修复前准备
1. 创建分支备份当前代码
2. 记录当前测试状态
3. 准备回滚计划

### 修复过程控制
1. 每个修复都要经过测试验证
2. 修复一个问题后立即运行相关测试
3. 发现新问题立即记录并评估影响

### 修复后验证
1. 运行完整测试套件
2. 检查代码覆盖率变化
3. 验证性能指标
4. 更新文档

## 紧急联系和支持

### 技术支持
- **架构问题**: 查阅系统设计文档
- **异步问题**: 参考asyncio最佳实践
- **测试问题**: 查阅pytest文档

### 质量标准
- **代码审查**: 每个修复都需要审查
- **测试覆盖**: 新增代码覆盖率 > 80%
- **性能要求**: 不能显著降低现有性能
- **兼容性**: 保持向后兼容

## 进度跟踪

### 当前状态
- **总测试数**: 241
- **通过数**: 28 (11.6%)
- **失败数**: 123 (51.0%)  
- **错误数**: 90 (37.3%)

### 目标状态 (Week 8结束)
- **总测试数**: 241+
- **通过数**: 217+ (90%+)
- **失败数**: < 24 (10%)
- **错误数**: 0

### 里程碑检查点
- **Week 1**: 通过率 > 50%
- **Week 2**: 通过率 > 65%  
- **Week 4**: 通过率 > 75%
- **Week 6**: 通过率 > 85%
- **Week 8**: 通过率 > 90%
