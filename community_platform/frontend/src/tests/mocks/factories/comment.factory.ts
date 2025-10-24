/**
 * 评论数据工厂
 * 用于生成测试用的评论数据
 */

import { createMockUser, MockUser } from './user.factory';

export interface MockComment {
  id: string;
  content: string;
  author: MockUser;
  contentId: string;
  parentId?: string;
  likesCount: number;
  repliesCount: number;
  isLiked?: boolean;
  createdAt: string;
  updatedAt: string;
}

let commentIdCounter = 1;

/**
 * 创建模拟评论
 */
export function createMockComment(overrides?: Partial<MockComment>): MockComment {
  const id = String(commentIdCounter++);
  
  return {
    id,
    content: `This is test comment ${id}. Great content!`,
    author: createMockUser(),
    contentId: '1',
    likesCount: Math.floor(Math.random() * 50),
    repliesCount: Math.floor(Math.random() * 10),
    isLiked: false,
    createdAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * 创建多个模拟评论
 */
export function createMockComments(count: number, overrides?: Partial<MockComment>): MockComment[] {
  return Array.from({ length: count }, () => createMockComment(overrides));
}

/**
 * 重置评论 ID 计数器
 */
export function resetCommentIdCounter() {
  commentIdCounter = 1;
}

