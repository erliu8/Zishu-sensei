/**
 * Framer Motion 动画变体配置
 * 
 * 为组件提供预定义的动画变体
 */

import { Variants } from 'framer-motion';

/* ========================================
   常用过渡配置
   ======================================== */

export const transitions = {
  fast: {
    duration: 0.15,
    ease: [0, 0, 0.2, 1],
  },
  normal: {
    duration: 0.25,
    ease: [0.4, 0, 0.2, 1],
  },
  slow: {
    duration: 0.35,
    ease: [0.4, 0, 0.2, 1],
  },
  spring: {
    type: 'spring',
    stiffness: 300,
    damping: 30,
  },
  smoothSpring: {
    type: 'spring',
    stiffness: 100,
    damping: 20,
  },
  bouncySpring: {
    type: 'spring',
    stiffness: 400,
    damping: 10,
  },
} as const;

/* ========================================
   淡入淡出变体
   ======================================== */

export const fadeVariants: Variants = {
  hidden: {
    opacity: 0,
  },
  visible: {
    opacity: 1,
    transition: transitions.normal,
  },
  exit: {
    opacity: 0,
    transition: transitions.fast,
  },
};

export const fadeInUpVariants: Variants = {
  hidden: {
    opacity: 0,
    y: 20,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: transitions.normal,
  },
  exit: {
    opacity: 0,
    y: -20,
    transition: transitions.fast,
  },
};

export const fadeInDownVariants: Variants = {
  hidden: {
    opacity: 0,
    y: -20,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: transitions.normal,
  },
  exit: {
    opacity: 0,
    y: 20,
    transition: transitions.fast,
  },
};

export const fadeInLeftVariants: Variants = {
  hidden: {
    opacity: 0,
    x: -20,
  },
  visible: {
    opacity: 1,
    x: 0,
    transition: transitions.normal,
  },
  exit: {
    opacity: 0,
    x: 20,
    transition: transitions.fast,
  },
};

export const fadeInRightVariants: Variants = {
  hidden: {
    opacity: 0,
    x: 20,
  },
  visible: {
    opacity: 1,
    x: 0,
    transition: transitions.normal,
  },
  exit: {
    opacity: 0,
    x: -20,
    transition: transitions.fast,
  },
};

/* ========================================
   缩放变体
   ======================================== */

export const scaleVariants: Variants = {
  hidden: {
    opacity: 0,
    scale: 0.9,
  },
  visible: {
    opacity: 1,
    scale: 1,
    transition: transitions.spring,
  },
  exit: {
    opacity: 0,
    scale: 0.9,
    transition: transitions.fast,
  },
};

export const zoomInVariants: Variants = {
  hidden: {
    opacity: 0,
    scale: 0.3,
  },
  visible: {
    opacity: 1,
    scale: 1,
    transition: transitions.spring,
  },
  exit: {
    opacity: 0,
    scale: 0.3,
    transition: transitions.fast,
  },
};

export const popVariants: Variants = {
  hidden: {
    scale: 0,
  },
  visible: {
    scale: 1,
    transition: transitions.bouncySpring,
  },
  exit: {
    scale: 0,
    transition: transitions.fast,
  },
};

/* ========================================
   滑动变体
   ======================================== */

export const slideInUpVariants: Variants = {
  hidden: {
    y: '100%',
  },
  visible: {
    y: 0,
    transition: transitions.slow,
  },
  exit: {
    y: '100%',
    transition: transitions.normal,
  },
};

export const slideInDownVariants: Variants = {
  hidden: {
    y: '-100%',
  },
  visible: {
    y: 0,
    transition: transitions.slow,
  },
  exit: {
    y: '-100%',
    transition: transitions.normal,
  },
};

export const slideInLeftVariants: Variants = {
  hidden: {
    x: '-100%',
  },
  visible: {
    x: 0,
    transition: transitions.slow,
  },
  exit: {
    x: '-100%',
    transition: transitions.normal,
  },
};

export const slideInRightVariants: Variants = {
  hidden: {
    x: '100%',
  },
  visible: {
    x: 0,
    transition: transitions.slow,
  },
  exit: {
    x: '100%',
    transition: transitions.normal,
  },
};

/* ========================================
   列表动画变体
   ======================================== */

export const listContainerVariants: Variants = {
  hidden: {
    opacity: 0,
  },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.1,
    },
  },
  exit: {
    opacity: 0,
    transition: {
      staggerChildren: 0.05,
      staggerDirection: -1,
    },
  },
};

export const listItemVariants: Variants = {
  hidden: {
    opacity: 0,
    y: 20,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: transitions.normal,
  },
  exit: {
    opacity: 0,
    y: -20,
    transition: transitions.fast,
  },
};

export const gridContainerVariants: Variants = {
  hidden: {
    opacity: 0,
  },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.05,
    },
  },
};

export const gridItemVariants: Variants = {
  hidden: {
    opacity: 0,
    scale: 0.8,
  },
  visible: {
    opacity: 1,
    scale: 1,
    transition: transitions.spring,
  },
};

/* ========================================
   卡片动画变体
   ======================================== */

export const cardVariants: Variants = {
  hidden: {
    opacity: 0,
    y: 50,
    scale: 0.9,
  },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: transitions.spring,
  },
  hover: {
    y: -8,
    scale: 1.02,
    transition: transitions.fast,
  },
  tap: {
    scale: 0.98,
    transition: transitions.fast,
  },
};

export const cardHoverVariants: Variants = {
  rest: {
    scale: 1,
  },
  hover: {
    scale: 1.05,
    transition: transitions.normal,
  },
  tap: {
    scale: 0.95,
    transition: transitions.fast,
  },
};

/* ========================================
   模态框/对话框变体
   ======================================== */

export const modalBackdropVariants: Variants = {
  hidden: {
    opacity: 0,
  },
  visible: {
    opacity: 1,
    transition: transitions.normal,
  },
  exit: {
    opacity: 0,
    transition: transitions.fast,
  },
};

export const modalContentVariants: Variants = {
  hidden: {
    opacity: 0,
    scale: 0.9,
    y: 20,
  },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: transitions.spring,
  },
  exit: {
    opacity: 0,
    scale: 0.9,
    y: 20,
    transition: transitions.fast,
  },
};

export const drawerVariants: Variants = {
  hidden: {
    x: '100%',
  },
  visible: {
    x: 0,
    transition: transitions.slow,
  },
  exit: {
    x: '100%',
    transition: transitions.normal,
  },
};

/* ========================================
   通知/Toast 变体
   ======================================== */

export const toastVariants: Variants = {
  hidden: {
    opacity: 0,
    y: -100,
    scale: 0.8,
  },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: transitions.spring,
  },
  exit: {
    opacity: 0,
    x: 100,
    transition: transitions.normal,
  },
};

export const notificationVariants: Variants = {
  hidden: {
    opacity: 0,
    x: 100,
  },
  visible: {
    opacity: 1,
    x: 0,
    transition: transitions.spring,
  },
  exit: {
    opacity: 0,
    x: 100,
    transition: transitions.fast,
  },
};

/* ========================================
   下拉菜单变体
   ======================================== */

export const dropdownVariants: Variants = {
  hidden: {
    opacity: 0,
    scale: 0.95,
    y: -10,
  },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: transitions.fast,
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    y: -10,
    transition: transitions.fast,
  },
};

export const dropdownItemVariants: Variants = {
  hidden: {
    opacity: 0,
    x: -10,
  },
  visible: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: {
      delay: i * 0.05,
      ...transitions.fast,
    },
  }),
};

/* ========================================
   标签页变体
   ======================================== */

export const tabContentVariants: Variants = {
  hidden: {
    opacity: 0,
    x: -20,
  },
  visible: {
    opacity: 1,
    x: 0,
    transition: transitions.normal,
  },
  exit: {
    opacity: 0,
    x: 20,
    transition: transitions.fast,
  },
};

export const tabIndicatorVariants = {
  transition: transitions.spring,
};

/* ========================================
   折叠/展开变体
   ======================================== */

export const collapseVariants: Variants = {
  collapsed: {
    height: 0,
    opacity: 0,
    transition: transitions.normal,
  },
  expanded: {
    height: 'auto',
    opacity: 1,
    transition: transitions.normal,
  },
};

export const accordionVariants: Variants = {
  collapsed: {
    height: 0,
    opacity: 0,
    transition: transitions.fast,
  },
  expanded: {
    height: 'auto',
    opacity: 1,
    transition: transitions.normal,
  },
};

/* ========================================
   旋转变体
   ======================================== */

export const rotateVariants: Variants = {
  initial: {
    rotate: 0,
  },
  animate: {
    rotate: 360,
    transition: {
      duration: 1,
      repeat: Infinity,
      ease: 'linear',
    },
  },
};

export const flipVariants: Variants = {
  front: {
    rotateY: 0,
    transition: transitions.normal,
  },
  back: {
    rotateY: 180,
    transition: transitions.normal,
  },
};

/* ========================================
   页面过渡变体
   ======================================== */

export const pageTransitionVariants: Variants = {
  initial: {
    opacity: 0,
    x: -20,
  },
  animate: {
    opacity: 1,
    x: 0,
    transition: transitions.slow,
  },
  exit: {
    opacity: 0,
    x: 20,
    transition: transitions.normal,
  },
};

export const pageFadeVariants: Variants = {
  initial: {
    opacity: 0,
  },
  animate: {
    opacity: 1,
    transition: transitions.slow,
  },
  exit: {
    opacity: 0,
    transition: transitions.fast,
  },
};

export const pageSlideVariants: Variants = {
  initial: {
    x: '100%',
  },
  animate: {
    x: 0,
    transition: transitions.slow,
  },
  exit: {
    x: '-100%',
    transition: transitions.normal,
  },
};

/* ========================================
   悬停动画变体
   ======================================== */

export const hoverLiftVariants: Variants = {
  rest: {
    y: 0,
    transition: transitions.normal,
  },
  hover: {
    y: -4,
    transition: transitions.fast,
  },
};

export const hoverScaleVariants: Variants = {
  rest: {
    scale: 1,
  },
  hover: {
    scale: 1.05,
    transition: transitions.fast,
  },
  tap: {
    scale: 0.95,
  },
};

export const hoverGlowVariants: Variants = {
  rest: {
    boxShadow: '0 0 0 0 rgba(0, 0, 0, 0)',
  },
  hover: {
    boxShadow: '0 0 20px 0 rgba(59, 130, 246, 0.5)',
    transition: transitions.normal,
  },
};

/* ========================================
   骨架屏变体
   ======================================== */

export const skeletonVariants: Variants = {
  initial: {
    backgroundPosition: '200% 0',
  },
  animate: {
    backgroundPosition: '-200% 0',
    transition: {
      duration: 1.5,
      repeat: Infinity,
      ease: 'linear',
    },
  },
};

/* ========================================
   加载变体
   ======================================== */

export const spinnerVariants: Variants = {
  animate: {
    rotate: 360,
    transition: {
      duration: 1,
      repeat: Infinity,
      ease: 'linear',
    },
  },
};

export const pulseVariants: Variants = {
  animate: {
    scale: [1, 1.05, 1],
    opacity: [1, 0.8, 1],
    transition: {
      duration: 2,
      repeat: Infinity,
      ease: 'easeInOut',
    },
  },
};

export const dotPulseVariants = {
  animate: (i: number) => ({
    scale: [0.8, 1, 0.8],
    opacity: [0.3, 1, 0.3],
    transition: {
      duration: 1.4,
      repeat: Infinity,
      delay: i * 0.16,
      ease: 'easeInOut',
    },
  }),
};

/* ========================================
   工具函数
   ======================================== */

/**
 * 创建延迟动画变体
 */
export const createDelayedVariants = (
  baseVariants: Variants,
  delay: number
): Variants => {
  return {
    ...baseVariants,
    visible: {
      ...baseVariants['visible'],
      transition: {
        ...(typeof baseVariants['visible'] === 'object'
          ? baseVariants['visible'].transition
          : {}),
        delay,
      },
    },
  };
};

/**
 * 创建交错动画变体
 */
export const createStaggerVariants = (
  staggerChildren: number = 0.1,
  delayChildren: number = 0
): Variants => {
  return {
    hidden: {
      opacity: 0,
    },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren,
        delayChildren,
      },
    },
  };
};

/**
 * 合并动画变体
 */
export const mergeVariants = (...variants: Variants[]): Variants => {
  return variants.reduce((acc, variant) => {
    Object.keys(variant).forEach((key) => {
      acc[key] = {
        ...(acc[key] || {}),
        ...(variant[key] || {}),
      };
    });
    return acc;
  }, {} as Variants);
};

