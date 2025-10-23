/**
 * 帖子数据层 - 验证器
 * @module features/post/domain
 */

import { z } from 'zod';
import { PostCategory, PostStatus } from './post.types';

/**
 * 帖子标题验证规则
 */
export const postTitleSchema = z
  .string()
  .min(1, '标题不能为空')
  .max(200, '标题长度不能超过 200 个字符')
  .trim();

/**
 * 帖子内容验证规则
 */
export const postContentSchema = z
  .string()
  .min(1, '内容不能为空')
  .max(100000, '内容长度不能超过 100000 个字符');

/**
 * 创建帖子验证 Schema
 */
export const createPostSchema = z.object({
  title: postTitleSchema,
  content: postContentSchema,
  excerpt: z.string().max(500, '摘要长度不能超过 500 个字符').optional(),
  coverImage: z.string().url('封面图片必须是有效的 URL').optional(),
  status: z.nativeEnum(PostStatus).optional(),
  category: z.nativeEnum(PostCategory),
  tagIds: z.array(z.string()).optional(),
  attachmentIds: z.array(z.string()).optional(),
});

/**
 * 更新帖子验证 Schema
 */
export const updatePostSchema = z.object({
  title: postTitleSchema.optional(),
  content: postContentSchema.optional(),
  excerpt: z.string().max(500, '摘要长度不能超过 500 个字符').optional(),
  coverImage: z.string().url('封面图片必须是有效的 URL').optional(),
  status: z.nativeEnum(PostStatus).optional(),
  category: z.nativeEnum(PostCategory).optional(),
  tagIds: z.array(z.string()).optional(),
  attachmentIds: z.array(z.string()).optional(),
});

/**
 * 帖子查询参数验证 Schema
 */
export const postQuerySchema = z.object({
  page: z.number().int().min(1).optional(),
  pageSize: z.number().int().min(1).max(100).optional(),
  category: z.nativeEnum(PostCategory).optional(),
  status: z.nativeEnum(PostStatus).optional(),
  tagIds: z.array(z.string()).optional(),
  authorId: z.string().optional(),
  search: z.string().optional(),
  sortBy: z.enum(['createdAt', 'updatedAt', 'viewCount', 'likeCount', 'commentCount']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
  isPinned: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
});

