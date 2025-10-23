/**
 * 搜索模块 - useSearchHistory Hook
 */

import { useState, useEffect, useCallback } from 'react';
import { SearchHistoryManager, type SearchHistoryItem, type SearchType } from '../domain';

/**
 * useSearchHistory Hook
 * 管理搜索历史
 * 
 * @example
 * ```tsx
 * const { history, addHistory, removeHistory, clearHistory } = useSearchHistory();
 * ```
 */
export function useSearchHistory() {
  const [history, setHistory] = useState<SearchHistoryItem[]>([]);

  // 加载历史记录
  useEffect(() => {
    const loadHistory = () => {
      const stored = SearchHistoryManager.getHistory();
      setHistory(stored);
    };

    loadHistory();

    // 监听 storage 事件（跨标签页同步）
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'zishu_search_history') {
        loadHistory();
      }
    };

    window.addEventListener('storage', handleStorage);

    return () => {
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  /**
   * 添加搜索历史
   */
  const addHistory = useCallback((query: string, type: SearchType, resultCount?: number) => {
    SearchHistoryManager.addHistory(query, type, resultCount);
    setHistory(SearchHistoryManager.getHistory());
  }, []);

  /**
   * 删除单条历史
   */
  const removeHistory = useCallback((id: string) => {
    SearchHistoryManager.removeHistory(id);
    setHistory(SearchHistoryManager.getHistory());
  }, []);

  /**
   * 清空历史
   */
  const clearHistory = useCallback(() => {
    SearchHistoryManager.clearHistory();
    setHistory([]);
  }, []);

  /**
   * 获取最近搜索（前N条）
   */
  const getRecent = useCallback((limit: number = 5): SearchHistoryItem[] => {
    return history.slice(0, limit);
  }, [history]);

  /**
   * 按类型过滤历史
   */
  const filterByType = useCallback((type: SearchType): SearchHistoryItem[] => {
    return history.filter((item) => item.type === type);
  }, [history]);

  return {
    history,
    addHistory,
    removeHistory,
    clearHistory,
    getRecent,
    filterByType,
    isEmpty: history.length === 0,
    count: history.length,
  };
}

/**
 * useSearchHistorySync Hook
 * 自动同步搜索历史（在搜索时自动添加）
 */
export function useSearchHistorySync() {
  const { addHistory } = useSearchHistory();

  const syncSearch = useCallback(
    (query: string, type: SearchType, resultCount?: number) => {
      if (query.trim()) {
        addHistory(query, type, resultCount);
      }
    },
    [addHistory]
  );

  return { syncSearch };
}

