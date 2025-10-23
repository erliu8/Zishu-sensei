import { useState, useCallback } from 'react';

/**
 * 切换状态 Hook
 * @param initialValue - 初始值，默认为 false
 * @returns [当前值, 切换函数, 设置函数]
 * @example
 * const [isOpen, toggle, setIsOpen] = useToggle(false);
 * <button onClick={toggle}>Toggle</button>
 * <button onClick={() => setIsOpen(true)}>Open</button>
 */
export function useToggle(
  initialValue: boolean = false
): [boolean, () => void, (value: boolean) => void] {
  const [value, setValue] = useState<boolean>(initialValue);

  const toggle = useCallback(() => {
    setValue((prev) => !prev);
  }, []);

  const set = useCallback((newValue: boolean) => {
    setValue(newValue);
  }, []);

  return [value, toggle, set];
}

