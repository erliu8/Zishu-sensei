/**
 * 优化的图片组件
 * 基于 Next.js Image 组件，提供自动优化、响应式和懒加载
 */

import Image, { ImageProps, StaticImageData } from 'next/image';
import { useState, memo } from 'react';
import { cn } from '@/shared/utils/cn';

interface OptimizedImageProps extends Omit<ImageProps, 'src'> {
  /**
   * 图片源
   */
  src: string | StaticImageData;
  /**
   * 图片描述
   */
  alt: string;
  /**
   * 容器类名
   */
  containerClassName?: string;
  /**
   * 是否显示骨架屏
   */
  showSkeleton?: boolean;
  /**
   * 骨架屏类名
   */
  skeletonClassName?: string;
  /**
   * 是否启用模糊占位符
   */
  blur?: boolean;
  /**
   * 图片加载失败时的回退图片
   */
  fallbackSrc?: string;
  /**
   * 图片加载完成回调
   */
  onLoadComplete?: () => void;
  /**
   * 图片加载失败回调
   */
  onError?: () => void;
}

/**
 * 优化的图片组件
 */
export const OptimizedImage = memo(function OptimizedImage({
  src,
  alt,
  className,
  containerClassName,
  showSkeleton = true,
  skeletonClassName,
  blur = true,
  fallbackSrc = '/images/placeholder.png',
  onLoadComplete,
  onError,
  priority = false,
  quality = 75,
  ...props
}: OptimizedImageProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [imgSrc, setImgSrc] = useState(src);

  const handleLoad = () => {
    setIsLoading(false);
    onLoadComplete?.();
  };

  const handleError = () => {
    setHasError(true);
    setIsLoading(false);
    setImgSrc(fallbackSrc);
    onError?.();
  };

  return (
    <div className={cn('relative overflow-hidden', containerClassName)}>
      {/* 骨架屏 */}
      {isLoading && showSkeleton && (
        <div
          className={cn(
            'absolute inset-0 animate-pulse bg-muted',
            skeletonClassName
          )}
        />
      )}

      {/* 图片 */}
      <Image
        src={imgSrc}
        alt={alt}
        className={cn(
          'transition-opacity duration-300',
          isLoading ? 'opacity-0' : 'opacity-100',
          className
        )}
        onLoad={handleLoad}
        onError={handleError}
        quality={quality}
        priority={priority}
        placeholder={blur && typeof src === 'string' ? 'blur' : undefined}
        {...props}
      />

      {/* 错误提示 */}
      {hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted text-muted-foreground text-sm">
          图片加载失败
        </div>
      )}
    </div>
  );
});

/**
 * 响应式图片组件
 */
interface ResponsiveImageProps extends OptimizedImageProps {
  /**
   * 不同尺寸的图片源
   */
  sources?: {
    mobile?: string;
    tablet?: string;
    desktop?: string;
  };
}

export const ResponsiveImage = memo(function ResponsiveImage({
  sources,
  src,
  ...props
}: ResponsiveImageProps) {
  if (!sources) {
    return <OptimizedImage src={src} {...props} />;
  }

  return (
    <picture>
      {sources.mobile && (
        <source
          media="(max-width: 640px)"
          srcSet={sources.mobile}
          type="image/webp"
        />
      )}
      {sources.tablet && (
        <source
          media="(max-width: 1024px)"
          srcSet={sources.tablet}
          type="image/webp"
        />
      )}
      {sources.desktop && (
        <source media="(min-width: 1025px)" srcSet={sources.desktop} type="image/webp" />
      )}
      <OptimizedImage src={src} {...props} />
    </picture>
  );
});

/**
 * 头像图片组件
 */
interface AvatarImageProps extends Omit<OptimizedImageProps, 'width' | 'height'> {
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const avatarSizes = {
  sm: 32,
  md: 48,
  lg: 64,
  xl: 96,
};

export const AvatarImage = memo(function AvatarImage({
  size = 'md',
  className,
  ...props
}: AvatarImageProps) {
  const dimension = avatarSizes[size];

  return (
    <OptimizedImage
      width={dimension}
      height={dimension}
      className={cn('rounded-full object-cover', className)}
      {...props}
    />
  );
});

/**
 * 背景图片组件
 */
interface BackgroundImageProps extends OptimizedImageProps {
  /**
   * 子元素
   */
  children?: React.ReactNode;
  /**
   * 遮罩层透明度
   */
  overlayOpacity?: number;
}

export const BackgroundImage = memo(function BackgroundImage({
  children,
  overlayOpacity = 0.5,
  className,
  containerClassName,
  ...props
}: BackgroundImageProps) {
  return (
    <div className={cn('relative', containerClassName)}>
      <OptimizedImage
        fill
        className={cn('object-cover', className)}
        {...props}
      />
      {overlayOpacity > 0 && (
        <div
          className="absolute inset-0 bg-black"
          style={{ opacity: overlayOpacity }}
        />
      )}
      {children && <div className="relative z-10">{children}</div>}
    </div>
  );
});

/**
 * 图片工具函数
 */
export const imageUtils = {
  /**
   * 生成图片 URL（支持多种尺寸）
   */
  generateImageUrl: (
    baseUrl: string,
    options?: {
      width?: number;
      height?: number;
      quality?: number;
      format?: 'webp' | 'jpeg' | 'png';
    }
  ): string => {
    const params = new URLSearchParams();

    if (options?.width) params.set('w', options.width.toString());
    if (options?.height) params.set('h', options.height.toString());
    if (options?.quality) params.set('q', options.quality.toString());
    if (options?.format) params.set('f', options.format);

    const queryString = params.toString();
    return queryString ? `${baseUrl}?${queryString}` : baseUrl;
  },

  /**
   * 获取响应式图片源集
   */
  getResponsiveSources: (baseUrl: string) => ({
    mobile: imageUtils.generateImageUrl(baseUrl, {
      width: 640,
      format: 'webp',
    }),
    tablet: imageUtils.generateImageUrl(baseUrl, {
      width: 1024,
      format: 'webp',
    }),
    desktop: imageUtils.generateImageUrl(baseUrl, {
      width: 1920,
      format: 'webp',
    }),
  }),

  /**
   * 检查是否支持 WebP
   */
  supportsWebP: (() => {
    if (typeof window === 'undefined') return false;

    const elem = document.createElement('canvas');
    if (elem.getContext?.('2d')) {
      return elem.toDataURL('image/webp').indexOf('data:image/webp') === 0;
    }
    return false;
  })(),
};

