/**
 * 动画配置提供器
 * 
 * 为整个应用提供动画配置和优化
 */

'use client';

import React, { createContext, useContext, useMemo } from 'react';
import { LazyMotion, domAnimation, MotionConfig } from 'framer-motion';
import {
  useReducedMotion,
  useDevicePerformance,
} from '@/shared/animations/utils';

interface AnimationContextValue {
  /**
   * 是否启用动画
   */
  enabled: boolean;
  /**
   * 动画时长倍数
   */
  durationMultiplier: number;
  /**
   * 设备性能级别
   */
  performanceLevel: 'high' | 'medium' | 'low';
}

const AnimationContext = createContext<AnimationContextValue>({
  enabled: true,
  durationMultiplier: 1,
  performanceLevel: 'high',
});

/**
 * 使用动画配置
 */
export const useAnimationContext = () => {
  const context = useContext(AnimationContext);
  if (!context) {
    throw new Error(
      'useAnimationContext must be used within AnimationProvider'
    );
  }
  return context;
};

interface AnimationProviderProps {
  children: React.ReactNode;
  /**
   * 强制禁用动画
   */
  forceDisable?: boolean;
}

/**
 * 动画提供器
 * 
 * 使用 LazyMotion 优化包体积，根据用户偏好和设备性能调整动画
 */
export const AnimationProvider: React.FC<AnimationProviderProps> = ({
  children,
  forceDisable = false,
}) => {
  const prefersReducedMotion = useReducedMotion();
  const performanceLevel = useDevicePerformance();

  const contextValue = useMemo<AnimationContextValue>(() => {
    const shouldDisable = forceDisable || prefersReducedMotion;
    
    return {
      enabled: !shouldDisable,
      durationMultiplier: shouldDisable
        ? 0
        : performanceLevel === 'low'
        ? 0.5
        : performanceLevel === 'medium'
        ? 0.75
        : 1,
      performanceLevel,
    };
  }, [forceDisable, prefersReducedMotion, performanceLevel]);

  return (
    <AnimationContext.Provider value={contextValue}>
      <LazyMotion features={domAnimation} strict>
        <MotionConfig
          reducedMotion={contextValue.enabled ? 'user' : 'always'}
          transition={{
            duration: 0.25 * contextValue.durationMultiplier,
            ease: [0.4, 0, 0.2, 1],
          }}
        >
          {children}
        </MotionConfig>
      </LazyMotion>
    </AnimationContext.Provider>
  );
};

AnimationProvider.displayName = 'AnimationProvider';

