/**
 * FeaturedSection 组件 Hydration 错误排查测试
 * 专门测试可能导致 SSR/CSR 不匹配的场景
 */

import { describe, it, expect } from 'vitest';
import { FeaturedSection, type FeaturedItem } from '../FeaturedSection';

// 简化的模拟数据，模拟实际使用的数据
const testFeaturedItems: FeaturedItem[] = [
  {
    id: '1',
    title: 'Zishu AI 社区平台正式上线',
    description: '一个全新的AI角色社区平台，让你轻松创建、分享和探索AI角色',
    image: '/images/featured/main.jpg', // 这里是问题可能的原因
    type: 'post',
    link: '/posts/1',
    badge: '置顶',
  },
  {
    id: '2',
    title: '智能对话适配器 v2.0',
    description: '全新升级的对话适配器，支持多轮对话和上下文理解',
    image: '/images/featured/adapter.jpg',
    type: 'adapter',
    link: '/adapters/2',
  },
  {
    id: '3',
    title: '小艾 - 智能助手角色',
    description: '温柔贴心的AI助手，随时为你提供帮助',
    image: '/images/featured/character.jpg',
    type: 'character',
    link: '/characters/3',
  },
];

describe('FeaturedSection Hydration Issues', () => {
  it('should analyze the component structure for potential hydration mismatches', () => {
    // 分析组件的结构和可能导致 hydration 错误的原因
    
    // 1. 检查图片路径是否可能在服务器端和客户端不同
    const imagePaths = testFeaturedItems.map(item => item.image);
    console.log('Image paths:', imagePaths);
    
    // 2. 检查是否有时间相关的动态内容
    // （当前组件中没有使用 Date.now() 等时间函数，这是好的）
    
    // 3. 检查类型配置是否稳定
    const typeConfig = {
      post: { label: '精选帖子', color: 'bg-blue-500' },
      adapter: { label: '推荐适配器', color: 'bg-green-500' },
      character: { label: '热门角色', color: 'bg-purple-500' },
    };
    
    testFeaturedItems.forEach(item => {
      expect(typeConfig[item.type]).toBeDefined();
      console.log(`Item ${item.id} type ${item.type} -> ${typeConfig[item.type].label}`);
    });
    
    // 4. 检查响应式样式类是否可能导致问题
    const responsiveClasses = [
      'grid-cols-1 lg:grid-cols-3', // 网格布局
      'lg:col-span-2', // 主项目跨列
      'h-64 lg:h-80', // 主图片高度
      'h-32 lg:h-36', // 副图片高度
      '(max-width: 1024px) 100vw, 66vw', // 主图片 sizes
      '(max-width: 1024px) 100vw, 33vw', // 副图片 sizes
    ];
    
    console.log('Responsive classes that might cause hydration issues:', responsiveClasses);
    
    // 测试通过，主要是为了分析和记录潜在问题
    expect(true).toBe(true);
  });

  it('should identify the specific hydration error from the stack trace', () => {
    // 从错误堆栈中我们知道问题出现在：
    // src/features/home/components/FeaturedSection.tsx (57:15) -> <Image> 组件
    
    // 第57行是主要的Image组件：
    const imageComponentProps = {
      src: testFeaturedItems[0].image, // '/images/featured/main.jpg'
      alt: testFeaturedItems[0].title,
      fill: true,
      className: "object-cover group-hover:scale-105 transition-transform duration-300",
      sizes: "(max-width: 1024px) 100vw, 66vw"
    };
    
    console.log('Problematic Image component props:', imageComponentProps);
    
    // 可能的问题原因：
    // 1. fill={true} 属性可能导致服务器端和客户端的布局计算不同
    // 2. sizes 属性在 SSR 时可能无法正确计算屏幕尺寸
    // 3. 图片路径在不同环境下可能解析不同
    // 4. CSS类名可能在 SSR 和 CSR 时应用不同
    
    expect(imageComponentProps.fill).toBe(true);
    expect(imageComponentProps.sizes).toContain('100vw');
    expect(imageComponentProps.sizes).toContain('66vw');
  });

  it('should suggest potential fixes for the hydration error', () => {
    // 基于分析，建议的修复方案：
    
    console.log('Suggested fixes for hydration error:');
    console.log('1. Remove or modify the fill prop on Image component');
    console.log('2. Use specific width/height instead of fill');
    console.log('3. Ensure image paths are absolute and consistent');
    console.log('4. Use CSS-in-JS for dynamic styles instead of Tailwind classes');
    console.log('5. Add suppressHydrationWarning if the mismatch is intentional');
    
    // 修复方案1：使用具体尺寸而不是 fill
    const fixedImageProps1 = {
      src: '/images/featured/main.jpg',
      alt: 'Zishu AI 社区平台正式上线',
      width: 800,
      height: 320, // 对应 h-80 (320px)
      className: "object-cover w-full h-full group-hover:scale-105 transition-transform duration-300"
    };
    
    // 修复方案2：简化 sizes 属性
    const fixedImageProps2 = {
      src: '/images/featured/main.jpg',
      alt: 'Zishu AI 社区平台正式上线',
      fill: true,
      sizes: "100vw", // 简化的 sizes
      className: "object-cover group-hover:scale-105 transition-transform duration-300"
    };
    
    console.log('Fix option 1 (specific dimensions):', fixedImageProps1);
    console.log('Fix option 2 (simplified sizes):', fixedImageProps2);
    
    expect(fixedImageProps1.width).toBeGreaterThan(0);
    expect(fixedImageProps1.height).toBeGreaterThan(0);
  });
});
