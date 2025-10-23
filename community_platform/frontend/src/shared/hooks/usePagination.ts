import { useState, useMemo, useCallback } from 'react';

export interface UsePaginationOptions {
  /** 总条目数 */
  total: number;
  /** 每页条目数，默认为 10 */
  pageSize?: number;
  /** 初始页码，默认为 1 */
  initialPage?: number;
}

export interface UsePaginationReturn {
  /** 当前页码 */
  currentPage: number;
  /** 每页条目数 */
  pageSize: number;
  /** 总页数 */
  totalPages: number;
  /** 总条目数 */
  total: number;
  /** 当前页的起始索引（从 0 开始） */
  startIndex: number;
  /** 当前页的结束索引（从 0 开始） */
  endIndex: number;
  /** 是否有上一页 */
  hasPrevious: boolean;
  /** 是否有下一页 */
  hasNext: boolean;
  /** 跳转到指定页 */
  goToPage: (page: number) => void;
  /** 上一页 */
  previousPage: () => void;
  /** 下一页 */
  nextPage: () => void;
  /** 第一页 */
  firstPage: () => void;
  /** 最后一页 */
  lastPage: () => void;
  /** 设置每页条目数 */
  setPageSize: (size: number) => void;
  /** 重置到第一页 */
  reset: () => void;
}

/**
 * 分页 Hook
 * @param options - 配置选项
 * @returns 分页状态和操作方法
 * @example
 * const pagination = usePagination({ total: 100, pageSize: 10 });
 * const items = data.slice(pagination.startIndex, pagination.endIndex + 1);
 */
export function usePagination(options: UsePaginationOptions): UsePaginationReturn {
  const { total, pageSize: initialPageSize = 10, initialPage = 1 } = options;

  const [currentPage, setCurrentPage] = useState(initialPage);
  const [pageSize, setPageSize] = useState(initialPageSize);

  // 计算总页数
  const totalPages = useMemo(() => {
    return Math.ceil(total / pageSize);
  }, [total, pageSize]);

  // 计算当前页的起始和结束索引
  const startIndex = useMemo(() => {
    return (currentPage - 1) * pageSize;
  }, [currentPage, pageSize]);

  const endIndex = useMemo(() => {
    return Math.min(startIndex + pageSize - 1, total - 1);
  }, [startIndex, pageSize, total]);

  // 是否有上一页/下一页
  const hasPrevious = currentPage > 1;
  const hasNext = currentPage < totalPages;

  // 跳转到指定页
  const goToPage = useCallback(
    (page: number) => {
      const validPage = Math.max(1, Math.min(page, totalPages));
      setCurrentPage(validPage);
    },
    [totalPages]
  );

  // 上一页
  const previousPage = useCallback(() => {
    goToPage(currentPage - 1);
  }, [currentPage, goToPage]);

  // 下一页
  const nextPage = useCallback(() => {
    goToPage(currentPage + 1);
  }, [currentPage, goToPage]);

  // 第一页
  const firstPage = useCallback(() => {
    goToPage(1);
  }, [goToPage]);

  // 最后一页
  const lastPage = useCallback(() => {
    goToPage(totalPages);
  }, [goToPage, totalPages]);

  // 设置每页条目数
  const handleSetPageSize = useCallback((size: number) => {
    setPageSize(size);
    setCurrentPage(1); // 重置到第一页
  }, []);

  // 重置
  const reset = useCallback(() => {
    setCurrentPage(initialPage);
    setPageSize(initialPageSize);
  }, [initialPage, initialPageSize]);

  return {
    currentPage,
    pageSize,
    totalPages,
    total,
    startIndex,
    endIndex,
    hasPrevious,
    hasNext,
    goToPage,
    previousPage,
    nextPage,
    firstPage,
    lastPage,
    setPageSize: handleSetPageSize,
    reset,
  };
}

