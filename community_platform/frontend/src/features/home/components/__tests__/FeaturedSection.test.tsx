/**
 * FeaturedSection 组件测试
 * 专门针对 hydration 错误进行排查
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { FeaturedSection, type FeaturedItem } from '../FeaturedSection';

// Mock Next.js Image component
vi.mock('next/image', () => ({
  default: ({ src, alt, fill, className, sizes, ...props }: any) => (
    <img 
      src={src} 
      alt={alt} 
      className={className}
      data-fill={fill?.toString()}
      data-sizes={sizes}
      {...props}
    />
  ),
}));

// Mock Next.js Link component  
vi.mock('next/link', () => ({
  default: ({ href, children, className, ...props }: any) => (
    <a href={href} className={className} {...props}>
      {children}
    </a>
  ),
}));

const mockFeaturedItems: FeaturedItem[] = [
  {
    id: '1',
    title: 'Test Main Item',
    description: 'This is a test main featured item',
    image: '/test-main.jpg',
    type: 'post',
    link: '/posts/1',
    badge: '置顶',
  },
  {
    id: '2',
    title: 'Test Side Item 1',
    description: 'This is a test side item 1',
    image: '/test-side-1.jpg',
    type: 'adapter',
    link: '/adapters/2',
  },
  {
    id: '3',
    title: 'Test Side Item 2',
    description: 'This is a test side item 2',
    image: '/test-side-2.jpg',
    type: 'character',
    link: '/characters/3',
  },
];

describe('FeaturedSection', () => {
  beforeEach(() => {
    // Reset any window/document modifications
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should render without hydration errors', () => {
    render(<FeaturedSection items={mockFeaturedItems} />);
    
    // 检查基本结构
    expect(screen.getByText('精选推荐')).toBeInTheDocument();
    expect(screen.getByText('Test Main Item')).toBeInTheDocument();
  });

  it('should render main item with correct image attributes', () => {
    render(<FeaturedSection items={mockFeaturedItems} />);
    
    const mainImage = screen.getByAltText('Test Main Item');
    expect(mainImage).toBeInTheDocument();
    expect(mainImage).toHaveAttribute('src', '/test-main.jpg');
    expect(mainImage).toHaveAttribute('data-fill', 'true');
    expect(mainImage).toHaveAttribute('data-sizes', '(max-width: 1024px) 100vw, 66vw');
  });

  it('should render side items with correct image attributes', () => {
    render(<FeaturedSection items={mockFeaturedItems} />);
    
    const sideImage1 = screen.getByAltText('Test Side Item 1');
    const sideImage2 = screen.getByAltText('Test Side Item 2');
    
    expect(sideImage1).toHaveAttribute('src', '/test-side-1.jpg');
    expect(sideImage1).toHaveAttribute('data-sizes', '(max-width: 1024px) 100vw, 33vw');
    
    expect(sideImage2).toHaveAttribute('src', '/test-side-2.jpg');
    expect(sideImage2).toHaveAttribute('data-sizes', '(max-width: 1024px) 100vw, 33vw');
  });

  it('should handle empty items array', () => {
    render(<FeaturedSection items={[]} />);
    
    // 组件应该不渲染任何内容
    expect(screen.queryByText('精选推荐')).not.toBeInTheDocument();
  });

  it('should handle undefined items', () => {
    // @ts-expect-error Testing edge case
    render(<FeaturedSection items={undefined} />);
    
    // 组件应该不渲染任何内容
    expect(screen.queryByText('精选推荐')).not.toBeInTheDocument();
  });

  it('should render type badges correctly', () => {
    render(<FeaturedSection items={mockFeaturedItems} />);
    
    // 检查类型标签
    expect(screen.getByText('精选帖子')).toBeInTheDocument();
    expect(screen.getByText('推荐适配器')).toBeInTheDocument();
    expect(screen.getByText('热门角色')).toBeInTheDocument();
  });

  it('should render custom badge', () => {
    render(<FeaturedSection items={mockFeaturedItems} />);
    
    // 检查自定义标签
    expect(screen.getByText('置顶')).toBeInTheDocument();
  });

  it('should have correct link hrefs', () => {
    render(<FeaturedSection items={mockFeaturedItems} />);
    
    const links = screen.getAllByRole('link');
    expect(links[0]).toHaveAttribute('href', '/posts/1');
    expect(links[1]).toHaveAttribute('href', '/adapters/2');
    expect(links[2]).toHaveAttribute('href', '/characters/3');
  });

  it('should apply custom className', () => {
    const { container } = render(
      <FeaturedSection items={mockFeaturedItems} className="custom-featured" />
    );
    
    const section = container.firstChild;
    expect(section).toHaveClass('custom-featured');
  });

  // 测试可能导致 hydration 错误的场景
  describe('Hydration Error Scenarios', () => {
    it('should handle dynamic image paths consistently', () => {
      const dynamicItems = mockFeaturedItems.map(item => ({
        ...item,
        // 模拟动态生成的图片路径
        image: `/dynamic/${Date.now()}-${item.id}.jpg`
      }));
      
      render(<FeaturedSection items={dynamicItems} />);
      
      // 检查图片是否正确渲染
      const images = screen.getAllByRole('img');
      expect(images).toHaveLength(3);
    });

    it('should handle responsive sizes attribute consistently', () => {
      // 测试在不同屏幕尺寸下的 sizes 属性
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1024,
      });

      render(<FeaturedSection items={mockFeaturedItems} />);
      
      const mainImage = screen.getByAltText('Test Main Item');
      expect(mainImage).toHaveAttribute('data-sizes', '(max-width: 1024px) 100vw, 66vw');
    });

    it('should maintain consistent DOM structure', () => {
      const { container } = render(<FeaturedSection items={mockFeaturedItems} />);
      
      // 检查DOM结构的一致性
      const gridContainer = container.querySelector('.grid');
      expect(gridContainer).toBeInTheDocument();
      expect(gridContainer).toHaveClass('grid-cols-1', 'lg:grid-cols-3', 'gap-4');
      
      const mainCard = container.querySelector('.lg\\:col-span-2');
      expect(mainCard).toBeInTheDocument();
    });
  });

  // 性能测试
  it('should render efficiently with many items', () => {
    const manyItems = Array.from({ length: 10 }, (_, i) => ({
      id: `item-${i}`,
      title: `Test Item ${i}`,
      description: `Description ${i}`,
      image: `/test-${i}.jpg`,
      type: 'post' as const,
      link: `/posts/${i}`,
    }));

    const startTime = performance.now();
    render(<FeaturedSection items={manyItems} />);
    const endTime = performance.now();
    
    // 渲染时间应该在合理范围内（小于100ms）
    expect(endTime - startTime).toBeLessThan(100);
    
    // 只应该渲染主要的3个项目（1个主要 + 2个副项目）
    expect(screen.getByText('Test Item 0')).toBeInTheDocument();
    expect(screen.getByText('Test Item 1')).toBeInTheDocument();
    expect(screen.getByText('Test Item 2')).toBeInTheDocument();
    expect(screen.queryByText('Test Item 3')).not.toBeInTheDocument();
  });
});
