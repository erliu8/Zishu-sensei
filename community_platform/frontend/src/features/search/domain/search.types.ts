/**
 * 搜索模块 - 类型定义
 */

/**
 * 搜索类型
 */
export enum SearchType {
  ALL = 'all',
  POST = 'post',
  ADAPTER = 'adapter',
  CHARACTER = 'character',
  USER = 'user',
}

/**
 * 搜索排序方式
 */
export enum SearchSortBy {
  RELEVANCE = 'relevance',
  CREATED_AT = 'created_at',
  UPDATED_AT = 'updated_at',
  POPULARITY = 'popularity',
  DOWNLOADS = 'downloads',
  RATING = 'rating',
}

/**
 * 搜索排序顺序
 */
export enum SearchSortOrder {
  ASC = 'asc',
  DESC = 'desc',
}

/**
 * 搜索过滤器
 */
export interface SearchFilters {
  /** 搜索类型 */
  type?: SearchType;
  /** 分类ID（用于适配器/角色） */
  categoryId?: string;
  /** 标签 */
  tags?: string[];
  /** 创建时间范围 */
  dateRange?: {
    from?: Date;
    to?: Date;
  };
  /** 评分范围（适配器/角色） */
  ratingRange?: {
    min?: number;
    max?: number;
  };
  /** 仅显示已验证内容 */
  verifiedOnly?: boolean;
  /** 仅显示特色内容 */
  featuredOnly?: boolean;
}

/**
 * 搜索参数
 */
export interface SearchParams {
  /** 搜索关键词 */
  query: string;
  /** 搜索类型 */
  type?: SearchType;
  /** 过滤器 */
  filters?: SearchFilters;
  /** 排序方式 */
  sortBy?: SearchSortBy;
  /** 排序顺序 */
  sortOrder?: SearchSortOrder;
  /** 页码 */
  page?: number;
  /** 每页数量 */
  pageSize?: number;
}

/**
 * 搜索结果项 - 帖子
 */
export interface SearchResultPost {
  type: SearchType.POST;
  id: string;
  title: string;
  content: string;
  excerpt: string;
  author: {
    id: string;
    username: string;
    avatar?: string;
  };
  createdAt: Date;
  updatedAt: Date;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  tags: string[];
  thumbnail?: string;
  highlight?: {
    title?: string[];
    content?: string[];
  };
}

/**
 * 搜索结果项 - 适配器
 */
export interface SearchResultAdapter {
  type: SearchType.ADAPTER;
  id: string;
  name: string;
  description: string;
  author: {
    id: string;
    username: string;
    avatar?: string;
  };
  version: string;
  createdAt: Date;
  updatedAt: Date;
  downloadCount: number;
  rating: number;
  ratingCount: number;
  tags: string[];
  category: {
    id: string;
    name: string;
    slug: string;
  };
  thumbnail?: string;
  verified: boolean;
  featured: boolean;
  highlight?: {
    name?: string[];
    description?: string[];
  };
}

/**
 * 搜索结果项 - 角色
 */
export interface SearchResultCharacter {
  type: SearchType.CHARACTER;
  id: string;
  name: string;
  description: string;
  author: {
    id: string;
    username: string;
    avatar?: string;
  };
  createdAt: Date;
  updatedAt: Date;
  downloadCount: number;
  rating: number;
  ratingCount: number;
  tags: string[];
  avatar?: string;
  verified: boolean;
  featured: boolean;
  highlight?: {
    name?: string[];
    description?: string[];
  };
}

/**
 * 搜索结果项 - 用户
 */
export interface SearchResultUser {
  type: SearchType.USER;
  id: string;
  username: string;
  displayName?: string;
  bio?: string;
  avatar?: string;
  followerCount: number;
  followingCount: number;
  postCount: number;
  adapterCount: number;
  characterCount: number;
  verified: boolean;
  createdAt: Date;
  highlight?: {
    username?: string[];
    displayName?: string[];
    bio?: string[];
  };
}

/**
 * 搜索结果项类型联合
 */
export type SearchResultItem =
  | SearchResultPost
  | SearchResultAdapter
  | SearchResultCharacter
  | SearchResultUser;

/**
 * 搜索结果
 */
export interface SearchResult {
  /** 搜索结果列表 */
  items: SearchResultItem[];
  /** 总数 */
  total: number;
  /** 当前页 */
  page: number;
  /** 每页数量 */
  pageSize: number;
  /** 总页数 */
  totalPages: number;
  /** 搜索耗时（毫秒） */
  took: number;
  /** 建议关键词 */
  suggestions?: string[];
}

/**
 * 搜索建议项
 */
export interface SearchSuggestion {
  /** 建议文本 */
  text: string;
  /** 建议类型 */
  type: SearchType;
  /** 高亮范围 */
  highlight?: {
    start: number;
    end: number;
  };
}

/**
 * 搜索历史项
 */
export interface SearchHistoryItem {
  /** ID */
  id: string;
  /** 搜索关键词 */
  query: string;
  /** 搜索类型 */
  type: SearchType;
  /** 搜索时间 */
  searchedAt: Date;
  /** 结果数量 */
  resultCount?: number;
}

/**
 * 热门搜索项
 */
export interface TrendingSearchItem {
  /** 搜索关键词 */
  query: string;
  /** 搜索类型 */
  type: SearchType;
  /** 搜索次数 */
  count: number;
  /** 排名 */
  rank: number;
  /** 排名变化 */
  rankChange?: number;
}

