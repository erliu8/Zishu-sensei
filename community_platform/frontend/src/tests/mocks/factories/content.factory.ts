/**
 * 内容数据工厂
 * 用于生成测试用的内容数据
 */

import { createMockUser, MockUser } from './user.factory';

export interface MockContent {
  id: string;
  title: string;
  description: string;
  content: string;
  author: MockUser;
  tags: string[];
  category: string;
  likesCount: number;
  commentsCount: number;
  viewsCount: number;
  isLiked?: boolean;
  isBookmarked?: boolean;
  createdAt: string;
  updatedAt: string;
}

let contentIdCounter = 1;

/**
 * 创建模拟内容
 */
export function createMockContent(overrides?: Partial<MockContent>): MockContent {
  const id = String(contentIdCounter++);
  
  return {
    id,
    title: `Test Content ${id}`,
    description: `This is test content ${id} description`,
    content: `# Test Content ${id}\n\nThis is the full content of test item ${id}. It contains detailed information and examples.`,
    author: createMockUser(),
    tags: ['test', 'example', `tag${id}`],
    category: 'General',
    likesCount: Math.floor(Math.random() * 500),
    commentsCount: Math.floor(Math.random() * 100),
    viewsCount: Math.floor(Math.random() * 5000),
    isLiked: false,
    isBookmarked: false,
    createdAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * 创建多个模拟内容
 */
export function createMockContents(count: number, overrides?: Partial<MockContent>): MockContent[] {
  return Array.from({ length: count }, () => createMockContent(overrides));
}

/**
 * 重置内容 ID 计数器
 */
export function resetContentIdCounter() {
  contentIdCounter = 1;
}

