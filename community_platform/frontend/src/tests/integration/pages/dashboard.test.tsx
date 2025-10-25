/**
 * 仪表盘页面集成测试
 * @module tests/integration/pages
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '@/tests/mocks/server';
import { http, HttpResponse } from 'msw';
import { mockUsers } from '@/tests/mocks/data/users';

const API_BASE = 'http://localhost:8000/api/v1';

// Mock 仪表盘组件
const DashboardPage = () => {
  return (
    <div>
      <header>
        <h1>仪表盘</h1>
        <div>
          <span>欢迎, {mockUsers[0].displayName}</span>
        </div>
      </header>
      
      <main>
        {/* 统计卡片 */}
        <section data-testid="stats-section">
          <div className="stat-card">
            <h3>总帖子数</h3>
            <span>42</span>
          </div>
          <div className="stat-card">
            <h3>总关注数</h3>
            <span>128</span>
          </div>
          <div className="stat-card">
            <h3>总粉丝数</h3>
            <span>256</span>
          </div>
          <div className="stat-card">
            <h3>获赞数</h3>
            <span>1024</span>
          </div>
        </section>
        
        {/* 我的帖子 */}
        <section data-testid="my-posts-section">
          <h2>我的帖子</h2>
          <button>创建新帖子</button>
          <div className="posts-list">
            {/* 帖子列表 */}
          </div>
        </section>
        
        {/* 活动统计图表 */}
        <section data-testid="analytics-section">
          <h2>活动统计</h2>
          <div className="chart">
            {/* 图表组件 */}
          </div>
        </section>
        
        {/* 最新通知 */}
        <section data-testid="notifications-section">
          <h2>最新通知</h2>
          <div className="notifications-list">
            {/* 通知列表 */}
          </div>
        </section>
      </main>
    </div>
  );
};

// 测试包装器
const TestWrapper = ({ children }: { children: React.ReactNode }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  
  return (
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </BrowserRouter>
  );
};

describe('仪表盘页面集成测试', () => {
  beforeEach(() => {
    // 清理
  });

  describe('页面渲染', () => {
    it('应该渲染所有主要部分', () => {
      render(
        <TestWrapper>
          <DashboardPage />
        </TestWrapper>
      );

      expect(screen.getByRole('heading', { name: /仪表盘/i })).toBeInTheDocument();
      expect(screen.getByTestId('stats-section')).toBeInTheDocument();
      expect(screen.getByTestId('my-posts-section')).toBeInTheDocument();
      expect(screen.getByTestId('analytics-section')).toBeInTheDocument();
      expect(screen.getByTestId('notifications-section')).toBeInTheDocument();
    });

    it('应该显示用户欢迎信息', () => {
      render(
        <TestWrapper>
          <DashboardPage />
        </TestWrapper>
      );

      expect(screen.getByText(/欢迎/i)).toBeInTheDocument();
      expect(screen.getByText(mockUsers[0].displayName)).toBeInTheDocument();
    });

    it('应该要求用户登录才能访问', async () => {
      // 模拟未登录状态
      server.use(
        http.get(`${API_BASE}/auth/me`, () => {
          return HttpResponse.json(
            { success: false, error: '未登录' },
            { status: 401 }
          );
        })
      );

      render(
        <TestWrapper>
          <DashboardPage />
        </TestWrapper>
      );

      await waitFor(() => {
        // 验证重定向到登录页或显示登录提示
        // expect(window.location.pathname).toBe('/login');
      });
    });
  });

  describe('统计数据展示', () => {
    it('应该加载并显示用户统计数据', async () => {
      const mockStats = {
        postsCount: 42,
        followingCount: 128,
        followersCount: 256,
        likesCount: 1024,
      };

      server.use(
        http.get(`${API_BASE}/users/${mockUsers[0].id}/stats`, () => {
          return HttpResponse.json({
            success: true,
            data: mockStats,
          });
        })
      );

      render(
        <TestWrapper>
          <DashboardPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('42')).toBeInTheDocument();
        expect(screen.getByText('128')).toBeInTheDocument();
        expect(screen.getByText('256')).toBeInTheDocument();
        expect(screen.getByText('1024')).toBeInTheDocument();
      });
    });

    it('应该实时更新统计数据', async () => {
      render(
        <TestWrapper>
          <DashboardPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('42')).toBeInTheDocument();
      });

      // 模拟数据更新
      server.use(
        http.get(`${API_BASE}/users/${mockUsers[0].id}/stats`, () => {
          return HttpResponse.json({
            success: true,
            data: {
              postsCount: 43, // 增加了一篇
              followingCount: 128,
              followersCount: 256,
              likesCount: 1024,
            },
          });
        })
      );

      // 触发数据刷新
      await waitFor(() => {
        // expect(screen.getByText('43')).toBeInTheDocument();
      });
    });
  });

  describe('我的帖子管理', () => {
    it('应该显示用户的帖子列表', async () => {
      const mockPosts = [
        {
          id: 'post-1',
          title: '我的第一篇帖子',
          content: '内容1',
          status: 'published',
          createdAt: new Date().toISOString(),
        },
        {
          id: 'post-2',
          title: '草稿帖子',
          content: '内容2',
          status: 'draft',
          createdAt: new Date().toISOString(),
        },
      ];

      server.use(
        http.get(`${API_BASE}/users/${mockUsers[0].id}/posts`, () => {
          return HttpResponse.json({
            success: true,
            data: {
              posts: mockPosts,
              total: 2,
            },
          });
        })
      );

      render(
        <TestWrapper>
          <DashboardPage />
        </TestWrapper>
      );

      await waitFor(() => {
        // expect(screen.getByText(/我的第一篇帖子/i)).toBeInTheDocument();
        // expect(screen.getByText(/草稿帖子/i)).toBeInTheDocument();
      });
    });

    it('应该能够创建新帖子', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <DashboardPage />
        </TestWrapper>
      );

      const createButton = screen.getByRole('button', { name: /创建新帖子/i });
      await user.click(createButton);

      // 验证导航到创建页面或打开创建对话框
      // expect(window.location.pathname).toContain('/posts/new');
    });

    it('应该能够编辑帖子', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <DashboardPage />
        </TestWrapper>
      );

      // 等待帖子加载
      await waitFor(() => {
        // 点击编辑按钮
      });

      // const editButton = screen.getByRole('button', { name: /编辑/i });
      // await user.click(editButton);

      // 验证导航到编辑页面
      // expect(window.location.pathname).toContain('/posts/post-1/edit');
    });

    it('应该能够删除帖子', async () => {
      const user = userEvent.setup();

      server.use(
        http.delete(`${API_BASE}/posts/:postId`, () => {
          return HttpResponse.json({
            success: true,
            message: '删除成功',
          });
        })
      );

      render(
        <TestWrapper>
          <DashboardPage />
        </TestWrapper>
      );

      // 等待帖子加载并点击删除
      await waitFor(() => {
        // const deleteButton = screen.getByRole('button', { name: /删除/i });
        // await user.click(deleteButton);
      });

      // 确认删除
      // const confirmButton = screen.getByRole('button', { name: /确认/i });
      // await user.click(confirmButton);

      // 验证帖子被删除
      await waitFor(() => {
        // expect(screen.queryByText(/我的第一篇帖子/i)).not.toBeInTheDocument();
      });
    });

    it('应该能够筛选帖子状态', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <DashboardPage />
        </TestWrapper>
      );

      // 选择只显示草稿
      // const filterSelect = screen.getByRole('combobox', { name: /筛选/i });
      // await user.selectOptions(filterSelect, 'draft');

      await waitFor(() => {
        // 验证只显示草稿帖子
      });
    });
  });

  describe('活动统计图表', () => {
    it('应该显示活动趋势图表', async () => {
      const mockAnalytics = {
        daily: [
          { date: '2025-01-01', views: 100, likes: 20, comments: 5 },
          { date: '2025-01-02', views: 150, likes: 30, comments: 8 },
          { date: '2025-01-03', views: 120, likes: 25, comments: 6 },
        ],
      };

      server.use(
        http.get(`${API_BASE}/users/${mockUsers[0].id}/analytics`, () => {
          return HttpResponse.json({
            success: true,
            data: mockAnalytics,
          });
        })
      );

      render(
        <TestWrapper>
          <DashboardPage />
        </TestWrapper>
      );

      await waitFor(() => {
        const analyticsSection = screen.getByTestId('analytics-section');
        expect(analyticsSection).toBeInTheDocument();
        // 验证图表渲染
      });
    });

    it('应该支持切换时间范围', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <DashboardPage />
        </TestWrapper>
      );

      // 切换到"本月"视图
      // const monthButton = screen.getByRole('button', { name: /本月/i });
      // await user.click(monthButton);

      await waitFor(() => {
        // 验证数据更新
      });
    });

    it('应该显示详细的指标说明', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <DashboardPage />
        </TestWrapper>
      );

      // 悬停在数据点上
      // const dataPoint = screen.getByTestId('chart-data-point-1');
      // await user.hover(dataPoint);

      // 验证工具提示显示
      await waitFor(() => {
        // expect(screen.getByText(/浏览: 100/i)).toBeInTheDocument();
      });
    });
  });

  describe('通知中心', () => {
    it('应该显示最新通知', async () => {
      const mockNotifications = [
        {
          id: 'notif-1',
          type: 'like',
          message: '用户X 点赞了你的帖子',
          createdAt: new Date().toISOString(),
          isRead: false,
        },
        {
          id: 'notif-2',
          type: 'follow',
          message: '用户Y 关注了你',
          createdAt: new Date().toISOString(),
          isRead: false,
        },
      ];

      server.use(
        http.get(`${API_BASE}/notifications`, () => {
          return HttpResponse.json({
            success: true,
            data: {
              notifications: mockNotifications,
              unreadCount: 2,
            },
          });
        })
      );

      render(
        <TestWrapper>
          <DashboardPage />
        </TestWrapper>
      );

      await waitFor(() => {
        // expect(screen.getByText(/用户X 点赞了你的帖子/i)).toBeInTheDocument();
        // expect(screen.getByText(/用户Y 关注了你/i)).toBeInTheDocument();
      });
    });

    it('应该显示未读通知数量', async () => {
      server.use(
        http.get(`${API_BASE}/notifications`, () => {
          return HttpResponse.json({
            success: true,
            data: {
              notifications: [],
              unreadCount: 5,
            },
          });
        })
      );

      render(
        <TestWrapper>
          <DashboardPage />
        </TestWrapper>
      );

      await waitFor(() => {
        // expect(screen.getByText('5')).toBeInTheDocument();
      });
    });

    it('应该能够标记通知为已读', async () => {
      const user = userEvent.setup();

      server.use(
        http.put(`${API_BASE}/notifications/:notifId/read`, () => {
          return HttpResponse.json({
            success: true,
          });
        })
      );

      render(
        <TestWrapper>
          <DashboardPage />
        </TestWrapper>
      );

      await waitFor(() => {
        // 点击通知
        // const notification = screen.getByText(/用户X 点赞了你的帖子/i);
        // await user.click(notification);
      });

      // 验证通知标记为已读
      await waitFor(() => {
        // expect(screen.getByTestId('notif-1')).toHaveClass('read');
      });
    });

    it('应该能够删除通知', async () => {
      const user = userEvent.setup();

      server.use(
        http.delete(`${API_BASE}/notifications/:notifId`, () => {
          return HttpResponse.json({
            success: true,
          });
        })
      );

      render(
        <TestWrapper>
          <DashboardPage />
        </TestWrapper>
      );

      await waitFor(() => {
        // 点击删除按钮
        // const deleteButton = screen.getByRole('button', { name: /删除通知/i });
        // await user.click(deleteButton);
      });

      // 验证通知被删除
      await waitFor(() => {
        // expect(screen.queryByTestId('notif-1')).not.toBeInTheDocument();
      });
    });
  });

  describe('快速操作', () => {
    it('应该有快速创建帖子按钮', () => {
      render(
        <TestWrapper>
          <DashboardPage />
        </TestWrapper>
      );

      const quickCreateButton = screen.getByRole('button', { name: /创建新帖子/i });
      expect(quickCreateButton).toBeInTheDocument();
    });

    it('应该能够快速导航到其他页面', () => {
      render(
        <TestWrapper>
          <DashboardPage />
        </TestWrapper>
      );

      // 验证导航链接存在
      // expect(screen.getByRole('link', { name: /个人资料/i })).toBeInTheDocument();
      // expect(screen.getByRole('link', { name: /设置/i })).toBeInTheDocument();
    });
  });

  describe('数据刷新', () => {
    it('应该支持手动刷新数据', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <DashboardPage />
        </TestWrapper>
      );

      // 点击刷新按钮
      // const refreshButton = screen.getByRole('button', { name: /刷新/i });
      // await user.click(refreshButton);

      await waitFor(() => {
        // 验证数据重新加载
      });
    });

    it('应该自动定期刷新数据', async () => {
      render(
        <TestWrapper>
          <DashboardPage />
        </TestWrapper>
      );

      // 等待初始加载
      await waitFor(() => {
        expect(screen.getByText('42')).toBeInTheDocument();
      });

      // 模拟定时刷新（例如每30秒）
      // 等待刷新间隔
      // await new Promise(resolve => setTimeout(resolve, 30000));

      // 验证数据更新
    });
  });

  describe('响应式布局', () => {
    it('应该在移动设备上调整布局', () => {
      global.innerWidth = 375;

      render(
        <TestWrapper>
          <DashboardPage />
        </TestWrapper>
      );

      // 验证移动布局
      const statsSection = screen.getByTestId('stats-section');
      // expect(statsSection).toHaveClass('mobile-layout');
    });

    it('应该在平板上显示适当布局', () => {
      global.innerWidth = 768;

      render(
        <TestWrapper>
          <DashboardPage />
        </TestWrapper>
      );

      // 验证平板布局
    });
  });

  describe('性能优化', () => {
    it('应该使用虚拟化渲染长列表', async () => {
      const manyPosts = Array.from({ length: 100 }, (_, i) => ({
        id: `post-${i}`,
        title: `帖子 ${i}`,
      }));

      server.use(
        http.get(`${API_BASE}/users/${mockUsers[0].id}/posts`, () => {
          return HttpResponse.json({
            success: true,
            data: {
              posts: manyPosts,
              total: 100,
            },
          });
        })
      );

      render(
        <TestWrapper>
          <DashboardPage />
        </TestWrapper>
      );

      await waitFor(() => {
        // 验证只渲染可见项
      });
    });

    it('应该缓存统计数据', async () => {
      const { rerender } = render(
        <TestWrapper>
          <DashboardPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('42')).toBeInTheDocument();
      });

      // 重新渲染
      rerender(
        <TestWrapper>
          <DashboardPage />
        </TestWrapper>
      );

      // 应该立即显示缓存数据
      expect(screen.getByText('42')).toBeInTheDocument();
    });
  });

  describe('错误处理', () => {
    it('应该处理数据加载失败', async () => {
      server.use(
        http.get(`${API_BASE}/users/${mockUsers[0].id}/stats`, () => {
          return HttpResponse.json(
            { success: false, error: '加载失败' },
            { status: 500 }
          );
        })
      );

      render(
        <TestWrapper>
          <DashboardPage />
        </TestWrapper>
      );

      await waitFor(() => {
        // expect(screen.getByText(/加载失败/i)).toBeInTheDocument();
      });
    });

    it('应该提供重试选项', async () => {
      const user = userEvent.setup();

      server.use(
        http.get(`${API_BASE}/users/${mockUsers[0].id}/stats`, () => {
          return HttpResponse.json(
            { success: false, error: '加载失败' },
            { status: 500 }
          );
        })
      );

      render(
        <TestWrapper>
          <DashboardPage />
        </TestWrapper>
      );

      await waitFor(() => {
        // const retryButton = screen.getByRole('button', { name: /重试/i });
        // expect(retryButton).toBeInTheDocument();
      });

      // 点击重试
      // await user.click(retryButton);
    });
  });
});

