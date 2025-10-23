/**
 * 用户领域模型
 * @module features/auth/domain
 */

import { User as IUser, UserRole, UserStatus } from '../types';

/**
 * 用户领域模型类
 */
export class User implements IUser {
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

  constructor(data: IUser) {
    this.id = data.id;
    this.email = data.email;
    this.username = data.username;
    this.name = data.name;
    this.avatar = data.avatar;
    this.role = data.role;
    this.status = data.status;
    this.emailVerified = data.emailVerified;
    this.createdAt = new Date(data.createdAt);
    this.updatedAt = new Date(data.updatedAt);
  }

  /**
   * 检查用户是否是管理员
   */
  isAdmin(): boolean {
    return this.role === UserRole.ADMIN;
  }

  /**
   * 检查用户是否是版主
   */
  isModerator(): boolean {
    return this.role === UserRole.MODERATOR || this.isAdmin();
  }

  /**
   * 检查用户是否激活
   */
  isActive(): boolean {
    return this.status === UserStatus.ACTIVE;
  }

  /**
   * 检查用户是否被暂停
   */
  isSuspended(): boolean {
    return this.status === UserStatus.SUSPENDED;
  }

  /**
   * 检查用户是否被删除
   */
  isDeleted(): boolean {
    return this.status === UserStatus.DELETED;
  }

  /**
   * 检查邮箱是否已验证
   */
  isEmailVerified(): boolean {
    return !!this.emailVerified;
  }

  /**
   * 检查用户是否有权限
   */
  hasPermission(requiredRole: UserRole): boolean {
    const roleHierarchy: Record<UserRole, number> = {
      [UserRole.GUEST]: 0,
      [UserRole.USER]: 1,
      [UserRole.MODERATOR]: 2,
      [UserRole.ADMIN]: 3,
    };

    return roleHierarchy[this.role] >= roleHierarchy[requiredRole];
  }

  /**
   * 获取显示名称
   */
  getDisplayName(): string {
    return this.name || this.username;
  }

  /**
   * 获取头像 URL
   */
  getAvatarUrl(): string {
    if (this.avatar) {
      return this.avatar;
    }
    // 使用 Gravatar 作为默认头像
    return `https://www.gravatar.com/avatar/${this.email}?d=identicon`;
  }

  /**
   * 转换为普通对象
   */
  toJSON(): IUser {
    return {
      id: this.id,
      email: this.email,
      username: this.username,
      name: this.name,
      avatar: this.avatar,
      role: this.role,
      status: this.status,
      emailVerified: this.emailVerified,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  /**
   * 从API响应创建用户实例
   */
  static fromAPI(data: any): User {
    return new User({
      id: data.id,
      email: data.email,
      username: data.username,
      name: data.name,
      avatar: data.avatar,
      role: data.role as UserRole,
      status: data.status as UserStatus,
      emailVerified: data.emailVerified ? new Date(data.emailVerified) : null,
      createdAt: new Date(data.createdAt),
      updatedAt: new Date(data.updatedAt),
    });
  }
}

