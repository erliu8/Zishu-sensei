/**
 * Card 组件测试
 * 测试卡片组件及其子组件
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/shared/components/ui/card';

describe('Card Components', () => {
  describe('Card', () => {
    it('应该正确渲染卡片', () => {
      render(<Card data-testid="card">卡片内容</Card>);
      const card = screen.getByTestId('card');
      expect(card).toBeInTheDocument();
      expect(card).toHaveTextContent('卡片内容');
    });

    it('应该有正确的默认样式类', () => {
      render(<Card data-testid="card">内容</Card>);
      const card = screen.getByTestId('card');
      expect(card).toHaveClass('rounded-lg', 'border', 'bg-card', 'shadow-sm');
    });

    it('应该接受自定义 className', () => {
      render(<Card className="custom-card" data-testid="card">内容</Card>);
      const card = screen.getByTestId('card');
      expect(card).toHaveClass('custom-card');
      expect(card).toHaveClass('rounded-lg'); // 保留默认样式
    });

    it('应该转发 ref', () => {
      const ref = { current: null };
      render(<Card ref={ref}>内容</Card>);
      expect(ref.current).toBeInstanceOf(HTMLDivElement);
    });

    it('应该传递 HTML 属性', () => {
      render(
        <Card data-testid="card" id="my-card" aria-label="信息卡片">
          内容
        </Card>
      );
      const card = screen.getByTestId('card');
      expect(card).toHaveAttribute('id', 'my-card');
      expect(card).toHaveAttribute('aria-label', '信息卡片');
    });
  });

  describe('CardHeader', () => {
    it('应该正确渲染卡片头部', () => {
      render(
        <Card>
          <CardHeader data-testid="header">头部内容</CardHeader>
        </Card>
      );
      const header = screen.getByTestId('header');
      expect(header).toBeInTheDocument();
      expect(header).toHaveTextContent('头部内容');
    });

    it('应该有正确的样式', () => {
      render(
        <Card>
          <CardHeader data-testid="header">头部</CardHeader>
        </Card>
      );
      const header = screen.getByTestId('header');
      expect(header).toHaveClass('flex', 'flex-col', 'space-y-1.5', 'p-6');
    });
  });

  describe('CardTitle', () => {
    it('应该渲染为 h3 标签', () => {
      render(
        <Card>
          <CardHeader>
            <CardTitle>卡片标题</CardTitle>
          </CardHeader>
        </Card>
      );
      const title = screen.getByRole('heading', { level: 3 });
      expect(title).toBeInTheDocument();
      expect(title).toHaveTextContent('卡片标题');
    });

    it('应该有正确的样式', () => {
      render(
        <Card>
          <CardHeader>
            <CardTitle>标题</CardTitle>
          </CardHeader>
        </Card>
      );
      const title = screen.getByRole('heading');
      expect(title).toHaveClass('text-2xl', 'font-semibold', 'leading-none', 'tracking-tight');
    });
  });

  describe('CardDescription', () => {
    it('应该正确渲染描述文本', () => {
      render(
        <Card>
          <CardHeader>
            <CardDescription>这是卡片描述</CardDescription>
          </CardHeader>
        </Card>
      );
      const description = screen.getByText('这是卡片描述');
      expect(description).toBeInTheDocument();
      expect(description.tagName).toBe('P');
    });

    it('应该有正确的样式', () => {
      render(
        <Card>
          <CardHeader>
            <CardDescription>描述</CardDescription>
          </CardHeader>
        </Card>
      );
      const description = screen.getByText('描述');
      expect(description).toHaveClass('text-sm', 'text-muted-foreground');
    });
  });

  describe('CardContent', () => {
    it('应该正确渲染卡片内容', () => {
      render(
        <Card>
          <CardContent data-testid="content">主要内容</CardContent>
        </Card>
      );
      const content = screen.getByTestId('content');
      expect(content).toBeInTheDocument();
      expect(content).toHaveTextContent('主要内容');
    });

    it('应该有正确的样式', () => {
      render(
        <Card>
          <CardContent data-testid="content">内容</CardContent>
        </Card>
      );
      const content = screen.getByTestId('content');
      expect(content).toHaveClass('p-6', 'pt-0');
    });
  });

  describe('CardFooter', () => {
    it('应该正确渲染卡片底部', () => {
      render(
        <Card>
          <CardFooter data-testid="footer">底部内容</CardFooter>
        </Card>
      );
      const footer = screen.getByTestId('footer');
      expect(footer).toBeInTheDocument();
      expect(footer).toHaveTextContent('底部内容');
    });

    it('应该有正确的样式', () => {
      render(
        <Card>
          <CardFooter data-testid="footer">底部</CardFooter>
        </Card>
      );
      const footer = screen.getByTestId('footer');
      expect(footer).toHaveClass('flex', 'items-center', 'p-6', 'pt-0');
    });
  });

  describe('完整卡片组合', () => {
    it('应该正确渲染完整的卡片结构', () => {
      render(
        <Card data-testid="card">
          <CardHeader>
            <CardTitle>用户信息</CardTitle>
            <CardDescription>查看和编辑用户详情</CardDescription>
          </CardHeader>
          <CardContent>
            <p>用户名：张三</p>
            <p>邮箱：zhangsan@example.com</p>
          </CardContent>
          <CardFooter>
            <button>编辑</button>
            <button>删除</button>
          </CardFooter>
        </Card>
      );

      expect(screen.getByTestId('card')).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: '用户信息' })).toBeInTheDocument();
      expect(screen.getByText('查看和编辑用户详情')).toBeInTheDocument();
      expect(screen.getByText('用户名：张三')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '编辑' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '删除' })).toBeInTheDocument();
    });

    it('应该支持嵌套卡片', () => {
      render(
        <Card data-testid="outer-card">
          <CardContent>
            <Card data-testid="inner-card">
              <CardContent>嵌套内容</CardContent>
            </Card>
          </CardContent>
        </Card>
      );

      expect(screen.getByTestId('outer-card')).toBeInTheDocument();
      expect(screen.getByTestId('inner-card')).toBeInTheDocument();
      expect(screen.getByText('嵌套内容')).toBeInTheDocument();
    });

    it('应该支持可选的子组件', () => {
      // 只有标题
      const { rerender } = render(
        <Card>
          <CardHeader>
            <CardTitle>仅标题</CardTitle>
          </CardHeader>
        </Card>
      );
      expect(screen.getByRole('heading', { name: '仅标题' })).toBeInTheDocument();

      // 只有内容
      rerender(
        <Card>
          <CardContent>仅内容</CardContent>
        </Card>
      );
      expect(screen.getByText('仅内容')).toBeInTheDocument();

      // 只有底部
      rerender(
        <Card>
          <CardFooter>仅底部</CardFooter>
        </Card>
      );
      expect(screen.getByText('仅底部')).toBeInTheDocument();
    });
  });

  describe('可访问性', () => {
    it('应该支持 ARIA 属性', () => {
      render(
        <Card
          data-testid="card"
          role="article"
          aria-label="用户卡片"
          aria-describedby="card-description"
        >
          <CardContent id="card-description">内容</CardContent>
        </Card>
      );

      const card = screen.getByTestId('card');
      expect(card).toHaveAttribute('role', 'article');
      expect(card).toHaveAttribute('aria-label', '用户卡片');
      expect(card).toHaveAttribute('aria-describedby', 'card-description');
    });

    it('标题应该有正确的语义结构', () => {
      render(
        <Card>
          <CardHeader>
            <CardTitle>主标题</CardTitle>
            <CardDescription>副标题</CardDescription>
          </CardHeader>
        </Card>
      );

      const heading = screen.getByRole('heading', { level: 3 });
      expect(heading).toHaveTextContent('主标题');
    });
  });
});

