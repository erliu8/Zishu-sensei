import { useState, useEffect } from 'react';

export interface ScrollPosition {
  x: number;
  y: number;
}

export interface UseScrollPositionOptions {
  /** 节流延迟（毫秒），默认为 100ms */
  throttle?: number;
}

/**
 * 滚动位置 Hook
 * @param options - 配置选项
 * @returns 当前滚动位置
 * @example
 * const { x, y } = useScrollPosition();
 * const isScrolled = y > 100;
 */
export function useScrollPosition(options: UseScrollPositionOptions = {}): ScrollPosition {
  const { throttle = 100 } = options;

  const [scrollPosition, setScrollPosition] = useState<ScrollPosition>({
    x: 0,
    y: 0,
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    let timeoutId: NodeJS.Timeout | null = null;

    const handleScroll = () => {
      if (timeoutId) return;

      timeoutId = setTimeout(() => {
        setScrollPosition({
          x: window.scrollX,
          y: window.scrollY,
        });
        timeoutId = null;
      }, throttle);
    };

    // 初始化位置
    setScrollPosition({
      x: window.scrollX,
      y: window.scrollY,
    });

    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [throttle]);

  return scrollPosition;
}

/**
 * 滚动方向 Hook
 * @returns 滚动方向：'up' | 'down' | 'left' | 'right' | null
 */
export function useScrollDirection() {
  const [scrollDirection, setScrollDirection] = useState<
    'up' | 'down' | 'left' | 'right' | null
  >(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    let lastScrollX = window.scrollX;
    let lastScrollY = window.scrollY;

    const handleScroll = () => {
      const currentScrollX = window.scrollX;
      const currentScrollY = window.scrollY;

      if (currentScrollY > lastScrollY) {
        setScrollDirection('down');
      } else if (currentScrollY < lastScrollY) {
        setScrollDirection('up');
      } else if (currentScrollX > lastScrollX) {
        setScrollDirection('right');
      } else if (currentScrollX < lastScrollX) {
        setScrollDirection('left');
      }

      lastScrollX = currentScrollX;
      lastScrollY = currentScrollY;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  return scrollDirection;
}

/**
 * 判断是否滚动到底部
 * @param offset - 距离底部的偏移量（像素），默认为 0
 * @returns 是否到达底部
 */
export function useIsAtBottom(offset: number = 0): boolean {
  const [isAtBottom, setIsAtBottom] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleScroll = () => {
      const scrollTop = window.scrollY;
      const windowHeight = window.innerHeight;
      const documentHeight = document.documentElement.scrollHeight;

      const bottom = scrollTop + windowHeight >= documentHeight - offset;
      setIsAtBottom(bottom);
    };

    handleScroll(); // 初始检查

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
    };
  }, [offset]);

  return isAtBottom;
}

