/**
 * 动画系统统一导出
 */

// 导出所有动画变体
export * from './variants';

// 导出所有工具函数
export * from './utils';

// 导出常用的动画配置
export {
  transitions,
  fadeVariants,
  fadeInUpVariants,
  fadeInDownVariants,
  scaleVariants,
  listContainerVariants,
  listItemVariants,
  cardVariants,
  modalBackdropVariants,
  modalContentVariants,
  pageTransitionVariants,
} from './variants';

// 导出常用的工具函数
export {
  useReducedMotion,
  useAnimationConfig,
  useScrollPosition,
  useScrollProgress,
  useInViewport,
  useScrollAnimation,
  useResponsiveAnimation,
  smoothScrollTo,
  animationPresets,
} from './utils';

