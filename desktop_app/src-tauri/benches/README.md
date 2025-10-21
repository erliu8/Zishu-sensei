# 🚀 性能基准测试

本目录包含 Zishu-Sensei 桌面应用的所有性能基准测试，使用 [Criterion.rs](https://github.com/bheisler/criterion.rs) 框架进行性能测量和回归检测。

## 📋 测试覆盖

### 1. 数据库性能测试 (`database_bench.rs`)

测试 SQLite 数据库的各种操作性能：

- **单条插入**: 测试不同数据大小的单条记录插入性能
- **批量插入**: 测试批量插入性能（100, 500, 1000, 5000 条记录）
- **查询性能**: 
  - 按主键查询
  - 按索引列查询
  - 范围查询
  - 计数查询
- **更新性能**: 批量更新操作
- **删除性能**: 批量删除操作
- **事务性能**: 有/无事务的批量操作对比

### 2. 加密性能测试 (`encryption_bench.rs`)

测试加密解密操作的性能：

- **AES-256-GCM 加密/解密**: 测试不同数据大小（1KB - 10MB）
- **完整加密/解密周期**: 包含密钥生成、加密、解密全流程
- **Argon2 密钥派生**: 测试不同内存成本配置（32MB, 64MB, 128MB）
- **SHA-256 哈希**: 测试不同数据大小的哈希计算
- **批量加密**: 测试批量加密多个数据块
- **密钥生成**: 随机密钥、Salt、Nonce 生成性能
- **Base64 编码/解码**: 常用于存储加密数据

### 3. 文件操作性能测试 (`file_operations_bench.rs`)

测试文件系统操作性能：

- **文件写入**: 
  - 直接写入 vs 缓冲写入
  - 不同文件大小（1KB - 100MB）
- **文件读取**: 
  - 直接读取 vs 缓冲读取
  - 不同文件大小
- **批量操作**: 
  - 批量文件创建
  - 批量文件删除
- **文件复制和重命名**
- **目录操作**: 
  - 创建/删除单个目录
  - 创建嵌套目录
  - 递归删除目录
- **元数据读取**: 文件信息查询、存在性检查
- **目录遍历**: 
  - 普通遍历
  - 递归遍历（使用 walkdir）

### 4. 内存管理性能测试 (`memory_bench.rs`)

测试内存分配和数据结构性能：

- **Vec 操作**: 
  - push 操作（有/无预分配容量）
  - 迭代和克隆
- **HashMap 操作**: 
  - 插入（有/无预分配容量）
  - 查询和迭代
- **BTreeMap vs HashMap**: 数据结构性能对比
- **并发数据结构**: 
  - Arc<Mutex<HashMap>>
  - Arc<RwLock<HashMap>>
  - DashMap
- **锁性能对比**: 
  - std::Mutex vs parking_lot::Mutex
  - std::RwLock vs parking_lot::RwLock
- **字符串操作**: 
  - 连接、格式化、克隆
- **智能指针**: Box vs Arc
- **缓存模拟**: LRU 缓存、命中/未命中
- **内存分配模式**: 频繁小分配 vs 单次大分配

### 5. 工作流性能测试 (`workflow_bench.rs`)

测试工作流引擎性能：

- **表达式求值**: 
  - 简单比较表达式
  - 字符串比较
- **变量替换**: 
  - 单个变量
  - 多个变量
  - 长文本模板
- **步骤执行**: API 调用、转换、条件步骤
- **完整工作流执行**: 不同步骤数量（5, 10, 20, 50）
- **并发工作流**: 多个工作流同时执行
- **JSON 处理**: 序列化、反序列化、路径访问
- **正则表达式**: 编译缓存 vs 每次编译、复杂正则
- **工作流调度**: 优先级队列调度

## 🚀 运行基准测试

### 快速开始

```bash
# 进入 src-tauri 目录
cd desktop_app/src-tauri

# 运行所有基准测试
./run_benchmarks.sh

# 或使用 cargo 命令
cargo bench
```

### 运行特定测试

```bash
# 运行数据库基准测试
cargo bench --bench database_bench

# 运行加密基准测试
cargo bench --bench encryption_bench

# 运行文件操作基准测试
cargo bench --bench file_operations_bench

# 运行内存管理基准测试
cargo bench --bench memory_bench

# 运行工作流基准测试
cargo bench --bench workflow_bench
```

### 使用运行脚本

```bash
# 运行所有测试
./run_benchmarks.sh

# 运行特定类别的测试
./run_benchmarks.sh database
./run_benchmarks.sh encryption
./run_benchmarks.sh file
./run_benchmarks.sh memory
./run_benchmarks.sh workflow

# 保存基线数据
./run_benchmarks.sh --baseline

# 与基线对比
./run_benchmarks.sh --compare

# 清理旧数据并运行
./run_benchmarks.sh --clean

# 快速模式（较少采样）
./run_benchmarks.sh --quick

# 查看帮助
./run_benchmarks.sh --help
```

## 📊 查看结果

### 命令行输出

基准测试会在命令行输出每个测试的结果，包括：
- 平均执行时间
- 标准差
- 吞吐量（如果适用）

### HTML 报告

Criterion 会自动生成详细的 HTML 报告：

```bash
# 报告位置
target/criterion/

# 在浏览器中打开
firefox target/criterion/report/index.html
# 或
xdg-open target/criterion/report/index.html
```

报告包含：
- 📈 性能曲线图
- 📊 统计数据（平均值、中位数、标准差）
- 📉 百分位数据（p50, p90, p99）
- 🔄 与之前运行的对比
- 📝 回归检测

## 🎯 性能目标

### 数据库操作

- **单条插入**: < 1ms (1KB 数据)
- **批量插入**: > 1000 ops/s (1000 条记录)
- **主键查询**: < 0.1ms
- **索引查询**: < 0.5ms

### 加密操作

- **AES-GCM 加密**: > 50 MB/s
- **AES-GCM 解密**: > 50 MB/s
- **Argon2 KDF**: < 100ms (64MB 内存成本)

### 文件操作

- **文件读取**: > 100 MB/s (带缓冲)
- **文件写入**: > 50 MB/s (带缓冲)
- **目录遍历**: > 1000 files/s

### 内存操作

- **HashMap 插入**: > 1M ops/s
- **HashMap 查询**: > 10M ops/s
- **Vec push (预分配)**: > 100M ops/s

### 工作流操作

- **表达式求值**: > 100K ops/s
- **变量替换**: > 50K ops/s
- **工作流执行**: > 1K workflows/s (10 步骤)

## 🔧 最佳实践

### 运行环境

为了获得准确和可重复的结果：

1. **关闭其他高负载程序**: 确保系统资源充足
2. **使用稳定的电源**: 避免 CPU 节能模式影响
3. **固定 CPU 频率**: 避免动态频率调整
4. **多次运行**: Criterion 会自动进行多次采样

### 解读结果

- **时间 (Time)**: 操作平均耗时
- **吞吐量 (Throughput)**: 每秒处理的操作/字节数
- **标准差 (Std Dev)**: 结果的稳定性
- **变化 (Change)**: 与上次运行的变化百分比

### 回归检测

Criterion 会自动检测性能回归：

- **绿色**: 性能改进
- **黄色**: 性能保持稳定
- **红色**: 性能下降（可能的回归）

## 📝 添加新的基准测试

### 1. 创建测试文件

在 `benches/` 目录下创建新文件，例如 `my_bench.rs`：

```rust
use criterion::{black_box, criterion_group, criterion_main, Criterion};

fn bench_my_function(c: &mut Criterion) {
    c.bench_function("my_function", |b| {
        b.iter(|| {
            // 被测试的代码
            black_box(my_function());
        });
    });
}

criterion_group!(benches, bench_my_function);
criterion_main!(benches);
```

### 2. 更新 Cargo.toml

```toml
[[bench]]
name = "my_bench"
harness = false
```

### 3. 运行测试

```bash
cargo bench --bench my_bench
```

## 🛠️ 故障排除

### 编译错误

```bash
# 确保依赖是最新的
cargo update

# 清理并重新构建
cargo clean
cargo bench
```

### 测试运行缓慢

```bash
# 使用快速模式
cargo bench -- --quick

# 或使用脚本
./run_benchmarks.sh --quick
```

### 内存不足

某些基准测试（特别是大数据测试）可能需要较多内存。可以：

1. 关闭其他程序释放内存
2. 单独运行特定测试而不是全部运行
3. 调整测试参数减小数据大小

## 📚 参考资料

- [Criterion.rs 文档](https://bheisler.github.io/criterion.rs/book/)
- [Rust 性能测试最佳实践](https://nnethercote.github.io/perf-book/)
- [性能分析工具](https://github.com/flamegraph-rs/flamegraph)

## 🤝 贡献

如果你想添加新的基准测试或改进现有测试：

1. 遵循现有的代码风格
2. 添加清晰的注释说明测试目的
3. 更新此 README 文档
4. 确保测试能稳定运行

---

**最后更新**: 2024-10-21  
**维护者**: Zishu Team

