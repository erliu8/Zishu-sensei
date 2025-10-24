/**
 * usePagination Hook 单元测试
 */

import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePagination } from '../usePagination';

describe('usePagination', () => {
  it('should initialize with default values', () => {
    const { result } = renderHook(() =>
      usePagination({ total: 100 })
    );

    expect(result.current.currentPage).toBe(1);
    expect(result.current.pageSize).toBe(10);
    expect(result.current.totalPages).toBe(10);
    expect(result.current.total).toBe(100);
  });

  it('should initialize with custom values', () => {
    const { result } = renderHook(() =>
      usePagination({ total: 100, pageSize: 20, initialPage: 2 })
    );

    expect(result.current.currentPage).toBe(2);
    expect(result.current.pageSize).toBe(20);
    expect(result.current.totalPages).toBe(5);
  });

  it('should calculate start and end indices correctly', () => {
    const { result } = renderHook(() =>
      usePagination({ total: 100, pageSize: 10 })
    );

    expect(result.current.startIndex).toBe(0);
    expect(result.current.endIndex).toBe(9);
  });

  it('should navigate to next page', () => {
    const { result } = renderHook(() =>
      usePagination({ total: 100, pageSize: 10 })
    );

    act(() => {
      result.current.nextPage();
    });

    expect(result.current.currentPage).toBe(2);
    expect(result.current.startIndex).toBe(10);
    expect(result.current.endIndex).toBe(19);
  });

  it('should navigate to previous page', () => {
    const { result } = renderHook(() =>
      usePagination({ total: 100, pageSize: 10, initialPage: 3 })
    );

    act(() => {
      result.current.previousPage();
    });

    expect(result.current.currentPage).toBe(2);
  });

  it('should navigate to first page', () => {
    const { result } = renderHook(() =>
      usePagination({ total: 100, pageSize: 10, initialPage: 5 })
    );

    act(() => {
      result.current.firstPage();
    });

    expect(result.current.currentPage).toBe(1);
  });

  it('should navigate to last page', () => {
    const { result } = renderHook(() =>
      usePagination({ total: 100, pageSize: 10 })
    );

    act(() => {
      result.current.lastPage();
    });

    expect(result.current.currentPage).toBe(10);
  });

  it('should go to specific page', () => {
    const { result } = renderHook(() =>
      usePagination({ total: 100, pageSize: 10 })
    );

    act(() => {
      result.current.goToPage(5);
    });

    expect(result.current.currentPage).toBe(5);
    expect(result.current.startIndex).toBe(40);
    expect(result.current.endIndex).toBe(49);
  });

  it('should not go beyond first page', () => {
    const { result } = renderHook(() =>
      usePagination({ total: 100, pageSize: 10 })
    );

    act(() => {
      result.current.goToPage(0);
    });

    expect(result.current.currentPage).toBe(1);

    act(() => {
      result.current.previousPage();
    });

    expect(result.current.currentPage).toBe(1);
  });

  it('should not go beyond last page', () => {
    const { result } = renderHook(() =>
      usePagination({ total: 100, pageSize: 10 })
    );

    act(() => {
      result.current.goToPage(20);
    });

    expect(result.current.currentPage).toBe(10);

    act(() => {
      result.current.nextPage();
    });

    expect(result.current.currentPage).toBe(10);
  });

  it('should update hasPrevious and hasNext correctly', () => {
    const { result } = renderHook(() =>
      usePagination({ total: 100, pageSize: 10 })
    );

    // First page
    expect(result.current.hasPrevious).toBe(false);
    expect(result.current.hasNext).toBe(true);

    // Middle page
    act(() => {
      result.current.goToPage(5);
    });

    expect(result.current.hasPrevious).toBe(true);
    expect(result.current.hasNext).toBe(true);

    // Last page
    act(() => {
      result.current.lastPage();
    });

    expect(result.current.hasPrevious).toBe(true);
    expect(result.current.hasNext).toBe(false);
  });

  it('should change page size and reset to first page', () => {
    const { result } = renderHook(() =>
      usePagination({ total: 100, pageSize: 10, initialPage: 5 })
    );

    act(() => {
      result.current.setPageSize(20);
    });

    expect(result.current.pageSize).toBe(20);
    expect(result.current.currentPage).toBe(1);
    expect(result.current.totalPages).toBe(5);
  });

  it('should reset to initial state', () => {
    const { result } = renderHook(() =>
      usePagination({ total: 100, pageSize: 10, initialPage: 2 })
    );

    act(() => {
      result.current.goToPage(5);
      result.current.setPageSize(20);
    });

    act(() => {
      result.current.reset();
    });

    expect(result.current.currentPage).toBe(2);
    expect(result.current.pageSize).toBe(10);
  });

  it('should handle edge case with total less than page size', () => {
    const { result } = renderHook(() =>
      usePagination({ total: 5, pageSize: 10 })
    );

    expect(result.current.totalPages).toBe(1);
    expect(result.current.startIndex).toBe(0);
    expect(result.current.endIndex).toBe(4);
    expect(result.current.hasNext).toBe(false);
  });

  it('should handle zero total', () => {
    const { result } = renderHook(() =>
      usePagination({ total: 0, pageSize: 10 })
    );

    expect(result.current.totalPages).toBe(0);
    expect(result.current.startIndex).toBe(0);
    expect(result.current.endIndex).toBe(-1);
  });

  it('should calculate correct end index for last page', () => {
    const { result } = renderHook(() =>
      usePagination({ total: 95, pageSize: 10 })
    );

    act(() => {
      result.current.lastPage();
    });

    // Last page has 5 items (90-94)
    expect(result.current.startIndex).toBe(90);
    expect(result.current.endIndex).toBe(94);
  });

  it('should maintain function references', () => {
    const { result, rerender } = renderHook(() =>
      usePagination({ total: 100, pageSize: 10 })
    );

    const {
      goToPage: goToPage1,
      nextPage: nextPage1,
      previousPage: previousPage1,
    } = result.current;

    rerender();

    const {
      goToPage: goToPage2,
      nextPage: nextPage2,
      previousPage: previousPage2,
    } = result.current;

    expect(goToPage1).toBe(goToPage2);
    expect(nextPage1).toBe(nextPage2);
    expect(previousPage1).toBe(previousPage2);
  });
});

