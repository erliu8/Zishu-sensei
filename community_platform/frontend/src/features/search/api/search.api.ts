/**
 * 搜索模块 - API Client
 */

import type {
  SearchParams,
  SearchResult,
  SearchSuggestion,
  TrendingSearchItem,
} from '../domain';

/**
 * 搜索 API 响应
 */
interface SearchApiResponse {
  data: {
    items: any[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
    took: number;
    suggestions?: string[];
  };
}

/**
 * 搜索建议 API 响应
 */
interface SearchSuggestionsApiResponse {
  data: {
    suggestions: Array<{
      text: string;
      type: string;
    }>;
  };
}

/**
 * 热门搜索 API 响应
 */
interface TrendingSearchApiResponse {
  data: {
    trending: Array<{
      query: string;
      type: string;
      count: number;
      rank: number;
      rankChange?: number;
    }>;
  };
}

/**
 * 搜索 API Client
 */
export class SearchApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = '/api') {
    this.baseUrl = baseUrl;
  }

  /**
   * 执行搜索
   */
  async search(params: SearchParams): Promise<SearchResult> {
    const queryParams = new URLSearchParams();

    queryParams.append('q', params.query);

    if (params.type) {
      queryParams.append('type', params.type);
    }

    if (params.page) {
      queryParams.append('page', params.page.toString());
    }

    if (params.pageSize) {
      queryParams.append('pageSize', params.pageSize.toString());
    }

    if (params.sortBy) {
      queryParams.append('sortBy', params.sortBy);
    }

    if (params.sortOrder) {
      queryParams.append('sortOrder', params.sortOrder);
    }

    // 过滤器
    if (params.filters) {
      if (params.filters.categoryId) {
        queryParams.append('categoryId', params.filters.categoryId);
      }

      if (params.filters.tags && params.filters.tags.length > 0) {
        queryParams.append('tags', params.filters.tags.join(','));
      }

      if (params.filters.dateRange?.from) {
        queryParams.append('dateFrom', params.filters.dateRange.from.toISOString());
      }

      if (params.filters.dateRange?.to) {
        queryParams.append('dateTo', params.filters.dateRange.to.toISOString());
      }

      if (params.filters.ratingRange?.min !== undefined) {
        queryParams.append('ratingMin', params.filters.ratingRange.min.toString());
      }

      if (params.filters.ratingRange?.max !== undefined) {
        queryParams.append('ratingMax', params.filters.ratingRange.max.toString());
      }

      if (params.filters.verifiedOnly) {
        queryParams.append('verifiedOnly', 'true');
      }

      if (params.filters.featuredOnly) {
        queryParams.append('featuredOnly', 'true');
      }
    }

    const response = await fetch(
      `${this.baseUrl}/search?${queryParams.toString()}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Search failed: ${response.statusText}`);
    }

    const data: SearchApiResponse = await response.json();

    return {
      items: data.data.items.map(this.transformSearchResultItem),
      total: data.data.total,
      page: data.data.page,
      pageSize: data.data.pageSize,
      totalPages: data.data.totalPages,
      took: data.data.took,
      suggestions: data.data.suggestions,
    };
  }

  /**
   * 获取搜索建议
   */
  async getSuggestions(query: string, type?: string): Promise<SearchSuggestion[]> {
    const queryParams = new URLSearchParams({ q: query });
    
    if (type) {
      queryParams.append('type', type);
    }

    const response = await fetch(
      `${this.baseUrl}/search/suggestions?${queryParams.toString()}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Get suggestions failed: ${response.statusText}`);
    }

    const data: SearchSuggestionsApiResponse = await response.json();

    return data.data.suggestions.map((item) => ({
      text: item.text,
      type: item.type as any,
    }));
  }

  /**
   * 获取热门搜索
   */
  async getTrending(limit: number = 10): Promise<TrendingSearchItem[]> {
    const response = await fetch(
      `${this.baseUrl}/search/trending?limit=${limit}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Get trending failed: ${response.statusText}`);
    }

    const data: TrendingSearchApiResponse = await response.json();

    return data.data.trending.map((item) => ({
      query: item.query,
      type: item.type as any,
      count: item.count,
      rank: item.rank,
      rankChange: item.rankChange,
    }));
  }

  /**
   * 转换搜索结果项
   */
  private transformSearchResultItem(item: any): any {
    const base = {
      type: item.type,
      id: item.id,
      createdAt: new Date(item.createdAt),
      updatedAt: new Date(item.updatedAt),
      highlight: item.highlight,
    };

    switch (item.type) {
      case 'post':
        return {
          ...base,
          title: item.title,
          content: item.content,
          excerpt: item.excerpt,
          author: item.author,
          viewCount: item.viewCount,
          likeCount: item.likeCount,
          commentCount: item.commentCount,
          tags: item.tags,
          thumbnail: item.thumbnail,
        };

      case 'adapter':
        return {
          ...base,
          name: item.name,
          description: item.description,
          author: item.author,
          version: item.version,
          downloadCount: item.downloadCount,
          rating: item.rating,
          ratingCount: item.ratingCount,
          tags: item.tags,
          category: item.category,
          thumbnail: item.thumbnail,
          verified: item.verified,
          featured: item.featured,
        };

      case 'character':
        return {
          ...base,
          name: item.name,
          description: item.description,
          author: item.author,
          downloadCount: item.downloadCount,
          rating: item.rating,
          ratingCount: item.ratingCount,
          tags: item.tags,
          avatar: item.avatar,
          verified: item.verified,
          featured: item.featured,
        };

      case 'user':
        return {
          ...base,
          username: item.username,
          displayName: item.displayName,
          bio: item.bio,
          avatar: item.avatar,
          followerCount: item.followerCount,
          followingCount: item.followingCount,
          postCount: item.postCount,
          adapterCount: item.adapterCount,
          characterCount: item.characterCount,
          verified: item.verified,
        };

      default:
        return item;
    }
  }
}

/**
 * 默认搜索 API 客户端实例
 */
export const searchApiClient = new SearchApiClient();

