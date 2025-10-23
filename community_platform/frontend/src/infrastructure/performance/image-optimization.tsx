/**
 * 图片优化工具
 * 提供图片懒加载、格式优化、响应式图片等功能
 */

import Image, { ImageProps } from 'next/image';
import { useState, useEffect } from 'react';
import { cn } from '@/shared/utils/cn';

/**
 * 优化的图片组件
 */
interface OptimizedImageProps extends Omit<ImageProps, 'src'> {
  src: string;
  alt: string;
  /**
   * 占位符类型
   */
  placeholder?: 'blur' | 'empty' | 'shimmer';
  /**
   * 模糊占位符（base64）
   */
  blurDataURL?: string;
  /**
   * 图片质量 (1-100)
   */
  quality?: number;
  /**
   * 是否优先加载
   */
  priority?: boolean;
  /**
   * 容器类名
   */
  containerClassName?: string;
  /**
   * 错误回退图片
   */
  fallbackSrc?: string;
}

/**
 * 优化的图片组件
 */
export function OptimizedImage({
  src,
  alt,
  placeholder = 'shimmer',
  blurDataURL,
  quality = 85,
  priority = false,
  containerClassName,
  fallbackSrc = '/images/placeholder.png',
  className,
  ...props
}: OptimizedImageProps) {
  const [imgSrc, setImgSrc] = useState(src);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setImgSrc(src);
    setHasError(false);
  }, [src]);

  const handleError = () => {
    setHasError(true);
    setImgSrc(fallbackSrc);
  };

  const handleLoad = () => {
    setIsLoading(false);
  };

  // 生成shimmer占位符
  const shimmerDataURL = `data:image/svg+xml;base64,${Buffer.from(
    `<svg width="400" height="400" xmlns="http://www.w3.org/2000/svg">
      <rect width="400" height="400" fill="#f0f0f0"/>
      <animate attributeName="fill" values="#f0f0f0;#e0e0e0;#f0f0f0" dur="1.5s" repeatCount="indefinite"/>
    </svg>`
  ).toString('base64')}`;

  return (
    <div className={cn('relative overflow-hidden', containerClassName)}>
      <Image
        src={imgSrc}
        alt={alt}
        quality={quality}
        priority={priority}
        placeholder={placeholder === 'shimmer' ? 'blur' : placeholder}
        blurDataURL={
          placeholder === 'shimmer' ? shimmerDataURL : blurDataURL
        }
        className={cn(
          'transition-opacity duration-300',
          isLoading && !hasError ? 'opacity-0' : 'opacity-100',
          className
        )}
        onLoad={handleLoad}
        onError={handleError}
        {...props}
      />
    </div>
  );
}

/**
 * 响应式图片组件
 */
interface ResponsiveImageProps extends OptimizedImageProps {
  /**
   * 不同尺寸的图片源
   */
  sources?: Array<{
    srcSet: string;
    media: string;
    type?: string;
  }>;
  /**
   * sizes 属性
   */
  sizes?: string;
}

export function ResponsiveImage({
  sources,
  sizes,
  ...props
}: ResponsiveImageProps) {
  if (!sources || sources.length === 0) {
    return <OptimizedImage {...props} sizes={sizes} />;
  }

  return (
    <picture>
      {sources.map((source, index) => (
        <source
          key={index}
          srcSet={source.srcSet}
          media={source.media}
          type={source.type}
        />
      ))}
      <OptimizedImage {...props} sizes={sizes} />
    </picture>
  );
}

/**
 * 头像图片组件
 */
interface AvatarImageProps {
  src?: string;
  alt: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  fallback?: string;
}

export function AvatarImage({
  src,
  alt,
  size = 'md',
  className,
  fallback,
}: AvatarImageProps) {
  const sizeMap = {
    sm: 32,
    md: 48,
    lg: 64,
    xl: 96,
  };

  const dimension = sizeMap[size];

  return (
    <div
      className={cn(
        'relative rounded-full overflow-hidden bg-muted',
        className
      )}
      style={{ width: dimension, height: dimension }}
    >
      {src ? (
        <OptimizedImage
          src={src}
          alt={alt}
          width={dimension}
          height={dimension}
          className="object-cover"
          fallbackSrc={fallback || `/images/avatar-placeholder.png`}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-primary/10 text-primary font-semibold">
          {alt.charAt(0).toUpperCase()}
        </div>
      )}
    </div>
  );
}

/**
 * 渐进式加载图片
 */
interface ProgressiveImageProps {
  /**
   * 低质量占位图
   */
  lowQualitySrc: string;
  /**
   * 高质量图片
   */
  highQualitySrc: string;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
}

export function ProgressiveImage({
  lowQualitySrc,
  highQualitySrc,
  alt,
  width,
  height,
  className,
}: ProgressiveImageProps) {
  const [currentSrc, setCurrentSrc] = useState(lowQualitySrc);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const img = new window.Image();
    img.src = highQualitySrc;
    img.onload = () => {
      setCurrentSrc(highQualitySrc);
      setIsLoaded(true);
    };
  }, [highQualitySrc]);

  return (
    <OptimizedImage
      src={currentSrc}
      alt={alt}
      width={width}
      height={height}
      className={cn(
        'transition-all duration-500',
        !isLoaded && 'blur-sm',
        className
      )}
    />
  );
}

/**
 * 图片预加载工具
 */
export const imagePreloader = {
  /**
   * 预加载单张图片
   */
  preload: (src: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      const img = new window.Image();
      img.onload = () => resolve();
      img.onerror = reject;
      img.src = src;
    });
  },

  /**
   * 预加载多张图片
   */
  preloadMultiple: async (sources: string[]): Promise<void[]> => {
    return Promise.all(sources.map((src) => imagePreloader.preload(src)));
  },

  /**
   * 预加载关键图片
   */
  preloadCritical: (): void => {
    if (typeof window === 'undefined') return;

    const criticalImages = [
      '/images/logo.png',
      '/images/hero-background.webp',
      // 添加其他关键图片
    ];

    imagePreloader.preloadMultiple(criticalImages).catch((error) => {
      console.warn('预加载关键图片失败:', error);
    });
  },
};

/**
 * 图片 URL 工具
 */
export const imageUtils = {
  /**
   * 获取优化的图片 URL
   */
  getOptimizedUrl: (
    src: string,
    options: {
      width?: number;
      quality?: number;
      format?: 'webp' | 'avif' | 'jpeg' | 'png';
    } = {}
  ): string => {
    if (!src) return '';

    // 如果是外部 URL，直接返回
    if (src.startsWith('http')) {
      return src;
    }

    const { width, quality = 85, format = 'webp' } = options;

    // 构建优化参数
    const params = new URLSearchParams();
    if (width) params.append('w', width.toString());
    params.append('q', quality.toString());
    params.append('f', format);

    return `/_next/image?url=${encodeURIComponent(src)}&${params.toString()}`;
  },

  /**
   * 获取响应式图片 srcSet
   */
  getResponsiveSrcSet: (
    src: string,
    widths: number[] = [640, 768, 1024, 1280, 1536]
  ): string => {
    return widths
      .map((width) => {
        const url = imageUtils.getOptimizedUrl(src, { width });
        return `${url} ${width}w`;
      })
      .join(', ');
  },

  /**
   * 检查是否支持 WebP
   */
  supportsWebP: (): boolean => {
    if (typeof window === 'undefined') return false;

    const elem = document.createElement('canvas');
    if (elem.getContext && elem.getContext('2d')) {
      return elem.toDataURL('image/webp').indexOf('data:image/webp') === 0;
    }
    return false;
  },

  /**
   * 检查是否支持 AVIF
   */
  supportsAVIF: async (): Promise<boolean> => {
    if (typeof window === 'undefined') return false;

    const avif =
      'data:image/avif;base64,AAAAIGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZk1BMUIAAADybWV0YQAAAAAAAAAoaGRscgAAAAAAAAAAcGljdAAAAAAAAAAAAAAAAGxpYmF2aWYAAAAADnBpdG0AAAAAAAEAAAAeaWxvYwAAAABEAAABAAEAAAABAAABGgAAAB0AAAAoaWluZgAAAAAAAQAAABppbmZlAgAAAAABAABhdjAxQ29sb3IAAAAAamlwcnAAAABLaXBjbwAAABRpc3BlAAAAAAAAAAIAAAACAAAAEHBpeGkAAAAAAwgICAAAAAxhdjFDgQ0MAAAAABNjb2xybmNseAACAAIAAYAAAAAXaXBtYQAAAAAAAAABAAEEAQKDBAAAACVtZGF0EgAKCBgANogQEAwgMg8f8D///8WfhwB8+ErK42A=';

    try {
      const img = new window.Image();
      img.src = avif;
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });
      return true;
    } catch {
      return false;
    }
  },
};

/**
 * 图片懒加载 Hook
 */
export function useImageLazyLoad(
  elementRef: React.RefObject<HTMLElement>,
  imageSrc: string
) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setSrc(imageSrc);
            observer.unobserve(element);
          }
        });
      },
      { rootMargin: '50px' }
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [elementRef, imageSrc]);

  return src;
}

