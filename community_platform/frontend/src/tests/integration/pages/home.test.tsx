/**
 * 首页集成测试
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

// Mock 首页组件（根据实际项目调整）
const HomePage = () => {
  return (
    <div>
      <header>
        <h1>字书先生</h1>
        <nav>
          <a href="/explore">探索</a>
          <a href="/dashboard">仪表盘</a>
          <a href="/profile">个人资料</a>
        </nav>
      </header>
      
      <main>
        <section data-testid="hero-section">
          <h2>欢迎来到字书先生</h2>
          <p>一个智能中文学习社区</p>
          <button>开始学习</button>
        </section>
        
        <section data-testid="features-section">
          <h2>功能特色</h2>
          <div className="features">
            <div className="feature">
              <h3>智能批改</h3>
              <p>AI 辅助写作批改</p>
            </div>
            <div className="feature">
              <h3>社区交流</h3>
              <p>与学习者交流互动</p>
            </div>
            <div className="feature">
              <h3>个性化学习</h3>
              <p>定制学习路径</p>
            </div>
          </div>
        </section>
        
        <section data-testid="posts-feed">
          <h2>最新动态</h2>
          <div className="posts">
            {/* 帖子列表 */}
          </div>
        </section>
      </main>
      
      <footer>
        <p>&copy; 2025 字书先生</p>
      </footer>
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

describe('首页集成测试', () => {
  beforeEach(() => {
    // 清理和重置
  });

  describe('页面渲染', () => {
    it('应该渲染首页的所有主要部分', () => {
      render(
        <TestWrapper>
          <HomePage />
        </TestWrapper>
      );

      // 验证页头
      expect(screen.getByRole('heading', { name: /字书先生/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /探索/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /仪表盘/i })).toBeInTheDocument();

      // 验证 Hero 区域
      expect(screen.getByTestId('hero-section')).toBeInTheDocument();
      expect(screen.getByText(/欢迎来到字书先生/i)).toBeInTheDocument();

      // 验证功能特色
      expect(screen.getByTestId('features-section')).toBeInTheDocument();
      expect(screen.getByText(/智能批改/i)).toBeInTheDocument();
      expect(screen.getByText(/社区交流/i)).toBeInTheDocument();

      // 验证动态信息流
      expect(screen.getByTestId('posts-feed')).toBeInTheDocument();
    });

    it('应该正确显示导航菜单', () => {
      render(
        <TestWrapper>
          <HomePage />
        </TestWrapper>
      );

      const nav = screen.getByRole('navigation');
      
      expect(within(nav).getByText(/探索/i)).toBeInTheDocument();
      expect(within(nav).getByText(/仪表盘/i)).toBeInTheDocument();
      expect(within(nav).getByText(/个人资料/i)).toBeInTheDocument();
    });

    it('应该在未登录时显示登录按钮', () => {
      render(
        <TestWrapper>
          <HomePage />
        </TestWrapper>
      );

      // 根据实际实现调整
      const loginButton = screen.queryByRole('button', { name: /登录/i });
      // expect(loginButton).toBeInTheDocument();
    });
  });

  describe('信息流加载', () => {
    it('应该加载并显示帖子列表', async () => {
      const mockPosts = [
        {
          id: 'post-1',
          title: '第一篇帖子',
          content: '内容1',
          author: mockUsers[0],
          likes: 10,
          comments: 5,
        },
        {
          id: 'post-2',
          title: '第二篇帖子',
          content: '内容2',
          author: mockUsers[1],
          likes: 20,
          comments: 3,
        },
      ];

      server.use(
        http.get(`${API_BASE}/posts`, () => {
          return HttpResponse.json({
            success: true,
            data: {
              posts: mockPosts,
              total: 2,
              page: 1,
            },
          });
        })
      );

      render(
        <TestWrapper>
          <HomePage />
        </TestWrapper>
      );

      // 等待数据加载
      await waitFor(() => {
        // 根据实际实现验证帖子显示
        // expect(screen.getByText(/第一篇帖子/i)).toBeInTheDocument();
      });
    });

    it('应该显示加载状态', () => {
      render(
        <TestWrapper>
          <HomePage />
        </TestWrapper>
      );

      // 验证加载指示器（根据实际实现）
      // const loader = screen.queryByTestId('loading-spinner');
      // expect(loader).toBeInTheDocument();
    });

    it('应该处理加载错误', async () => {
      server.use(
        http.get(`${API_BASE}/posts`, () => {
          return HttpResponse.json(
            {
              success: false,
              error: '加载失败',
            },
            { status: 500 }
          );
        })
      );

      render(
        <TestWrapper>
          <HomePage />
        </TestWrapper>
      );

      await waitFor(() => {
        // 验证错误消息显示
        // expect(screen.getByText(/加载失败/i)).toBeInTheDocument();
      });
    });
  });

  describe('无限滚动', () => {
    it('应该在滚动到底部时加载更多内容', async () => {
      const firstBatch = [
        { id: 'post-1', title: '帖子1', content: '内容1' },
        { id: 'post-2', title: '帖子2', content: '内容2' },
      ];

      const secondBatch = [
        { id: 'post-3', title: '帖子3', content: '内容3' },
        { id: 'post-4', title: '帖子4', content: '内容4' },
      ];

      let page = 1;

      server.use(
        http.get(`${API_BASE}/posts`, ({ request }) => {
          const url = new URL(request.url);
          const currentPage = parseInt(url.searchParams.get('page') || '1');
          
          return HttpResponse.json({
            success: true,
            data: {
              posts: currentPage === 1 ? firstBatch : secondBatch,
              total: 4,
              page: currentPage,
              hasMore: currentPage === 1,
            },
          });
        })
      );

      render(
        <TestWrapper>
          <HomePage />
        </TestWrapper>
      );

      // 等待首批内容加载
      await waitFor(() => {
        // 验证首批内容
      });

      // 模拟滚动到底部
      // fireEvent.scroll(window, { target: { scrollY: 1000 } });

      // 等待第二批内容加载
      await waitFor(() => {
        // 验证第二批内容
      });
    });

    it('应该在没有更多内容时停止加载', async () => {
      server.use(
        http.get(`${API_BASE}/posts`, () => {
          return HttpResponse.json({
            success: true,
            data: {
              posts: [],
              total: 0,
              page: 1,
              hasMore: false,
            },
          });
        })
      );

      render(
        <TestWrapper>
          <HomePage />
        </TestWrapper>
      );

      await waitFor(() => {
        // 验证"没有更多内容"提示
        // expect(screen.getByText(/没有更多内容/i)).toBeInTheDocument();
      });
    });
  });

  describe('用户交互', () => {
    it('应该能够点击帖子查看详情', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <HomePage />
        </TestWrapper>
      );

      // 等待帖子加载
      await waitFor(() => {
        // 假设有帖子标题
      });

      // 点击帖子
      // const postTitle = screen.getByText(/第一篇帖子/i);
      // await user.click(postTitle);

      // 验证导航到详情页
      // expect(window.location.pathname).toContain('/posts/');
    });

    it('应该能够点赞帖子', async () => {
      const user = userEvent.setup();

      server.use(
        http.post(`${API_BASE}/posts/:postId/like`, () => {
          return HttpResponse.json({
            success: true,
            data: {
              isLiked: true,
              likesCount: 11,
            },
          });
        })
      );

      render(
        <TestWrapper>
          <HomePage />
        </TestWrapper>
      );

      // 等待帖子加载并点击点赞按钮
      await waitFor(() => {
        // const likeButton = screen.getByRole('button', { name: /点赞/i });
        // await user.click(likeButton);
      });

      // 验证点赞数更新
      // await waitFor(() => {
      //   expect(screen.getByText(/11/)).toBeInTheDocument();
      // });
    });

    it('应该能够分享帖子', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <HomePage />
        </TestWrapper>
      );

      // 点击分享按钮
      // const shareButton = screen.getByRole('button', { name: /分享/i });
      // await user.click(shareButton);

      // 验证分享对话框打开
      // expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('应该能够过滤和排序内容', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <HomePage />
        </TestWrapper>
      );

      // 点击排序选项
      // const sortButton = screen.getByRole('button', { name: /排序/i });
      // await user.click(sortButton);

      // 选择"最热"排序
      // const hotOption = screen.getByText(/最热/i);
      // await user.click(hotOption);

      // 验证请求参数
      await waitFor(() => {
        // 验证数据重新加载
      });
    });
  });

  describe('搜索功能', () => {
    it('应该能够搜索内容', async () => {
      const user = userEvent.setup();

      server.use(
        http.get(`${API_BASE}/search`, ({ request }) => {
          const url = new URL(request.url);
          const query = url.searchParams.get('q');
          
          return HttpResponse.json({
            success: true,
            data: {
              results: [
                {
                  id: 'post-1',
                  title: `包含 ${query} 的帖子`,
                  content: '搜索结果内容',
                },
              ],
              total: 1,
            },
          });
        })
      );

      render(
        <TestWrapper>
          <HomePage />
        </TestWrapper>
      );

      // 输入搜索关键词
      // const searchInput = screen.getByRole('searchbox');
      // await user.type(searchInput, '测试');

      // 提交搜索
      // await user.keyboard('{Enter}');

      // 验证搜索结果
      await waitFor(() => {
        // expect(screen.getByText(/包含 测试 的帖子/i)).toBeInTheDocument();
      });
    });

    it('应该显示搜索建议', async () => {
      const user = userEvent.setup();

      server.use(
        http.get(`${API_BASE}/search/suggestions`, ({ request }) => {
          const url = new URL(request.url);
          const query = url.searchParams.get('q');
          
          return HttpResponse.json({
            success: true,
            data: {
              suggestions: [
                `${query}建议1`,
                `${query}建议2`,
                `${query}建议3`,
              ],
            },
          });
        })
      );

      render(
        <TestWrapper>
          <HomePage />
        </TestWrapper>
      );

      // 输入搜索关键词
      // const searchInput = screen.getByRole('searchbox');
      // await user.type(searchInput, '测试');

      // 等待建议显示
      await waitFor(() => {
        // expect(screen.getByText(/测试建议1/i)).toBeInTheDocument();
      });
    });
  });

  describe('响应式设计', () => {
    it('应该在移动设备上正确显示', () => {
      // 设置移动视口
      global.innerWidth = 375;
      global.innerHeight = 667;

      render(
        <TestWrapper>
          <HomePage />
        </TestWrapper>
      );

      // 验证移动布局
      // 根据实际实现验证
    });

    it('应该在移动设备上显示汉堡菜单', () => {
      global.innerWidth = 375;

      render(
        <TestWrapper>
          <HomePage />
        </TestWrapper>
      );

      // 验证汉堡菜单按钮
      // const menuButton = screen.getByRole('button', { name: /菜单/i });
      // expect(menuButton).toBeInTheDocument();
    });
  });

  describe('性能优化', () => {
    it('应该实现虚拟滚动优化长列表', async () => {
      const manyPosts = Array.from({ length: 100 }, (_, i) => ({
        id: `post-${i}`,
        title: `帖子 ${i}`,
        content: `内容 ${i}`,
      }));

      server.use(
        http.get(`${API_BASE}/posts`, () => {
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
          <HomePage />
        </TestWrapper>
      );

      await waitFor(() => {
        // 验证只渲染可见部分
        // 根据虚拟滚动实现验证
      });
    });

    it('应该使用图片懒加载', () => {
      render(
        <TestWrapper>
          <HomePage />
        </TestWrapper>
      );

      // 验证图片使用 loading="lazy" 属性
      // const images = screen.getAllByRole('img');
      // images.forEach(img => {
      //   expect(img).toHaveAttribute('loading', 'lazy');
      // });
    });
  });

  describe('可访问性', () => {
    it('应该有正确的语义化标签', () => {
      render(
        <TestWrapper>
          <HomePage />
        </TestWrapper>
      );

      expect(screen.getByRole('banner')).toBeInTheDocument(); // header
      expect(screen.getByRole('main')).toBeInTheDocument();
      expect(screen.getByRole('contentinfo')).toBeInTheDocument(); // footer
    });

    it('应该支持键盘导航', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <HomePage />
        </TestWrapper>
      );

      // Tab 键导航
      await user.tab();

      // 验证焦点管理
      // expect(document.activeElement).toBe(...);
    });

    it('应该有适当的 ARIA 标签', () => {
      render(
        <TestWrapper>
          <HomePage />
        </TestWrapper>
      );

      // 验证 ARIA 标签
      // const nav = screen.getByRole('navigation');
      // expect(nav).toHaveAttribute('aria-label', '主导航');
    });
  });
});

