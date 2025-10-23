/**
 * 骨架屏组件库
 * 
 * 提供各种骨架屏组件用于加载状态
 */

'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/shared/utils/cn';
import { skeletonVariants } from '@/shared/animations/variants';

/* ========================================
   基础骨架屏组件
   ======================================== */

interface SkeletonProps {
  className?: string;
  /**
   * 骨架屏宽度
   */
  width?: string | number;
  /**
   * 骨架屏高度
   */
  height?: string | number;
  /**
   * 是否使用圆形
   */
  circle?: boolean;
  /**
   * 是否使用动画
   */
  animate?: boolean;
  /**
   * 自定义样式
   */
  style?: React.CSSProperties;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  className,
  width,
  height,
  circle = false,
  animate = true,
  style,
}) => {
  const Component = animate ? motion.div : 'div';

  const skeletonStyle: React.CSSProperties = {
    width: typeof width === 'number' ? `${width}px` : width,
    height: typeof height === 'number' ? `${height}px` : height,
    ...style,
  };

  return (
    <Component
      className={cn(
        'skeleton bg-muted',
        circle && 'rounded-full',
        !circle && 'rounded-md',
        className
      )}
      style={skeletonStyle}
      {...(animate && {
        variants: skeletonVariants,
        initial: 'initial',
        animate: 'animate',
      })}
    />
  );
};

/* ========================================
   文本骨架屏
   ======================================== */

interface SkeletonTextProps {
  /**
   * 行数
   */
  lines?: number;
  /**
   * 最后一行的宽度百分比
   */
  lastLineWidth?: string;
  className?: string;
}

export const SkeletonText: React.FC<SkeletonTextProps> = ({
  lines = 3,
  lastLineWidth = '60%',
  className,
}) => {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton
          key={index}
          height={16}
          width={index === lines - 1 ? lastLineWidth : '100%'}
        />
      ))}
    </div>
  );
};

/* ========================================
   头像骨架屏
   ======================================== */

interface SkeletonAvatarProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const avatarSizes = {
  sm: 'w-8 h-8',
  md: 'w-10 h-10',
  lg: 'w-12 h-12',
  xl: 'w-16 h-16',
};

export const SkeletonAvatar: React.FC<SkeletonAvatarProps> = ({
  size = 'md',
  className,
}) => {
  return (
    <Skeleton
      circle
      className={cn(avatarSizes[size], className)}
    />
  );
};

/* ========================================
   卡片骨架屏
   ======================================== */

interface SkeletonCardProps {
  /**
   * 是否显示头像
   */
  showAvatar?: boolean;
  /**
   * 是否显示图片
   */
  showImage?: boolean;
  /**
   * 文本行数
   */
  textLines?: number;
  className?: string;
}

export const SkeletonCard: React.FC<SkeletonCardProps> = ({
  showAvatar = true,
  showImage = true,
  textLines = 3,
  className,
}) => {
  return (
    <div className={cn('rounded-lg border bg-card p-4', className)}>
      {/* 头部 */}
      {showAvatar && (
        <div className="flex items-center gap-3 mb-4">
          <SkeletonAvatar size="md" />
          <div className="flex-1 space-y-2">
            <Skeleton height={16} width="40%" />
            <Skeleton height={12} width="60%" />
          </div>
        </div>
      )}

      {/* 图片 */}
      {showImage && <Skeleton height={200} className="mb-4" />}

      {/* 文本内容 */}
      <SkeletonText lines={textLines} />

      {/* 底部操作栏 */}
      <div className="flex gap-4 mt-4">
        <Skeleton height={32} width={80} />
        <Skeleton height={32} width={80} />
        <Skeleton height={32} width={80} />
      </div>
    </div>
  );
};

/* ========================================
   列表骨架屏
   ======================================== */

interface SkeletonListProps {
  /**
   * 列表项数量
   */
  count?: number;
  /**
   * 是否显示头像
   */
  showAvatar?: boolean;
  className?: string;
}

export const SkeletonList: React.FC<SkeletonListProps> = ({
  count = 5,
  showAvatar = true,
  className,
}) => {
  return (
    <div className={cn('space-y-4', className)}>
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="flex items-start gap-3">
          {showAvatar && <SkeletonAvatar size="md" />}
          <div className="flex-1 space-y-2">
            <Skeleton height={16} width="80%" />
            <Skeleton height={12} width="60%" />
          </div>
        </div>
      ))}
    </div>
  );
};

/* ========================================
   表格骨架屏
   ======================================== */

interface SkeletonTableProps {
  /**
   * 行数
   */
  rows?: number;
  /**
   * 列数
   */
  columns?: number;
  /**
   * 是否显示表头
   */
  showHeader?: boolean;
  className?: string;
}

export const SkeletonTable: React.FC<SkeletonTableProps> = ({
  rows = 5,
  columns = 4,
  showHeader = true,
  className,
}) => {
  return (
    <div className={cn('space-y-3', className)}>
      {/* 表头 */}
      {showHeader && (
        <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
          {Array.from({ length: columns }).map((_, index) => (
            <Skeleton key={index} height={20} />
          ))}
        </div>
      )}

      {/* 表格行 */}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div
          key={rowIndex}
          className="grid gap-4"
          style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
        >
          {Array.from({ length: columns }).map((_, colIndex) => (
            <Skeleton key={colIndex} height={16} />
          ))}
        </div>
      ))}
    </div>
  );
};

/* ========================================
   帖子骨架屏
   ======================================== */

export const SkeletonPost: React.FC<{ className?: string }> = ({
  className,
}) => {
  return (
    <div className={cn('rounded-lg border bg-card p-6', className)}>
      {/* 作者信息 */}
      <div className="flex items-center gap-3 mb-4">
        <SkeletonAvatar size="md" />
        <div className="flex-1 space-y-2">
          <Skeleton height={16} width="30%" />
          <Skeleton height={12} width="20%" />
        </div>
      </div>

      {/* 标题 */}
      <Skeleton height={24} width="80%" className="mb-3" />

      {/* 内容 */}
      <SkeletonText lines={4} lastLineWidth="70%" className="mb-4" />

      {/* 图片 */}
      <Skeleton height={300} className="mb-4" />

      {/* 标签 */}
      <div className="flex gap-2 mb-4">
        <Skeleton height={24} width={60} />
        <Skeleton height={24} width={80} />
        <Skeleton height={24} width={70} />
      </div>

      {/* 操作栏 */}
      <div className="flex items-center gap-6 pt-4 border-t">
        <Skeleton height={20} width={60} />
        <Skeleton height={20} width={60} />
        <Skeleton height={20} width={60} />
        <Skeleton height={20} width={60} />
      </div>
    </div>
  );
};

/* ========================================
   适配器卡片骨架屏
   ======================================== */

export const SkeletonAdapterCard: React.FC<{ className?: string }> = ({
  className,
}) => {
  return (
    <div className={cn('rounded-lg border bg-card overflow-hidden', className)}>
      {/* 图标/封面 */}
      <div className="relative">
        <Skeleton height={160} className="rounded-none" />
        <div className="absolute top-3 right-3">
          <Skeleton circle className="w-8 h-8" />
        </div>
      </div>

      {/* 内容 */}
      <div className="p-4">
        {/* 标题 */}
        <Skeleton height={20} width="80%" className="mb-2" />

        {/* 描述 */}
        <SkeletonText lines={2} lastLineWidth="90%" className="mb-4" />

        {/* 标签 */}
        <div className="flex gap-2 mb-4">
          <Skeleton height={20} width={50} />
          <Skeleton height={20} width={60} />
        </div>

        {/* 统计信息 */}
        <div className="flex items-center justify-between pt-3 border-t">
          <Skeleton height={16} width={80} />
          <Skeleton height={16} width={60} />
        </div>
      </div>
    </div>
  );
};

/* ========================================
   角色卡片骨架屏
   ======================================== */

export const SkeletonCharacterCard: React.FC<{ className?: string }> = ({
  className,
}) => {
  return (
    <div className={cn('rounded-lg border bg-card overflow-hidden', className)}>
      {/* 角色头像/封面 */}
      <Skeleton height={200} className="rounded-none" />

      {/* 内容 */}
      <div className="p-4">
        {/* 角色名 */}
        <Skeleton height={24} width="60%" className="mb-2" />

        {/* 描述 */}
        <SkeletonText lines={3} lastLineWidth="80%" className="mb-4" />

        {/* 属性标签 */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          <Skeleton height={32} />
          <Skeleton height={32} />
          <Skeleton height={32} />
          <Skeleton height={32} />
        </div>

        {/* 底部操作 */}
        <div className="flex gap-2">
          <Skeleton height={36} className="flex-1" />
          <Skeleton height={36} width={36} />
        </div>
      </div>
    </div>
  );
};

/* ========================================
   评论骨架屏
   ======================================== */

export const SkeletonComment: React.FC<{ className?: string }> = ({
  className,
}) => {
  return (
    <div className={cn('flex gap-3', className)}>
      <SkeletonAvatar size="md" />
      <div className="flex-1 space-y-3">
        <div className="flex items-center gap-2">
          <Skeleton height={14} width={100} />
          <Skeleton height={12} width={80} />
        </div>
        <SkeletonText lines={2} lastLineWidth="85%" />
        <div className="flex gap-4">
          <Skeleton height={16} width={40} />
          <Skeleton height={16} width={40} />
        </div>
      </div>
    </div>
  );
};

/* ========================================
   搜索结果骨架屏
   ======================================== */

export const SkeletonSearchResult: React.FC<{ className?: string }> = ({
  className,
}) => {
  return (
    <div className={cn('p-4 border-b last:border-b-0', className)}>
      <Skeleton height={20} width="70%" className="mb-2" />
      <SkeletonText lines={2} lastLineWidth="90%" className="mb-2" />
      <Skeleton height={12} width="30%" />
    </div>
  );
};

/* ========================================
   网格骨架屏
   ======================================== */

interface SkeletonGridProps {
  /**
   * 网格项数量
   */
  count?: number;
  /**
   * 列数
   */
  columns?: 2 | 3 | 4 | 5;
  /**
   * 渲染单个骨架屏项
   */
  renderItem?: () => React.ReactNode;
  className?: string;
}

const gridColumns = {
  2: 'grid-cols-1 sm:grid-cols-2',
  3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
  4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
  5: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5',
};

export const SkeletonGrid: React.FC<SkeletonGridProps> = ({
  count = 6,
  columns = 3,
  renderItem,
  className,
}) => {
  return (
    <div className={cn('grid gap-4', gridColumns[columns], className)}>
      {Array.from({ length: count }).map((_, index) => (
        <div key={index}>{renderItem ? renderItem() : <SkeletonCard />}</div>
      ))}
    </div>
  );
};

/* ========================================
   表单骨架屏
   ======================================== */

interface SkeletonFormProps {
  /**
   * 表单字段数量
   */
  fields?: number;
  /**
   * 是否显示提交按钮
   */
  showSubmit?: boolean;
  className?: string;
}

export const SkeletonForm: React.FC<SkeletonFormProps> = ({
  fields = 4,
  showSubmit = true,
  className,
}) => {
  return (
    <div className={cn('space-y-6', className)}>
      {Array.from({ length: fields }).map((_, index) => (
        <div key={index} className="space-y-2">
          <Skeleton height={16} width={120} />
          <Skeleton height={40} width="100%" />
        </div>
      ))}

      {showSubmit && (
        <div className="flex gap-3">
          <Skeleton height={40} width={120} />
          <Skeleton height={40} width={100} />
        </div>
      )}
    </div>
  );
};

/* ========================================
   页面骨架屏组合
   ======================================== */

export const SkeletonPage: React.FC<{ className?: string }> = ({
  className,
}) => {
  return (
    <div className={cn('space-y-6', className)}>
      {/* 页面标题 */}
      <div className="space-y-2">
        <Skeleton height={32} width="40%" />
        <Skeleton height={16} width="60%" />
      </div>

      {/* 过滤器栏 */}
      <div className="flex gap-3">
        <Skeleton height={40} width={200} />
        <Skeleton height={40} width={150} />
        <Skeleton height={40} width={120} />
      </div>

      {/* 内容网格 */}
      <SkeletonGrid count={9} columns={3} />
    </div>
  );
};

Skeleton.displayName = 'Skeleton';
SkeletonText.displayName = 'SkeletonText';
SkeletonAvatar.displayName = 'SkeletonAvatar';
SkeletonCard.displayName = 'SkeletonCard';
SkeletonList.displayName = 'SkeletonList';
SkeletonTable.displayName = 'SkeletonTable';
SkeletonPost.displayName = 'SkeletonPost';
SkeletonAdapterCard.displayName = 'SkeletonAdapterCard';
SkeletonCharacterCard.displayName = 'SkeletonCharacterCard';
SkeletonComment.displayName = 'SkeletonComment';
SkeletonSearchResult.displayName = 'SkeletonSearchResult';
SkeletonGrid.displayName = 'SkeletonGrid';
SkeletonForm.displayName = 'SkeletonForm';
SkeletonPage.displayName = 'SkeletonPage';

