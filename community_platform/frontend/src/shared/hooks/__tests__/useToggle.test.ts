/**
 * useToggle Hook 单元测试
 */

import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useToggle } from '../useToggle';

describe('useToggle', () => {
  it('should return false as default initial value', () => {
    const { result } = renderHook(() => useToggle());
    const [value] = result.current;
    expect(value).toBe(false);
  });

  it('should return custom initial value', () => {
    const { result } = renderHook(() => useToggle(true));
    const [value] = result.current;
    expect(value).toBe(true);
  });

  it('should toggle value', () => {
    const { result } = renderHook(() => useToggle(false));

    act(() => {
      const [, toggle] = result.current;
      toggle();
    });

    expect(result.current[0]).toBe(true);

    act(() => {
      const [, toggle] = result.current;
      toggle();
    });

    expect(result.current[0]).toBe(false);
  });

  it('should set value to true', () => {
    const { result } = renderHook(() => useToggle(false));

    act(() => {
      const [, , set] = result.current;
      set(true);
    });

    expect(result.current[0]).toBe(true);
  });

  it('should set value to false', () => {
    const { result } = renderHook(() => useToggle(true));

    act(() => {
      const [, , set] = result.current;
      set(false);
    });

    expect(result.current[0]).toBe(false);
  });

  it('should toggle multiple times', () => {
    const { result } = renderHook(() => useToggle(false));

    act(() => {
      const [, toggle] = result.current;
      toggle(); // true
      toggle(); // false
      toggle(); // true
    });

    expect(result.current[0]).toBe(true);
  });

  it('should maintain function references', () => {
    const { result, rerender } = renderHook(() => useToggle(false));

    const [, toggle1, set1] = result.current;
    rerender();
    const [, toggle2, set2] = result.current;

    expect(toggle1).toBe(toggle2);
    expect(set1).toBe(set2);
  });
});

