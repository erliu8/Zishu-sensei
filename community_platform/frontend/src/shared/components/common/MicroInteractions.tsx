/**
 * 微交互组件库
 * 
 * 提供各种微交互效果和动画组件
 */

'use client';

import React, { useState } from 'react';
import { motion, useMotionValue, useTransform } from 'framer-motion';
import { Heart, Star, ThumbsUp, Bookmark } from 'lucide-react';
import { cn } from '@/shared/utils/cn';

/* ========================================
   涟漪效果按钮
   ======================================== */

interface RippleButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  rippleColor?: string;
}

export const RippleButton: React.FC<RippleButtonProps> = ({
  children,
  className,
  rippleColor = 'rgba(255, 255, 255, 0.5)',
  onClick,
  ...props
}) => {
  const [ripples, setRipples] = useState<
    Array<{ x: number; y: number; id: number }>
  >([]);

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    const button = e.currentTarget;
    const rect = button.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const newRipple = { x, y, id: Date.now() };
    setRipples((prev) => [...prev, newRipple]);

    setTimeout(() => {
      setRipples((prev) => prev.filter((r) => r.id !== newRipple.id));
    }, 600);

    onClick?.(e);
  };

  return (
    <button
      className={cn('relative overflow-hidden', className)}
      onClick={handleClick}
      {...props}
    >
      {children}
      {ripples.map((ripple) => (
        <motion.span
          key={ripple.id}
          className="absolute rounded-full pointer-events-none"
          style={{
            left: ripple.x,
            top: ripple.y,
            backgroundColor: rippleColor,
          }}
          initial={{ width: 0, height: 0, opacity: 1 }}
          animate={{
            width: 300,
            height: 300,
            opacity: 0,
          }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      ))}
    </button>
  );
};

/* ========================================
   悬停提升效果
   ======================================== */

interface HoverLiftProps {
  children: React.ReactNode;
  /**
   * 提升高度（像素）
   */
  liftHeight?: number;
  className?: string;
  /**
   * 点击时缩放
   */
  tapScale?: number;
}

export const HoverLift: React.FC<HoverLiftProps> = ({
  children,
  liftHeight = 8,
  className,
  tapScale = 0.98,
}) => {
  return (
    <motion.div
      className={className}
      whileHover={{ y: -liftHeight }}
      whileTap={{ scale: tapScale }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  );
};

/* ========================================
   磁性按钮（鼠标吸引效果）
   ======================================== */

interface MagneticButtonProps {
  children: React.ReactNode;
  /**
   * 磁性强度
   */
  strength?: number;
  className?: string;
}

export const MagneticButton: React.FC<MagneticButtonProps> = ({
  children,
  strength = 0.3,
  className,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isHovered) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    x.set((e.clientX - centerX) * strength);
    y.set((e.clientY - centerY) * strength);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    x.set(0);
    y.set(0);
  };

  return (
    <motion.div
      className={className}
      style={{ x, y }}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={handleMouseLeave}
      transition={{ type: 'spring', stiffness: 150, damping: 15 }}
    >
      {children}
    </motion.div>
  );
};

/* ========================================
   3D 倾斜卡片
   ======================================== */

interface TiltCardProps {
  children: React.ReactNode;
  /**
   * 倾斜角度（度数）
   */
  tiltAngle?: number;
  className?: string;
}

export const TiltCard: React.FC<TiltCardProps> = ({
  children,
  tiltAngle = 10,
  className,
}) => {
  const [rotateX, setRotateX] = useState(0);
  const [rotateY, setRotateY] = useState(0);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const percentX = (e.clientX - centerX) / (rect.width / 2);
    const percentY = (e.clientY - centerY) / (rect.height / 2);

    setRotateY(percentX * tiltAngle);
    setRotateX(-percentY * tiltAngle);
  };

  const handleMouseLeave = () => {
    setRotateX(0);
    setRotateY(0);
  };

  return (
    <motion.div
      className={cn('transform-gpu', className)}
      style={{
        perspective: 1000,
      }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      animate={{ rotateX, rotateY }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
    >
      {children}
    </motion.div>
  );
};

/* ========================================
   点赞按钮（带动画）
   ======================================== */

interface AnimatedLikeButtonProps {
  liked: boolean;
  onToggle: () => void;
  count?: number;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const likeSizes = {
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
  lg: 'w-6 h-6',
};

export const AnimatedLikeButton: React.FC<AnimatedLikeButtonProps> = ({
  liked,
  onToggle,
  count,
  className,
  size = 'md',
}) => {
  return (
    <motion.button
      className={cn('inline-flex items-center gap-2 group', className)}
      onClick={onToggle}
      whileTap={{ scale: 0.9 }}
    >
      <motion.div
        animate={
          liked
            ? { scale: [1, 1.3, 1], rotate: [0, -15, 15, 0] }
            : { scale: 1 }
        }
        transition={{ duration: 0.4 }}
      >
        <ThumbsUp
          className={cn(
            likeSizes[size],
            'transition-colors',
            liked
              ? 'fill-primary text-primary'
              : 'text-muted-foreground group-hover:text-foreground'
          )}
        />
      </motion.div>
      {count !== undefined && (
        <motion.span
          key={count}
          initial={{ scale: 1 }}
          animate={liked ? { scale: [1, 1.2, 1] } : { scale: 1 }}
          className="text-sm"
        >
          {count}
        </motion.span>
      )}
    </motion.button>
  );
};

/* ========================================
   收藏按钮（带动画）
   ======================================== */

interface AnimatedBookmarkButtonProps {
  bookmarked: boolean;
  onToggle: () => void;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const AnimatedBookmarkButton: React.FC<
  AnimatedBookmarkButtonProps
> = ({ bookmarked, onToggle, className, size = 'md' }) => {
  return (
    <motion.button
      className={cn('group', className)}
      onClick={onToggle}
      whileTap={{ scale: 0.9 }}
    >
      <motion.div
        animate={bookmarked ? { y: [0, -5, 0] } : { y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <Bookmark
          className={cn(
            likeSizes[size],
            'transition-colors',
            bookmarked
              ? 'fill-primary text-primary'
              : 'text-muted-foreground group-hover:text-foreground'
          )}
        />
      </motion.div>
    </motion.button>
  );
};

/* ========================================
   爱心按钮（带动画）
   ======================================== */

interface AnimatedHeartButtonProps {
  liked: boolean;
  onToggle: () => void;
  count?: number;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const AnimatedHeartButton: React.FC<AnimatedHeartButtonProps> = ({
  liked,
  onToggle,
  count,
  className,
  size = 'md',
}) => {
  return (
    <motion.button
      className={cn('inline-flex items-center gap-2 group', className)}
      onClick={onToggle}
      whileTap={{ scale: 0.9 }}
    >
      <motion.div
        animate={
          liked
            ? {
                scale: [1, 1.3, 1],
              }
            : { scale: 1 }
        }
        transition={{ duration: 0.3 }}
      >
        <Heart
          className={cn(
            likeSizes[size],
            'transition-colors',
            liked
              ? 'fill-red-500 text-red-500'
              : 'text-muted-foreground group-hover:text-red-400'
          )}
        />
      </motion.div>
      {count !== undefined && (
        <motion.span
          key={count}
          initial={{ scale: 1 }}
          animate={liked ? { scale: [1, 1.2, 1] } : { scale: 1 }}
          className="text-sm"
        >
          {count}
        </motion.span>
      )}
    </motion.button>
  );
};

/* ========================================
   星级评分（带动画）
   ======================================== */

interface AnimatedRatingProps {
  /**
   * 当前评分 (0-5)
   */
  rating: number;
  /**
   * 评分改变回调
   */
  onChange?: (rating: number) => void;
  /**
   * 是否只读
   */
  readonly?: boolean;
  /**
   * 星星数量
   */
  max?: number;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const starSizes = {
  sm: 'w-4 h-4',
  md: 'w-6 h-6',
  lg: 'w-8 h-8',
};

export const AnimatedRating: React.FC<AnimatedRatingProps> = ({
  rating,
  onChange,
  readonly = false,
  max = 5,
  size = 'md',
  className,
}) => {
  const [hoverRating, setHoverRating] = useState(0);

  const handleClick = (value: number) => {
    if (!readonly && onChange) {
      onChange(value);
    }
  };

  return (
    <div className={cn('inline-flex gap-1', className)}>
      {Array.from({ length: max }).map((_, index) => {
        const starValue = index + 1;
        const isFilled = starValue <= (hoverRating || rating);

        return (
          <motion.button
            key={index}
            type="button"
            onClick={() => handleClick(starValue)}
            onMouseEnter={() => !readonly && setHoverRating(starValue)}
            onMouseLeave={() => !readonly && setHoverRating(0)}
            disabled={readonly}
            className={cn(
              'focus:outline-none',
              !readonly && 'cursor-pointer'
            )}
            whileHover={!readonly ? { scale: 1.2 } : undefined}
            whileTap={!readonly ? { scale: 0.9 } : undefined}
          >
            <Star
              className={cn(
                starSizes[size],
                'transition-colors',
                isFilled
                  ? 'fill-yellow-400 text-yellow-400'
                  : 'text-muted-foreground'
              )}
            />
          </motion.button>
        );
      })}
    </div>
  );
};

/* ========================================
   数字滚动动画
   ======================================== */

interface CountUpProps {
  /**
   * 目标数字
   */
  value: number;
  /**
   * 动画时长（秒）
   */
  duration?: number;
  /**
   * 数字格式化函数
   */
  formatter?: (value: number) => string;
  className?: string;
}

export const CountUp: React.FC<CountUpProps> = ({
  value,
  duration = 1,
  formatter = (v) => Math.round(v).toString(),
  className,
}) => {
  const motionValue = useMotionValue(0);
  const rounded = useTransform(motionValue, (latest) => formatter(latest));

  React.useEffect(() => {
    motionValue.set(value);
  }, [value, motionValue]);

  return (
    <motion.span
      className={className}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <motion.span>{rounded}</motion.span>
    </motion.span>
  );
};

/* ========================================
   悬停显示组件
   ======================================== */

interface HoverRevealProps {
  children: React.ReactNode;
  /**
   * 悬停时显示的内容
   */
  hoverContent: React.ReactNode;
  className?: string;
}

export const HoverReveal: React.FC<HoverRevealProps> = ({
  children,
  hoverContent,
  className,
}) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      className={cn('relative', className)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {children}
      <motion.div
        className="absolute inset-0 flex items-center justify-center bg-background/90"
        initial={{ opacity: 0 }}
        animate={{ opacity: isHovered ? 1 : 0 }}
        transition={{ duration: 0.2 }}
        style={{ pointerEvents: isHovered ? 'auto' : 'none' }}
      >
        {hoverContent}
      </motion.div>
    </div>
  );
};

/* ========================================
   拖拽排序项
   ======================================== */

interface DraggableItemProps {
  children: React.ReactNode;
  /**
   * 拖拽开始回调
   */
  onDragStart?: () => void;
  /**
   * 拖拽结束回调
   */
  onDragEnd?: () => void;
  className?: string;
}

export const DraggableItem: React.FC<DraggableItemProps> = ({
  children,
  onDragStart,
  onDragEnd,
  className,
}) => {
  return (
    <motion.div
      className={className}
      drag
      dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
      dragElastic={0.1}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      whileDrag={{ scale: 1.05, zIndex: 1 }}
      transition={{ duration: 0.2 }}
    >
      {children}
    </motion.div>
  );
};

/* ========================================
   滑动删除项
   ======================================== */

interface SwipeToDeleteProps {
  children: React.ReactNode;
  /**
   * 删除回调
   */
  onDelete: () => void;
  /**
   * 删除阈值（像素）
   */
  threshold?: number;
  className?: string;
}

export const SwipeToDelete: React.FC<SwipeToDeleteProps> = ({
  children,
  onDelete,
  threshold = 100,
  className,
}) => {
  const x = useMotionValue(0);

  const handleDragEnd = () => {
    if (x.get() < -threshold) {
      onDelete();
    }
  };

  return (
    <div className={cn('relative overflow-hidden', className)}>
      <motion.div
        style={{ x }}
        drag="x"
        dragConstraints={{ left: -threshold * 1.5, right: 0 }}
        dragElastic={0.2}
        onDragEnd={handleDragEnd}
        className="relative"
      >
        {children}
      </motion.div>
      <div className="absolute right-0 top-0 bottom-0 w-20 flex items-center justify-center bg-destructive text-destructive-foreground">
        删除
      </div>
    </div>
  );
};

/* ========================================
   视差滚动效果
   ======================================== */

interface ParallaxProps {
  children: React.ReactNode;
  /**
   * 滚动速度倍数
   */
  speed?: number;
  className?: string;
}

export const Parallax: React.FC<ParallaxProps> = ({
  children,
  speed = 0.5,
  className,
}) => {
  const [offset, setOffset] = useState(0);

  React.useEffect(() => {
    const handleScroll = () => {
      setOffset(window.pageYOffset);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <motion.div
      className={className}
      style={{
        y: offset * speed,
      }}
    >
      {children}
    </motion.div>
  );
};

/* ========================================
   悬浮气泡
   ======================================== */

interface FloatingBubbleProps {
  children: React.ReactNode;
  /**
   * 浮动范围（像素）
   */
  range?: number;
  /**
   * 动画时长（秒）
   */
  duration?: number;
  className?: string;
}

export const FloatingBubble: React.FC<FloatingBubbleProps> = ({
  children,
  range = 10,
  duration = 3,
  className,
}) => {
  return (
    <motion.div
      className={className}
      animate={{
        y: [0, -range, 0],
        x: [0, range / 2, 0],
      }}
      transition={{
        duration,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
    >
      {children}
    </motion.div>
  );
};

RippleButton.displayName = 'RippleButton';
HoverLift.displayName = 'HoverLift';
MagneticButton.displayName = 'MagneticButton';
TiltCard.displayName = 'TiltCard';
AnimatedLikeButton.displayName = 'AnimatedLikeButton';
AnimatedBookmarkButton.displayName = 'AnimatedBookmarkButton';
AnimatedHeartButton.displayName = 'AnimatedHeartButton';
AnimatedRating.displayName = 'AnimatedRating';
CountUp.displayName = 'CountUp';
HoverReveal.displayName = 'HoverReveal';
DraggableItem.displayName = 'DraggableItem';
SwipeToDelete.displayName = 'SwipeToDelete';
Parallax.displayName = 'Parallax';
FloatingBubble.displayName = 'FloatingBubble';

