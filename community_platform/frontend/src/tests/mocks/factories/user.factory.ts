/**
 * 用户数据工厂
 * 用于生成测试用的用户数据
 */

export interface MockUser {
  id: string;
  username: string;
  email: string;
  displayName: string;
  avatar?: string;
  bio?: string;
  createdAt: string;
  updatedAt: string;
  followersCount: number;
  followingCount: number;
  isFollowing?: boolean;
}

let userIdCounter = 1;

/**
 * 创建模拟用户
 */
export function createMockUser(overrides?: Partial<MockUser>): MockUser {
  const id = String(userIdCounter++);
  const username = `user${id}`;
  
  return {
    id,
    username,
    email: `${username}@example.com`,
    displayName: `Test User ${id}`,
    avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${id}`,
    bio: `This is test user ${id}'s bio`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    followersCount: Math.floor(Math.random() * 1000),
    followingCount: Math.floor(Math.random() * 500),
    isFollowing: false,
    ...overrides,
  };
}

/**
 * 创建多个模拟用户
 */
export function createMockUsers(count: number, overrides?: Partial<MockUser>): MockUser[] {
  return Array.from({ length: count }, () => createMockUser(overrides));
}

/**
 * 重置用户 ID 计数器
 */
export function resetUserIdCounter() {
  userIdCounter = 1;
}

