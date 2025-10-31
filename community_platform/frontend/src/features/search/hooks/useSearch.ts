/**
 * 搜索模块 - useSearch Hook
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { searchApiClient } from '../api';
import {
  SearchHistoryManager,
  SearchQueryOptimizer,
  type SearchParams,
  type SearchResult,
} from '../domain';

/**
 * 搜索查询 Key 工厂
 */
export const searchKeys = {
  all: ['search'] as const,
  searches: () => [...searchKeys.all, 'searches'] as const,
  search: (params: SearchParams) => [...searchKeys.searches(), params] as const,
  suggestions: (query: string, type?: string) =>
    [...searchKeys.all, 'suggestions', query, type] as const,
  trending: (limit?: number) => [...searchKeys.all, 'trending', limit] as const,
};

/**
 * useSearch Hook 配置
 */
export interface UseSearchOptions {
  /** 是否启用查询 */
  enabled?: boolean;
  /** 是否保存到历史记录 */
  saveToHistory?: boolean;
  /** 成功回调 */
  onSuccess?: (data: SearchResult) => void;
  /** 错误回调 */
  onError?: (error: Error) => void;
}

/**
 * useSearch Hook
 * 
 * @example
 * ```tsx
 * const { data, isLoading, error } = useSearch({
 *   query: 'react',
 *   type: SearchType.POST,
 *   page: 1,
 * });
 * ```
 */
export function useSearch(params: SearchParams, options: UseSearchOptions = {}) {
  const {
    enabled = true,
    saveToHistory = true,
  } = options;

  const isValidQuery = SearchQueryOptimizer.isValidQuery(params.query);

  return useQuery({
    queryKey: searchKeys.search(params),
    queryFn: async () => {
      const result = await searchApiClient.search(params);

      // 保存到历史记录
      if (saveToHistory && params.type) {
        SearchHistoryManager.addHistory(params.query, params.type, result.total);
      }

      return result;
    },
    enabled: enabled && isValidQuery,
    staleTime: 5 * 60 * 1000, // 5 分钟
    gcTime: 10 * 60 * 1000, // 10 分钟
    retry: 1,
  });
}

/**
 * useSearchSuggestions Hook
 * 
 * @example
 * ```tsx
 * const { data: suggestions } = useSearchSuggestions('rea');
 * ```
 */
export function useSearchSuggestions(query: string, type?: string) {
  const isValidQuery = query.trim().length >= 2;

  return useQuery({
    queryKey: searchKeys.suggestions(query, type),
    queryFn: () => searchApiClient.getSuggestions(query, type),
    enabled: isValidQuery,
    staleTime: 10 * 60 * 1000, // 10 分钟
    gcTime: 30 * 60 * 1000, // 30 分钟
  });
}

/**
 * useTrendingSearch Hook
 * 
 * @example
 * ```tsx
 * const { data: trending } = useTrendingSearch(10);
 * ```
 */
export function useTrendingSearch(limit: number = 10) {
  return useQuery({
    queryKey: searchKeys.trending(limit),
    queryFn: () => searchApiClient.getTrending(limit),
    staleTime: 5 * 60 * 1000, // 5 分钟
    gcTime: 15 * 60 * 1000, // 15 分钟
  });
}

/**
 * useInvalidateSearch Hook
 * 使搜索缓存失效
 */
export function useInvalidateSearch() {
  const queryClient = useQueryClient();

  return {
    invalidateAll: () => queryClient.invalidateQueries({ queryKey: searchKeys.all }),
    invalidateSearches: () => queryClient.invalidateQueries({ queryKey: searchKeys.searches() }),
    invalidateSearch: (params: SearchParams) =>
      queryClient.invalidateQueries({ queryKey: searchKeys.search(params) }),
    invalidateSuggestions: (query: string, type?: string) =>
      queryClient.invalidateQueries({ queryKey: searchKeys.suggestions(query, type) }),
    invalidateTrending: (limit?: number) =>
      queryClient.invalidateQueries({ queryKey: searchKeys.trending(limit) }),
  };
}

