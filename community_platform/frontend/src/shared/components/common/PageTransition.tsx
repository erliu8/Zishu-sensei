/**
 * 页面过渡动画组件
 * 
 * 为页面切换提供平滑的过渡效果
 */

'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  pageTransitionVariants,
  pageFadeVariants,
  pageSlideVariants,
} from '@/shared/animations/variants';

type TransitionType = 'fade' | 'slide' | 'slideUp' | 'scale' | 'none';

interface PageTransitionProps {
  children: React.ReactNode;
  type?: TransitionType;
  className?: string;
}

const variantsMap = {
  fade: pageFadeVariants,
  slide: pageTransitionVariants,
  slideUp: pageSlideVariants,
  scale: {
    initial: { opacity: 0, scale: 0.95 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.95 },
  },
  none: {
    initial: {},
    animate: {},
    exit: {},
  },
};

/**
 * 页面过渡组件
 */
export const PageTransition: React.FC<PageTransitionProps> = ({
  children,
  type = 'fade',
  className,
}) => {
  const variants = variantsMap[type];

  return (
    <motion.div
      initial="initial"
      animate="animate"
      exit="exit"
      variants={variants}
      className={className}
    >
      {children}
    </motion.div>
  );
};

/**
 * 页面动画包装器（用于 App Router）
 */
interface PageAnimationWrapperProps {
  children: React.ReactNode;
  type?: TransitionType;
  className?: string;
  /**
   * 用于标识页面的唯一 key
   */
  pageKey?: string;
}

export const PageAnimationWrapper: React.FC<PageAnimationWrapperProps> = ({
  children,
  type = 'fade',
  className,
  pageKey,
}) => {
  return (
    <AnimatePresence mode="wait" initial={false}>
      <PageTransition key={pageKey} type={type} className={className}>
        {children}
      </PageTransition>
    </AnimatePresence>
  );
};

/**
 * 路由过渡提供器
 */
interface RouteTransitionProviderProps {
  children: React.ReactNode;
}

export const RouteTransitionProvider: React.FC<
  RouteTransitionProviderProps
> = ({ children }) => {
  return (
    <AnimatePresence mode="wait" initial={false}>
      {children}
    </AnimatePresence>
  );
};

PageTransition.displayName = 'PageTransition';
PageAnimationWrapper.displayName = 'PageAnimationWrapper';
RouteTransitionProvider.displayName = 'RouteTransitionProvider';

