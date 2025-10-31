/**
 * HydrationSafeImage - 防水合错误的图片组件
 * 解决浏览器扩展程序导致的属性不匹配问题
 */

'use client';

import React, { forwardRef } from 'react';
import Image, { ImageProps } from 'next/image';

export interface HydrationSafeImageProps extends ImageProps {
  /** 是否抑制水合警告 */
  suppressHydrationWarning?: boolean;
}

/**
 * 防水合错误的图片组件
 * 主要用于解决浏览器扩展程序（如OCR扩展）动态添加属性导致的水合错误
 */
export const HydrationSafeImage = forwardRef<
  HTMLImageElement,
  HydrationSafeImageProps
>(({ suppressHydrationWarning = true, ...props }, ref) => {
  return (
    <div suppressHydrationWarning={suppressHydrationWarning}>
      <Image
        {...props}
        ref={ref}
        suppressHydrationWarning={suppressHydrationWarning}
      />
    </div>
  );
});

HydrationSafeImage.displayName = 'HydrationSafeImage';

export default HydrationSafeImage;
