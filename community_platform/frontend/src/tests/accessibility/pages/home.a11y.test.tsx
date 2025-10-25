/**
 * Home 页面可访问性测试
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { checkA11y } from '../helpers/a11y-utils';
import { pageAxeOptions } from '../setup-a11y';
import { 
  checkHeadingOrder,
  checkLandmarks,
  generateA11yReport,
} from '../helpers/a11y-utils';

// 临时的 Home 页面组件用于测试
const HomePage = () => (
  <div className="home-page">
    <a href="#main-content" className="skip-link">
      Skip to main content
    </a>
    
    <header role="banner">
      <nav aria-label="Main navigation">
        <ul>
          <li><a href="/">Home</a></li>
          <li><a href="/about">About</a></li>
          <li><a href="/contact">Contact</a></li>
        </ul>
      </nav>
    </header>
    
    <main id="main-content" role="main">
      <h1>Welcome to Our Platform</h1>
      
      <section aria-labelledby="features-heading">
        <h2 id="features-heading">Features</h2>
        <div className="features-grid">
          <article>
            <h3>Feature 1</h3>
            <p>Description of feature 1</p>
          </article>
          <article>
            <h3>Feature 2</h3>
            <p>Description of feature 2</p>
          </article>
          <article>
            <h3>Feature 3</h3>
            <p>Description of feature 3</p>
          </article>
        </div>
      </section>
      
      <section aria-labelledby="cta-heading">
        <h2 id="cta-heading">Get Started</h2>
        <p>Join our community today</p>
        <button>Sign Up Now</button>
      </section>
    </main>
    
    <footer role="contentinfo">
      <nav aria-label="Footer navigation">
        <ul>
          <li><a href="/privacy">Privacy Policy</a></li>
          <li><a href="/terms">Terms of Service</a></li>
        </ul>
      </nav>
      <p>&copy; 2025 Our Platform</p>
    </footer>
  </div>
);

describe('Home Page Accessibility', () => {
  describe('整体页面可访问性', () => {
    it('页面应该没有可访问性违规', async () => {
      const { container } = render(<HomePage />);
      await checkA11y(container, pageAxeOptions);
    });

    it('应该生成完整的可访问性报告', () => {
      const { container } = render(<HomePage />);
      
      const report = generateA11yReport(container);
      
      expect(report.summary.totalErrors).toBe(0);
      expect(report.headings.valid).toBe(true);
      expect(report.landmarks.valid).toBe(true);
    });
  });

  describe('页面结构', () => {
    it('应该有适当的 landmark 区域', () => {
      const { container } = render(<HomePage />);
      
      expect(screen.getByRole('banner')).toBeInTheDocument(); // header
      expect(screen.getByRole('main')).toBeInTheDocument();
      expect(screen.getByRole('contentinfo')).toBeInTheDocument(); // footer
    });

    it('应该有正确的 landmark 结构', () => {
      const { container } = render(<HomePage />);
      
      const landmarksCheck = checkLandmarks(container);
      
      expect(landmarksCheck.valid).toBe(true);
      expect(landmarksCheck.landmarks.some(l => l.role === 'main')).toBe(true);
    });

    it('应该有多个导航区域，且各有不同的标签', () => {
      render(<HomePage />);
      
      const mainNav = screen.getByRole('navigation', { name: /main/i });
      const footerNav = screen.getByRole('navigation', { name: /footer/i });
      
      expect(mainNav).toBeInTheDocument();
      expect(footerNav).toBeInTheDocument();
    });
  });

  describe('标题层级', () => {
    it('应该有一个 h1 标题', () => {
      render(<HomePage />);
      
      const h1 = screen.getByRole('heading', { level: 1 });
      expect(h1).toHaveTextContent(/welcome to our platform/i);
    });

    it('标题层级应该有序', () => {
      const { container } = render(<HomePage />);
      
      const headingsCheck = checkHeadingOrder(container);
      
      expect(headingsCheck.valid).toBe(true);
      expect(headingsCheck.errors).toHaveLength(0);
    });

    it('标题应该描述内容区域', () => {
      render(<HomePage />);
      
      expect(screen.getByRole('heading', { level: 1, name: /welcome/i })).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 2, name: /features/i })).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 2, name: /get started/i })).toBeInTheDocument();
    });
  });

  describe('跳过链接', () => {
    it('应该提供跳过导航链接', () => {
      render(<HomePage />);
      
      const skipLink = screen.getByRole('link', { name: /skip to main content/i });
      expect(skipLink).toHaveAttribute('href', '#main-content');
    });

    it('跳过链接应该指向主内容区域', () => {
      const { container } = render(<HomePage />);
      
      const skipLink = screen.getByRole('link', { name: /skip to main content/i });
      const mainContent = container.querySelector('#main-content');
      
      expect(skipLink.getAttribute('href')).toBe('#main-content');
      expect(mainContent).toBeInTheDocument();
    });
  });

  describe('导航', () => {
    it('主导航应该可访问', () => {
      render(<HomePage />);
      
      const mainNav = screen.getByRole('navigation', { name: /main/i });
      expect(mainNav).toBeInTheDocument();
      
      expect(screen.getByRole('link', { name: /home/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /about/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /contact/i })).toBeInTheDocument();
    });

    it('页脚导航应该可访问', () => {
      render(<HomePage />);
      
      const footerNav = screen.getByRole('navigation', { name: /footer/i });
      expect(footerNav).toBeInTheDocument();
      
      expect(screen.getByRole('link', { name: /privacy/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /terms/i })).toBeInTheDocument();
    });
  });

  describe('语义化区域', () => {
    it('特性区域应该使用 section 和 aria-labelledby', () => {
      const { container } = render(<HomePage />);
      
      const section = container.querySelector('[aria-labelledby="features-heading"]');
      expect(section).toBeInTheDocument();
      
      const heading = container.querySelector('#features-heading');
      expect(heading).toHaveTextContent(/features/i);
    });

    it('特性卡片应该使用 article 元素', () => {
      const { container } = render(<HomePage />);
      
      const articles = container.querySelectorAll('article');
      expect(articles.length).toBeGreaterThan(0);
    });
  });

  describe('交互元素', () => {
    it('所有链接都应该有可访问的名称', () => {
      const { container } = render(<HomePage />);
      
      const links = container.querySelectorAll('a');
      links.forEach(link => {
        const text = link.textContent?.trim();
        const ariaLabel = link.getAttribute('aria-label');
        
        expect(text || ariaLabel).toBeTruthy();
      });
    });

    it('所有按钮都应该有可访问的名称', () => {
      render(<HomePage />);
      
      const button = screen.getByRole('button', { name: /sign up now/i });
      expect(button).toBeInTheDocument();
    });
  });

  describe('焦点管理', () => {
    it('所有交互元素都应该可以通过键盘访问', () => {
      const { container } = render(<HomePage />);
      
      const focusableElements = container.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      
      expect(focusableElements.length).toBeGreaterThan(0);
    });
  });
});

// 测试动态内容的可访问性
describe('Home Page with Dynamic Content', () => {
  const HomePageWithLoading = ({ isLoading }: { isLoading: boolean }) => (
    <main role="main">
      <h1>Home Page</h1>
      
      {isLoading ? (
        <div role="status" aria-live="polite" aria-busy="true">
          <span>Loading content...</span>
        </div>
      ) : (
        <section aria-labelledby="content-heading">
          <h2 id="content-heading">Content</h2>
          <p>Page content loaded successfully</p>
        </section>
      )}
    </main>
  );

  it('加载状态应该通过 live region 通知', () => {
    render(<HomePageWithLoading isLoading={true} />);
    
    const status = screen.getByRole('status');
    expect(status).toHaveTextContent(/loading/i);
    expect(status).toHaveAttribute('aria-live', 'polite');
  });

  it('加载状态应该有 aria-busy 属性', () => {
    render(<HomePageWithLoading isLoading={true} />);
    
    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-busy', 'true');
  });

  it('内容加载后应该可访问', async () => {
    const { container } = render(<HomePageWithLoading isLoading={false} />);
    
    expect(screen.getByRole('heading', { level: 2, name: /content/i })).toBeInTheDocument();
    await checkA11y(container, pageAxeOptions);
  });
});

// 测试错误状态的可访问性
describe('Home Page Error States', () => {
  const HomePageWithError = ({ error }: { error?: string }) => (
    <main role="main">
      <h1>Home Page</h1>
      
      {error && (
        <div role="alert" className="error-message">
          <h2>Error</h2>
          <p>{error}</p>
        </div>
      )}
      
      <section>
        <h2>Content</h2>
        <p>Page content</p>
      </section>
    </main>
  );

  it('错误消息应该使用 role="alert"', () => {
    render(<HomePageWithError error="Failed to load content" />);
    
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(/failed to load content/i);
  });

  it('错误状态应该没有可访问性违规', async () => {
    const { container } = render(
      <HomePageWithError error="Something went wrong" />
    );
    
    await checkA11y(container, pageAxeOptions);
  });
});

// 测试带模态框的页面
describe('Home Page with Modal', () => {
  const HomePageWithModal = ({ showModal }: { showModal: boolean }) => (
    <>
      <main role="main">
        <h1>Home Page</h1>
        <button>Open Modal</button>
      </main>
      
      {showModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
        >
          <h2 id="modal-title">Modal Title</h2>
          <p>Modal content</p>
          <button>Close</button>
        </div>
      )}
    </>
  );

  it('模态框打开时应该可访问', async () => {
    const { container } = render(<HomePageWithModal showModal={true} />);
    
    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    
    await checkA11y(container, pageAxeOptions);
  });

  it('模态框应该有可访问的标题', () => {
    render(<HomePageWithModal showModal={true} />);
    
    const dialog = screen.getByRole('dialog', { name: /modal title/i });
    expect(dialog).toBeInTheDocument();
  });
});

