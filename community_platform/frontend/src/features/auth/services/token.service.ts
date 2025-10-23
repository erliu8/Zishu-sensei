/**
 * JWT Token 管理服务
 * @module features/auth/services
 */

import { jwtVerify, SignJWT } from 'jose';
import type { TokenPayload, AuthSession } from '../types';

/**
 * Token 存储键名
 */
const TOKEN_KEYS = {
  ACCESS_TOKEN: 'auth_access_token',
  REFRESH_TOKEN: 'auth_refresh_token',
  EXPIRES_AT: 'auth_expires_at',
} as const;

/**
 * JWT 密钥
 */
const getJWTSecret = (): Uint8Array => {
  const secret = process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET || 'default-secret-key';
  return new TextEncoder().encode(secret);
};

/**
 * Token 服务类
 */
export class TokenService {
  /**
   * 验证 JWT Token
   */
  static async verifyToken(token: string): Promise<TokenPayload | null> {
    try {
      const secret = getJWTSecret();
      const { payload } = await jwtVerify(token, secret);
      
      return {
        sub: payload.sub as string,
        email: payload.email as string,
        role: payload.role as any,
        iat: payload.iat,
        exp: payload.exp,
      };
    } catch (error) {
      console.error('Token verification failed:', error);
      return null;
    }
  }

  /**
   * 生成 JWT Token（仅在服务端使用）
   */
  static async generateToken(payload: Omit<TokenPayload, 'iat' | 'exp'>, expiresIn: string = '7d'): Promise<string> {
    try {
      const secret = getJWTSecret();
      
      const token = await new SignJWT({ ...payload })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime(expiresIn)
        .sign(secret);
      
      return token;
    } catch (error) {
      console.error('Token generation failed:', error);
      throw error;
    }
  }

  /**
   * 解码 Token（不验证）
   */
  static decodeToken(token: string): TokenPayload | null {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        return null;
      }

      const payload = JSON.parse(atob(parts[1]));
      return {
        sub: payload.sub,
        email: payload.email,
        role: payload.role,
        iat: payload.iat,
        exp: payload.exp,
      };
    } catch (error) {
      console.error('Token decode failed:', error);
      return null;
    }
  }

  /**
   * 检查 Token 是否过期
   */
  static isTokenExpired(token: string): boolean {
    const payload = this.decodeToken(token);
    if (!payload || !payload.exp) {
      return true;
    }

    const now = Math.floor(Date.now() / 1000);
    // 提前5分钟判定为过期，用于刷新
    return payload.exp - now < 300;
  }

  /**
   * 获取 Token 剩余时间（秒）
   */
  static getTokenRemainingTime(token: string): number {
    const payload = this.decodeToken(token);
    if (!payload || !payload.exp) {
      return 0;
    }

    const now = Math.floor(Date.now() / 1000);
    return Math.max(0, payload.exp - now);
  }

  /**
   * 保存 Token 到本地存储
   */
  static saveTokens(accessToken: string, refreshToken?: string, expiresAt?: number): void {
    if (typeof window === 'undefined') return;

    try {
      localStorage.setItem(TOKEN_KEYS.ACCESS_TOKEN, accessToken);
      
      if (refreshToken) {
        localStorage.setItem(TOKEN_KEYS.REFRESH_TOKEN, refreshToken);
      }
      
      if (expiresAt) {
        localStorage.setItem(TOKEN_KEYS.EXPIRES_AT, expiresAt.toString());
      }
    } catch (error) {
      console.error('Failed to save tokens:', error);
    }
  }

  /**
   * 从本地存储获取访问令牌
   */
  static getAccessToken(): string | null {
    if (typeof window === 'undefined') return null;

    try {
      return localStorage.getItem(TOKEN_KEYS.ACCESS_TOKEN);
    } catch (error) {
      console.error('Failed to get access token:', error);
      return null;
    }
  }

  /**
   * 从本地存储获取刷新令牌
   */
  static getRefreshToken(): string | null {
    if (typeof window === 'undefined') return null;

    try {
      return localStorage.getItem(TOKEN_KEYS.REFRESH_TOKEN);
    } catch (error) {
      console.error('Failed to get refresh token:', error);
      return null;
    }
  }

  /**
   * 获取过期时间
   */
  static getExpiresAt(): number | null {
    if (typeof window === 'undefined') return null;

    try {
      const expiresAt = localStorage.getItem(TOKEN_KEYS.EXPIRES_AT);
      return expiresAt ? parseInt(expiresAt, 10) : null;
    } catch (error) {
      console.error('Failed to get expires at:', error);
      return null;
    }
  }

  /**
   * 清除所有 Token
   */
  static clearTokens(): void {
    if (typeof window === 'undefined') return;

    try {
      localStorage.removeItem(TOKEN_KEYS.ACCESS_TOKEN);
      localStorage.removeItem(TOKEN_KEYS.REFRESH_TOKEN);
      localStorage.removeItem(TOKEN_KEYS.EXPIRES_AT);
    } catch (error) {
      console.error('Failed to clear tokens:', error);
    }
  }

  /**
   * 检查是否已登录
   */
  static isAuthenticated(): boolean {
    const token = this.getAccessToken();
    if (!token) {
      return false;
    }

    return !this.isTokenExpired(token);
  }

  /**
   * 获取当前用户 ID
   */
  static getCurrentUserId(): string | null {
    const token = this.getAccessToken();
    if (!token) {
      return null;
    }

    const payload = this.decodeToken(token);
    return payload?.sub || null;
  }

  /**
   * 获取当前用户角色
   */
  static getCurrentUserRole(): string | null {
    const token = this.getAccessToken();
    if (!token) {
      return null;
    }

    const payload = this.decodeToken(token);
    return payload?.role || null;
  }
}

/**
 * 导出便捷函数
 */
export const {
  verifyToken,
  generateToken,
  decodeToken,
  isTokenExpired,
  getTokenRemainingTime,
  saveTokens,
  getAccessToken,
  getRefreshToken,
  clearTokens,
  isAuthenticated,
  getCurrentUserId,
  getCurrentUserRole,
} = TokenService;

