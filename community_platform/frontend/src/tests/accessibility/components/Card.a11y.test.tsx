/**
 * Card 组件可访问性测试
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { checkA11y } from '../helpers/a11y-utils';
import { componentAxeOptions } from '../setup-a11y';

// 临时的 Card 组件用于测试
const Card = ({ children, className, ...props }: any) => (
  <div className={`card ${className || ''}`} {...props}>
    {children}
  </div>
);

const CardHeader = ({ children }: any) => (
  <div className="card-header">{children}</div>
);

const CardTitle = ({ children, as: Component = 'h3' }: any) => (
  <Component className="card-title">{children}</Component>
);

const CardContent = ({ children }: any) => (
  <div className="card-content">{children}</div>
);

const CardFooter = ({ children }: any) => (
  <div className="card-footer">{children}</div>
);

describe('Card Accessibility', () => {
  describe('基本可访问性', () => {
    it('简单卡片应该没有可访问性违规', async () => {
      const { container } = render(
        <Card>
          <CardHeader>
            <CardTitle>Card Title</CardTitle>
          </CardHeader>
          <CardContent>
            <p>Card content goes here</p>
          </CardContent>
        </Card>
      );
      
      await checkA11y(container, componentAxeOptions);
    });

    it('卡片标题应该使用适当的标题级别', () => {
      render(
        <Card>
          <CardHeader>
            <CardTitle as="h2">Article Title</CardTitle>
          </CardHeader>
          <CardContent>
            <p>Article content</p>
          </CardContent>
        </Card>
      );
      
      const heading = screen.getByRole('heading', { level: 2 });
      expect(heading).toHaveTextContent(/article title/i);
    });
  });

  describe('可点击卡片', () => {
    const ClickableCard = ({ href, children, ...props }: any) => (
      <Card {...props}>
        <a href={href} className="card-link">
          {children}
        </a>
      </Card>
    );

    it('可点击卡片应该使用链接', () => {
      render(
        <ClickableCard href="/article/1">
          <CardHeader>
            <CardTitle>Article Title</CardTitle>
          </CardHeader>
          <CardContent>
            <p>Article preview</p>
          </CardContent>
        </ClickableCard>
      );
      
      const link = screen.getByRole('link');
      expect(link).toHaveAttribute('href', '/article/1');
    });

    it('可点击卡片应该没有可访问性违规', async () => {
      const { container } = render(
        <ClickableCard href="/article/1">
          <CardHeader>
            <CardTitle>Article Title</CardTitle>
          </CardHeader>
          <CardContent>
            <p>Preview text</p>
          </CardContent>
        </ClickableCard>
      );
      
      await checkA11y(container, componentAxeOptions);
    });
  });

  describe('带图片的卡片', () => {
    const ImageCard = ({ imageSrc, imageAlt, title, children }: any) => (
      <Card>
        <img src={imageSrc} alt={imageAlt} className="card-image" />
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
    );

    it('卡片图片应该有替代文本', () => {
      render(
        <ImageCard
          imageSrc="/image.jpg"
          imageAlt="Beautiful landscape"
          title="Travel Article"
        >
          <p>Description</p>
        </ImageCard>
      );
      
      const image = screen.getByRole('img');
      expect(image).toHaveAttribute('alt', 'Beautiful landscape');
    });

    it('装饰性图片应该有空的 alt 属性', async () => {
      const { container } = render(
        <Card>
          <img src="/pattern.svg" alt="" className="decorative" />
          <CardHeader>
            <CardTitle>Content Title</CardTitle>
          </CardHeader>
          <CardContent>
            <p>Main content</p>
          </CardContent>
        </Card>
      );
      
      const image = container.querySelector('img');
      expect(image).toHaveAttribute('alt', '');
      
      await checkA11y(container, componentAxeOptions);
    });

    it('带图片的卡片应该没有可访问性违规', async () => {
      const { container } = render(
        <ImageCard
          imageSrc="/photo.jpg"
          imageAlt="Product photo"
          title="Product Name"
        >
          <p>Product description</p>
        </ImageCard>
      );
      
      await checkA11y(container, componentAxeOptions);
    });
  });

  describe('卡片组合', () => {
    it('卡片网格应该使用语义化标记', async () => {
      const { container } = render(
        <div role="list" aria-label="Articles">
          <Card role="listitem">
            <CardTitle>Article 1</CardTitle>
            <CardContent>Content 1</CardContent>
          </Card>
          <Card role="listitem">
            <CardTitle>Article 2</CardTitle>
            <CardContent>Content 2</CardContent>
          </Card>
          <Card role="listitem">
            <CardTitle>Article 3</CardTitle>
            <CardContent>Content 3</CardContent>
          </Card>
        </div>
      );
      
      const list = screen.getByRole('list', { name: /articles/i });
      expect(list).toBeInTheDocument();
      
      const items = screen.getAllByRole('listitem');
      expect(items).toHaveLength(3);
      
      await checkA11y(container, componentAxeOptions);
    });
  });

  describe('交互式卡片', () => {
    const InteractiveCard = ({ title, children, onAction }: any) => (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>{children}</CardContent>
        <CardFooter>
          <button onClick={onAction}>Learn More</button>
          <button onClick={onAction}>Share</button>
        </CardFooter>
      </Card>
    );

    it('交互式卡片的按钮应该可访问', () => {
      render(
        <InteractiveCard title="Article" onAction={() => {}}>
          <p>Content</p>
        </InteractiveCard>
      );
      
      expect(screen.getByRole('button', { name: /learn more/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /share/i })).toBeInTheDocument();
    });

    it('交互式卡片应该没有可访问性违规', async () => {
      const { container } = render(
        <InteractiveCard title="Product" onAction={() => {}}>
          <p>Description</p>
        </InteractiveCard>
      );
      
      await checkA11y(container, componentAxeOptions);
    });
  });

  describe('卡片状态', () => {
    const StatusCard = ({ status, title, children }: any) => (
      <Card
        role="article"
        aria-label={`${title} - ${status}`}
        data-status={status}
      >
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <span className="status" role="status">
            {status}
          </span>
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
    );

    it('卡片状态应该对屏幕阅读器可见', () => {
      render(
        <StatusCard status="Active" title="Task">
          <p>Task description</p>
        </StatusCard>
      );
      
      const status = screen.getByRole('status');
      expect(status).toHaveTextContent(/active/i);
    });

    it('状态卡片应该没有可访问性违规', async () => {
      const { container } = render(
        <StatusCard status="Completed" title="Project">
          <p>Project details</p>
        </StatusCard>
      );
      
      await checkA11y(container, componentAxeOptions);
    });
  });

  describe('带表单的卡片', () => {
    const FormCard = ({ title, onSubmit }: any) => (
      <Card>
        <CardHeader>
          <CardTitle as="h2">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit}>
            <label htmlFor="email-input">Email</label>
            <input id="email-input" type="email" name="email" />
            <button type="submit">Subscribe</button>
          </form>
        </CardContent>
      </Card>
    );

    it('卡片内的表单应该可访问', () => {
      render(<FormCard title="Newsletter" onSubmit={() => {}} />);
      
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /subscribe/i })).toBeInTheDocument();
    });

    it('表单卡片应该没有可访问性违规', async () => {
      const { container } = render(
        <FormCard title="Contact Us" onSubmit={() => {}} />
      );
      
      await checkA11y(container, componentAxeOptions);
    });
  });

  describe('加载状态', () => {
    const LoadingCard = ({ isLoading, children }: any) => (
      <Card aria-busy={isLoading}>
        {isLoading ? (
          <div role="status" aria-live="polite">
            <span>Loading...</span>
          </div>
        ) : (
          children
        )}
      </Card>
    );

    it('加载中的卡片应该有 aria-busy', () => {
      const { container } = render(
        <LoadingCard isLoading={true}>
          <p>Content</p>
        </LoadingCard>
      );
      
      const card = container.querySelector('.card');
      expect(card).toHaveAttribute('aria-busy', 'true');
    });

    it('加载状态应该通过 live region 通知', () => {
      render(
        <LoadingCard isLoading={true}>
          <p>Content</p>
        </LoadingCard>
      );
      
      const status = screen.getByRole('status');
      expect(status).toHaveTextContent(/loading/i);
    });

    it('加载状态应该没有可访问性违规', async () => {
      const { container } = render(
        <LoadingCard isLoading={true}>
          <p>Content</p>
        </LoadingCard>
      );
      
      await checkA11y(container, componentAxeOptions);
    });
  });

  describe('空状态', () => {
    const EmptyCard = ({ message }: any) => (
      <Card>
        <CardContent>
          <div role="status" className="empty-state">
            {message}
          </div>
        </CardContent>
      </Card>
    );

    it('空状态应该对屏幕阅读器可见', () => {
      render(<EmptyCard message="No items found" />);
      
      const status = screen.getByRole('status');
      expect(status).toHaveTextContent(/no items found/i);
    });

    it('空状态应该没有可访问性违规', async () => {
      const { container } = render(<EmptyCard message="No results" />);
      await checkA11y(container, componentAxeOptions);
    });
  });

  describe('可展开卡片', () => {
    const ExpandableCard = ({ title, children, isExpanded, onToggle }: any) => (
      <Card>
        <CardHeader>
          <button
            onClick={onToggle}
            aria-expanded={isExpanded}
            aria-controls="card-content"
          >
            <CardTitle>{title}</CardTitle>
            <span aria-hidden="true">{isExpanded ? '−' : '+'}</span>
          </button>
        </CardHeader>
        {isExpanded && (
          <CardContent id="card-content">
            {children}
          </CardContent>
        )}
      </Card>
    );

    it('展开按钮应该有 aria-expanded 属性', () => {
      render(
        <ExpandableCard
          title="Details"
          isExpanded={false}
          onToggle={() => {}}
        >
          <p>Hidden content</p>
        </ExpandableCard>
      );
      
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-expanded', 'false');
    });

    it('展开状态应该通过 aria-expanded 反映', () => {
      render(
        <ExpandableCard
          title="Details"
          isExpanded={true}
          onToggle={() => {}}
        >
          <p>Visible content</p>
        </ExpandableCard>
      );
      
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-expanded', 'true');
      expect(screen.getByText(/visible content/i)).toBeInTheDocument();
    });

    it('可展开卡片应该没有可访问性违规', async () => {
      const { container } = render(
        <ExpandableCard
          title="More Info"
          isExpanded={true}
          onToggle={() => {}}
        >
          <p>Additional information</p>
        </ExpandableCard>
      );
      
      await checkA11y(container, componentAxeOptions);
    });
  });
});

