/**
 * useLocalStorage Hook 单元测试
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLocalStorage } from '../useLocalStorage';

describe('useLocalStorage', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('should return initial value when localStorage is empty', () => {
    const { result } = renderHook(() => useLocalStorage('test-key', 'initial'));
    const [value] = result.current;
    expect(value).toBe('initial');
  });

  it('should return stored value from localStorage', () => {
    localStorage.setItem('test-key', JSON.stringify('stored'));
    const { result } = renderHook(() => useLocalStorage('test-key', 'initial'));
    const [value] = result.current;
    expect(value).toBe('stored');
  });

  it('should set value to localStorage', () => {
    const { result } = renderHook(() => useLocalStorage('test-key', 'initial'));
    const [, setValue] = result.current;

    act(() => {
      setValue('updated');
    });

    const [value] = result.current;
    expect(value).toBe('updated');
    expect(localStorage.getItem('test-key')).toBe(JSON.stringify('updated'));
  });

  it('should handle function updates', () => {
    const { result } = renderHook(() => useLocalStorage('test-key', 0));

    act(() => {
      const [, setValue] = result.current;
      setValue((prev) => prev + 1);
    });

    const [value] = result.current;
    expect(value).toBe(1);
  });

  it('should remove value from localStorage', () => {
    localStorage.setItem('test-key', JSON.stringify('value'));
    const { result } = renderHook(() => useLocalStorage('test-key', 'initial'));

    act(() => {
      const [, , removeValue] = result.current;
      removeValue();
    });

    const [value] = result.current;
    expect(value).toBe('initial');
    expect(localStorage.getItem('test-key')).toBeNull();
  });

  it('should handle complex objects', () => {
    const complexObject = { name: 'John', age: 30, hobbies: ['reading', 'coding'] };
    const { result } = renderHook(() => useLocalStorage('user', complexObject));

    act(() => {
      const [, setValue] = result.current;
      setValue({ ...complexObject, age: 31 });
    });

    const [value] = result.current;
    expect(value).toEqual({ ...complexObject, age: 31 });
  });

  it('should handle null values', () => {
    const { result } = renderHook(() => useLocalStorage<string | null>('test-key', null));
    const [value] = result.current;
    expect(value).toBeNull();

    act(() => {
      const [, setValue] = result.current;
      setValue('not null');
    });

    const [updatedValue] = result.current;
    expect(updatedValue).toBe('not null');
  });

  it('should handle array values', () => {
    const { result } = renderHook(() => useLocalStorage('items', [1, 2, 3]));

    act(() => {
      const [, setValue] = result.current;
      setValue([...result.current[0], 4]);
    });

    const [value] = result.current;
    expect(value).toEqual([1, 2, 3, 4]);
  });

  it('should gracefully handle JSON parse errors', () => {
    localStorage.setItem('test-key', 'invalid-json');
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const { result } = renderHook(() => useLocalStorage('test-key', 'default'));
    const [value] = result.current;

    expect(value).toBe('default');
    expect(consoleSpy).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  it('should handle storage events from other tabs', () => {
    const { result } = renderHook(() => useLocalStorage('test-key', 'initial'));

    // Simulate storage event from another tab
    act(() => {
      const event = new StorageEvent('storage', {
        key: 'test-key',
        newValue: JSON.stringify('updated-from-other-tab'),
      });
      window.dispatchEvent(event);
    });

    const [value] = result.current;
    expect(value).toBe('updated-from-other-tab');
  });

  it('should persist across re-renders', () => {
    const { result, rerender } = renderHook(() => useLocalStorage('test-key', 'initial'));

    act(() => {
      const [, setValue] = result.current;
      setValue('persisted');
    });

    rerender();

    const [value] = result.current;
    expect(value).toBe('persisted');
  });
});

