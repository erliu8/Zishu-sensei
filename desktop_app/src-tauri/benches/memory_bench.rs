// benches/memory_bench.rs
//! 内存管理性能基准测试
//! 
//! 测试内存分配、缓存、数据结构等性能

use criterion::{black_box, criterion_group, criterion_main, Criterion, BenchmarkId, Throughput};
use std::collections::{HashMap, HashSet, BTreeMap, VecDeque};
use std::sync::{Arc, Mutex, RwLock};
use dashmap::DashMap;
use parking_lot::{Mutex as ParkingLotMutex, RwLock as ParkingLotRwLock};
use rand::{Rng, thread_rng};

/// 生成随机字符串
fn random_string(len: usize) -> String {
    use rand::distributions::Alphanumeric;
    thread_rng()
        .sample_iter(&Alphanumeric)
        .take(len)
        .map(char::from)
        .collect()
}

/// 基准测试：Vec 操作
fn bench_vec_operations(c: &mut Criterion) {
    let mut group = c.benchmark_group("memory_vec");
    
    // Vec push
    for size in [100, 1000, 10000].iter() {
        group.throughput(Throughput::Elements(*size as u64));
        group.bench_with_input(BenchmarkId::new("push", size), size, |b, &size| {
            b.iter(|| {
                let mut vec = Vec::new();
                for i in 0..size {
                    vec.push(i);
                }
                black_box(vec);
            });
        });
    }
    
    // Vec with_capacity push
    for size in [100, 1000, 10000].iter() {
        group.throughput(Throughput::Elements(*size as u64));
        group.bench_with_input(BenchmarkId::new("push_with_capacity", size), size, |b, &size| {
            b.iter(|| {
                let mut vec = Vec::with_capacity(size);
                for i in 0..size {
                    vec.push(i);
                }
                black_box(vec);
            });
        });
    }
    
    // Vec iteration
    group.bench_function("iterate_1000", |b| {
        let vec: Vec<i32> = (0..1000).collect();
        b.iter(|| {
            let sum: i32 = vec.iter().sum();
            black_box(sum);
        });
    });
    
    // Vec clone
    for size in [100, 1000, 10000].iter() {
        group.throughput(Throughput::Elements(*size as u64));
        group.bench_with_input(BenchmarkId::new("clone", size), size, |b, &size| {
            let vec: Vec<i32> = (0..size).collect();
            b.iter(|| {
                let cloned = vec.clone();
                black_box(cloned);
            });
        });
    }
    
    group.finish();
}

/// 基准测试：HashMap 操作
fn bench_hashmap_operations(c: &mut Criterion) {
    let mut group = c.benchmark_group("memory_hashmap");
    
    // HashMap insert
    for size in [100, 1000, 10000].iter() {
        group.throughput(Throughput::Elements(*size as u64));
        group.bench_with_input(BenchmarkId::new("insert", size), size, |b, &size| {
            b.iter(|| {
                let mut map = HashMap::new();
                for i in 0..size {
                    map.insert(i, i * 2);
                }
                black_box(map);
            });
        });
    }
    
    // HashMap with_capacity insert
    for size in [100, 1000, 10000].iter() {
        group.throughput(Throughput::Elements(*size as u64));
        group.bench_with_input(BenchmarkId::new("insert_with_capacity", size), size, |b, &size| {
            b.iter(|| {
                let mut map = HashMap::with_capacity(size);
                for i in 0..size {
                    map.insert(i, i * 2);
                }
                black_box(map);
            });
        });
    }
    
    // HashMap lookup
    group.bench_function("lookup_1000", |b| {
        let map: HashMap<i32, i32> = (0..1000).map(|i| (i, i * 2)).collect();
        let mut rng = thread_rng();
        
        b.iter(|| {
            let key = rng.gen_range(0..1000);
            let value = map.get(&key);
            black_box(value);
        });
    });
    
    // HashMap iteration
    group.bench_function("iterate_1000", |b| {
        let map: HashMap<i32, i32> = (0..1000).map(|i| (i, i * 2)).collect();
        
        b.iter(|| {
            let sum: i32 = map.values().sum();
            black_box(sum);
        });
    });
    
    group.finish();
}

/// 基准测试：BTreeMap vs HashMap
fn bench_btreemap_vs_hashmap(c: &mut Criterion) {
    let mut group = c.benchmark_group("memory_map_comparison");
    
    let size = 1000;
    
    // HashMap insert
    group.bench_function("hashmap_insert", |b| {
        b.iter(|| {
            let mut map = HashMap::with_capacity(size);
            for i in 0..size {
                map.insert(i, random_string(20));
            }
            black_box(map);
        });
    });
    
    // BTreeMap insert
    group.bench_function("btreemap_insert", |b| {
        b.iter(|| {
            let mut map = BTreeMap::new();
            for i in 0..size {
                map.insert(i, random_string(20));
            }
            black_box(map);
        });
    });
    
    // HashMap lookup
    group.bench_function("hashmap_lookup", |b| {
        let map: HashMap<i32, String> = (0..size).map(|i| (i, random_string(20))).collect();
        let mut rng = thread_rng();
        
        b.iter(|| {
            let key = rng.gen_range(0..size);
            let value = map.get(&key);
            black_box(value);
        });
    });
    
    // BTreeMap lookup
    group.bench_function("btreemap_lookup", |b| {
        let map: BTreeMap<i32, String> = (0..size).map(|i| (i, random_string(20))).collect();
        let mut rng = thread_rng();
        
        b.iter(|| {
            let key = rng.gen_range(0..size);
            let value = map.get(&key);
            black_box(value);
        });
    });
    
    group.finish();
}

/// 基准测试：并发数据结构
fn bench_concurrent_structures(c: &mut Criterion) {
    let mut group = c.benchmark_group("memory_concurrent");
    
    // Arc<Mutex<HashMap>> 写入
    group.bench_function("arc_mutex_hashmap_write", |b| {
        b.iter(|| {
            let map = Arc::new(Mutex::new(HashMap::new()));
            for i in 0..100 {
                let mut guard = map.lock().unwrap();
                guard.insert(i, i * 2);
            }
            black_box(map);
        });
    });
    
    // Arc<RwLock<HashMap>> 写入
    group.bench_function("arc_rwlock_hashmap_write", |b| {
        b.iter(|| {
            let map = Arc::new(RwLock::new(HashMap::new()));
            for i in 0..100 {
                let mut guard = map.write().unwrap();
                guard.insert(i, i * 2);
            }
            black_box(map);
        });
    });
    
    // DashMap 写入
    group.bench_function("dashmap_write", |b| {
        b.iter(|| {
            let map = DashMap::new();
            for i in 0..100 {
                map.insert(i, i * 2);
            }
            black_box(map);
        });
    });
    
    // Arc<RwLock<HashMap>> 读取
    group.bench_function("arc_rwlock_hashmap_read", |b| {
        let map = Arc::new(RwLock::new(HashMap::new()));
        {
            let mut guard = map.write().unwrap();
            for i in 0..1000 {
                guard.insert(i, i * 2);
            }
        }
        
        b.iter(|| {
            let guard = map.read().unwrap();
            let value = guard.get(&500);
            black_box(value);
        });
    });
    
    // DashMap 读取
    group.bench_function("dashmap_read", |b| {
        let map = DashMap::new();
        for i in 0..1000 {
            map.insert(i, i * 2);
        }
        
        b.iter(|| {
            let value = map.get(&500);
            black_box(value);
        });
    });
    
    group.finish();
}

/// 基准测试：parking_lot vs std sync
fn bench_parking_lot_vs_std(c: &mut Criterion) {
    let mut group = c.benchmark_group("memory_lock_comparison");
    
    // std::Mutex
    group.bench_function("std_mutex", |b| {
        let counter = Arc::new(Mutex::new(0));
        b.iter(|| {
            let mut guard = counter.lock().unwrap();
            *guard += 1;
        });
    });
    
    // parking_lot::Mutex
    group.bench_function("parking_lot_mutex", |b| {
        let counter = Arc::new(ParkingLotMutex::new(0));
        b.iter(|| {
            let mut guard = counter.lock();
            *guard += 1;
        });
    });
    
    // std::RwLock read
    group.bench_function("std_rwlock_read", |b| {
        let value = Arc::new(RwLock::new(42));
        b.iter(|| {
            let guard = value.read().unwrap();
            black_box(*guard);
        });
    });
    
    // parking_lot::RwLock read
    group.bench_function("parking_lot_rwlock_read", |b| {
        let value = Arc::new(ParkingLotRwLock::new(42));
        b.iter(|| {
            let guard = value.read();
            black_box(*guard);
        });
    });
    
    group.finish();
}

/// 基准测试：字符串操作
fn bench_string_operations(c: &mut Criterion) {
    let mut group = c.benchmark_group("memory_string");
    
    // String::new + push_str
    group.bench_function("string_push_str", |b| {
        b.iter(|| {
            let mut s = String::new();
            for _ in 0..100 {
                s.push_str("test ");
            }
            black_box(s);
        });
    });
    
    // String::with_capacity + push_str
    group.bench_function("string_with_capacity_push_str", |b| {
        b.iter(|| {
            let mut s = String::with_capacity(500);
            for _ in 0..100 {
                s.push_str("test ");
            }
            black_box(s);
        });
    });
    
    // format!
    group.bench_function("format_macro", |b| {
        b.iter(|| {
            let result = format!("Hello, {}", "world");
            black_box(result);
        });
    });
    
    // String concatenation
    group.bench_function("string_concat", |b| {
        b.iter(|| {
            let a = "Hello".to_string();
            let b = "world".to_string();
            let result = a + ", " + &b;
            black_box(result);
        });
    });
    
    // String clone
    for size in [100, 1000, 10000].iter() {
        group.throughput(Throughput::Bytes(*size as u64));
        group.bench_with_input(BenchmarkId::new("clone", size), size, |b, &size| {
            let s = random_string(size);
            b.iter(|| {
                let cloned = s.clone();
                black_box(cloned);
            });
        });
    }
    
    group.finish();
}

/// 基准测试：Box vs Arc
fn bench_box_vs_arc(c: &mut Criterion) {
    let mut group = c.benchmark_group("memory_smart_pointers");
    
    // Box allocation
    group.bench_function("box_alloc", |b| {
        b.iter(|| {
            let boxed = Box::new(vec![0; 1000]);
            black_box(boxed);
        });
    });
    
    // Arc allocation
    group.bench_function("arc_alloc", |b| {
        b.iter(|| {
            let arced = Arc::new(vec![0; 1000]);
            black_box(arced);
        });
    });
    
    // Arc clone
    group.bench_function("arc_clone", |b| {
        let arced = Arc::new(vec![0; 1000]);
        b.iter(|| {
            let cloned = Arc::clone(&arced);
            black_box(cloned);
        });
    });
    
    group.finish();
}

/// 基准测试：缓存模拟
fn bench_cache_simulation(c: &mut Criterion) {
    let mut group = c.benchmark_group("memory_cache");
    
    // 简单LRU缓存模拟
    group.bench_function("lru_cache_insert_evict", |b| {
        b.iter(|| {
            let mut cache = VecDeque::with_capacity(100);
            let mut lookup = HashSet::new();
            
            for i in 0..200 {
                let key = format!("key_{}", i);
                
                if lookup.len() >= 100 {
                    if let Some(old_key) = cache.pop_front() {
                        lookup.remove(&old_key);
                    }
                }
                
                cache.push_back(key.clone());
                lookup.insert(key);
            }
            
            black_box(cache);
        });
    });
    
    // HashMap缓存命中
    group.bench_function("hashmap_cache_hit", |b| {
        let mut cache = HashMap::new();
        for i in 0..1000 {
            cache.insert(format!("key_{}", i), vec![0u8; 100]);
        }
        
        let mut rng = thread_rng();
        b.iter(|| {
            let key = format!("key_{}", rng.gen_range(0..1000));
            let value = cache.get(&key);
            black_box(value);
        });
    });
    
    // HashMap缓存未命中
    group.bench_function("hashmap_cache_miss", |b| {
        let mut cache = HashMap::new();
        for i in 0..1000 {
            cache.insert(format!("key_{}", i), vec![0u8; 100]);
        }
        
        b.iter(|| {
            let key = "non_existent_key".to_string();
            let value = cache.get(&key);
            black_box(value);
        });
    });
    
    group.finish();
}

/// 基准测试：内存分配模式
fn bench_allocation_patterns(c: &mut Criterion) {
    let mut group = c.benchmark_group("memory_allocation_patterns");
    
    // 小对象频繁分配
    group.bench_function("frequent_small_alloc", |b| {
        b.iter(|| {
            let mut vecs = Vec::new();
            for _ in 0..1000 {
                vecs.push(vec![0u8; 64]);
            }
            black_box(vecs);
        });
    });
    
    // 大对象一次分配
    group.bench_function("single_large_alloc", |b| {
        b.iter(|| {
            let vec = vec![0u8; 64000];
            black_box(vec);
        });
    });
    
    // 预分配 vs 动态增长
    group.bench_function("dynamic_growth", |b| {
        b.iter(|| {
            let mut vec = Vec::new();
            for i in 0..1000 {
                vec.push(i);
            }
            black_box(vec);
        });
    });
    
    group.bench_function("pre_allocated", |b| {
        b.iter(|| {
            let mut vec = Vec::with_capacity(1000);
            for i in 0..1000 {
                vec.push(i);
            }
            black_box(vec);
        });
    });
    
    group.finish();
}

criterion_group!(
    benches,
    bench_vec_operations,
    bench_hashmap_operations,
    bench_btreemap_vs_hashmap,
    bench_concurrent_structures,
    bench_parking_lot_vs_std,
    bench_string_operations,
    bench_box_vs_arc,
    bench_cache_simulation,
    bench_allocation_patterns,
);

criterion_main!(benches);

