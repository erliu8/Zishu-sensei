/**
 * 搜索模块 - Domain 模型
 */

import {
  SearchType,
  SearchSortBy,
  SearchSortOrder,
  type SearchParams,
  type SearchFilters,
  type SearchResult,
  type SearchResultItem,
  type SearchHistoryItem,
  type SearchSuggestion,
  type TrendingSearchItem,
} from './search.types';

/**
 * 搜索参数构建器
 */
export class SearchParamsBuilder {
  private params: SearchParams;

  constructor(query: string) {
    this.params = {
      query,
      type: SearchType.ALL,
      page: 1,
      pageSize: 20,
      sortBy: SearchSortBy.RELEVANCE,
      sortOrder: SearchSortOrder.DESC,
    };
  }

  withType(type: SearchType): this {
    this.params.type = type;
    return this;
  }

  withFilters(filters: SearchFilters): this {
    this.params.filters = { ...this.params.filters, ...filters };
    return this;
  }

  withSorting(sortBy: SearchSortBy, sortOrder: SearchSortOrder = SearchSortOrder.DESC): this {
    this.params.sortBy = sortBy;
    this.params.sortOrder = sortOrder;
    return this;
  }

  withPagination(page: number, pageSize: number = 20): this {
    this.params.page = page;
    this.params.pageSize = pageSize;
    return this;
  }

  build(): SearchParams {
    return this.params;
  }
}

/**
 * 搜索历史管理器
 */
export class SearchHistoryManager {
  private static readonly STORAGE_KEY = 'zishu_search_history';
  private static readonly MAX_HISTORY_SIZE = 20;

  /**
   * 添加搜索历史
   */
  static addHistory(query: string, type: SearchType, resultCount?: number): void {
    if (!query.trim()) return;

    const history = this.getHistory();
    
    // 移除已存在的相同搜索
    const filtered = history.filter(
      (item) => !(item.query === query && item.type === type)
    );

    // 添加到开头
    const newItem: SearchHistoryItem = {
      id: `${Date.now()}_${Math.random()}`,
      query,
      type,
      searchedAt: new Date(),
      resultCount,
    };

    filtered.unshift(newItem);

    // 保持最大数量
    const trimmed = filtered.slice(0, this.MAX_HISTORY_SIZE);

    this.saveHistory(trimmed);
  }

  /**
   * 获取搜索历史
   */
  static getHistory(): SearchHistoryItem[] {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (!stored) return [];

      const parsed = JSON.parse(stored);
      return parsed.map((item: any) => ({
        ...item,
        searchedAt: new Date(item.searchedAt),
      }));
    } catch (error) {
      console.error('Failed to get search history:', error);
      return [];
    }
  }

  /**
   * 删除单条历史
   */
  static removeHistory(id: string): void {
    const history = this.getHistory();
    const filtered = history.filter((item) => item.id !== id);
    this.saveHistory(filtered);
  }

  /**
   * 清空历史
   */
  static clearHistory(): void {
    localStorage.removeItem(this.STORAGE_KEY);
  }

  /**
   * 保存历史
   */
  private static saveHistory(history: SearchHistoryItem[]): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(history));
    } catch (error) {
      console.error('Failed to save search history:', error);
    }
  }
}

/**
 * 搜索结果辅助类
 */
export class SearchResultHelper {
  /**
   * 按类型分组搜索结果
   */
  static groupByType(items: SearchResultItem[]): Map<SearchType, SearchResultItem[]> {
    const groups = new Map<SearchType, SearchResultItem[]>();

    for (const item of items) {
      const group = groups.get(item.type) || [];
      group.push(item);
      groups.set(item.type, group);
    }

    return groups;
  }

  /**
   * 提取高亮文本
   */
  static extractHighlight(item: SearchResultItem): string[] {
    const highlights: string[] = [];

    if (!item.highlight) return highlights;

    Object.values(item.highlight).forEach((highlightArray) => {
      if (Array.isArray(highlightArray)) {
        highlights.push(...highlightArray);
      }
    });

    return highlights;
  }

  /**
   * 判断是否为空结果
   */
  static isEmpty(result: SearchResult): boolean {
    return result.items.length === 0;
  }

  /**
   * 获取类型统计
   */
  static getTypeStats(items: SearchResultItem[]): Record<SearchType, number> {
    const stats: Record<string, number> = {
      [SearchType.ALL]: items.length,
      [SearchType.POST]: 0,
      [SearchType.ADAPTER]: 0,
      [SearchType.CHARACTER]: 0,
      [SearchType.USER]: 0,
    };

    for (const item of items) {
      stats[item.type]++;
    }

    return stats as Record<SearchType, number>;
  }
}

/**
 * 搜索查询优化器
 */
export class SearchQueryOptimizer {
  /**
   * 清理搜索查询
   */
  static cleanQuery(query: string): string {
    return query
      .trim()
      .replace(/\s+/g, ' ')
      .toLowerCase();
  }

  /**
   * 提取关键词
   */
  static extractKeywords(query: string): string[] {
    const cleaned = this.cleanQuery(query);
    return cleaned.split(' ').filter((word) => word.length > 0);
  }

  /**
   * 判断是否为有效查询
   */
  static isValidQuery(query: string): boolean {
    const cleaned = this.cleanQuery(query);
    return cleaned.length >= 2;
  }

  /**
   * 生成建议查询
   */
  static generateSuggestions(query: string, suggestions: string[]): SearchSuggestion[] {
    const cleaned = this.cleanQuery(query);
    
    return suggestions.map((text) => {
      const lowerText = text.toLowerCase();
      const index = lowerText.indexOf(cleaned);

      return {
        text,
        type: SearchType.ALL,
        highlight: index >= 0 ? {
          start: index,
          end: index + cleaned.length,
        } : undefined,
      };
    });
  }
}

