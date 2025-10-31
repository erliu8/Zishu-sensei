/**
 * 认证 API 客户端
 * @module features/auth/api
 */

import { apiClient } from '@/infrastructure/api';
import type {
  User,
  LoginCredentials,
  RegisterInput,
  AuthSession,
  RefreshTokenResponse,
  PasswordResetRequest,
  PasswordResetConfirm,
  ChangePassword,
  EmailVerification,
} from '../types';

/**
 * 后端用户响应类型
 */
interface BackendUserResponse {
  id: number;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  is_verified: boolean;
  created_at: string;
}

/**
 * 后端认证响应类型（从 FastAPI 返回）
 */
interface BackendAuthResponse {
  user: BackendUserResponse;
  access_token: string;
  refresh_token?: string;
  token_type: string;
  expires_in: number;
}

/**
 * Next.js API 认证响应类型（从 /api/auth/* 返回）
 */
interface NextAuthResponse {
  user: {
    id: string;
    email: string;
    username: string;
    name?: string;
    avatar?: string;
    role: string;
    status: string;
    emailVerified: Date | null;
    createdAt: Date;
    updatedAt: Date;
  };
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
}

/**
 * 将后端用户响应转换为前端User类型
 */
function transformBackendUser(backendUser: BackendUserResponse): User {
  return {
    id: backendUser.id.toString(),
    username: backendUser.username,
    email: '', // 需要从其他端点获取
    name: backendUser.full_name || undefined,
    avatar: backendUser.avatar_url || undefined,
    role: 'user' as any, // 需要从其他端点获取
    status: 'active' as any, // 需要从其他端点获取
    emailVerified: backendUser.is_verified ? new Date() : null,
    createdAt: new Date(backendUser.created_at),
    updatedAt: new Date(backendUser.created_at), // 使用created_at作为默认值
  };
}

/**
 * 将后端认证响应转换为前端AuthSession类型
 * @deprecated 当前使用 Next.js API 路由，此函数保留用于未来直接调用后端的场景
 * @internal
 */
export function transformAuthResponse(backendResponse: BackendAuthResponse): AuthSession {
  const user = transformBackendUser(backendResponse.user);
  
  // 计算过期时间戳（当前时间 + expires_in秒）
  const expiresAt = Date.now() + backendResponse.expires_in * 1000;
  
  return {
    user,
    accessToken: backendResponse.access_token,
    refreshToken: backendResponse.refresh_token,
    expiresAt,
  };
}

/**
 * 将 Next.js API 响应转换为前端AuthSession类型
 */
function transformNextAuthResponse(nextResponse: NextAuthResponse): AuthSession {
  return {
    user: nextResponse.user as User,
    accessToken: nextResponse.accessToken,
    refreshToken: nextResponse.refreshToken,
    expiresAt: nextResponse.expiresAt,
  };
}

/**
 * 认证 API 路径
 */
const AUTH_ENDPOINTS = {
  LOGIN: '/auth/login',
  REGISTER: '/auth/register',
  LOGOUT: '/auth/logout',
  REFRESH: '/auth/refresh',
  ME: '/auth/me',
  PASSWORD_RESET_REQUEST: '/auth/password-reset/request',
  PASSWORD_RESET_CONFIRM: '/auth/password-reset/confirm',
  CHANGE_PASSWORD: '/auth/password/change',
  VERIFY_EMAIL: '/auth/email/verify',
  RESEND_VERIFICATION: '/auth/email/resend',
} as const;

/**
 * 认证 API 客户端类
 */
export class AuthApiClient {
  /**
   * 用户登录
   */
  static async login(credentials: LoginCredentials): Promise<AuthSession> {
    // Next.js API 期望email字段
    const loginData = {
      email: credentials.email,
      password: credentials.password,
    };
    
    // 调用 Next.js API 路由（不是直接调用后端）
    const response = await apiClient.post<NextAuthResponse>(
      AUTH_ENDPOINTS.LOGIN,
      loginData
    );
    return transformNextAuthResponse(response.data);
  }

  /**
   * 用户注册
   */
  static async register(input: RegisterInput): Promise<AuthSession> {
    // 调用 Next.js API 路由（不是直接调用后端）
    const response = await apiClient.post<NextAuthResponse>(
      AUTH_ENDPOINTS.REGISTER,
      input
    );
    return transformNextAuthResponse(response.data);
  }

  /**
   * 用户登出
   */
  static async logout(): Promise<void> {
    await apiClient.post(AUTH_ENDPOINTS.LOGOUT);
  }

  /**
   * 刷新访问令牌
   */
  static async refreshToken(refreshToken: string): Promise<RefreshTokenResponse> {
    const response = await apiClient.post<RefreshTokenResponse>(
      AUTH_ENDPOINTS.REFRESH,
      { refreshToken }
    );
    return response.data;
  }

  /**
   * 获取当前用户信息
   */
  static async getCurrentUser(): Promise<User> {
    const response = await apiClient.get<User>(AUTH_ENDPOINTS.ME);
    return response.data;
  }

  /**
   * 请求密码重置
   */
  static async requestPasswordReset(data: PasswordResetRequest): Promise<void> {
    await apiClient.post(AUTH_ENDPOINTS.PASSWORD_RESET_REQUEST, data);
  }

  /**
   * 确认密码重置
   */
  static async confirmPasswordReset(data: PasswordResetConfirm): Promise<void> {
    await apiClient.post(AUTH_ENDPOINTS.PASSWORD_RESET_CONFIRM, data);
  }

  /**
   * 修改密码
   */
  static async changePassword(data: ChangePassword): Promise<void> {
    await apiClient.post(AUTH_ENDPOINTS.CHANGE_PASSWORD, data);
  }

  /**
   * 验证邮箱
   */
  static async verifyEmail(data: EmailVerification): Promise<void> {
    await apiClient.post(AUTH_ENDPOINTS.VERIFY_EMAIL, data);
  }

  /**
   * 重新发送验证邮件
   */
  static async resendVerificationEmail(data: { email: string }): Promise<void> {
    await apiClient.post(AUTH_ENDPOINTS.RESEND_VERIFICATION, data);
  }

  /**
   * 检查用户名是否可用
   */
  static async checkUsernameAvailability(username: string): Promise<{
    available: boolean;
    reason: string;
    suggestions?: string[];
  }> {
    const response = await apiClient.get('/users/check-username', {
      params: { username },
    });
    return response.data;
  }

  /**
   * 检查邮箱是否可用
   */
  static async checkEmailAvailability(email: string): Promise<{
    available: boolean;
    reason: string;
    suggestions?: string[];
  }> {
    const response = await apiClient.get('/users/check-email', {
      params: { email },
    });
    return response.data;
  }
}

/**
 * 导出便捷函数
 */
export const {
  login,
  register,
  logout,
  refreshToken,
  getCurrentUser,
  requestPasswordReset,
  confirmPasswordReset,
  changePassword,
  verifyEmail,
  resendVerificationEmail,
  checkUsernameAvailability,
  checkEmailAvailability,
} = AuthApiClient;

