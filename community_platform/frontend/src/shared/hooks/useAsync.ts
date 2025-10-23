import { useState, useCallback, useEffect, useRef } from 'react';

export interface UseAsyncState<T> {
  /** 数据 */
  data: T | null;
  /** 是否加载中 */
  loading: boolean;
  /** 错误信息 */
  error: Error | null;
}

export interface UseAsyncReturn<T, Args extends any[]> extends UseAsyncState<T> {
  /** 执行异步函数 */
  execute: (...args: Args) => Promise<T | null>;
  /** 重置状态 */
  reset: () => void;
}

/**
 * 异步操作 Hook
 * @param asyncFunction - 异步函数
 * @param immediate - 是否立即执行，默认为 false
 * @returns 异步操作状态和方法
 * @example
 * const { data, loading, error, execute } = useAsync(fetchUser);
 * useEffect(() => { execute(userId); }, [userId]);
 */
export function useAsync<T, Args extends any[] = []>(
  asyncFunction: (...args: Args) => Promise<T>,
  immediate: boolean = false
): UseAsyncReturn<T, Args> {
  const [state, setState] = useState<UseAsyncState<T>>({
    data: null,
    loading: immediate,
    error: null,
  });

  // 使用 ref 来追踪最新的请求
  const activeRequestRef = useRef(0);

  const execute = useCallback(
    async (...args: Args): Promise<T | null> => {
      const requestId = ++activeRequestRef.current;

      setState((prev) => ({ ...prev, loading: true, error: null }));

      try {
        const result = await asyncFunction(...args);

        // 只有当这是最新的请求时才更新状态
        if (requestId === activeRequestRef.current) {
          setState({ data: result, loading: false, error: null });
          return result;
        }

        return null;
      } catch (error) {
        // 只有当这是最新的请求时才更新状态
        if (requestId === activeRequestRef.current) {
          const err = error instanceof Error ? error : new Error(String(error));
          setState({ data: null, loading: false, error: err });
        }
        return null;
      }
    },
    [asyncFunction]
  );

  const reset = useCallback(() => {
    activeRequestRef.current++;
    setState({ data: null, loading: false, error: null });
  }, []);

  useEffect(() => {
    if (immediate) {
      execute([] as any as Args);
    }
  }, [immediate, execute]);

  return {
    ...state,
    execute,
    reset,
  };
}

