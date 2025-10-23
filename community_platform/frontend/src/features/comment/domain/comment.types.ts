/**
 * Comment Domain Types
 * 评论模块类型定义
 */

export interface Comment {
  id: string;
  content: string;
  targetType: CommentTargetType;
  targetId: string;
  authorId: string;
  author: CommentAuthor;
  parentId: string | null;
  replies?: Comment[];
  replyCount: number;
  likeCount: number;
  isLiked: boolean;
  isEdited: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CommentAuthor {
  id: string;
  username: string;
  displayName: string;
  avatar?: string;
  badges?: string[];
}

export enum CommentTargetType {
  POST = 'post',
  ADAPTER = 'adapter',
  CHARACTER = 'character',
  PACKAGE = 'package',
}

export interface CreateCommentDto {
  content: string;
  targetType: CommentTargetType;
  targetId: string;
  parentId?: string;
}

export interface UpdateCommentDto {
  content: string;
}

export interface CommentListParams {
  targetType: CommentTargetType;
  targetId: string;
  page?: number;
  pageSize?: number;
  sortBy?: CommentSortBy;
  parentId?: string | null;
}

export enum CommentSortBy {
  NEWEST = 'newest',
  OLDEST = 'oldest',
  POPULAR = 'popular',
}

export interface CommentListResponse {
  data: Comment[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface CommentStats {
  totalCount: number;
  todayCount: number;
  topCommenters: CommentAuthor[];
}

