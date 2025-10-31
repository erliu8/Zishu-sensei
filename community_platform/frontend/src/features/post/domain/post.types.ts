/**
 * 帖子领域模型类型定义
 */

export interface Post {
  id: string;
  title: string;
  content: string;
  summary?: string;
  coverImage?: string;
  author: Author;
  category?: CategoryInfo;
  tags?: Tag[];
  stats: PostStats;
  status: PostStatus;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
  isLikedByCurrentUser?: boolean;
  isFavoritedByCurrentUser?: boolean;
}

export interface Author {
  id: string;
  name: string;
  username: string;
  avatar?: string;
  bio?: string;
}


export interface Tag {
  id: string;
  name: string;
  slug: string;
}

export interface PostStats {
  views: number;
  likes: number;
  comments: number;
  favorites: number;
  shares: number;
}

export enum PostStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  ARCHIVED = 'archived',
}

export interface CreatePostInput {
  title: string;
  content: string;
  summary?: string;
  coverImage?: string;
  categoryId?: string;
  tagIds?: string[];
  status?: PostStatus;
}

export interface UpdatePostInput extends Partial<CreatePostInput> {
  id: string;
}

export interface PostFilters {
  categoryId?: string;
  tagIds?: string[];
  authorId?: string;
  status?: PostStatus;
  search?: string;
}

export interface PostSortOptions {
  sortBy: 'createdAt' | 'updatedAt' | 'views' | 'likes' | 'comments';
  order: 'asc' | 'desc';
}

export interface PaginatedPosts {
  data: Post[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// API 相关类型
export interface PostQueryParams {
  page?: number;
  pageSize?: number;
  category?: string;
  tags?: string[];
  search?: string;
  sortBy?: 'createdAt' | 'updatedAt' | 'viewCount' | 'likeCount' | 'commentCount';
  sortOrder?: 'asc' | 'desc';
  status?: PostStatus;
  authorId?: string;
}

export interface PostListResponse {
  data: Post[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

export interface CreatePostDto {
  title: string;
  content: string;
  summary?: string;
  coverImage?: string;
  categoryId?: string;
  tagIds?: string[];
  status?: PostStatus;
}

export interface UpdatePostDto extends Partial<CreatePostDto> {}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export enum PostCategory {
  GENERAL = 'general',
  TECH = 'tech',
  TUTORIAL = 'tutorial',
  DISCUSSION = 'discussion',
  NEWS = 'news',
  SHOWCASE = 'showcase',
  QUESTION = 'question',
  RESOURCE = 'resource',
}

export interface CategoryInfo {
  id: string;
  name: string;
  slug: string;
  description?: string;
  color?: string;
  icon?: string;
}
