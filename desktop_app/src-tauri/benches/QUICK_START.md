# 🚀 性能基准测试 - 快速入门指南

## 5分钟快速上手

### 1️⃣ 运行所有基准测试

```bash
cd desktop_app/src-tauri
./run_benchmarks.sh
```

这将运行所有5个基准测试套件，大约需要 5-15 分钟。

### 2️⃣ 运行单个测试

如果你只想测试特定模块：

```bash
# 数据库性能
./run_benchmarks.sh database

# 加密性能
./run_benchmarks.sh encryption

# 文件操作性能
./run_benchmarks.sh file

# 内存管理性能
./run_benchmarks.sh memory

# 工作流性能
./run_benchmarks.sh workflow
```

### 3️⃣ 查看结果

测试完成后，打开浏览器查看详细报告：

```bash
firefox target/criterion/report/index.html
```

## 📊 结果解读

### 命令行输出

```
database_single_insert/1024
    time:   [245.32 µs 248.76 µs 252.45 µs]
    thrpt:  [4.0567 KiB/s 4.1159 KiB/s 4.1743 KiB/s]
```

- **time**: 平均执行时间（微秒）
- **thrpt**: 吞吐量（每秒处理的数据量）

### 性能变化

```
Change:  -5.2% (p < 0.05)
Performance has improved.
```

- **-5.2%**: 性能提升了 5.2%（负数表示变快）
- **+5.2%**: 性能下降了 5.2%（正数表示变慢）

## 🎯 常用场景

### 场景1: 建立性能基线

在开始优化前，先保存当前性能数据：

```bash
./run_benchmarks.sh --baseline
```

### 场景2: 性能对比

做了优化后，与基线对比：

```bash
./run_benchmarks.sh --compare
```

这会显示每个测试相比基线的变化。

### 场景3: 快速验证

快速检查某个模块的性能（较少采样）：

```bash
./run_benchmarks.sh --quick database
```

### 场景4: 清理重测

清理旧数据，重新测试：

```bash
./run_benchmarks.sh --clean
```

## 💡 性能优化工作流

### 步骤1: 建立基线

```bash
git checkout main
./run_benchmarks.sh --baseline
```

### 步骤2: 进行优化

```bash
git checkout -b optimize-database
# 修改代码进行优化
```

### 步骤3: 测试对比

```bash
./run_benchmarks.sh --compare
```

### 步骤4: 分析结果

查看 HTML 报告，关注：
- ✅ 绿色：性能提升
- ⚠️ 黄色：性能无明显变化
- ❌ 红色：性能下降（需要关注）

### 步骤5: 迭代优化

根据结果继续优化，直到达到目标。

## 🔍 深入分析

### 查看特定测试的详细结果

```bash
# 查看数据库插入测试的所有变体
cargo bench --bench database_bench -- single_insert

# 查看加密测试的特定大小
cargo bench --bench encryption_bench -- 10240
```

### 生成火焰图（需要额外工具）

```bash
# 安装 cargo-flamegraph
cargo install flamegraph

# 生成火焰图
cargo flamegraph --bench database_bench
```

## 📈 性能监控

### 定期运行基准测试

建议在以下情况运行基准测试：

1. **每次重要代码更改后**
2. **发布新版本前**
3. **升级依赖后**
4. **定期（如每周）**

### 设置 CI/CD

可以将基准测试集成到 CI/CD 流程：

```yaml
# .github/workflows/benchmark.yml
name: Benchmark
on: [push, pull_request]

jobs:
  benchmark:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Run benchmarks
        run: |
          cd desktop_app/src-tauri
          ./run_benchmarks.sh --quick
```

## 🛠️ 故障排除

### 问题1: 测试运行很慢

**解决方案**: 使用快速模式

```bash
./run_benchmarks.sh --quick
```

### 问题2: 内存不足

**解决方案**: 单独运行较小的测试

```bash
./run_benchmarks.sh database
./run_benchmarks.sh encryption
```

### 问题3: 结果不稳定

**解决方案**: 
1. 关闭其他程序
2. 确保系统不处于节能模式
3. 多运行几次取平均值

### 问题4: 找不到报告

**解决方案**: 检查报告位置

```bash
ls -la target/criterion/
```

## 📚 了解更多

- 📖 [详细文档](README.md)
- 🎯 [测试框架计划](../tests/TEST_FRAMEWORK_PLAN.md)
- 🔧 [Criterion.rs 文档](https://bheisler.github.io/criterion.rs/book/)

## 🤔 常见问题

### Q: 基准测试需要多长时间？

A: 
- 全部测试: 5-15 分钟
- 单个测试: 1-3 分钟
- 快速模式: 2-5 分钟

### Q: 我应该关注哪些指标？

A: 主要关注：
1. **平均时间**: 最常用的指标
2. **吞吐量**: 对于批量操作很重要
3. **性能变化**: 确保没有回归

### Q: 什么算性能回归？

A: 一般来说：
- **< 5%**: 可接受的变化
- **5-10%**: 需要注意
- **> 10%**: 明显的性能回归，需要修复

### Q: 如何提高测试稳定性？

A:
1. 多次运行求平均
2. 固定 CPU 频率
3. 关闭后台程序
4. 使用相同的硬件环境

---

**需要帮助？** 查看 [README.md](README.md) 或联系团队。

