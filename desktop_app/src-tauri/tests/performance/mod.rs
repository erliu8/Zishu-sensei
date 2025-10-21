// tests/performance/mod.rs
//! 性能测试模块
//! 
//! 本模块包含所有性能基准测试，使用 Criterion 框架进行性能测量和回归检测。
//! 
//! ## 测试覆盖
//! 
//! - **database_bench**: 数据库操作性能（插入、查询、更新、并发）
//! - **encryption_bench**: 加密解密性能（AES-GCM、密钥派生）
//! - **file_operations_bench**: 文件操作性能（读写、批量操作）
//! - **memory_bench**: 内存管理性能（分配、缓存、清理）
//! - **workflow_bench**: 工作流性能（表达式求值、工作流执行）
//! 
//! ## 运行方式
//! 
//! ```bash
//! # 运行所有基准测试
//! cargo bench
//! 
//! # 运行特定基准测试
//! cargo bench --bench database_bench
//! cargo bench --bench encryption_bench
//! 
//! # 生成详细报告
//! cargo bench -- --verbose
//! ```
//! 
//! ## 性能指标
//! 
//! 每个基准测试都会测量：
//! - **吞吐量** (operations/second)
//! - **延迟** (平均、最小、最大、百分位)
//! - **回归检测** (与基线对比)
//! 
//! ## 注意事项
//! 
//! - 基准测试会在 release 模式下运行
//! - 测试期间请关闭其他高负载程序
//! - 首次运行会建立基线，后续运行会与基线对比

pub mod common;

// 注意：Criterion 基准测试通过 benches/ 目录或 [[bench]] 配置运行
// 本模块主要用于共享测试工具和辅助函数

