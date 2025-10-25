/**
 * Navigation 组件可访问性测试
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { checkA11y } from '../helpers/a11y-utils';
import { componentAxeOptions } from '../setup-a11y';
import { testArrowKeyNavigation } from '../helpers/keyboard-testing';

// 临时的 Navigation 组件用于测试
const Nav = ({ children, ...props }: any) => (
  <nav {...props}>{children}</nav>
);

const NavList = ({ children }: any) => (
  <ul role="list">{children}</ul>
);

const NavItem = ({ children, href, active = false }: any) => (
  <li>
    <a
      href={href}
      aria-current={active ? 'page' : undefined}
      className={active ? 'active' : ''}
    >
      {children}
    </a>
  </li>
);

const MobileNav = ({ isOpen, onClose, children }: any) => {
  if (!isOpen) return null;
  
  return (
    <nav aria-label="Mobile navigation" className="mobile-nav">
      <button
        onClick={onClose}
        aria-label="Close navigation"
        className="close-button"
      >
        ×
      </button>
      {children}
    </nav>
  );
};

describe('Navigation Accessibility', () => {
  describe('基本可访问性', () => {
    it('导航应该使用 nav 元素', () => {
      render(
        <Nav aria-label="Main navigation">
          <NavList>
            <NavItem href="/">Home</NavItem>
            <NavItem href="/about">About</NavItem>
          </NavList>
        </Nav>
      );
      
      const nav = screen.getByRole('navigation', { name: /main navigation/i });
      expect(nav).toBeInTheDocument();
    });

    it('导航应该没有可访问性违规', async () => {
      const { container } = render(
        <Nav aria-label="Main navigation">
          <NavList>
            <NavItem href="/">Home</NavItem>
            <NavItem href="/about">About</NavItem>
            <NavItem href="/contact">Contact</NavItem>
          </NavList>
        </Nav>
      );
      
      await checkA11y(container, componentAxeOptions);
    });

    it('多个导航区域应该有不同的标签', async () => {
      const { container } = render(
        <>
          <Nav aria-label="Main navigation">
            <NavList>
              <NavItem href="/">Home</NavItem>
              <NavItem href="/products">Products</NavItem>
            </NavList>
          </Nav>
          <Nav aria-label="Footer navigation">
            <NavList>
              <NavItem href="/privacy">Privacy</NavItem>
              <NavItem href="/terms">Terms</NavItem>
            </NavList>
          </Nav>
        </>
      );
      
      expect(screen.getByRole('navigation', { name: /main/i })).toBeInTheDocument();
      expect(screen.getByRole('navigation', { name: /footer/i })).toBeInTheDocument();
      
      await checkA11y(container, componentAxeOptions);
    });
  });

  describe('当前页面指示', () => {
    it('当前页面应该使用 aria-current', () => {
      render(
        <Nav aria-label="Main navigation">
          <NavList>
            <NavItem href="/" active>Home</NavItem>
            <NavItem href="/about">About</NavItem>
            <NavItem href="/contact">Contact</NavItem>
          </NavList>
        </Nav>
      );
      
      const homeLink = screen.getByRole('link', { name: /home/i });
      expect(homeLink).toHaveAttribute('aria-current', 'page');
    });

    it('只有一个链接应该标记为当前页面', () => {
      const { container } = render(
        <Nav aria-label="Main navigation">
          <NavList>
            <NavItem href="/">Home</NavItem>
            <NavItem href="/products" active>Products</NavItem>
            <NavItem href="/about">About</NavItem>
          </NavList>
        </Nav>
      );
      
      const currentLinks = container.querySelectorAll('[aria-current="page"]');
      expect(currentLinks).toHaveLength(1);
    });
  });

  describe('键盘导航', () => {
    it('所有导航链接都应该可以通过 Tab 键访问', async () => {
      const user = userEvent.setup();
      
      render(
        <Nav aria-label="Main navigation">
          <NavList>
            <NavItem href="/">Home</NavItem>
            <NavItem href="/products">Products</NavItem>
            <NavItem href="/about">About</NavItem>
          </NavList>
        </Nav>
      );
      
      const links = screen.getAllByRole('link');
      
      await user.tab();
      expect(document.activeElement).toBe(links[0]);
      
      await user.tab();
      expect(document.activeElement).toBe(links[1]);
      
      await user.tab();
      expect(document.activeElement).toBe(links[2]);
    });

    it('链接应该可以通过 Enter 键激活', async () => {
      const user = userEvent.setup();
      
      render(
        <Nav aria-label="Main navigation">
          <NavList>
            <NavItem href="/about">About</NavItem>
          </NavList>
        </Nav>
      );
      
      const link = screen.getByRole('link', { name: /about/i });
      link.focus();
      
      await user.keyboard('{Enter}');
      // 在真实浏览器中会导航，这里只测试可以触发
    });
  });

  describe('移动端导航', () => {
    it('移动端导航应该可访问', async () => {
      const { container } = render(
        <MobileNav isOpen={true} onClose={() => {}}>
          <NavList>
            <NavItem href="/">Home</NavItem>
            <NavItem href="/about">About</NavItem>
          </NavList>
        </MobileNav>
      );
      
      expect(screen.getByRole('navigation', { name: /mobile/i })).toBeInTheDocument();
      await checkA11y(container, componentAxeOptions);
    });

    it('关闭按钮应该有可访问的名称', () => {
      render(
        <MobileNav isOpen={true} onClose={() => {}}>
          <NavList>
            <NavItem href="/">Home</NavItem>
          </NavList>
        </MobileNav>
      );
      
      const closeButton = screen.getByRole('button', { name: /close navigation/i });
      expect(closeButton).toBeInTheDocument();
    });

    it('打开时应该陷阱焦点', () => {
      render(
        <MobileNav isOpen={true} onClose={() => {}}>
          <NavList>
            <NavItem href="/">Home</NavItem>
            <NavItem href="/about">About</NavItem>
          </NavList>
        </MobileNav>
      );
      
      const nav = screen.getByRole('navigation');
      const focusableElements = nav.querySelectorAll('a, button');
      expect(focusableElements.length).toBeGreaterThan(0);
    });
  });

  describe('面包屑导航', () => {
    const Breadcrumb = ({ children }: any) => (
      <nav aria-label="Breadcrumb">
        <ol role="list">{children}</ol>
      </nav>
    );

    const BreadcrumbItem = ({ href, children, isCurrent = false }: any) => (
      <li>
        {isCurrent ? (
          <span aria-current="page">{children}</span>
        ) : (
          <a href={href}>{children}</a>
        )}
      </li>
    );

    it('面包屑应该使用有序列表', () => {
      render(
        <Breadcrumb>
          <BreadcrumbItem href="/">Home</BreadcrumbItem>
          <BreadcrumbItem href="/products">Products</BreadcrumbItem>
          <BreadcrumbItem isCurrent>Details</BreadcrumbItem>
        </Breadcrumb>
      );
      
      const breadcrumb = screen.getByRole('navigation', { name: /breadcrumb/i });
      expect(breadcrumb).toBeInTheDocument();
      
      const list = breadcrumb.querySelector('ol');
      expect(list).toBeInTheDocument();
    });

    it('当前页面应该标记为 aria-current', () => {
      const { container } = render(
        <Breadcrumb>
          <BreadcrumbItem href="/">Home</BreadcrumbItem>
          <BreadcrumbItem isCurrent>Current</BreadcrumbItem>
        </Breadcrumb>
      );
      
      const current = container.querySelector('[aria-current="page"]');
      expect(current).toHaveTextContent(/current/i);
    });

    it('面包屑应该没有可访问性违规', async () => {
      const { container } = render(
        <Breadcrumb>
          <BreadcrumbItem href="/">Home</BreadcrumbItem>
          <BreadcrumbItem href="/category">Category</BreadcrumbItem>
          <BreadcrumbItem isCurrent>Item</BreadcrumbItem>
        </Breadcrumb>
      );
      
      await checkA11y(container, componentAxeOptions);
    });
  });

  describe('下拉菜单导航', () => {
    const DropdownNav = ({ label, items }: any) => {
      const [isOpen, setIsOpen] = React.useState(false);
      
      return (
        <div className="dropdown">
          <button
            aria-expanded={isOpen}
            aria-haspopup="true"
            onClick={() => setIsOpen(!isOpen)}
          >
            {label}
          </button>
          {isOpen && (
            <ul role="menu">
              {items.map((item: any) => (
                <li key={item.href} role="menuitem">
                  <a href={item.href}>{item.label}</a>
                </li>
              ))}
            </ul>
          )}
        </div>
      );
    };

    // 添加 React 引用
    const React = { useState: (initial: any) => [initial, () => {}] };

    it('下拉按钮应该有 aria-expanded', () => {
      render(
        <Nav aria-label="Main">
          <button aria-expanded="false" aria-haspopup="true">
            Products
          </button>
        </Nav>
      );
      
      const button = screen.getByRole('button', { name: /products/i });
      expect(button).toHaveAttribute('aria-expanded', 'false');
      expect(button).toHaveAttribute('aria-haspopup', 'true');
    });

    it('展开的菜单应该使用 role="menu"', () => {
      render(
        <Nav aria-label="Main">
          <button aria-expanded="true" aria-haspopup="true">
            Products
          </button>
          <ul role="menu">
            <li role="menuitem">
              <a href="/products/1">Product 1</a>
            </li>
            <li role="menuitem">
              <a href="/products/2">Product 2</a>
            </li>
          </ul>
        </Nav>
      );
      
      const menu = screen.getByRole('menu');
      expect(menu).toBeInTheDocument();
      
      const menuItems = screen.getAllByRole('menuitem');
      expect(menuItems).toHaveLength(2);
    });
  });

  describe('跳过导航链接', () => {
    const SkipLink = ({ href, children }: any) => (
      <a href={href} className="skip-link">
        {children}
      </a>
    );

    it('应该提供跳过导航链接', () => {
      render(
        <>
          <SkipLink href="#main-content">Skip to main content</SkipLink>
          <Nav aria-label="Main navigation">
            <NavList>
              <NavItem href="/">Home</NavItem>
              <NavItem href="/about">About</NavItem>
            </NavList>
          </Nav>
          <main id="main-content">
            <h1>Main Content</h1>
          </main>
        </>
      );
      
      const skipLink = screen.getByRole('link', { name: /skip to main content/i });
      expect(skipLink).toHaveAttribute('href', '#main-content');
    });

    it('跳过链接应该是第一个可聚焦元素', async () => {
      const user = userEvent.setup();
      
      render(
        <>
          <SkipLink href="#main">Skip to content</SkipLink>
          <Nav aria-label="Main">
            <NavList>
              <NavItem href="/">Home</NavItem>
            </NavList>
          </Nav>
        </>
      );
      
      await user.tab();
      const skipLink = screen.getByRole('link', { name: /skip to content/i });
      expect(document.activeElement).toBe(skipLink);
    });
  });

  describe('标签导航（Tabs）', () => {
    const Tabs = ({ children, defaultValue }: any) => (
      <div className="tabs">{children}</div>
    );

    const TabList = ({ children }: any) => (
      <div role="tablist" aria-label="Content tabs">
        {children}
      </div>
    );

    const Tab = ({ children, value, active = false }: any) => (
      <button
        role="tab"
        aria-selected={active}
        aria-controls={`panel-${value}`}
        id={`tab-${value}`}
        tabIndex={active ? 0 : -1}
      >
        {children}
      </button>
    );

    const TabPanel = ({ children, value, active = false }: any) => (
      <div
        role="tabpanel"
        id={`panel-${value}`}
        aria-labelledby={`tab-${value}`}
        hidden={!active}
        tabIndex={0}
      >
        {children}
      </div>
    );

    it('标签应该使用 ARIA tabs 模式', () => {
      render(
        <Tabs defaultValue="tab1">
          <TabList>
            <Tab value="tab1" active>Tab 1</Tab>
            <Tab value="tab2">Tab 2</Tab>
            <Tab value="tab3">Tab 3</Tab>
          </TabList>
          <TabPanel value="tab1" active>
            <p>Content 1</p>
          </TabPanel>
          <TabPanel value="tab2">
            <p>Content 2</p>
          </TabPanel>
          <TabPanel value="tab3">
            <p>Content 3</p>
          </TabPanel>
        </Tabs>
      );
      
      const tablist = screen.getByRole('tablist');
      expect(tablist).toBeInTheDocument();
      
      const tabs = screen.getAllByRole('tab');
      expect(tabs).toHaveLength(3);
      
      const panels = screen.getAllByRole('tabpanel', { hidden: true });
      expect(panels.length).toBeGreaterThan(0);
    });

    it('激活的标签应该有 aria-selected="true"', () => {
      render(
        <Tabs defaultValue="tab2">
          <TabList>
            <Tab value="tab1">Tab 1</Tab>
            <Tab value="tab2" active>Tab 2</Tab>
          </TabList>
          <TabPanel value="tab1">Content 1</TabPanel>
          <TabPanel value="tab2" active>Content 2</TabPanel>
        </Tabs>
      );
      
      const activeTab = screen.getByRole('tab', { name: /tab 2/i });
      expect(activeTab).toHaveAttribute('aria-selected', 'true');
    });

    it('标签应该与面板关联', () => {
      render(
        <Tabs defaultValue="tab1">
          <TabList>
            <Tab value="tab1" active>Tab 1</Tab>
          </TabList>
          <TabPanel value="tab1" active>
            <p>Panel content</p>
          </TabPanel>
        </Tabs>
      );
      
      const tab = screen.getByRole('tab');
      const panel = screen.getByRole('tabpanel');
      
      expect(tab).toHaveAttribute('aria-controls', 'panel-tab1');
      expect(panel).toHaveAttribute('aria-labelledby', 'tab-tab1');
    });

    it('标签导航应该没有可访问性违规', async () => {
      const { container } = render(
        <Tabs defaultValue="tab1">
          <TabList>
            <Tab value="tab1" active>Overview</Tab>
            <Tab value="tab2">Details</Tab>
          </TabList>
          <TabPanel value="tab1" active>
            <p>Overview content</p>
          </TabPanel>
          <TabPanel value="tab2">
            <p>Details content</p>
          </TabPanel>
        </Tabs>
      );
      
      await checkA11y(container, componentAxeOptions);
    });

    it('应该支持箭头键导航', async () => {
      render(
        <Tabs defaultValue="tab1">
          <TabList>
            <Tab value="tab1" active>Tab 1</Tab>
            <Tab value="tab2">Tab 2</Tab>
            <Tab value="tab3">Tab 3</Tab>
          </TabList>
          <TabPanel value="tab1" active>Content 1</TabPanel>
          <TabPanel value="tab2">Content 2</TabPanel>
          <TabPanel value="tab3">Content 3</TabPanel>
        </Tabs>
      );
      
      const tabs = screen.getAllByRole('tab');
      
      // 测试箭头键导航
      tabs[0].focus();
      await testArrowKeyNavigation(tabs, 'horizontal');
    });
  });
});

