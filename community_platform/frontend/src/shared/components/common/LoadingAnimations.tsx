/**
 * 加载动画组件库
 * 
 * 提供各种加载状态的动画组件
 */

'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/shared/utils/cn';
import { Loader2 } from 'lucide-react';

/* ========================================
   旋转加载器
   ======================================== */

interface SpinnerProps {
  /**
   * 加载器大小
   */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /**
   * 颜色
   */
  color?: string;
  className?: string;
}

const spinnerSizes = {
  sm: 'w-4 h-4',
  md: 'w-6 h-6',
  lg: 'w-8 h-8',
  xl: 'w-12 h-12',
};

export const Spinner: React.FC<SpinnerProps> = ({
  size = 'md',
  color,
  className,
}) => {
  return (
    <motion.div
      className={cn(spinnerSizes[size], 'inline-block', className)}
      animate={{ rotate: 360 }}
      transition={{
        duration: 1,
        repeat: Infinity,
        ease: 'linear',
      }}
    >
      <Loader2
        className={cn('w-full h-full', color)}
        style={color ? { color } : undefined}
      />
    </motion.div>
  );
};

/* ========================================
   点加载器
   ======================================== */

interface DotsLoaderProps {
  /**
   * 点的数量
   */
  count?: number;
  /**
   * 点的大小（像素）
   */
  size?: number;
  /**
   * 点的颜色
   */
  color?: string;
  className?: string;
}

export const DotsLoader: React.FC<DotsLoaderProps> = ({
  count = 3,
  size = 8,
  color = 'currentColor',
  className,
}) => {
  return (
    <div className={cn('inline-flex items-center gap-2', className)}>
      {Array.from({ length: count }).map((_, i) => (
        <motion.div
          key={i}
          className="rounded-full"
          style={{
            width: size,
            height: size,
            backgroundColor: color,
          }}
          animate={{
            scale: [0.8, 1, 0.8],
            opacity: [0.3, 1, 0.3],
          }}
          transition={{
            duration: 1.4,
            repeat: Infinity,
            delay: i * 0.16,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  );
};

/* ========================================
   脉冲加载器
   ======================================== */

interface PulseLoaderProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const pulseSizes = {
  sm: 'w-8 h-8',
  md: 'w-12 h-12',
  lg: 'w-16 h-16',
};

export const PulseLoader: React.FC<PulseLoaderProps> = ({
  size = 'md',
  className,
}) => {
  return (
    <div className={cn('relative inline-flex', pulseSizes[size], className)}>
      {[0, 1].map((i) => (
        <motion.div
          key={i}
          className="absolute inset-0 rounded-full bg-primary"
          animate={{
            scale: [1, 2],
            opacity: [1, 0],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            delay: i * 1,
            ease: 'easeOut',
          }}
        />
      ))}
    </div>
  );
};

/* ========================================
   进度条
   ======================================== */

interface ProgressBarProps {
  /**
   * 进度值 (0-100)
   */
  value?: number;
  /**
   * 是否显示为不确定状态
   */
  indeterminate?: boolean;
  /**
   * 高度（像素）
   */
  height?: number;
  /**
   * 颜色
   */
  color?: string;
  /**
   * 是否显示百分比文本
   */
  showPercentage?: boolean;
  className?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  value = 0,
  indeterminate = false,
  height = 4,
  color,
  showPercentage = false,
  className,
}) => {
  return (
    <div className={cn('w-full', className)}>
      <div
        className="relative bg-secondary rounded-full overflow-hidden"
        style={{ height }}
      >
        {indeterminate ? (
          <motion.div
            className={cn('absolute inset-y-0 w-1/3 rounded-full', color || 'bg-primary')}
            animate={{
              x: ['-100%', '400%'],
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
        ) : (
          <motion.div
            className={cn('absolute inset-y-0 left-0 rounded-full', color || 'bg-primary')}
            initial={{ width: 0 }}
            animate={{ width: `${value}%` }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
          />
        )}
      </div>
      {showPercentage && !indeterminate && (
        <div className="text-xs text-muted-foreground text-center mt-1">
          {Math.round(value)}%
        </div>
      )}
    </div>
  );
};

/* ========================================
   圆形进度
   ======================================== */

interface CircularProgressProps {
  /**
   * 进度值 (0-100)
   */
  value?: number;
  /**
   * 是否显示为不确定状态
   */
  indeterminate?: boolean;
  /**
   * 大小（像素）
   */
  size?: number;
  /**
   * 线条粗细
   */
  strokeWidth?: number;
  /**
   * 颜色
   */
  color?: string;
  /**
   * 是否显示百分比文本
   */
  showPercentage?: boolean;
  className?: string;
}

export const CircularProgress: React.FC<CircularProgressProps> = ({
  value = 0,
  indeterminate = false,
  size = 48,
  strokeWidth = 4,
  color = 'currentColor',
  showPercentage = false,
  className,
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (value / 100) * circumference;

  return (
    <div
      className={cn('relative inline-flex items-center justify-center', className)}
      style={{ width: size, height: size }}
    >
      <svg
        className="transform -rotate-90"
        width={size}
        height={size}
      >
        {/* 背景圆环 */}
        <circle
          className="text-muted"
          strokeWidth={strokeWidth}
          stroke="currentColor"
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
          opacity={0.2}
        />
        {/* 进度圆环 */}
        {indeterminate ? (
          <motion.circle
            strokeWidth={strokeWidth}
            stroke={color}
            fill="transparent"
            r={radius}
            cx={size / 2}
            cy={size / 2}
            animate={{
              strokeDasharray: `${circumference} ${circumference}`,
              strokeDashoffset: [0, circumference],
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: 'linear',
            }}
          />
        ) : (
          <motion.circle
            strokeWidth={strokeWidth}
            stroke={color}
            fill="transparent"
            r={radius}
            cx={size / 2}
            cy={size / 2}
            strokeDasharray={`${circumference} ${circumference}`}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            strokeLinecap="round"
          />
        )}
      </svg>
      {showPercentage && !indeterminate && (
        <div className="absolute text-xs font-medium">
          {Math.round(value)}%
        </div>
      )}
    </div>
  );
};

/* ========================================
   加载覆盖层
   ======================================== */

interface LoadingOverlayProps {
  /**
   * 是否显示
   */
  visible: boolean;
  /**
   * 加载文本
   */
  text?: string;
  /**
   * 是否模糊背景
   */
  blur?: boolean;
  className?: string;
  children?: React.ReactNode;
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
  visible,
  text,
  blur = true,
  className,
  children,
}) => {
  if (!visible) return null;

  return (
    <motion.div
      className={cn(
        'absolute inset-0 flex flex-col items-center justify-center',
        'bg-background/80 z-50',
        blur && 'backdrop-blur-sm',
        className
      )}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      {children || (
        <>
          <Spinner size="lg" className="mb-4" />
          {text && (
            <p className="text-sm text-muted-foreground animate-pulse">{text}</p>
          )}
        </>
      )}
    </motion.div>
  );
};

/* ========================================
   全屏加载
   ======================================== */

interface FullScreenLoadingProps {
  /**
   * 是否显示
   */
  visible: boolean;
  /**
   * 加载文本
   */
  text?: string;
  /**
   * Logo或图标
   */
  logo?: React.ReactNode;
}

export const FullScreenLoading: React.FC<FullScreenLoadingProps> = ({
  visible,
  text = '加载中...',
  logo,
}) => {
  if (!visible) return null;

  return (
    <motion.div
      className="fixed inset-0 flex flex-col items-center justify-center bg-background z-[9999]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      {logo && (
        <motion.div
          className="mb-8"
          animate={{
            scale: [1, 1.05, 1],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        >
          {logo}
        </motion.div>
      )}
      <Spinner size="xl" className="mb-4" />
      {text && (
        <motion.p
          className="text-sm text-muted-foreground"
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          {text}
        </motion.p>
      )}
    </motion.div>
  );
};

/* ========================================
   步骤加载器
   ======================================== */

interface StepLoadingProps {
  /**
   * 当前步骤 (从0开始)
   */
  currentStep: number;
  /**
   * 总步骤数
   */
  steps: string[];
  className?: string;
}

export const StepLoading: React.FC<StepLoadingProps> = ({
  currentStep,
  steps,
  className,
}) => {
  return (
    <div className={cn('space-y-3', className)}>
      {steps.map((step, index) => {
        const isActive = index === currentStep;
        const isCompleted = index < currentStep;

        return (
          <motion.div
            key={index}
            className="flex items-center gap-3"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <div className="relative">
              {isCompleted ? (
                <motion.div
                  className="w-6 h-6 rounded-full bg-primary flex items-center justify-center text-primary-foreground"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 10 }}
                >
                  ✓
                </motion.div>
              ) : isActive ? (
                <Spinner size="sm" />
              ) : (
                <div className="w-6 h-6 rounded-full border-2 border-muted" />
              )}
            </div>
            <span
              className={cn(
                'text-sm transition-colors',
                isActive && 'text-foreground font-medium',
                isCompleted && 'text-muted-foreground line-through',
                !isActive && !isCompleted && 'text-muted-foreground'
              )}
            >
              {step}
            </span>
          </motion.div>
        );
      })}
    </div>
  );
};

/* ========================================
   骨架屏脉冲
   ======================================== */

interface SkeletonPulseProps {
  /**
   * 是否激活
   */
  active?: boolean;
  children: React.ReactNode;
  className?: string;
}

export const SkeletonPulse: React.FC<SkeletonPulseProps> = ({
  active = true,
  children,
  className,
}) => {
  if (!active) return <>{children}</>;

  return (
    <motion.div
      className={className}
      animate={{
        opacity: [0.5, 1, 0.5],
      }}
      transition={{
        duration: 1.5,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
    >
      {children}
    </motion.div>
  );
};

/* ========================================
   加载骨架
   ======================================== */

interface LoadingSkeletonProps {
  /**
   * 加载状态
   */
  loading: boolean;
  /**
   * 骨架屏内容
   */
  skeleton: React.ReactNode;
  /**
   * 实际内容
   */
  children: React.ReactNode;
}

export const LoadingSkeleton: React.FC<LoadingSkeletonProps> = ({
  loading,
  skeleton,
  children,
}) => {
  return (
    <motion.div
      initial={false}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      {loading ? skeleton : children}
    </motion.div>
  );
};

/* ========================================
   波浪加载器
   ======================================== */

interface WaveLoaderProps {
  /**
   * 波浪数量
   */
  count?: number;
  /**
   * 波浪高度
   */
  height?: number;
  /**
   * 波浪颜色
   */
  color?: string;
  className?: string;
}

export const WaveLoader: React.FC<WaveLoaderProps> = ({
  count = 5,
  height = 40,
  color = 'currentColor',
  className,
}) => {
  return (
    <div className={cn('inline-flex items-end gap-1', className)}>
      {Array.from({ length: count }).map((_, i) => (
        <motion.div
          key={i}
          className="w-1 rounded-full"
          style={{
            height,
            backgroundColor: color,
          }}
          animate={{
            scaleY: [0.3, 1, 0.3],
          }}
          transition={{
            duration: 1,
            repeat: Infinity,
            delay: i * 0.1,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  );
};

/* ========================================
   组件显示名称
   ======================================== */

Spinner.displayName = 'Spinner';
DotsLoader.displayName = 'DotsLoader';
PulseLoader.displayName = 'PulseLoader';
ProgressBar.displayName = 'ProgressBar';
CircularProgress.displayName = 'CircularProgress';
LoadingOverlay.displayName = 'LoadingOverlay';
FullScreenLoading.displayName = 'FullScreenLoading';
StepLoading.displayName = 'StepLoading';
SkeletonPulse.displayName = 'SkeletonPulse';
LoadingSkeleton.displayName = 'LoadingSkeleton';
WaveLoader.displayName = 'WaveLoader';

