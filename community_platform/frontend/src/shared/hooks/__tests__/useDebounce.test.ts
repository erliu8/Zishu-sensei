/**
 * useDebounce Hook 单元测试
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useDebounce } from '../useDebounce';

describe('useDebounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return initial value immediately', () => {
    const { result } = renderHook(() => useDebounce('initial', 500));
    expect(result.current).toBe('initial');
  });

  it('should debounce value changes', async () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      {
        initialProps: { value: 'initial', delay: 500 },
      }
    );

    expect(result.current).toBe('initial');

    // Update value
    rerender({ value: 'updated', delay: 500 });
    expect(result.current).toBe('initial'); // Still initial

    // Fast forward time
    vi.advanceTimersByTime(500);
    await waitFor(() => {
      expect(result.current).toBe('updated');
    });
  });

  it('should cancel previous timeout on rapid changes', async () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 500),
      {
        initialProps: { value: 'value1' },
      }
    );

    // Rapid changes
    rerender({ value: 'value2' });
    vi.advanceTimersByTime(200);
    
    rerender({ value: 'value3' });
    vi.advanceTimersByTime(200);
    
    rerender({ value: 'value4' });
    
    // Should still be initial value
    expect(result.current).toBe('value1');

    // After full delay, should be the last value
    vi.advanceTimersByTime(500);
    await waitFor(() => {
      expect(result.current).toBe('value4');
    });
  });

  it('should respect custom delay', async () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      {
        initialProps: { value: 'initial', delay: 1000 },
      }
    );

    rerender({ value: 'updated', delay: 1000 });
    
    vi.advanceTimersByTime(500);
    expect(result.current).toBe('initial');

    vi.advanceTimersByTime(500);
    await waitFor(() => {
      expect(result.current).toBe('updated');
    });
  });

  it('should handle different value types', async () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 500),
      {
        initialProps: { value: { count: 0 } },
      }
    );

    expect(result.current).toEqual({ count: 0 });

    rerender({ value: { count: 1 } });
    vi.advanceTimersByTime(500);

    await waitFor(() => {
      expect(result.current).toEqual({ count: 1 });
    });
  });

  it('should use default delay of 500ms', async () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value),
      {
        initialProps: { value: 'initial' },
      }
    );

    rerender({ value: 'updated' });
    
    vi.advanceTimersByTime(499);
    expect(result.current).toBe('initial');

    vi.advanceTimersByTime(1);
    await waitFor(() => {
      expect(result.current).toBe('updated');
    });
  });
});

