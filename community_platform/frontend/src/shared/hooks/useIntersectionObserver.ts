import { useState, useEffect, RefObject } from 'react';

export interface UseIntersectionObserverOptions extends IntersectionObserverInit {
  /** 是否只触发一次 */
  triggerOnce?: boolean;
}

/**
 * Intersection Observer Hook
 * @param ref - 要观察的元素引用
 * @param options - 配置选项
 * @returns IntersectionObserverEntry 或 null
 * @example
 * const ref = useRef<HTMLDivElement>(null);
 * const entry = useIntersectionObserver(ref, { threshold: 0.5 });
 * const isVisible = entry?.isIntersecting;
 */
export function useIntersectionObserver<T extends HTMLElement = HTMLElement>(
  ref: RefObject<T>,
  options: UseIntersectionObserverOptions = {}
): IntersectionObserverEntry | null {
  const { threshold = 0, root = null, rootMargin = '0px', triggerOnce = false } = options;

  const [entry, setEntry] = useState<IntersectionObserverEntry | null>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setEntry(entry);

        // 如果只触发一次且已经可见，则停止观察
        if (triggerOnce && entry.isIntersecting) {
          observer.unobserve(element);
        }
      },
      { threshold, root, rootMargin }
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [ref, threshold, root, rootMargin, triggerOnce]);

  return entry;
}

/**
 * 简化版：判断元素是否可见
 * @param ref - 要观察的元素引用
 * @param options - 配置选项
 * @returns 是否可见
 */
export function useIsVisible<T extends HTMLElement = HTMLElement>(
  ref: RefObject<T>,
  options?: UseIntersectionObserverOptions
): boolean {
  const entry = useIntersectionObserver(ref, options);
  return entry?.isIntersecting ?? false;
}

