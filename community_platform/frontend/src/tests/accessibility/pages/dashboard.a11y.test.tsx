/**
 * Dashboard 页面可访问性测试
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { checkA11y } from '../helpers/a11y-utils';
import { pageAxeOptions } from '../setup-a11y';

// 临时的 Dashboard 页面组件用于测试
const DashboardPage = ({ user }: { user?: { name: string } }) => (
  <div className="dashboard-page">
    <header role="banner">
      <h1>Dashboard</h1>
      <nav aria-label="User menu">
        <button aria-label="User menu" aria-expanded="false" aria-haspopup="true">
          {user?.name || 'User'}
        </button>
      </nav>
    </header>
    
    <aside role="complementary" aria-label="Sidebar navigation">
      <nav aria-label="Dashboard navigation">
        <ul>
          <li><a href="/dashboard" aria-current="page">Overview</a></li>
          <li><a href="/dashboard/analytics">Analytics</a></li>
          <li><a href="/dashboard/settings">Settings</a></li>
        </ul>
      </nav>
    </aside>
    
    <main role="main">
      <h2>Welcome back{user?.name ? `, ${user.name}` : ''}</h2>
      
      <section aria-labelledby="stats-heading">
        <h3 id="stats-heading">Statistics</h3>
        <div className="stats-grid">
          <article aria-labelledby="stat-1">
            <h4 id="stat-1">Total Users</h4>
            <p aria-label="1,234 users">1,234</p>
          </article>
          <article aria-labelledby="stat-2">
            <h4 id="stat-2">Active Sessions</h4>
            <p aria-label="456 sessions">456</p>
          </article>
        </div>
      </section>
      
      <section aria-labelledby="recent-heading">
        <h3 id="recent-heading">Recent Activity</h3>
        <ul aria-label="Activity list">
          <li>
            <time dateTime="2025-10-25">October 25, 2025</time>
            <span> - User logged in</span>
          </li>
        </ul>
      </section>
    </main>
  </div>
);

describe('Dashboard Page Accessibility', () => {
  describe('基本可访问性', () => {
    it('Dashboard 页面应该没有可访问性违规', async () => {
      const { container } = render(
        <DashboardPage user={{ name: 'John Doe' }} />
      );
      await checkA11y(container, pageAxeOptions);
    });
  });

  describe('页面结构', () => {
    it('应该有适当的 landmark 区域', () => {
      render(<DashboardPage />);
      
      expect(screen.getByRole('banner')).toBeInTheDocument();
      expect(screen.getByRole('main')).toBeInTheDocument();
      expect(screen.getByRole('complementary')).toBeInTheDocument();
    });

    it('侧边栏应该有可访问的标签', () => {
      render(<DashboardPage />);
      
      const sidebar = screen.getByRole('complementary', { name: /sidebar/i });
      expect(sidebar).toBeInTheDocument();
    });
  });

  describe('导航', () => {
    it('Dashboard 导航应该可访问', () => {
      render(<DashboardPage />);
      
      const nav = screen.getByRole('navigation', { name: /dashboard navigation/i });
      expect(nav).toBeInTheDocument();
    });

    it('当前页面应该标记为 aria-current', () => {
      render(<DashboardPage />);
      
      const currentLink = screen.getByRole('link', { name: /overview/i });
      expect(currentLink).toHaveAttribute('aria-current', 'page');
    });
  });

  describe('统计数据', () => {
    it('统计数据应该有语义化标记', () => {
      render(<DashboardPage />);
      
      expect(screen.getByLabelText(/total users/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/active sessions/i)).toBeInTheDocument();
    });

    it('数字应该有可访问的标签', () => {
      render(<DashboardPage />);
      
      const userCount = screen.getByLabelText(/1,234 users/i);
      expect(userCount).toBeInTheDocument();
    });
  });

  describe('时间信息', () => {
    it('时间应该使用 time 元素', () => {
      const { container } = render(<DashboardPage />);
      
      const timeElement = container.querySelector('time');
      expect(timeElement).toBeInTheDocument();
      expect(timeElement).toHaveAttribute('dateTime');
    });
  });
});

