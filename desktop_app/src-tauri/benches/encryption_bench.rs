// benches/encryption_bench.rs
//! 加密性能基准测试
//! 
//! 测试 AES-GCM 加密/解密、密钥派生、签名验证等性能

use criterion::{black_box, criterion_group, criterion_main, Criterion, BenchmarkId, Throughput};
use aes_gcm::{
    aead::{Aead, KeyInit, OsRng},
    Aes256Gcm, Key, Nonce,
};
use argon2::{
    password_hash::{PasswordHasher, SaltString},
    Argon2, ParamsBuilder,
};
use sha2::{Sha256, Digest};
use rand::{Rng, thread_rng};

/// 生成随机数据
fn random_bytes(size: usize) -> Vec<u8> {
    let mut rng = thread_rng();
    (0..size).map(|_| rng.gen()).collect()
}

/// 生成随机密钥
fn random_key() -> [u8; 32] {
    let mut key = [0u8; 32];
    thread_rng().fill(&mut key);
    key
}

/// 生成随机 nonce
fn random_nonce() -> [u8; 12] {
    let mut nonce = [0u8; 12];
    thread_rng().fill(&mut nonce);
    nonce
}

/// 基准测试：AES-GCM 加密
fn bench_aes_gcm_encrypt(c: &mut Criterion) {
    let mut group = c.benchmark_group("encryption_aes_gcm_encrypt");
    
    // 测试不同大小的数据加密
    for size in [1024, 10240, 102400, 1024000].iter() {
        group.throughput(Throughput::Bytes(*size as u64));
        group.bench_with_input(BenchmarkId::from_parameter(size), size, |b, &size| {
            let key_bytes = random_key();
            let key = Key::<Aes256Gcm>::from_slice(&key_bytes);
            let cipher = Aes256Gcm::new(key);
            let plaintext = random_bytes(size);
            
            b.iter(|| {
                let nonce_bytes = random_nonce();
                let nonce = Nonce::from_slice(&nonce_bytes);
                let ciphertext = cipher.encrypt(nonce, plaintext.as_ref())
                    .expect("Encryption failed");
                black_box(ciphertext);
            });
        });
    }
    
    group.finish();
}

/// 基准测试：AES-GCM 解密
fn bench_aes_gcm_decrypt(c: &mut Criterion) {
    let mut group = c.benchmark_group("encryption_aes_gcm_decrypt");
    
    for size in [1024, 10240, 102400, 1024000].iter() {
        group.throughput(Throughput::Bytes(*size as u64));
        group.bench_with_input(BenchmarkId::from_parameter(size), size, |b, &size| {
            let key_bytes = random_key();
            let key = Key::<Aes256Gcm>::from_slice(&key_bytes);
            let cipher = Aes256Gcm::new(key);
            let plaintext = random_bytes(size);
            
            // 预先加密数据
            let nonce_bytes = random_nonce();
            let nonce = Nonce::from_slice(&nonce_bytes);
            let ciphertext = cipher.encrypt(nonce, plaintext.as_ref())
                .expect("Encryption failed");
            
            b.iter(|| {
                let decrypted = cipher.decrypt(nonce, ciphertext.as_ref())
                    .expect("Decryption failed");
                black_box(decrypted);
            });
        });
    }
    
    group.finish();
}

/// 基准测试：完整的加密/解密周期
fn bench_encrypt_decrypt_cycle(c: &mut Criterion) {
    let mut group = c.benchmark_group("encryption_full_cycle");
    
    for size in [1024, 10240, 102400].iter() {
        group.throughput(Throughput::Bytes(*size as u64));
        group.bench_with_input(BenchmarkId::from_parameter(size), size, |b, &size| {
            let plaintext = random_bytes(size);
            
            b.iter(|| {
                // 生成密钥和 cipher
                let key_bytes = random_key();
                let key = Key::<Aes256Gcm>::from_slice(&key_bytes);
                let cipher = Aes256Gcm::new(key);
                
                // 加密
                let nonce_bytes = random_nonce();
                let nonce = Nonce::from_slice(&nonce_bytes);
                let ciphertext = cipher.encrypt(nonce, plaintext.as_ref())
                    .expect("Encryption failed");
                
                // 解密
                let decrypted = cipher.decrypt(nonce, ciphertext.as_ref())
                    .expect("Decryption failed");
                
                black_box(decrypted);
            });
        });
    }
    
    group.finish();
}

/// 基准测试：Argon2 密钥派生
fn bench_argon2_key_derivation(c: &mut Criterion) {
    let mut group = c.benchmark_group("encryption_argon2_kdf");
    
    // 不同的内存成本配置
    let configs = vec![
        ("low", 32768),      // 32 MB
        ("medium", 65536),   // 64 MB
        ("high", 131072),    // 128 MB
    ];
    
    for (name, mem_cost) in configs {
        group.bench_function(name, |b| {
            let password = "test_password_for_benchmarking";
            let salt = SaltString::generate(&mut OsRng);
            
            b.iter(|| {
                let params = ParamsBuilder::new()
                    .m_cost(mem_cost)
                    .t_cost(3)
                    .p_cost(4)
                    .build()
                    .expect("Failed to build params");
                
                let argon2 = Argon2::new(
                    argon2::Algorithm::Argon2id,
                    argon2::Version::V0x13,
                    params,
                );
                
                let password_hash = argon2.hash_password(password.as_bytes(), &salt)
                    .expect("Hashing failed");
                
                black_box(password_hash);
            });
        });
    }
    
    group.finish();
}

/// 基准测试：SHA-256 哈希
fn bench_sha256_hash(c: &mut Criterion) {
    let mut group = c.benchmark_group("encryption_sha256_hash");
    
    for size in [1024, 10240, 102400, 1024000, 10240000].iter() {
        group.throughput(Throughput::Bytes(*size as u64));
        group.bench_with_input(BenchmarkId::from_parameter(size), size, |b, &size| {
            let data = random_bytes(size);
            
            b.iter(|| {
                let mut hasher = Sha256::new();
                hasher.update(&data);
                let result = hasher.finalize();
                black_box(result);
            });
        });
    }
    
    group.finish();
}

/// 基准测试：批量加密
fn bench_batch_encryption(c: &mut Criterion) {
    let mut group = c.benchmark_group("encryption_batch");
    
    for count in [10, 50, 100, 500].iter() {
        group.throughput(Throughput::Elements(*count as u64));
        group.bench_with_input(BenchmarkId::from_parameter(count), count, |b, &count| {
            let key_bytes = random_key();
            let key = Key::<Aes256Gcm>::from_slice(&key_bytes);
            let cipher = Aes256Gcm::new(key);
            
            // 准备多个明文
            let plaintexts: Vec<_> = (0..count)
                .map(|_| random_bytes(1024))
                .collect();
            
            b.iter(|| {
                let ciphertexts: Vec<_> = plaintexts.iter().map(|plaintext| {
                    let nonce_bytes = random_nonce();
                    let nonce = Nonce::from_slice(&nonce_bytes);
                    cipher.encrypt(nonce, plaintext.as_ref())
                        .expect("Encryption failed")
                }).collect();
                
                black_box(ciphertexts);
            });
        });
    }
    
    group.finish();
}

/// 基准测试：密钥生成
fn bench_key_generation(c: &mut Criterion) {
    let mut group = c.benchmark_group("encryption_key_generation");
    
    // 随机密钥生成
    group.bench_function("random_key_32bytes", |b| {
        b.iter(|| {
            let key = random_key();
            black_box(key);
        });
    });
    
    // Salt 生成
    group.bench_function("salt_generation", |b| {
        b.iter(|| {
            let salt = SaltString::generate(&mut OsRng);
            black_box(salt);
        });
    });
    
    // Nonce 生成
    group.bench_function("nonce_generation", |b| {
        b.iter(|| {
            let nonce = random_nonce();
            black_box(nonce);
        });
    });
    
    group.finish();
}

/// 基准测试：不同加密算法对比
fn bench_cipher_comparison(c: &mut Criterion) {
    let mut group = c.benchmark_group("encryption_cipher_comparison");
    
    let data_size = 10240; // 10KB
    let plaintext = random_bytes(data_size);
    
    // AES-256-GCM
    group.bench_function("aes256_gcm", |b| {
        let key_bytes = random_key();
        let key = Key::<Aes256Gcm>::from_slice(&key_bytes);
        let cipher = Aes256Gcm::new(key);
        
        b.iter(|| {
            let nonce_bytes = random_nonce();
            let nonce = Nonce::from_slice(&nonce_bytes);
            let ciphertext = cipher.encrypt(nonce, plaintext.as_ref())
                .expect("Encryption failed");
            black_box(ciphertext);
        });
    });
    
    group.finish();
}

/// 基准测试：Base64 编码/解码（常用于存储加密数据）
fn bench_base64_encoding(c: &mut Criterion) {
    let mut group = c.benchmark_group("encryption_base64");
    
    use base64::{engine::general_purpose, Engine};
    
    for size in [1024, 10240, 102400].iter() {
        group.throughput(Throughput::Bytes(*size as u64));
        
        // 编码
        group.bench_with_input(
            BenchmarkId::new("encode", size),
            size,
            |b, &size| {
                let data = random_bytes(size);
                b.iter(|| {
                    let encoded = general_purpose::STANDARD.encode(&data);
                    black_box(encoded);
                });
            },
        );
        
        // 解码
        group.bench_with_input(
            BenchmarkId::new("decode", size),
            size,
            |b, &size| {
                let data = random_bytes(size);
                let encoded = general_purpose::STANDARD.encode(&data);
                b.iter(|| {
                    let decoded = general_purpose::STANDARD.decode(&encoded)
                        .expect("Decode failed");
                    black_box(decoded);
                });
            },
        );
    }
    
    group.finish();
}

criterion_group!(
    benches,
    bench_aes_gcm_encrypt,
    bench_aes_gcm_decrypt,
    bench_encrypt_decrypt_cycle,
    bench_argon2_key_derivation,
    bench_sha256_hash,
    bench_batch_encryption,
    bench_key_generation,
    bench_cipher_comparison,
    bench_base64_encoding,
);

criterion_main!(benches);

