pub mod config;
pub mod bridge;
pub mod logger;
pub mod file_system;
pub mod file_preview;
pub mod encryption;
pub mod key_manager;
pub mod security_audit;
pub mod data_masking;
pub mod permission_checker;
pub mod data_cleanup;
pub mod anonymizer;
pub mod memory_manager;

pub use config::{
    get_app_log_dir,
    get_app_data_dir,
    get_config_file_path,
    get_config_backup_path,
    load_config,
    save_config,
    reset_config,
    import_config,
    export_config,
    validate_config,
    merge_config,
    get_config_info,
    get_backup_files,
    clean_old_backups,
    create_config_snapshot,
    restore_from_snapshot,
    get_config_diff,
};

pub use logger::{
    Logger,
    LogLevel,
    LogEntry,
    LoggerConfig,
    LoggerError,
    LoggerResult,
    RotationStrategy,
    init_global_logger,
    global_logger,
    init_tracing,
};

pub use encryption::{
    EncryptionManager,
    EncryptedData,
    KeyDerivationParams,
    EncryptionError,
    generate_salt,
    generate_random_key,
    generate_random_password,
    quick_encrypt,
    quick_decrypt,
};

pub use key_manager::{
    KeyManager,
    StoredKeyInfo,
    KeyManagerError,
    GLOBAL_KEY_MANAGER,
};

pub use security_audit::{
    SecurityAuditLogger,
    AuditEvent,
    AuditEventType,
    AuditLevel,
    AuditEventFilter,
    AuditStatistics,
    init_global_audit_logger,
    log_audit_event,
    log_audit_success,
    log_audit_failure,
};

pub use data_masking::{
    DataMasker,
    MaskingStrategy,
    SensitiveDataType,
    quick_mask,
};

pub use permission_checker::{
    PermissionChecker,
    FileSystemChecker,
    NetworkChecker,
    SystemChecker,
    AppChecker,
    HardwareChecker,
    PermissionGuardResult,
    with_permission,
};

