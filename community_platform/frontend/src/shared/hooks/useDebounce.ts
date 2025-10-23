import { useEffect, useState } from 'react';

/**
 * 防抖 Hook
 * @param value - 要防抖的值
 * @param delay - 延迟时间（毫秒），默认为 500ms
 * @returns 防抖后的值
 * @example
 * const debouncedSearchTerm = useDebounce(searchTerm, 500);
 */
export function useDebounce<T>(value: T, delay: number = 500): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

