import { useState, useCallback } from 'react';

export interface UseClipboardOptions {
  /** 复制成功后的提示时长（毫秒），默认为 2000ms */
  successDuration?: number;
}

export interface UseClipboardReturn {
  /** 复制的文本 */
  value: string;
  /** 是否已复制 */
  isCopied: boolean;
  /** 复制函数 */
  copy: (text: string) => Promise<void>;
  /** 重置状态 */
  reset: () => void;
}

/**
 * 剪贴板 Hook
 * @param options - 配置选项
 * @returns 剪贴板操作方法和状态
 * @example
 * const { copy, isCopied } = useClipboard();
 * <button onClick={() => copy('Hello World')}>
 *   {isCopied ? '已复制' : '复制'}
 * </button>
 */
export function useClipboard(options: UseClipboardOptions = {}): UseClipboardReturn {
  const { successDuration = 2000 } = options;

  const [value, setValue] = useState<string>('');
  const [isCopied, setIsCopied] = useState<boolean>(false);

  const copy = useCallback(
    async (text: string) => {
      if (!navigator?.clipboard) {
        console.warn('Clipboard API not supported');
        return;
      }

      try {
        await navigator.clipboard.writeText(text);
        setValue(text);
        setIsCopied(true);

        // 一段时间后重置状态
        setTimeout(() => {
          setIsCopied(false);
        }, successDuration);
      } catch (error) {
        console.error('Failed to copy text:', error);
        setIsCopied(false);
      }
    },
    [successDuration]
  );

  const reset = useCallback(() => {
    setValue('');
    setIsCopied(false);
  }, []);

  return { value, isCopied, copy, reset };
}

