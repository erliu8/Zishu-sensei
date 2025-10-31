/**
 * 加载状态组件库
 * 
 * 提供各种加载指示器和状态组件
 */

'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Loader2, RefreshCw } from 'lucide-react';
import { cn } from '@/shared/utils/cn';
import {
  spinnerVariants,
  pulseVariants,
} from '@/shared/animations/variants';

/* ========================================
   旋转加载器
   ======================================== */

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  /**
   * 加载文本
   */
  text?: string;
}

const spinnerSizes = {
  sm: 'w-4 h-4',
  md: 'w-6 h-6',
  lg: 'w-8 h-8',
  xl: 'w-12 h-12',
};

export const Spinner: React.FC<SpinnerProps> = ({
  size = 'md',
  className,
  text,
}) => {
  return (
    <div className="flex flex-col items-center justify-center gap-2">
      <motion.div
        className={cn(spinnerSizes[size], className)}
        variants={spinnerVariants}
        animate="animate"
      >
        <Loader2 className="w-full h-full text-primary" />
      </motion.div>
      {text && <p className="text-sm text-muted-foreground">{text}</p>}
    </div>
  );
};

/* ========================================
   点加载器
   ======================================== */

interface DotsLoaderProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const dotSizes = {
  sm: 'w-1.5 h-1.5',
  md: 'w-2 h-2',
  lg: 'w-3 h-3',
};

export const DotsLoader: React.FC<DotsLoaderProps> = ({
  size = 'md',
  className,
}) => {
  return (
    <div className={cn('flex items-center gap-1', className)}>
      {[0, 1, 2].map((index) => (
        <motion.div
          key={index}
          className={cn('bg-primary rounded-full', dotSizes[size])}
          animate={{
            scale: [0.8, 1, 0.8],
            opacity: [0.3, 1, 0.3]
          }}
          transition={{
            duration: 1.4,
            repeat: Infinity,
            delay: index * 0.16,
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
    <motion.div
      className={cn(
        'bg-primary rounded-full',
        pulseSizes[size],
        className
      )}
      variants={pulseVariants}
      animate="animate"
    />
  );
};

/* ========================================
   进度条加载器
   ======================================== */

interface ProgressBarProps {
  /**
   * 进度值 (0-100)
   */
  value?: number;
  /**
   * 是否为不确定状态
   */
  indeterminate?: boolean;
  className?: string;
  /**
   * 显示百分比文本
   */
  showPercentage?: boolean;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  value = 0,
  indeterminate = false,
  className,
  showPercentage = false,
}) => {
  const percentage = Math.min(Math.max(value, 0), 100);

  return (
    <div className={cn('w-full', className)}>
      <div className="relative h-2 bg-muted rounded-full overflow-hidden">
        {indeterminate ? (
          <motion.div
            className="absolute h-full w-1/3 bg-primary rounded-full"
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
            className="h-full bg-primary rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${percentage}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        )}
      </div>
      {showPercentage && !indeterminate && (
        <p className="text-xs text-muted-foreground mt-1 text-center">
          {percentage}%
        </p>
      )}
    </div>
  );
};

/* ========================================
   圆形进度加载器
   ======================================== */

interface CircularProgressProps {
  /**
   * 进度值 (0-100)
   */
  value?: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
  /**
   * 显示百分比文本
   */
  showPercentage?: boolean;
}

export const CircularProgress: React.FC<CircularProgressProps> = ({
  value = 0,
  size = 48,
  strokeWidth = 4,
  className,
  showPercentage = false,
}) => {
  const percentage = Math.min(Math.max(value, 0), 100);
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div className={cn('relative inline-flex', className)}>
      <svg width={size} height={size} className="transform -rotate-90">
        {/* 背景圆 */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="none"
          className="text-muted"
        />
        {/* 进度圆 */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          className="text-primary"
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          style={{
            strokeDasharray: circumference,
          }}
        />
      </svg>
      {showPercentage && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xs font-medium">{Math.round(percentage)}%</span>
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
   * 是否半透明背景
   */
  transparent?: boolean;
  className?: string;
  children?: React.ReactNode;
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
  visible,
  text,
  transparent = false,
  className,
  children,
}) => {
  if (!visible) return null;

  return (
    <motion.div
      className={cn(
        'absolute inset-0 z-50 flex items-center justify-center',
        transparent ? 'bg-background/80' : 'bg-background',
        className
      )}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <div className="flex flex-col items-center gap-3">
        {children || <Spinner size="lg" />}
        {text && (
          <p className="text-sm text-muted-foreground font-medium">{text}</p>
        )}
      </div>
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
   * Logo 或图标
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
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-background"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="flex flex-col items-center gap-4">
        {logo && <div className="mb-2">{logo}</div>}
        <Spinner size="xl" />
        {text && (
          <p className="text-base text-muted-foreground font-medium">{text}</p>
        )}
      </div>
    </motion.div>
  );
};

/* ========================================
   刷新按钮
   ======================================== */

interface RefreshButtonProps {
  onClick: () => void;
  loading?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  children?: React.ReactNode;
}

const refreshButtonSizes = {
  sm: 'h-8 px-3 text-xs',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-6 text-base',
};

export const RefreshButton: React.FC<RefreshButtonProps> = ({
  onClick,
  loading = false,
  size = 'md',
  className,
  children = '刷新',
}) => {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-md',
        'bg-primary text-primary-foreground font-medium',
        'hover:bg-primary/90 active:scale-95',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        'transition-all duration-200',
        refreshButtonSizes[size],
        className
      )}
    >
      <motion.div
        animate={loading ? { rotate: 360 } : { rotate: 0 }}
        transition={
          loading
            ? { duration: 1, repeat: Infinity, ease: 'linear' }
            : { duration: 0.2 }
        }
      >
        <RefreshCw className="w-4 h-4" />
      </motion.div>
      {children}
    </button>
  );
};

/* ========================================
   按钮加载状态
   ======================================== */

interface ButtonLoadingProps {
  loading: boolean;
  children: React.ReactNode;
  /**
   * 加载时显示的文本
   */
  loadingText?: string;
  className?: string;
}

export const ButtonLoading: React.FC<ButtonLoadingProps> = ({
  loading,
  children,
  loadingText,
  className,
}) => {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      {loading && <Spinner size="sm" />}
      {loading && loadingText ? loadingText : children}
    </span>
  );
};

/* ========================================
   骨架屏容器（带加载状态切换）
   ======================================== */

interface LoadingWrapperProps {
  /**
   * 是否正在加载
   */
  loading: boolean;
  /**
   * 骨架屏组件
   */
  skeleton: React.ReactNode;
  /**
   * 实际内容
   */
  children: React.ReactNode;
  className?: string;
}

export const LoadingWrapper: React.FC<LoadingWrapperProps> = ({
  loading,
  skeleton,
  children,
  className,
}) => {
  return (
    <div className={className}>
      {loading ? skeleton : children}
    </div>
  );
};

/* ========================================
   分段加载指示器
   ======================================== */

interface StepLoadingProps {
  /**
   * 当前步骤 (从 0 开始)
   */
  currentStep: number;
  /**
   * 总步骤数
   */
  totalSteps: number;
  /**
   * 步骤标签
   */
  labels?: string[];
  className?: string;
}

export const StepLoading: React.FC<StepLoadingProps> = ({
  currentStep,
  totalSteps,
  labels = [],
  className,
}) => {
  return (
    <div className={cn('space-y-4', className)}>
      {/* 进度条 */}
      <ProgressBar
        value={(currentStep / totalSteps) * 100}
        showPercentage
      />

      {/* 步骤指示 */}
      <div className="flex justify-between">
        {Array.from({ length: totalSteps }).map((_, index) => (
          <div
            key={index}
            className="flex flex-col items-center gap-2"
          >
            <motion.div
              className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium',
                index <= currentStep
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground'
              )}
              initial={{ scale: 0.8 }}
              animate={{ scale: index === currentStep ? 1.1 : 1 }}
              transition={{ duration: 0.2 }}
            >
              {index + 1}
            </motion.div>
            {labels[index] && (
              <span className="text-xs text-muted-foreground">
                {labels[index]}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

/* ========================================
   加载状态卡片
   ======================================== */

interface LoadingCardProps {
  title?: string;
  description?: string;
  className?: string;
}

export const LoadingCard: React.FC<LoadingCardProps> = ({
  title = '加载中',
  description = '请稍候...',
  className,
}) => {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-4 p-8',
        'rounded-lg border bg-card',
        className
      )}
    >
      <Spinner size="lg" />
      <div className="text-center space-y-1">
        <h3 className="font-semibold text-base">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
};

/* ========================================
   无限加载指示器
   ======================================== */

interface InfiniteScrollLoaderProps {
  loading: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  className?: string;
}

export const InfiniteScrollLoader: React.FC<InfiniteScrollLoaderProps> = ({
  loading,
  hasMore,
  className,
}) => {
  if (!hasMore && !loading) {
    return (
      <div className={cn('py-8 text-center text-muted-foreground', className)}>
        没有更多内容了
      </div>
    );
  }

  if (!loading) return null;

  return (
    <div className={cn('py-8 flex justify-center', className)}>
      <Spinner size="md" />
    </div>
  );
};

Spinner.displayName = 'Spinner';
DotsLoader.displayName = 'DotsLoader';
PulseLoader.displayName = 'PulseLoader';
ProgressBar.displayName = 'ProgressBar';
CircularProgress.displayName = 'CircularProgress';
LoadingOverlay.displayName = 'LoadingOverlay';
FullScreenLoading.displayName = 'FullScreenLoading';
RefreshButton.displayName = 'RefreshButton';
ButtonLoading.displayName = 'ButtonLoading';
LoadingWrapper.displayName = 'LoadingWrapper';
StepLoading.displayName = 'StepLoading';
LoadingCard.displayName = 'LoadingCard';
InfiniteScrollLoader.displayName = 'InfiniteScrollLoader';

