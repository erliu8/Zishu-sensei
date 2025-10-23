/**
 * 用户模块类型定义
 * @module features/user/types
 */

import { UserRole, UserStatus } from '@/features/auth/types';

/**
 * 用户统计信息
 */
export interface UserStats {
  postsCount: number;
  adaptersCount: number;
  charactersCount: number;
  followersCount: number;
  followingCount: number;
  likesCount: number;
  favoritesCount: number;
  viewsCount: number;
}

/**
 * 用户个人资料
 */
export interface UserProfile {
  id: string;
  email: string;
  username: string;
  name?: string;
  avatar?: string;
  bio?: string;
  location?: string;
  website?: string;
  github?: string;
  twitter?: string;
  role: UserRole;
  status: UserStatus;
  emailVerified?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  stats: UserStats;
}

/**
 * 用户基本信息（用于列表展示）
 */
export interface UserBasic {
  id: string;
  username: string;
  name?: string;
  avatar?: string;
  bio?: string;
  role: UserRole;
}

/**
 * 用户设置 - 个人资料
 */
export interface UserProfileSettings {
  name?: string;
  bio?: string;
  location?: string;
  website?: string;
  github?: string;
  twitter?: string;
}

/**
 * 用户设置 - 安全设置
 */
export interface UserSecuritySettings {
  email: string;
  twoFactorEnabled: boolean;
}

/**
 * 用户设置 - 偏好设置
 */
export interface UserPreferences {
  // 外观设置
  theme: 'light' | 'dark' | 'system';
  language: 'zh-CN' | 'en-US' | 'ja-JP';
  
  // 通知设置
  emailNotifications: boolean;
  pushNotifications: boolean;
  marketingEmails: boolean;
  weeklyDigest: boolean;
  
  // 隐私设置
  profileVisibility: 'public' | 'followers' | 'private';
  showEmail: boolean;
  showActivity: boolean;
  allowFollow: boolean;
  allowComment: boolean;
  allowMessage: boolean;
}

/**
 * 更新个人资料请求
 */
export interface UpdateProfileRequest {
  name?: string;
  bio?: string;
  location?: string;
  website?: string;
  github?: string;
  twitter?: string;
}

/**
 * 更新头像请求
 */
export interface UpdateAvatarRequest {
  avatar: File;
}

/**
 * 更新密码请求
 */
export interface UpdatePasswordRequest {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

/**
 * 更新邮箱请求
 */
export interface UpdateEmailRequest {
  newEmail: string;
  password: string;
}

/**
 * 更新偏好设置请求
 */
export interface UpdatePreferencesRequest {
  // 外观设置
  theme?: 'light' | 'dark' | 'system';
  language?: 'zh-CN' | 'en-US' | 'ja-JP';
  
  // 通知设置
  emailNotifications?: boolean;
  pushNotifications?: boolean;
  marketingEmails?: boolean;
  weeklyDigest?: boolean;
  
  // 隐私设置
  profileVisibility?: 'public' | 'followers' | 'private';
  showEmail?: boolean;
  showActivity?: boolean;
  allowFollow?: boolean;
  allowComment?: boolean;
  allowMessage?: boolean;
}

/**
 * 用户活动记录
 */
export interface UserActivity {
  id: string;
  userId: string;
  type: 'post' | 'comment' | 'like' | 'follow' | 'adapter' | 'character';
  action: string;
  targetId?: string;
  targetType?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
}

/**
 * 分页用户列表
 */
export interface PaginatedUsers {
  users: UserBasic[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

/**
 * 搜索用户参数
 */
export interface SearchUsersParams {
  query?: string;
  role?: UserRole;
  status?: UserStatus;
  page?: number;
  pageSize?: number;
  sortBy?: 'createdAt' | 'username' | 'postsCount' | 'followersCount';
  sortOrder?: 'asc' | 'desc';
}

/**
 * 用户会话信息
 */
export interface UserSession {
  id: string;
  userId: string;
  deviceName: string;
  deviceType: 'desktop' | 'mobile' | 'tablet' | 'unknown';
  browser: string;
  os: string;
  ip: string;
  location?: string;
  isCurrent: boolean;
  lastActiveAt: Date;
  createdAt: Date;
}

/**
 * 登录历史记录
 */
export interface LoginHistory {
  id: string;
  userId: string;
  ip: string;
  location?: string;
  deviceName: string;
  browser: string;
  os: string;
  success: boolean;
  failReason?: string;
  createdAt: Date;
}

/**
 * 分页会话列表
 */
export interface PaginatedSessions {
  sessions: UserSession[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

/**
 * 分页登录历史列表
 */
export interface PaginatedLoginHistory {
  history: LoginHistory[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

