/**
 * 懒加载图片组件
 * 提供图片懒加载、渐进式加载、占位符和错误处理
 */

import React, { useState, useEffect, useRef, CSSProperties } from 'react';
import './LazyImage.css';

/**
 * 懒加载图片属性
 */
export interface LazyImageProps {
  /** 图片源 */
  src: string;
  /** 图片替代文本 */
  alt?: string;
  /** 占位符图片 */
  placeholder?: string;
  /** 图片类名 */
  className?: string;
  /** 图片样式 */
  style?: CSSProperties;
  /** 根边距（用于提前加载） */
  rootMargin?: string;
  /** 可见度阈值 */
  threshold?: number;
  /** 是否启用渐进式加载 */
  progressive?: boolean;
  /** 加载完成回调 */
  onLoad?: () => void;
  /** 加载失败回调 */
  onError?: (error: Error) => void;
  /** 点击事件 */
  onClick?: () => void;
  /** 图片宽度 */
  width?: number | string;
  /** 图片高度 */
  height?: number | string;
  /** 对象填充方式 */
  objectFit?: 'contain' | 'cover' | 'fill' | 'none' | 'scale-down';
}

/**
 * 懒加载图片组件
 */
export const LazyImage: React.FC<LazyImageProps> = ({
  src,
  alt = '',
  placeholder = '',
  className = '',
  style = {},
  rootMargin = '50px',
  threshold = 0.01,
  progressive = true,
  onLoad,
  onError,
  onClick,
  width,
  height,
  objectFit = 'cover',
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isError, setIsError] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const imgRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);

  // 使用 Intersection Observer 检测图片是否进入视口
  useEffect(() => {
    if (!imgRef.current) return;

    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            setIsInView(true);
            observer.disconnect();
          }
        });
      },
      {
        rootMargin,
        threshold,
      }
    );

    observer.observe(imgRef.current);

    return () => {
      observer.disconnect();
    };
  }, [rootMargin, threshold]);

  // 当图片进入视口时加载
  useEffect(() => {
    if (!isInView || !src) return;

    const img = new Image();
    imageRef.current = img;

    img.onload = () => {
      setIsLoaded(true);
      setIsError(false);
      onLoad?.();
    };

    img.onerror = () => {
      setIsError(true);
      setIsLoaded(false);
      onError?.(new Error(`Failed to load image: ${src}`));
    };

    img.src = src;

    return () => {
      // 清理
      if (imageRef.current) {
        imageRef.current.onload = null;
        imageRef.current.onerror = null;
      }
    };
  }, [isInView, src, onLoad, onError]);

  const containerStyle: CSSProperties = {
    width: width || '100%',
    height: height || 'auto',
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: '#f0f0f0',
    ...style,
  };

  const imageStyle: CSSProperties = {
    width: '100%',
    height: '100%',
    objectFit,
    transition: progressive ? 'opacity 0.3s ease-in-out' : 'none',
    opacity: isLoaded ? 1 : 0,
  };

  return (
    <div ref={imgRef} className={`lazy-image-container ${className}`} style={containerStyle} onClick={onClick}>
      {/* 占位符 */}
      {!isLoaded && !isError && (
        <div className="lazy-image-placeholder">
          {placeholder ? (
            <img src={placeholder} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <div className="lazy-image-skeleton">
              <div className="lazy-image-skeleton-shimmer"></div>
            </div>
          )}
        </div>
      )}

      {/* 实际图片 */}
      {isInView && !isError && (
        <img
          src={src}
          alt={alt}
          className="lazy-image"
          style={imageStyle}
          loading="lazy"
        />
      )}

      {/* 错误状态 */}
      {isError && (
        <div className="lazy-image-error">
          <svg
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21 15 16 10 5 21" />
          </svg>
          <span className="lazy-image-error-text">加载失败</span>
        </div>
      )}

      {/* 加载指示器 */}
      {isInView && !isLoaded && !isError && (
        <div className="lazy-image-loading">
          <div className="lazy-image-spinner"></div>
        </div>
      )}
    </div>
  );
};

export default LazyImage;

