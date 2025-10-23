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
    const response = await apiClient.post<AuthSession>(
      AUTH_ENDPOINTS.LOGIN,
      credentials
    );
    return response;
  }

  /**
   * 用户注册
   */
  static async register(input: RegisterInput): Promise<AuthSession> {
    const response = await apiClient.post<AuthSession>(
      AUTH_ENDPOINTS.REGISTER,
      input
    );
    return response;
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
    return response;
  }

  /**
   * 获取当前用户信息
   */
  static async getCurrentUser(): Promise<User> {
    const response = await apiClient.get<User>(AUTH_ENDPOINTS.ME);
    return response;
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
} = AuthApiClient;

