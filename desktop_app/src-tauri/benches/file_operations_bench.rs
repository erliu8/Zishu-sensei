// benches/file_operations_bench.rs
//! 文件操作性能基准测试
//! 
//! 测试文件读写、批量操作、目录遍历等性能

use criterion::{black_box, criterion_group, criterion_main, Criterion, BenchmarkId, Throughput};
use std::fs::{self, File};
use std::io::{Read, Write, BufReader, BufWriter};
use std::path::PathBuf;
use tempfile::TempDir;
use rand::{Rng, thread_rng};

/// 生成随机数据
fn random_bytes(size: usize) -> Vec<u8> {
    let mut rng = thread_rng();
    (0..size).map(|_| rng.gen()).collect()
}

/// 创建临时目录
fn create_temp_dir() -> TempDir {
    TempDir::new().expect("Failed to create temp dir")
}

/// 基准测试：文件写入
fn bench_file_write(c: &mut Criterion) {
    let mut group = c.benchmark_group("file_write");
    
    // 测试不同大小的文件写入
    for size in [1024, 10240, 102400, 1024000, 10240000].iter() {
        group.throughput(Throughput::Bytes(*size as u64));
        group.bench_with_input(BenchmarkId::from_parameter(size), size, |b, &size| {
            let data = random_bytes(size);
            
            b.iter_batched(
                || create_temp_dir(),
                |temp_dir| {
                    let file_path = temp_dir.path().join("test.bin");
                    fs::write(&file_path, &data).expect("Write failed");
                },
                criterion::BatchSize::SmallInput,
            );
        });
    }
    
    group.finish();
}

/// 基准测试：带缓冲的文件写入
fn bench_buffered_file_write(c: &mut Criterion) {
    let mut group = c.benchmark_group("file_write_buffered");
    
    for size in [1024, 10240, 102400, 1024000, 10240000].iter() {
        group.throughput(Throughput::Bytes(*size as u64));
        group.bench_with_input(BenchmarkId::from_parameter(size), size, |b, &size| {
            let data = random_bytes(size);
            
            b.iter_batched(
                || create_temp_dir(),
                |temp_dir| {
                    let file_path = temp_dir.path().join("test.bin");
                    let file = File::create(&file_path).expect("Create failed");
                    let mut writer = BufWriter::new(file);
                    writer.write_all(&data).expect("Write failed");
                    writer.flush().expect("Flush failed");
                },
                criterion::BatchSize::SmallInput,
            );
        });
    }
    
    group.finish();
}

/// 基准测试：文件读取
fn bench_file_read(c: &mut Criterion) {
    let mut group = c.benchmark_group("file_read");
    
    for size in [1024, 10240, 102400, 1024000, 10240000].iter() {
        group.throughput(Throughput::Bytes(*size as u64));
        group.bench_with_input(BenchmarkId::from_parameter(size), size, |b, &size| {
            let data = random_bytes(size);
            
            b.iter_batched(
                || {
                    let temp_dir = create_temp_dir();
                    let file_path = temp_dir.path().join("test.bin");
                    fs::write(&file_path, &data).expect("Write failed");
                    (temp_dir, file_path)
                },
                |(_temp_dir, file_path)| {
                    let content = fs::read(&file_path).expect("Read failed");
                    black_box(content);
                },
                criterion::BatchSize::SmallInput,
            );
        });
    }
    
    group.finish();
}

/// 基准测试：带缓冲的文件读取
fn bench_buffered_file_read(c: &mut Criterion) {
    let mut group = c.benchmark_group("file_read_buffered");
    
    for size in [1024, 10240, 102400, 1024000, 10240000].iter() {
        group.throughput(Throughput::Bytes(*size as u64));
        group.bench_with_input(BenchmarkId::from_parameter(size), size, |b, &size| {
            let data = random_bytes(size);
            
            b.iter_batched(
                || {
                    let temp_dir = create_temp_dir();
                    let file_path = temp_dir.path().join("test.bin");
                    fs::write(&file_path, &data).expect("Write failed");
                    (temp_dir, file_path)
                },
                |(_temp_dir, file_path)| {
                    let file = File::open(&file_path).expect("Open failed");
                    let mut reader = BufReader::new(file);
                    let mut content = Vec::new();
                    reader.read_to_end(&mut content).expect("Read failed");
                    black_box(content);
                },
                criterion::BatchSize::SmallInput,
            );
        });
    }
    
    group.finish();
}

/// 基准测试：批量文件创建
fn bench_batch_file_creation(c: &mut Criterion) {
    let mut group = c.benchmark_group("file_batch_create");
    
    for count in [10, 50, 100, 500, 1000].iter() {
        group.throughput(Throughput::Elements(*count as u64));
        group.bench_with_input(BenchmarkId::from_parameter(count), count, |b, &count| {
            b.iter_batched(
                || create_temp_dir(),
                |temp_dir| {
                    for i in 0..count {
                        let file_path = temp_dir.path().join(format!("file_{}.txt", i));
                        fs::write(&file_path, "test content").expect("Write failed");
                    }
                },
                criterion::BatchSize::SmallInput,
            );
        });
    }
    
    group.finish();
}

/// 基准测试：批量文件删除
fn bench_batch_file_deletion(c: &mut Criterion) {
    let mut group = c.benchmark_group("file_batch_delete");
    
    for count in [10, 50, 100, 500, 1000].iter() {
        group.throughput(Throughput::Elements(*count as u64));
        group.bench_with_input(BenchmarkId::from_parameter(count), count, |b, &count| {
            b.iter_batched(
                || {
                    let temp_dir = create_temp_dir();
                    // 创建文件
                    for i in 0..count {
                        let file_path = temp_dir.path().join(format!("file_{}.txt", i));
                        fs::write(&file_path, "test content").expect("Write failed");
                    }
                    temp_dir
                },
                |temp_dir| {
                    for i in 0..count {
                        let file_path = temp_dir.path().join(format!("file_{}.txt", i));
                        fs::remove_file(&file_path).expect("Delete failed");
                    }
                },
                criterion::BatchSize::SmallInput,
            );
        });
    }
    
    group.finish();
}

/// 基准测试：文件复制
fn bench_file_copy(c: &mut Criterion) {
    let mut group = c.benchmark_group("file_copy");
    
    for size in [1024, 10240, 102400, 1024000, 10240000].iter() {
        group.throughput(Throughput::Bytes(*size as u64));
        group.bench_with_input(BenchmarkId::from_parameter(size), size, |b, &size| {
            let data = random_bytes(size);
            
            b.iter_batched(
                || {
                    let temp_dir = create_temp_dir();
                    let src_path = temp_dir.path().join("source.bin");
                    fs::write(&src_path, &data).expect("Write failed");
                    (temp_dir, src_path)
                },
                |(temp_dir, src_path)| {
                    let dst_path = temp_dir.path().join("destination.bin");
                    fs::copy(&src_path, &dst_path).expect("Copy failed");
                },
                criterion::BatchSize::SmallInput,
            );
        });
    }
    
    group.finish();
}

/// 基准测试：文件重命名
fn bench_file_rename(c: &mut Criterion) {
    let mut group = c.benchmark_group("file_rename");
    
    group.bench_function("rename", |b| {
        b.iter_batched(
            || {
                let temp_dir = create_temp_dir();
                let old_path = temp_dir.path().join("old_name.txt");
                fs::write(&old_path, "test content").expect("Write failed");
                (temp_dir, old_path)
            },
            |(temp_dir, old_path)| {
                let new_path = temp_dir.path().join("new_name.txt");
                fs::rename(&old_path, &new_path).expect("Rename failed");
            },
            criterion::BatchSize::SmallInput,
        );
    });
    
    group.finish();
}

/// 基准测试：目录创建和删除
fn bench_directory_operations(c: &mut Criterion) {
    let mut group = c.benchmark_group("file_directory_ops");
    
    // 创建单个目录
    group.bench_function("create_single_dir", |b| {
        b.iter_batched(
            || create_temp_dir(),
            |temp_dir| {
                let dir_path = temp_dir.path().join("test_dir");
                fs::create_dir(&dir_path).expect("Create dir failed");
            },
            criterion::BatchSize::SmallInput,
        );
    });
    
    // 创建嵌套目录
    group.bench_function("create_nested_dirs", |b| {
        b.iter_batched(
            || create_temp_dir(),
            |temp_dir| {
                let dir_path = temp_dir.path().join("level1/level2/level3");
                fs::create_dir_all(&dir_path).expect("Create dirs failed");
            },
            criterion::BatchSize::SmallInput,
        );
    });
    
    // 删除目录
    group.bench_function("remove_dir", |b| {
        b.iter_batched(
            || {
                let temp_dir = create_temp_dir();
                let dir_path = temp_dir.path().join("test_dir");
                fs::create_dir(&dir_path).expect("Create dir failed");
                (temp_dir, dir_path)
            },
            |(_temp_dir, dir_path)| {
                fs::remove_dir(&dir_path).expect("Remove dir failed");
            },
            criterion::BatchSize::SmallInput,
        );
    });
    
    // 递归删除目录
    group.bench_function("remove_dir_recursive", |b| {
        b.iter_batched(
            || {
                let temp_dir = create_temp_dir();
                let dir_path = temp_dir.path().join("test_dir");
                fs::create_dir_all(&dir_path.join("sub1/sub2")).expect("Create dirs failed");
                fs::write(dir_path.join("file1.txt"), "content").expect("Write failed");
                fs::write(dir_path.join("sub1/file2.txt"), "content").expect("Write failed");
                (temp_dir, dir_path)
            },
            |(_temp_dir, dir_path)| {
                fs::remove_dir_all(&dir_path).expect("Remove dir failed");
            },
            criterion::BatchSize::SmallInput,
        );
    });
    
    group.finish();
}

/// 基准测试：文件元数据读取
fn bench_file_metadata(c: &mut Criterion) {
    let mut group = c.benchmark_group("file_metadata");
    
    group.bench_function("read_metadata", |b| {
        let temp_dir = create_temp_dir();
        let file_path = temp_dir.path().join("test.txt");
        fs::write(&file_path, "test content").expect("Write failed");
        
        b.iter(|| {
            let metadata = fs::metadata(&file_path).expect("Metadata failed");
            black_box(metadata);
        });
    });
    
    group.bench_function("check_exists", |b| {
        let temp_dir = create_temp_dir();
        let file_path = temp_dir.path().join("test.txt");
        fs::write(&file_path, "test content").expect("Write failed");
        
        b.iter(|| {
            let exists = file_path.exists();
            black_box(exists);
        });
    });
    
    group.finish();
}

/// 基准测试：目录遍历
fn bench_directory_traversal(c: &mut Criterion) {
    let mut group = c.benchmark_group("file_directory_traversal");
    
    for file_count in [10, 50, 100, 500].iter() {
        group.throughput(Throughput::Elements(*file_count as u64));
        group.bench_with_input(
            BenchmarkId::from_parameter(file_count),
            file_count,
            |b, &file_count| {
                let temp_dir = create_temp_dir();
                
                // 创建测试文件
                for i in 0..file_count {
                    let file_path = temp_dir.path().join(format!("file_{}.txt", i));
                    fs::write(&file_path, "test content").expect("Write failed");
                }
                
                b.iter(|| {
                    let entries: Vec<_> = fs::read_dir(temp_dir.path())
                        .expect("Read dir failed")
                        .collect();
                    black_box(entries);
                });
            },
        );
    }
    
    group.finish();
}

/// 基准测试：递归目录遍历
fn bench_recursive_directory_traversal(c: &mut Criterion) {
    let mut group = c.benchmark_group("file_recursive_traversal");
    
    use walkdir::WalkDir;
    
    group.bench_function("walkdir", |b| {
        let temp_dir = create_temp_dir();
        
        // 创建复杂的目录结构
        for i in 0..5 {
            let dir = temp_dir.path().join(format!("dir_{}", i));
            fs::create_dir_all(&dir).expect("Create dir failed");
            
            for j in 0..20 {
                let file_path = dir.join(format!("file_{}.txt", j));
                fs::write(&file_path, "test content").expect("Write failed");
            }
        }
        
        b.iter(|| {
            let entries: Vec<_> = WalkDir::new(temp_dir.path())
                .into_iter()
                .collect();
            black_box(entries);
        });
    });
    
    group.finish();
}

/// 基准测试：文件权限检查（Unix）
#[cfg(unix)]
fn bench_file_permissions(c: &mut Criterion) {
    use std::os::unix::fs::PermissionsExt;
    
    let mut group = c.benchmark_group("file_permissions");
    
    group.bench_function("read_permissions", |b| {
        let temp_dir = create_temp_dir();
        let file_path = temp_dir.path().join("test.txt");
        fs::write(&file_path, "test content").expect("Write failed");
        
        b.iter(|| {
            let metadata = fs::metadata(&file_path).expect("Metadata failed");
            let permissions = metadata.permissions();
            let mode = permissions.mode();
            black_box(mode);
        });
    });
    
    group.finish();
}

criterion_group!(
    benches,
    bench_file_write,
    bench_buffered_file_write,
    bench_file_read,
    bench_buffered_file_read,
    bench_batch_file_creation,
    bench_batch_file_deletion,
    bench_file_copy,
    bench_file_rename,
    bench_directory_operations,
    bench_file_metadata,
    bench_directory_traversal,
    bench_recursive_directory_traversal,
);

criterion_main!(benches);

