/**
 * FeaturedSection 修复后的验证测试
 * 验证hydration错误修复后组件是否正常工作
 */

import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { FeaturedSection, type FeaturedItem } from '../FeaturedSection';

// Mock Next.js components
vi.mock('next/image', () => ({
  default: ({ src, alt, width, height, className, sizes, priority }: any) => (
    <img 
      src={src} 
      alt={alt}
      width={width}
      height={height}
      className={className}
      data-sizes={sizes}
      data-priority={priority?.toString()}
    />
  ),
}));

vi.mock('next/link', () => ({
  default: ({ href, children, className }: any) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

// 模拟实际使用的数据（与主页相同）
const testItems: FeaturedItem[] = [
  {
    id: '1',
    title: 'Zishu AI 社区平台正式上线',
    description: '一个全新的AI角色社区平台，让你轻松创建、分享和探索AI角色',
    image: '/images/featured/main.jpg',
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

describe('FeaturedSection - 修复后验证', () => {
  it('should render without hydration errors after fix', () => {
    render(<FeaturedSection items={testItems} />);
    
    // 检查组件是否正常渲染
    expect(screen.getByText('精选推荐')).toBeInTheDocument();
    expect(screen.getByText('Zishu AI 社区平台正式上线')).toBeInTheDocument();
  });

  it('should use width/height instead of fill attribute', () => {
    render(<FeaturedSection items={testItems} />);
    
    // 检查主图片使用了width和height而不是fill
    const mainImage = screen.getByAltText('Zishu AI 社区平台正式上线');
    expect(mainImage).toHaveAttribute('width', '800');
    expect(mainImage).toHaveAttribute('height', '320');
    expect(mainImage).not.toHaveAttribute('fill');
    
    // 检查副图片也使用了width和height
    const sideImage1 = screen.getByAltText('智能对话适配器 v2.0');
    expect(sideImage1).toHaveAttribute('width', '400');
    expect(sideImage1).toHaveAttribute('height', '144');
  });

  it('should use simplified sizes attributes', () => {
    render(<FeaturedSection items={testItems} />);
    
    // 检查简化后的sizes属性
    const mainImage = screen.getByAltText('Zishu AI 社区平台正式上线');
    expect(mainImage).toHaveAttribute('data-sizes', '100vw');
    
    const sideImage = screen.getByAltText('智能对话适配器 v2.0');
    expect(sideImage).toHaveAttribute('data-sizes', '50vw');
  });

  it('should include priority attribute for main image', () => {
    render(<FeaturedSection items={testItems} />);
    
    // 检查主图片有priority属性（有助于LCP优化）
    const mainImage = screen.getByAltText('Zishu AI 社区平台正式上线');
    expect(mainImage).toHaveAttribute('data-priority', 'true');
  });

  it('should maintain responsive styling with w-full h-full classes', () => {
    render(<FeaturedSection items={testItems} />);
    
    // 检查图片有w-full h-full类来保持响应式
    const mainImage = screen.getByAltText('Zishu AI 社区平台正式上线');
    expect(mainImage).toHaveClass('w-full', 'h-full');
    
    const sideImage = screen.getByAltText('智能对话适配器 v2.0');
    expect(sideImage).toHaveClass('w-full', 'h-full');
  });

  it('should render all content correctly after fix', () => {
    render(<FeaturedSection items={testItems} />);
    
    // 检查所有内容是否正确渲染
    expect(screen.getByText('精选帖子')).toBeInTheDocument();
    expect(screen.getByText('推荐适配器')).toBeInTheDocument();
    expect(screen.getByText('热门角色')).toBeInTheDocument();
    expect(screen.getByText('置顶')).toBeInTheDocument();
    
    // 检查链接
    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(3);
    expect(links[0]).toHaveAttribute('href', '/posts/1');
    expect(links[1]).toHaveAttribute('href', '/adapters/2');
    expect(links[2]).toHaveAttribute('href', '/characters/3');
  });

  it('should handle edge cases without errors', () => {
    // 测试空数组
    const { rerender } = render(<FeaturedSection items={[]} />);
    expect(screen.queryByText('精选推荐')).not.toBeInTheDocument();
    
    // 测试单个项目
    rerender(<FeaturedSection items={[testItems[0]]} />);
    expect(screen.getByText('精选推荐')).toBeInTheDocument();
    expect(screen.getByText('Zishu AI 社区平台正式上线')).toBeInTheDocument();
    
    // 副推荐区域应该为空（因为只有1个项目）
    expect(screen.queryByText('智能对话适配器 v2.0')).not.toBeInTheDocument();
  });
});
