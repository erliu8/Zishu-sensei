/**
 * 滚动动画组件库
 * 
 * 提供各种滚动触发的动画效果
 */

'use client';

import React, { useRef, useEffect, useState } from 'react';
import { motion, useScroll, useSpring, useTransform, useInView } from 'framer-motion';
import { cn } from '@/shared/utils/cn';

/* ========================================
   滚动淡入组件
   ======================================== */

interface FadeInWhenVisibleProps {
  children: React.ReactNode;
  /**
   * 动画方向
   */
  direction?: 'up' | 'down' | 'left' | 'right' | 'none';
  /**
   * 移动距离（像素）
   */
  distance?: number;
  /**
   * 延迟（秒）
   */
  delay?: number;
  /**
   * 动画时长（秒）
   */
  duration?: number;
  /**
   * 是否只触发一次
   */
  once?: boolean;
  /**
   * 触发阈值 (0-1)
   */
  threshold?: number;
  className?: string;
}

export const FadeInWhenVisible: React.FC<FadeInWhenVisibleProps> = ({
  children,
  direction = 'up',
  distance = 30,
  delay = 0,
  duration = 0.5,
  once = true,
  threshold = 0.1,
  className,
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once, amount: threshold });

  const getInitialPosition = () => {
    switch (direction) {
      case 'up':
        return { y: distance };
      case 'down':
        return { y: -distance };
      case 'left':
        return { x: distance };
      case 'right':
        return { x: -distance };
      default:
        return {};
    }
  };

  return (
    <motion.div
      ref={ref}
      className={className}
      initial={{ opacity: 0, ...getInitialPosition() }}
      animate={
        isInView
          ? { opacity: 1, x: 0, y: 0 }
          : { opacity: 0, ...getInitialPosition() }
      }
      transition={{ duration, delay }}
    >
      {children}
    </motion.div>
  );
};

/* ========================================
   滚动进度指示器
   ======================================== */

interface ScrollProgressProps {
  /**
   * 位置
   */
  position?: 'top' | 'bottom';
  /**
   * 高度（像素）
   */
  height?: number;
  /**
   * 颜色
   */
  color?: string;
  className?: string;
}

export const ScrollProgress: React.FC<ScrollProgressProps> = ({
  position = 'top',
  height = 3,
  color = 'hsl(var(--primary))',
  className,
}) => {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001,
  });

  return (
    <motion.div
      className={cn(
        'fixed left-0 right-0 z-50 origin-left',
        position === 'top' ? 'top-0' : 'bottom-0',
        className
      )}
      style={{
        height,
        backgroundColor: color,
        scaleX,
      }}
    />
  );
};

/* ========================================
   滚动视差组件
   ======================================== */

interface ScrollParallaxProps {
  children: React.ReactNode;
  /**
   * 滚动速度（负值向上，正值向下）
   */
  speed?: number;
  /**
   * 范围限制
   */
  clamp?: boolean;
  className?: string;
}

export const ScrollParallax: React.FC<ScrollParallaxProps> = ({
  children,
  speed = 0.5,
  clamp = false,
  className,
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  });

  const y = useTransform(
    scrollYProgress,
    [0, 1],
    [-100 * speed, 100 * speed],
    { clamp }
  );

  return (
    <div ref={ref} className={className}>
      <motion.div style={{ y }}>{children}</motion.div>
    </div>
  );
};

/* ========================================
   滚动缩放组件
   ======================================== */

interface ScrollScaleProps {
  children: React.ReactNode;
  /**
   * 初始缩放
   */
  initialScale?: number;
  /**
   * 最终缩放
   */
  finalScale?: number;
  className?: string;
}

export const ScrollScale: React.FC<ScrollScaleProps> = ({
  children,
  initialScale = 0.8,
  finalScale = 1,
  className,
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  });

  const scale = useTransform(scrollYProgress, [0, 0.5, 1], [initialScale, finalScale, initialScale]);

  return (
    <div ref={ref} className={className}>
      <motion.div style={{ scale }}>{children}</motion.div>
    </div>
  );
};

/* ========================================
   滚动旋转组件
   ======================================== */

interface ScrollRotateProps {
  children: React.ReactNode;
  /**
   * 旋转角度范围
   */
  rotation?: number;
  className?: string;
}

export const ScrollRotate: React.FC<ScrollRotateProps> = ({
  children,
  rotation = 360,
  className,
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  });

  const rotate = useTransform(scrollYProgress, [0, 1], [0, rotation]);

  return (
    <div ref={ref} className={className}>
      <motion.div style={{ rotate }}>{children}</motion.div>
    </div>
  );
};

/* ========================================
   滚动透明度组件
   ======================================== */

interface ScrollOpacityProps {
  children: React.ReactNode;
  /**
   * 淡入淡出模式
   */
  mode?: 'fade-in' | 'fade-out' | 'fade-in-out';
  className?: string;
}

export const ScrollOpacity: React.FC<ScrollOpacityProps> = ({
  children,
  mode = 'fade-in',
  className,
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  });

  const getOpacityRange = () => {
    switch (mode) {
      case 'fade-in':
        return [0, 1, 1];
      case 'fade-out':
        return [1, 1, 0];
      case 'fade-in-out':
        return [0, 1, 0];
      default:
        return [0, 1, 1];
    }
  };

  const opacity = useTransform(scrollYProgress, [0, 0.5, 1], getOpacityRange());

  return (
    <div ref={ref} className={className}>
      <motion.div style={{ opacity }}>{children}</motion.div>
    </div>
  );
};

/* ========================================
   交错滚动动画
   ======================================== */

interface StaggerScrollProps {
  children: React.ReactNode[];
  /**
   * 交错延迟（秒）
   */
  staggerDelay?: number;
  /**
   * 动画方向
   */
  direction?: 'up' | 'down' | 'left' | 'right';
  /**
   * 是否只触发一次
   */
  once?: boolean;
  className?: string;
  itemClassName?: string;
}

export const StaggerScroll: React.FC<StaggerScrollProps> = ({
  children,
  staggerDelay = 0.1,
  direction = 'up',
  once = true,
  className,
  itemClassName,
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once, amount: 0.1 });

  const getInitialPosition = () => {
    switch (direction) {
      case 'up':
        return { y: 30 };
      case 'down':
        return { y: -30 };
      case 'left':
        return { x: 30 };
      case 'right':
        return { x: -30 };
    }
  };

  return (
    <div ref={ref} className={className}>
      {React.Children.map(children, (child, index) => (
        <motion.div
          className={itemClassName}
          initial={{ opacity: 0, ...getInitialPosition() }}
          animate={
            isInView
              ? { opacity: 1, x: 0, y: 0 }
              : { opacity: 0, ...getInitialPosition() }
          }
          transition={{ duration: 0.5, delay: index * staggerDelay }}
        >
          {child}
        </motion.div>
      ))}
    </div>
  );
};

/* ========================================
   滚动计数器
   ======================================== */

interface ScrollCounterProps {
  /**
   * 目标数值
   */
  value: number;
  /**
   * 数字格式化函数
   */
  formatter?: (value: number) => string;
  /**
   * 动画时长（秒）
   */
  duration?: number;
  className?: string;
}

export const ScrollCounter: React.FC<ScrollCounterProps> = ({
  value,
  formatter = (v) => Math.round(v).toString(),
  duration = 2,
  className,
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true });
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    if (!isInView) return;

    let startTime: number;
    let animationFrame: number;

    const animate = (currentTime: number) => {
      if (!startTime) startTime = currentTime;
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / (duration * 1000), 1);

      // 缓动函数
      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      setDisplayValue(value * easeOutQuart);

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      }
    };

    animationFrame = requestAnimationFrame(animate);

    return () => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
    };
  }, [isInView, value, duration]);

  return (
    <div ref={ref} className={className}>
      {formatter(displayValue)}
    </div>
  );
};

/* ========================================
   粘性滚动元素
   ======================================== */

interface StickyScrollProps {
  children: React.ReactNode;
  /**
   * 粘性位置
   */
  top?: number;
  className?: string;
}

export const StickyScroll: React.FC<StickyScrollProps> = ({
  children,
  top = 0,
  className,
}) => {
  return (
    <div
      className={cn('sticky', className)}
      style={{ top }}
    >
      {children}
    </div>
  );
};

/* ========================================
   滚动触发动画容器
   ======================================== */

interface ScrollRevealProps {
  children: React.ReactNode;
  /**
   * 动画变体
   */
  variants?: {
    hidden: any;
    visible: any;
  };
  /**
   * 是否只触发一次
   */
  once?: boolean;
  /**
   * 触发阈值
   */
  threshold?: number;
  className?: string;
}

export const ScrollReveal: React.FC<ScrollRevealProps> = ({
  children,
  variants = {
    hidden: { opacity: 0, y: 30 },
    visible: { opacity: 1, y: 0 },
  },
  once = true,
  threshold = 0.1,
  className,
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once, amount: threshold });

  return (
    <motion.div
      ref={ref}
      className={className}
      initial="hidden"
      animate={isInView ? 'visible' : 'hidden'}
      variants={variants}
      transition={{ duration: 0.5 }}
    >
      {children}
    </motion.div>
  );
};

/* ========================================
   滚动背景视差
   ======================================== */

interface ScrollBackgroundParallaxProps {
  children: React.ReactNode;
  /**
   * 背景图片URL
   */
  backgroundUrl?: string;
  /**
   * 视差速度
   */
  speed?: number;
  className?: string;
}

export const ScrollBackgroundParallax: React.FC<ScrollBackgroundParallaxProps> = ({
  children,
  backgroundUrl,
  speed = 0.5,
  className,
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  });

  const y = useTransform(scrollYProgress, [0, 1], ['0%', `${100 * speed}%`]);

  return (
    <div ref={ref} className={cn('relative overflow-hidden', className)}>
      {backgroundUrl && (
        <motion.div
          className="absolute inset-0 -z-10"
          style={{
            backgroundImage: `url(${backgroundUrl})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            y,
          }}
        />
      )}
      {children}
    </div>
  );
};

/* ========================================
   滚动文字动画
   ======================================== */

interface ScrollTextRevealProps {
  text: string;
  /**
   * 是否按字符分割
   */
  splitByCharacter?: boolean;
  /**
   * 交错延迟
   */
  staggerDelay?: number;
  className?: string;
}

export const ScrollTextReveal: React.FC<ScrollTextRevealProps> = ({
  text,
  splitByCharacter = false,
  staggerDelay = 0.03,
  className,
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, amount: 0.5 });

  const items = splitByCharacter ? text.split('') : text.split(' ');

  return (
    <div ref={ref} className={className}>
      {items.map((item, index) => (
        <motion.span
          key={index}
          className={splitByCharacter ? '' : 'inline-block mr-1'}
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.5, delay: index * staggerDelay }}
        >
          {item}
        </motion.span>
      ))}
    </div>
  );
};

/* ========================================
   返回顶部按钮
   ======================================== */

interface ScrollToTopProps {
  /**
   * 显示阈值（滚动距离）
   */
  showAfter?: number;
  /**
   * 按钮位置
   */
  position?: 'bottom-right' | 'bottom-left';
  className?: string;
}

export const ScrollToTop: React.FC<ScrollToTopProps> = ({
  showAfter = 300,
  position = 'bottom-right',
  className,
}) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setVisible(window.scrollY > showAfter);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [showAfter]);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const positionClasses = {
    'bottom-right': 'bottom-8 right-8',
    'bottom-left': 'bottom-8 left-8',
  };

  return (
    <motion.button
      className={cn(
        'fixed z-50 p-3 rounded-full bg-primary text-primary-foreground shadow-lg',
        'hover:shadow-xl transition-shadow',
        positionClasses[position],
        className
      )}
      initial={{ opacity: 0, scale: 0 }}
      animate={visible ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0 }}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.9 }}
      onClick={scrollToTop}
      aria-label="返回顶部"
    >
      <svg
        className="w-6 h-6"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M5 10l7-7m0 0l7 7m-7-7v18"
        />
      </svg>
    </motion.button>
  );
};

/* ========================================
   组件显示名称
   ======================================== */

FadeInWhenVisible.displayName = 'FadeInWhenVisible';
ScrollProgress.displayName = 'ScrollProgress';
ScrollParallax.displayName = 'ScrollParallax';
ScrollScale.displayName = 'ScrollScale';
ScrollRotate.displayName = 'ScrollRotate';
ScrollOpacity.displayName = 'ScrollOpacity';
StaggerScroll.displayName = 'StaggerScroll';
ScrollCounter.displayName = 'ScrollCounter';
StickyScroll.displayName = 'StickyScroll';
ScrollReveal.displayName = 'ScrollReveal';
ScrollBackgroundParallax.displayName = 'ScrollBackgroundParallax';
ScrollTextReveal.displayName = 'ScrollTextReveal';
ScrollToTop.displayName = 'ScrollToTop';

