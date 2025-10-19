/**
 * 权限管理类型定义
 * 
 * 提供完整的权限系统类型定义，包括：
 * - 权限类型和级别
 * - 权限授权和状态
 * - 权限使用日志
 * - 权限统计
 */

// ================================
// 权限类型和级别
// ================================

/**
 * 权限类型枚举
 */
export enum PermissionType {
  // 文件系统权限
  FILE_READ = 'file_read',
  FILE_WRITE = 'file_write',
  FILE_DELETE = 'file_delete',
  FILE_EXECUTE = 'file_execute',
  FILE_WATCH = 'file_watch',

  // 网络权限
  NETWORK_HTTP = 'network_http',
  NETWORK_WEBSOCKET = 'network_websocket',
  NETWORK_SOCKET = 'network_socket',
  NETWORK_DNS = 'network_dns',

  // 系统权限
  SYSTEM_COMMAND = 'system_command',
  SYSTEM_ENV = 'system_env',
  SYSTEM_INFO = 'system_info',
  SYSTEM_CLIPBOARD = 'system_clipboard',
  SYSTEM_NOTIFICATION = 'system_notification',

  // 应用权限
  APP_DATABASE = 'app_database',
  APP_CONFIG = 'app_config',
  APP_CHAT_HISTORY = 'app_chat_history',
  APP_USER_DATA = 'app_user_data',
  APP_ADAPTER = 'app_adapter',

  // 硬件权限
  HARDWARE_CAMERA = 'hardware_camera',
  HARDWARE_MICROPHONE = 'hardware_microphone',
  HARDWARE_SCREEN_CAPTURE = 'hardware_screen_capture',
  HARDWARE_LOCATION = 'hardware_location',

  // 高级权限
  ADVANCED_AUTO_START = 'advanced_auto_start',
  ADVANCED_BACKGROUND = 'advanced_background',
  ADVANCED_ADMIN = 'advanced_admin',
}

/**
 * 权限级别枚举
 */
export enum PermissionLevel {
  NONE = 'none',
  READ_ONLY = 'readonly',
  READ_WRITE = 'readwrite',
  FULL = 'full',
}

/**
 * 权限状态枚举
 */
export enum PermissionStatus {
  PENDING = 'pending',
  GRANTED = 'granted',
  DENIED = 'denied',
  REVOKED = 'revoked',
  EXPIRED = 'expired',
}

/**
 * 权限分类
 */
export enum PermissionCategory {
  FILESYSTEM = 'filesystem',
  NETWORK = 'network',
  SYSTEM = 'system',
  APPLICATION = 'application',
  HARDWARE = 'hardware',
  ADVANCED = 'advanced',
}

// ================================
// 数据结构
// ================================

/**
 * 权限定义
 */
export interface Permission {
  /** 权限ID */
  id: number;
  /** 权限名称 */
  name: string;
  /** 权限类型 */
  permission_type: PermissionType;
  /** 权限级别 */
  level: PermissionLevel;
  /** 显示名称 */
  display_name: string;
  /** 描述 */
  description: string;
  /** 分类 */
  category: PermissionCategory;
  /** 是否危险权限 */
  is_dangerous: boolean;
  /** 是否可撤销 */
  is_revocable: boolean;
  /** 依赖的其他权限 */
  dependencies: string[];
  /** 创建时间 */
  created_at: string;
}

/**
 * 权限授权记录
 */
export interface PermissionGrant {
  /** 授权ID */
  id: number;
  /** 实体类型 */
  entity_type: string;
  /** 实体ID */
  entity_id: string;
  /** 权限类型 */
  permission_type: PermissionType;
  /** 权限级别 */
  level: PermissionLevel;
  /** 授权状态 */
  status: PermissionStatus;
  /** 授权范围 */
  scope?: string;
  /** 授权时间 */
  granted_at?: string;
  /** 过期时间 */
  expires_at?: string;
  /** 授权者 */
  granted_by?: string;
  /** 拒绝/撤销原因 */
  reason?: string;
  /** 最后修改时间 */
  updated_at: string;
  /** 创建时间 */
  created_at: string;
}

/**
 * 权限使用日志
 */
export interface PermissionUsageLog {
  /** 日志ID */
  id: number;
  /** 实体类型 */
  entity_type: string;
  /** 实体ID */
  entity_id: string;
  /** 权限类型 */
  permission_type: PermissionType;
  /** 使用的级别 */
  level: PermissionLevel;
  /** 访问的资源 */
  resource?: string;
  /** 操作描述 */
  action: string;
  /** 是否成功 */
  success: boolean;
  /** 失败原因 */
  failure_reason?: string;
  /** IP地址 */
  ip_address?: string;
  /** 使用时间 */
  used_at: string;
  /** 额外元数据 */
  metadata?: string;
}

/**
 * 权限组
 */
export interface PermissionGroup {
  /** 组ID */
  id: number;
  /** 组名 */
  name: string;
  /** 显示名称 */
  display_name: string;
  /** 描述 */
  description: string;
  /** 包含的权限列表 */
  permissions: PermissionType[];
  /** 创建时间 */
  created_at: string;
}

/**
 * 权限统计信息
 */
export interface PermissionStats {
  /** 实体ID */
  entity_id: string;
  /** 总授权数 */
  total_grants: number;
  /** 活跃授权数 */
  active_grants: number;
  /** 待审核数 */
  pending_grants: number;
  /** 被拒绝数 */
  denied_grants: number;
  /** 总使用次数 */
  total_usage: number;
  /** 最后使用时间 */
  last_used_at?: string;
  /** 按类型统计 */
  by_type: Record<string, number>;
}

// ================================
// 请求数据结构
// ================================

/**
 * 权限请求
 */
export interface PermissionRequest {
  /** 实体类型 */
  entity_type: string;
  /** 实体ID */
  entity_id: string;
  /** 权限类型 */
  permission_type: PermissionType;
  /** 权限级别 */
  level: PermissionLevel;
  /** 权限范围 */
  scope?: string;
}

/**
 * 权限授予请求
 */
export interface PermissionGrantRequest {
  /** 实体类型 */
  entity_type: string;
  /** 实体ID */
  entity_id: string;
  /** 权限类型 */
  permission_type: PermissionType;
  /** 权限级别 */
  level: PermissionLevel;
  /** 权限范围 */
  scope?: string;
  /** 授权者 */
  granted_by?: string;
  /** 过期时间 (ISO 8601) */
  expires_at?: string;
}

/**
 * 权限撤销/拒绝请求
 */
export interface PermissionRevokeRequest {
  /** 实体类型 */
  entity_type: string;
  /** 实体ID */
  entity_id: string;
  /** 权限类型 */
  permission_type: PermissionType;
  /** 权限范围 */
  scope?: string;
  /** 原因 */
  reason?: string;
}

/**
 * 权限检查请求
 */
export interface PermissionCheckRequest {
  /** 实体类型 */
  entity_type: string;
  /** 实体ID */
  entity_id: string;
  /** 权限类型 */
  permission_type: PermissionType;
  /** 权限级别 */
  level: PermissionLevel;
  /** 权限范围 */
  scope?: string;
}

/**
 * 权限使用日志请求
 */
export interface PermissionUsageLogRequest {
  /** 实体类型 */
  entity_type: string;
  /** 实体ID */
  entity_id: string;
  /** 权限类型 */
  permission_type: PermissionType;
  /** 权限级别 */
  level: PermissionLevel;
  /** 访问的资源 */
  resource?: string;
  /** 操作描述 */
  action: string;
  /** 是否成功 */
  success: boolean;
  /** 失败原因 */
  failure_reason?: string;
  /** IP地址 */
  ip_address?: string;
  /** 额外元数据 */
  metadata?: Record<string, any>;
}

/**
 * 权限组创建请求
 */
export interface PermissionGroupRequest {
  /** 组名 */
  name: string;
  /** 显示名称 */
  display_name: string;
  /** 描述 */
  description: string;
  /** 权限列表 */
  permissions: PermissionType[];
}

/**
 * 批量授予权限组请求
 */
export interface GrantPermissionGroupRequest {
  /** 实体类型 */
  entity_type: string;
  /** 实体ID */
  entity_id: string;
  /** 组名 */
  group_name: string;
  /** 权限级别 */
  level: PermissionLevel;
  /** 授权者 */
  granted_by?: string;
  /** 过期时间 */
  expires_at?: string;
}

// ================================
// UI 相关类型
// ================================

/**
 * 权限对话框配置
 */
export interface PermissionDialogConfig {
  /** 是否显示 */
  visible: boolean;
  /** 权限授权信息 */
  grant?: PermissionGrant;
  /** 权限定义信息 */
  permission?: Permission;
  /** 回调函数 */
  onGrant?: (grant: PermissionGrant) => void;
  onDeny?: (grant: PermissionGrant, reason?: string) => void;
  onRevoke?: (grant: PermissionGrant, reason?: string) => void;
}

/**
 * 权限过滤器
 */
export interface PermissionFilter {
  /** 实体类型 */
  entity_type?: string;
  /** 实体ID */
  entity_id?: string;
  /** 权限类型 */
  permission_type?: PermissionType;
  /** 权限状态 */
  status?: PermissionStatus;
  /** 分类 */
  category?: PermissionCategory;
  /** 是否危险权限 */
  is_dangerous?: boolean;
  /** 搜索关键词 */
  search?: string;
}

/**
 * 权限排序选项
 */
export interface PermissionSortOptions {
  /** 排序字段 */
  field: 'created_at' | 'updated_at' | 'used_at' | 'name' | 'category';
  /** 排序方向 */
  direction: 'asc' | 'desc';
}

// ================================
// 工具函数类型
// ================================

/**
 * 权限检查结果
 */
export interface PermissionCheckResult {
  /** 是否授予 */
  granted: boolean;
  /** 权限信息 */
  grant?: PermissionGrant;
  /** 原因 */
  reason?: string;
}

/**
 * 权限元数据
 */
export interface PermissionMetadata {
  /** 图标 */
  icon: string;
  /** 颜色 */
  color: string;
  /** 风险级别 */
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  /** 用户友好的描述 */
  user_friendly_description: string;
}

// ================================
// 事件类型
// ================================

/**
 * 权限事件类型
 */
export enum PermissionEventType {
  REQUEST = 'permission-request',
  GRANTED = 'permission-granted',
  DENIED = 'permission-denied',
  REVOKED = 'permission-revoked',
  USED = 'permission-used',
  EXPIRED = 'permission-expired',
}

/**
 * 权限事件数据
 */
export interface PermissionEventData {
  /** 事件类型 */
  type: PermissionEventType;
  /** 实体类型 */
  entity_type: string;
  /** 实体ID */
  entity_id: string;
  /** 权限类型 */
  permission_type: PermissionType;
  /** 权限级别 */
  level: PermissionLevel;
  /** 权限范围 */
  scope?: string;
  /** 额外数据 */
  data?: any;
  /** 时间戳 */
  timestamp: string;
}

// ================================
// 常量定义
// ================================

/**
 * 权限类型元数据映射
 */
export const PERMISSION_METADATA: Record<PermissionType, PermissionMetadata> = {
  [PermissionType.FILE_READ]: {
    icon: '📖',
    color: '#3b82f6',
    risk_level: 'low',
    user_friendly_description: '读取您计算机上的文件',
  },
  [PermissionType.FILE_WRITE]: {
    icon: '✏️',
    color: '#f59e0b',
    risk_level: 'medium',
    user_friendly_description: '创建或修改您计算机上的文件',
  },
  [PermissionType.FILE_DELETE]: {
    icon: '🗑️',
    color: '#ef4444',
    risk_level: 'high',
    user_friendly_description: '删除您计算机上的文件',
  },
  [PermissionType.FILE_EXECUTE]: {
    icon: '⚡',
    color: '#dc2626',
    risk_level: 'critical',
    user_friendly_description: '执行程序或脚本',
  },
  [PermissionType.FILE_WATCH]: {
    icon: '👀',
    color: '#8b5cf6',
    risk_level: 'low',
    user_friendly_description: '监听文件变化',
  },
  [PermissionType.NETWORK_HTTP]: {
    icon: '🌐',
    color: '#3b82f6',
    risk_level: 'low',
    user_friendly_description: '访问互联网（HTTP/HTTPS）',
  },
  [PermissionType.NETWORK_WEBSOCKET]: {
    icon: '🔌',
    color: '#6366f1',
    risk_level: 'medium',
    user_friendly_description: '建立实时网络连接',
  },
  [PermissionType.NETWORK_SOCKET]: {
    icon: '🔗',
    color: '#dc2626',
    risk_level: 'high',
    user_friendly_description: '访问底层网络功能',
  },
  [PermissionType.NETWORK_DNS]: {
    icon: '🏷️',
    color: '#10b981',
    risk_level: 'low',
    user_friendly_description: '查询域名信息',
  },
  [PermissionType.SYSTEM_COMMAND]: {
    icon: '💻',
    color: '#dc2626',
    risk_level: 'critical',
    user_friendly_description: '执行系统命令',
  },
  [PermissionType.SYSTEM_ENV]: {
    icon: '🔐',
    color: '#f59e0b',
    risk_level: 'medium',
    user_friendly_description: '访问系统环境变量',
  },
  [PermissionType.SYSTEM_INFO]: {
    icon: 'ℹ️',
    color: '#3b82f6',
    risk_level: 'low',
    user_friendly_description: '获取系统信息',
  },
  [PermissionType.SYSTEM_CLIPBOARD]: {
    icon: '📋',
    color: '#8b5cf6',
    risk_level: 'medium',
    user_friendly_description: '访问剪贴板',
  },
  [PermissionType.SYSTEM_NOTIFICATION]: {
    icon: '🔔',
    color: '#06b6d4',
    risk_level: 'low',
    user_friendly_description: '显示系统通知',
  },
  [PermissionType.APP_DATABASE]: {
    icon: '💾',
    color: '#ef4444',
    risk_level: 'high',
    user_friendly_description: '访问应用数据库',
  },
  [PermissionType.APP_CONFIG]: {
    icon: '⚙️',
    color: '#f59e0b',
    risk_level: 'high',
    user_friendly_description: '修改应用配置',
  },
  [PermissionType.APP_CHAT_HISTORY]: {
    icon: '💬',
    color: '#ef4444',
    risk_level: 'high',
    user_friendly_description: '访问聊天历史记录',
  },
  [PermissionType.APP_USER_DATA]: {
    icon: '👤',
    color: '#dc2626',
    risk_level: 'critical',
    user_friendly_description: '访问用户个人数据',
  },
  [PermissionType.APP_ADAPTER]: {
    icon: '🔌',
    color: '#8b5cf6',
    risk_level: 'medium',
    user_friendly_description: '调用其他适配器',
  },
  [PermissionType.HARDWARE_CAMERA]: {
    icon: '📷',
    color: '#dc2626',
    risk_level: 'critical',
    user_friendly_description: '访问摄像头',
  },
  [PermissionType.HARDWARE_MICROPHONE]: {
    icon: '🎤',
    color: '#dc2626',
    risk_level: 'critical',
    user_friendly_description: '访问麦克风',
  },
  [PermissionType.HARDWARE_SCREEN_CAPTURE]: {
    icon: '🖥️',
    color: '#dc2626',
    risk_level: 'critical',
    user_friendly_description: '录制屏幕内容',
  },
  [PermissionType.HARDWARE_LOCATION]: {
    icon: '📍',
    color: '#ef4444',
    risk_level: 'high',
    user_friendly_description: '获取地理位置',
  },
  [PermissionType.ADVANCED_AUTO_START]: {
    icon: '🚀',
    color: '#f59e0b',
    risk_level: 'medium',
    user_friendly_description: '开机自动启动',
  },
  [PermissionType.ADVANCED_BACKGROUND]: {
    icon: '🌙',
    color: '#6366f1',
    risk_level: 'medium',
    user_friendly_description: '在后台持续运行',
  },
  [PermissionType.ADVANCED_ADMIN]: {
    icon: '👑',
    color: '#dc2626',
    risk_level: 'critical',
    user_friendly_description: '需要管理员权限',
  },
};

/**
 * 权限分类显示名称
 */
export const PERMISSION_CATEGORY_NAMES: Record<PermissionCategory, string> = {
  [PermissionCategory.FILESYSTEM]: '文件系统',
  [PermissionCategory.NETWORK]: '网络访问',
  [PermissionCategory.SYSTEM]: '系统功能',
  [PermissionCategory.APPLICATION]: '应用数据',
  [PermissionCategory.HARDWARE]: '硬件设备',
  [PermissionCategory.ADVANCED]: '高级权限',
};

/**
 * 权限级别显示名称
 */
export const PERMISSION_LEVEL_NAMES: Record<PermissionLevel, string> = {
  [PermissionLevel.NONE]: '无权限',
  [PermissionLevel.READ_ONLY]: '只读',
  [PermissionLevel.READ_WRITE]: '读写',
  [PermissionLevel.FULL]: '完全控制',
};

/**
 * 权限状态显示名称
 */
export const PERMISSION_STATUS_NAMES: Record<PermissionStatus, string> = {
  [PermissionStatus.PENDING]: '待审核',
  [PermissionStatus.GRANTED]: '已授予',
  [PermissionStatus.DENIED]: '已拒绝',
  [PermissionStatus.REVOKED]: '已撤销',
  [PermissionStatus.EXPIRED]: '已过期',
};

/**
 * 权限状态颜色
 */
export const PERMISSION_STATUS_COLORS: Record<PermissionStatus, string> = {
  [PermissionStatus.PENDING]: '#f59e0b',
  [PermissionStatus.GRANTED]: '#10b981',
  [PermissionStatus.DENIED]: '#ef4444',
  [PermissionStatus.REVOKED]: '#6b7280',
  [PermissionStatus.EXPIRED]: '#9ca3af',
};

