/**
 * 动画工具函数
 * 
 * 提供动画相关的工具函数和 Hooks
 */

import { useEffect, useState, useRef } from 'react';
import { useMotionValue, useSpring, useTransform } from 'framer-motion';

/* ========================================
   性能检测
   ======================================== */

/**
 * 检测用户是否偏好减少动画
 */
export const useReducedMotion = (): boolean => {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const handleChange = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return prefersReducedMotion;
};

/**
 * 根据用户偏好返回动画配置
 */
export const useAnimationConfig = () => {
  const reducedMotion = useReducedMotion();

  return {
    duration: reducedMotion ? 0 : undefined,
    transition: reducedMotion
      ? { duration: 0 }
      : { duration: 0.25, ease: 'easeOut' },
  };
};

/* ========================================
   滚动动画
   ======================================== */

/**
 * 监听滚动位置
 */
export const useScrollPosition = () => {
  const [scrollPosition, setScrollPosition] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      setScrollPosition(window.pageYOffset);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return scrollPosition;
};

/**
 * 监听元素滚动进度
 */
export const useScrollProgress = () => {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const totalScroll = document.documentElement.scrollHeight - window.innerHeight;
      const currentProgress = (window.pageYOffset / totalScroll) * 100;
      setProgress(currentProgress);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); // 初始化
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return progress;
};

/**
 * 平滑滚动到元素
 */
export const smoothScrollTo = (
  elementId: string,
  offset: number = 0,
  behavior: ScrollBehavior = 'smooth'
) => {
  const element = document.getElementById(elementId);
  if (!element) return;

  const elementPosition = element.getBoundingClientRect().top;
  const offsetPosition = elementPosition + window.pageYOffset - offset;

  window.scrollTo({
    top: offsetPosition,
    behavior,
  });
};

/* ========================================
   视口检测
   ======================================== */

/**
 * 检测元素是否在视口中
 */
export const useInViewport = (
  ref: React.RefObject<HTMLElement>,
  options?: IntersectionObserverInit
): boolean => {
  const [isInViewport, setIsInViewport] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(([entry]) => {
      setIsInViewport(entry.isIntersecting);
    }, options);

    observer.observe(element);
    return () => observer.disconnect();
  }, [ref, options]);

  return isInViewport;
};

/**
 * 滚动触发动画
 */
export const useScrollAnimation = (
  ref: React.RefObject<HTMLElement>,
  threshold: number = 0.1
) => {
  const [hasAnimated, setHasAnimated] = useState(false);
  const isInView = useInViewport(ref, { threshold });

  useEffect(() => {
    if (isInView && !hasAnimated) {
      setHasAnimated(true);
    }
  }, [isInView, hasAnimated]);

  return hasAnimated;
};

/* ========================================
   鼠标位置追踪
   ======================================== */

/**
 * 追踪鼠标位置
 */
export const useMousePosition = () => {
  const [position, setPosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setPosition({ x: e.clientX, y: e.clientY });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return position;
};

/**
 * 追踪元素内的鼠标位置
 */
export const useMousePositionInElement = (
  ref: React.RefObject<HTMLElement>
) => {
  const [position, setPosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = element.getBoundingClientRect();
      setPosition({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    };

    element.addEventListener('mousemove', handleMouseMove);
    return () => element.removeEventListener('mousemove', handleMouseMove);
  }, [ref]);

  return position;
};

/* ========================================
   弹簧动画
   ======================================== */

/**
 * 创建弹簧动画值
 */
export const useSpringValue = (
  value: number,
  config?: {
    stiffness?: number;
    damping?: number;
    mass?: number;
  }
) => {
  const motionValue = useMotionValue(value);
  const spring = useSpring(motionValue, {
    stiffness: config?.stiffness ?? 100,
    damping: config?.damping ?? 10,
    mass: config?.mass ?? 1,
  });

  useEffect(() => {
    motionValue.set(value);
  }, [value, motionValue]);

  return spring;
};

/* ========================================
   交错动画
   ======================================== */

/**
 * 生成交错延迟
 */
export const getStaggerDelay = (index: number, baseDelay: number = 0.1) => {
  return index * baseDelay;
};

/**
 * 生成交错动画配置
 */
export const createStaggerConfig = (
  itemCount: number,
  baseDelay: number = 0.1,
  startDelay: number = 0
) => {
  return Array.from({ length: itemCount }).map((_, index) => ({
    delay: startDelay + getStaggerDelay(index, baseDelay),
  }));
};

/* ========================================
   响应式动画
   ======================================== */

/**
 * 根据屏幕大小调整动画参数
 */
export const useResponsiveAnimation = () => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return {
    duration: isMobile ? 0.2 : 0.3,
    distance: isMobile ? 10 : 20,
    scale: isMobile ? 0.95 : 0.9,
  };
};

/* ========================================
   视差效果
   ======================================== */

/**
 * 创建视差滚动效果
 */
export const useParallax = (speed: number = 0.5) => {
  const scrollY = useScrollPosition();
  return scrollY * speed;
};

/**
 * 创建视差变换
 */
export const useParallaxTransform = (
  inputRange: number[],
  outputRange: number[],
  options?: { clamp?: boolean }
) => {
  const scrollY = useMotionValue(0);

  useEffect(() => {
    const handleScroll = () => {
      scrollY.set(window.pageYOffset);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [scrollY]);

  return useTransform(scrollY, inputRange, outputRange, options);
};

/* ========================================
   动画帧率控制
   ======================================== */

/**
 * 节流动画帧
 */
export const useThrottledAnimation = (
  callback: () => void,
  delay: number = 16
) => {
  const lastRun = useRef(Date.now());

  useEffect(() => {
    const handleAnimation = () => {
      const now = Date.now();
      if (now - lastRun.current >= delay) {
        callback();
        lastRun.current = now;
      }
    };

    let animationFrameId: number;
    const animate = () => {
      handleAnimation();
      animationFrameId = requestAnimationFrame(animate);
    };

    animationFrameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrameId);
  }, [callback, delay]);
};

/* ========================================
   动画状态管理
   ======================================== */

/**
 * 管理动画播放状态
 */
export const useAnimationState = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  const play = () => {
    setIsPlaying(true);
    setIsPaused(false);
  };

  const pause = () => {
    setIsPaused(true);
  };

  const stop = () => {
    setIsPlaying(false);
    setIsPaused(false);
  };

  const toggle = () => {
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  };

  return { isPlaying, isPaused, play, pause, stop, toggle };
};

/* ========================================
   动画序列
   ======================================== */

/**
 * 创建动画序列
 */
export const createAnimationSequence = (
  steps: Array<{
    duration: number;
    callback: () => void;
  }>
) => {
  let currentStep = 0;

  const executeStep = () => {
    if (currentStep >= steps.length) return;

    const step = steps[currentStep];
    step.callback();

    setTimeout(() => {
      currentStep++;
      executeStep();
    }, step.duration * 1000);
  };

  return {
    start: () => {
      currentStep = 0;
      executeStep();
    },
    reset: () => {
      currentStep = 0;
    },
  };
};

/* ========================================
   性能优化
   ======================================== */

/**
 * 使用 will-change 优化动画性能
 */
export const optimizeAnimation = (
  element: HTMLElement | null,
  properties: string[]
) => {
  if (!element) return;

  element.style.willChange = properties.join(', ');

  // 动画结束后移除 will-change
  const removeWillChange = () => {
    element.style.willChange = 'auto';
  };

  return removeWillChange;
};

/**
 * 检测设备性能
 */
export const useDevicePerformance = () => {
  const [performance, setPerformance] = useState<'high' | 'medium' | 'low'>(
    'high'
  );

  useEffect(() => {
    // 简单的性能检测逻辑
    const hardwareConcurrency = navigator.hardwareConcurrency || 2;
    const deviceMemory = (navigator as any).deviceMemory || 4;

    if (hardwareConcurrency >= 8 && deviceMemory >= 8) {
      setPerformance('high');
    } else if (hardwareConcurrency >= 4 && deviceMemory >= 4) {
      setPerformance('medium');
    } else {
      setPerformance('low');
    }
  }, []);

  return performance;
};

/**
 * 根据性能调整动画配置
 */
export const usePerformanceAwareAnimation = () => {
  const performance = useDevicePerformance();
  const reducedMotion = useReducedMotion();

  if (reducedMotion) {
    return { duration: 0, animate: false };
  }

  switch (performance) {
    case 'high':
      return { duration: 0.3, animate: true, quality: 'high' };
    case 'medium':
      return { duration: 0.2, animate: true, quality: 'medium' };
    case 'low':
      return { duration: 0.1, animate: false, quality: 'low' };
    default:
      return { duration: 0.2, animate: true, quality: 'medium' };
  }
};

/* ========================================
   条件动画
   ======================================== */

/**
 * 根据条件返回动画变体
 */
export const conditionalVariants = <T extends Record<string, any>>(
  condition: boolean,
  trueVariants: T,
  falseVariants: T
): T => {
  return condition ? trueVariants : falseVariants;
};

/**
 * 组合多个动画变体
 */
export const combineVariants = <T extends Record<string, any>>(
  ...variants: T[]
): T => {
  return variants.reduce((acc, variant) => ({ ...acc, ...variant }), {} as T);
};

/* ========================================
   时间工具
   ======================================== */

/**
 * 将秒转换为毫秒
 */
export const toMs = (seconds: number): number => seconds * 1000;

/**
 * 将毫秒转换为秒
 */
export const toSeconds = (ms: number): number => ms / 1000;

/**
 * 延迟执行
 */
export const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/* ========================================
   缓动函数
   ======================================== */

export const easings = {
  linear: (t: number) => t,
  easeIn: (t: number) => t * t,
  easeOut: (t: number) => t * (2 - t),
  easeInOut: (t: number) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),
  easeInCubic: (t: number) => t * t * t,
  easeOutCubic: (t: number) => --t * t * t + 1,
  easeInOutCubic: (t: number) =>
    t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1,
  easeInQuart: (t: number) => t * t * t * t,
  easeOutQuart: (t: number) => 1 - --t * t * t * t,
  easeInOutQuart: (t: number) =>
    t < 0.5 ? 8 * t * t * t * t : 1 - 8 * --t * t * t * t,
  easeInElastic: (t: number) =>
    (0.04 - 0.04 / t) * Math.sin(25 * t) + 1,
  easeOutElastic: (t: number) =>
    ((0.04 * t) / --t) * Math.sin(25 * t),
  easeInOutElastic: (t: number) =>
    (t -= 0.5) < 0
      ? (0.02 + 0.01 / t) * Math.sin(50 * t)
      : (0.02 - 0.01 / t) * Math.sin(50 * t) + 1,
};

/* ========================================
   动画预设
   ======================================== */

export const animationPresets = {
  // 快速淡入
  quickFade: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: 0.15 },
  },
  // 滑入
  slideUp: {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 },
    transition: { duration: 0.25 },
  },
  // 缩放
  scale: {
    initial: { opacity: 0, scale: 0.9 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.9 },
    transition: { duration: 0.2 },
  },
  // 弹性
  bounce: {
    initial: { opacity: 0, scale: 0 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0 },
    transition: {
      type: 'spring',
      stiffness: 400,
      damping: 10,
    },
  },
};

/* ========================================
   调试工具
   ======================================== */

/**
 * 在开发环境中记录动画事件
 */
export const logAnimationEvent = (
  eventName: string,
  data?: any
) => {
  if (process.env.NODE_ENV === 'development') {
    console.log(`[Animation] ${eventName}`, data);
  }
};

/**
 * 测量动画性能
 */
export const measureAnimationPerformance = (
  name: string,
  callback: () => void
) => {
  if (process.env.NODE_ENV === 'development') {
    const start = performance.now();
    callback();
    const end = performance.now();
    console.log(`[Animation Performance] ${name}: ${end - start}ms`);
  } else {
    callback();
  }
};

