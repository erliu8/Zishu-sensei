/**
 * 认证模块类型定义
 * @module features/auth/types
 */

/**
 * 用户角色枚举
 */
export enum UserRole {
  ADMIN = 'admin',
  MODERATOR = 'moderator',
  USER = 'user',
  GUEST = 'guest',
}

/**
 * 用户状态枚举
 */
export enum UserStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
  DELETED = 'deleted',
}

/**
 * 认证提供者类型
 */
export enum AuthProvider {
  CREDENTIALS = 'credentials',
  GITHUB = 'github',
  GOOGLE = 'google',
}

/**
 * 用户信息接口
 */
export interface User {
  id: string;
  email: string;
  username: string;
  name?: string;
  avatar?: string;
  role: UserRole;
  status: UserStatus;
  emailVerified?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 认证会话信息
 */
export interface AuthSession {
  user: User;
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
}

/**
 * 登录凭证
 */
export interface LoginCredentials {
  email: string;
  password: string;
  remember?: boolean;
}

/**
 * 注册信息
 */
export interface RegisterInput {
  email: string;
  username: string;
  password: string;
  full_name?: string;
}

/**
 * Token 载荷
 */
export interface TokenPayload {
  sub: string; // user id
  email: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}

/**
 * 刷新 Token 响应
 */
export interface RefreshTokenResponse {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
}

/**
 * 密码重置请求
 */
export interface PasswordResetRequest {
  email: string;
}

/**
 * 密码重置确认
 */
export interface PasswordResetConfirm {
  token: string;
  password: string;
}

/**
 * 修改密码
 */
export interface ChangePassword {
  currentPassword: string;
  newPassword: string;
}

/**
 * 邮箱验证
 */
export interface EmailVerification {
  token: string;
}

/**
 * OAuth 回调参数
 */
export interface OAuthCallbackParams {
  code: string;
  state?: string;
  error?: string;
}

/**
 * 认证错误类型
 */
export enum AuthErrorType {
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  EMAIL_ALREADY_EXISTS = 'EMAIL_ALREADY_EXISTS',
  USERNAME_ALREADY_EXISTS = 'USERNAME_ALREADY_EXISTS',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  TOKEN_INVALID = 'TOKEN_INVALID',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  EMAIL_NOT_VERIFIED = 'EMAIL_NOT_VERIFIED',
  ACCOUNT_SUSPENDED = 'ACCOUNT_SUSPENDED',
  ACCOUNT_DELETED = 'ACCOUNT_DELETED',
}

/**
 * 认证错误
 */
export class AuthError extends Error {
  constructor(
    public type: AuthErrorType,
    message: string,
    public statusCode: number = 401
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

