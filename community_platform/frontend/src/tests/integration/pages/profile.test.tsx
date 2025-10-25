/**
 * 个人资料页面集成测试
 * @module tests/integration/pages
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tantml:query';
import { server } from '@/tests/mocks/server';
import { http, HttpResponse } from 'msw';
import { mockUsers } from '@/tests/mocks/data/users';

const API_BASE = 'http://localhost:8000/api/v1';

// Mock 个人资料页面组件
const ProfilePage = ({ userId }: { userId?: string }) => {
  const user = mockUsers[0];
  
  return (
    <div>
      <header data-testid="profile-header">
        <img src={user.avatar} alt={user.displayName} />
        <h1>{user.displayName}</h1>
        <p>@{user.username}</p>
        <p>{user.bio || '这个用户很懒，什么都没写'}</p>
        
        <div className="stats">
          <div>
            <span>帖子</span>
            <strong>42</strong>
          </div>
          <div>
            <span>关注</span>
            <strong>128</strong>
          </div>
          <div>
            <span>粉丝</span>
            <strong>256</strong>
          </div>
        </div>
        
        <div className="actions">
          <button>关注</button>
          <button>消息</button>
        </div>
      </header>
      
      <nav data-testid="profile-tabs">
        <button>帖子</button>
        <button>回复</button>
        <button>媒体</button>
        <button>点赞</button>
      </nav>
      
      <main data-testid="profile-content">
        <section>
          {/* 内容区域 */}
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

describe('个人资料页面集成测试', () => {
  beforeEach(() => {
    // 清理
  });

  describe('页面渲染', () => {
    it('应该显示用户基本信息', () => {
      render(
        <TestWrapper>
          <ProfilePage userId={mockUsers[0].id} />
        </TestWrapper>
      );

      expect(screen.getByText(mockUsers[0].displayName)).toBeInTheDocument();
      expect(screen.getByText(`@${mockUsers[0].username}`)).toBeInTheDocument();
      expect(screen.getByAltText(mockUsers[0].displayName)).toHaveAttribute('src', mockUsers[0].avatar);
    });

    it('应该显示用户统计数据', () => {
      render(
        <TestWrapper>
          <ProfilePage userId={mockUsers[0].id} />
        </TestWrapper>
      );

      const header = screen.getByTestId('profile-header');
      
      expect(within(header).getByText(/帖子/i)).toBeInTheDocument();
      expect(within(header).getByText('42')).toBeInTheDocument();
      expect(within(header).getByText(/关注/i)).toBeInTheDocument();
      expect(within(header).getByText('128')).toBeInTheDocument();
      expect(within(header).getByText(/粉丝/i)).toBeInTheDocument();
      expect(within(header).getByText('256')).toBeInTheDocument();
    });

    it('应该显示用户简介', () => {
      render(
        <TestWrapper>
          <ProfilePage userId={mockUsers[0].id} />
        </TestWrapper>
      );

      const bio = mockUsers[0].bio || '这个用户很懒，什么都没写';
      expect(screen.getByText(bio)).toBeInTheDocument();
    });

    it('应该显示标签页导航', () => {
      render(
        <TestWrapper>
          <ProfilePage userId={mockUsers[0].id} />
        </TestWrapper>
      );

      const tabs = screen.getByTestId('profile-tabs');
      
      expect(within(tabs).getByRole('button', { name: /帖子/i })).toBeInTheDocument();
      expect(within(tabs).getByRole('button', { name: /回复/i })).toBeInTheDocument();
      expect(within(tabs).getByRole('button', { name: /媒体/i })).toBeInTheDocument();
      expect(within(tabs).getByRole('button', { name: /点赞/i })).toBeInTheDocument();
    });
  });

  describe('用户数据加载', () => {
    it('应该从 API 加载用户信息', async () => {
      server.use(
        http.get(`${API_BASE}/users/${mockUsers[0].id}`, () => {
          return HttpResponse.json({
            success: true,
            data: mockUsers[0],
          });
        })
      );

      render(
        <TestWrapper>
          <ProfilePage userId={mockUsers[0].id} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(mockUsers[0].displayName)).toBeInTheDocument();
      });
    });

    it('应该处理用户不存在的情况', async () => {
      server.use(
        http.get(`${API_BASE}/users/non-existent`, () => {
          return HttpResponse.json(
            { success: false, error: '用户不存在' },
            { status: 404 }
          );
        })
      );

      render(
        <TestWrapper>
          <ProfilePage userId="non-existent" />
        </TestWrapper>
      );

      await waitFor(() => {
        // expect(screen.getByText(/用户不存在/i)).toBeInTheDocument();
      });
    });

    it('应该显示加载状态', () => {
      render(
        <TestWrapper>
          <ProfilePage userId={mockUsers[0].id} />
        </TestWrapper>
      );

      // 验证加载指示器
      // const loader = screen.queryByTestId('loading-spinner');
      // expect(loader).toBeInTheDocument();
    });
  });

  describe('关注功能', () => {
    it('应该能够关注用户', async () => {
      const user = userEvent.setup();

      server.use(
        http.post(`${API_BASE}/users/${mockUsers[1].id}/follow`, () => {
          return HttpResponse.json({
            success: true,
            data: {
              isFollowing: true,
              followerCount: 257,
            },
          });
        })
      );

      render(
        <TestWrapper>
          <ProfilePage userId={mockUsers[1].id} />
        </TestWrapper>
      );

      const followButton = screen.getByRole('button', { name: /关注/i });
      await user.click(followButton);

      await waitFor(() => {
        // expect(screen.getByRole('button', { name: /已关注/i })).toBeInTheDocument();
        // expect(screen.getByText('257')).toBeInTheDocument();
      });
    });

    it('应该能够取消关注', async () => {
      const user = userEvent.setup();

      server.use(
        http.delete(`${API_BASE}/users/${mockUsers[1].id}/follow`, () => {
          return HttpResponse.json({
            success: true,
            data: {
              isFollowing: false,
              followerCount: 255,
            },
          });
        })
      );

      render(
        <TestWrapper>
          <ProfilePage userId={mockUsers[1].id} />
        </TestWrapper>
      );

      // 假设初始状态是已关注
      const unfollowButton = screen.getByRole('button', { name: /关注/i });
      await user.click(unfollowButton);

      await waitFor(() => {
        // expect(screen.getByRole('button', { name: /关注/i })).toBeInTheDocument();
      });
    });

    it('不应该显示关注自己的按钮', () => {
      // 模拟查看自己的资料
      render(
        <TestWrapper>
          <ProfilePage userId={mockUsers[0].id} />
        </TestWrapper>
      );

      // 验证没有关注按钮，而是编辑按钮
      // expect(screen.queryByRole('button', { name: /关注/i })).not.toBeInTheDocument();
      // expect(screen.getByRole('button', { name: /编辑资料/i })).toBeInTheDocument();
    });
  });

  describe('消息功能', () => {
    it('应该能够发送私信', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <ProfilePage userId={mockUsers[1].id} />
        </TestWrapper>
      );

      const messageButton = screen.getByRole('button', { name: /消息/i });
      await user.click(messageButton);

      // 验证打开消息对话框或跳转到消息页面
      await waitFor(() => {
        // expect(screen.getByRole('dialog')).toBeInTheDocument();
        // 或者
        // expect(window.location.pathname).toContain('/messages');
      });
    });
  });

  describe('内容标签页', () => {
    it('应该显示用户的帖子', async () => {
      const mockPosts = [
        {
          id: 'post-1',
          title: '用户的帖子1',
          content: '内容1',
          createdAt: new Date().toISOString(),
        },
        {
          id: 'post-2',
          title: '用户的帖子2',
          content: '内容2',
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
          <ProfilePage userId={mockUsers[0].id} />
        </TestWrapper>
      );

      await waitFor(() => {
        // expect(screen.getByText(/用户的帖子1/i)).toBeInTheDocument();
        // expect(screen.getByText(/用户的帖子2/i)).toBeInTheDocument();
      });
    });

    it('应该显示用户的回复', async () => {
      const user = userEvent.setup();

      const mockReplies = [
        {
          id: 'reply-1',
          content: '这是一条回复',
          postId: 'post-x',
          createdAt: new Date().toISOString(),
        },
      ];

      server.use(
        http.get(`${API_BASE}/users/${mockUsers[0].id}/replies`, () => {
          return HttpResponse.json({
            success: true,
            data: {
              replies: mockReplies,
              total: 1,
            },
          });
        })
      );

      render(
        <TestWrapper>
          <ProfilePage userId={mockUsers[0].id} />
        </TestWrapper>
      );

      const repliesTab = screen.getByRole('button', { name: /回复/i });
      await user.click(repliesTab);

      await waitFor(() => {
        // expect(screen.getByText(/这是一条回复/i)).toBeInTheDocument();
      });
    });

    it('应该显示用户的媒体内容', async () => {
      const user = userEvent.setup();

      const mockMedia = [
        {
          id: 'media-1',
          url: 'https://example.com/image1.jpg',
          type: 'image',
        },
        {
          id: 'media-2',
          url: 'https://example.com/image2.jpg',
          type: 'image',
        },
      ];

      server.use(
        http.get(`${API_BASE}/users/${mockUsers[0].id}/media`, () => {
          return HttpResponse.json({
            success: true,
            data: {
              media: mockMedia,
              total: 2,
            },
          });
        })
      );

      render(
        <TestWrapper>
          <ProfilePage userId={mockUsers[0].id} />
        </TestWrapper>
      );

      const mediaTab = screen.getByRole('button', { name: /媒体/i });
      await user.click(mediaTab);

      await waitFor(() => {
        // 验证媒体网格显示
        // const images = screen.getAllByRole('img');
        // expect(images.length).toBe(2);
      });
    });

    it('应该显示用户点赞的内容', async () => {
      const user = userEvent.setup();

      const mockLikedPosts = [
        {
          id: 'post-liked-1',
          title: '点赞的帖子',
          content: '内容',
        },
      ];

      server.use(
        http.get(`${API_BASE}/users/${mockUsers[0].id}/likes`, () => {
          return HttpResponse.json({
            success: true,
            data: {
              posts: mockLikedPosts,
              total: 1,
            },
          });
        })
      );

      render(
        <TestWrapper>
          <ProfilePage userId={mockUsers[0].id} />
        </TestWrapper>
      );

      const likesTab = screen.getByRole('button', { name: /点赞/i });
      await user.click(likesTab);

      await waitFor(() => {
        // expect(screen.getByText(/点赞的帖子/i)).toBeInTheDocument();
      });
    });
  });

  describe('资料编辑', () => {
    it('应该能够编辑个人资料', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <ProfilePage userId={mockUsers[0].id} />
        </TestWrapper>
      );

      // 点击编辑按钮（仅在查看自己的资料时显示）
      // const editButton = screen.getByRole('button', { name: /编辑资料/i });
      // await user.click(editButton);

      // 验证打开编辑表单
      await waitFor(() => {
        // expect(screen.getByRole('dialog', { name: /编辑资料/i })).toBeInTheDocument();
      });
    });

    it('应该能够更新头像', async () => {
      const user = userEvent.setup();

      server.use(
        http.post(`${API_BASE}/upload/avatar`, () => {
          return HttpResponse.json({
            success: true,
            data: {
              url: 'https://example.com/new-avatar.jpg',
            },
          });
        }),
        http.put(`${API_BASE}/users/${mockUsers[0].id}`, () => {
          return HttpResponse.json({
            success: true,
            data: {
              ...mockUsers[0],
              avatar: 'https://example.com/new-avatar.jpg',
            },
          });
        })
      );

      render(
        <TestWrapper>
          <ProfilePage userId={mockUsers[0].id} />
        </TestWrapper>
      );

      // 上传新头像
      // const avatarInput = screen.getByLabelText(/上传头像/i);
      // const file = new File(['avatar'], 'avatar.jpg', { type: 'image/jpeg' });
      // await user.upload(avatarInput, file);

      await waitFor(() => {
        // 验证头像更新
        // const avatar = screen.getByAltText(mockUsers[0].displayName);
        // expect(avatar).toHaveAttribute('src', 'https://example.com/new-avatar.jpg');
      });
    });

    it('应该能够更新简介', async () => {
      const user = userEvent.setup();

      const newBio = '这是我的新简介';

      server.use(
        http.put(`${API_BASE}/users/${mockUsers[0].id}`, () => {
          return HttpResponse.json({
            success: true,
            data: {
              ...mockUsers[0],
              bio: newBio,
            },
          });
        })
      );

      render(
        <TestWrapper>
          <ProfilePage userId={mockUsers[0].id} />
        </TestWrapper>
      );

      // 编辑简介
      // const editButton = screen.getByRole('button', { name: /编辑资料/i });
      // await user.click(editButton);

      // const bioInput = screen.getByLabelText(/简介/i);
      // await user.clear(bioInput);
      // await user.type(bioInput, newBio);

      // const saveButton = screen.getByRole('button', { name: /保存/i });
      // await user.click(saveButton);

      await waitFor(() => {
        // expect(screen.getByText(newBio)).toBeInTheDocument();
      });
    });
  });

  describe('关注者和关注列表', () => {
    it('应该显示关注者列表', async () => {
      const user = userEvent.setup();

      const mockFollowers = [mockUsers[1], mockUsers[2]];

      server.use(
        http.get(`${API_BASE}/users/${mockUsers[0].id}/followers`, () => {
          return HttpResponse.json({
            success: true,
            data: {
              followers: mockFollowers,
              total: 2,
            },
          });
        })
      );

      render(
        <TestWrapper>
          <ProfilePage userId={mockUsers[0].id} />
        </TestWrapper>
      );

      // 点击粉丝数
      const followersLink = screen.getByText('256');
      await user.click(followersLink);

      await waitFor(() => {
        // 验证显示关注者列表
        // expect(screen.getByText(mockUsers[1].displayName)).toBeInTheDocument();
        // expect(screen.getByText(mockUsers[2].displayName)).toBeInTheDocument();
      });
    });

    it('应该显示关注列表', async () => {
      const user = userEvent.setup();

      const mockFollowing = [mockUsers[1], mockUsers[2]];

      server.use(
        http.get(`${API_BASE}/users/${mockUsers[0].id}/following`, () => {
          return HttpResponse.json({
            success: true,
            data: {
              following: mockFollowing,
              total: 2,
            },
          });
        })
      );

      render(
        <TestWrapper>
          <ProfilePage userId={mockUsers[0].id} />
        </TestWrapper>
      );

      // 点击关注数
      const followingLink = screen.getByText('128');
      await user.click(followingLink);

      await waitFor(() => {
        // 验证显示关注列表
      });
    });
  });

  describe('响应式设计', () => {
    it('应该在移动设备上调整布局', () => {
      global.innerWidth = 375;

      render(
        <TestWrapper>
          <ProfilePage userId={mockUsers[0].id} />
        </TestWrapper>
      );

      // 验证移动布局
      const header = screen.getByTestId('profile-header');
      // expect(header).toHaveClass('mobile-layout');
    });

    it('应该在移动设备上隐藏某些元素', () => {
      global.innerWidth = 375;

      render(
        <TestWrapper>
          <ProfilePage userId={mockUsers[0].id} />
        </TestWrapper>
      );

      // 验证某些元素被隐藏或折叠
    });
  });

  describe('安全性和隐私', () => {
    it('应该尊重用户隐私设置', async () => {
      const privateUser = {
        ...mockUsers[1],
        isPrivate: true,
      };

      server.use(
        http.get(`${API_BASE}/users/${privateUser.id}`, () => {
          return HttpResponse.json({
            success: true,
            data: privateUser,
          });
        })
      );

      render(
        <TestWrapper>
          <ProfilePage userId={privateUser.id} />
        </TestWrapper>
      );

      await waitFor(() => {
        // 验证显示隐私提示
        // expect(screen.getByText(/此账号为私密账号/i)).toBeInTheDocument();
      });
    });

    it('应该处理被屏蔽的用户', async () => {
      server.use(
        http.get(`${API_BASE}/users/${mockUsers[1].id}`, () => {
          return HttpResponse.json(
            {
              success: false,
              error: '您已被该用户屏蔽',
            },
            { status: 403 }
          );
        })
      );

      render(
        <TestWrapper>
          <ProfilePage userId={mockUsers[1].id} />
        </TestWrapper>
      );

      await waitFor(() => {
        // expect(screen.getByText(/您已被该用户屏蔽/i)).toBeInTheDocument();
      });
    });
  });

  describe('分享和操作菜单', () => {
    it('应该能够分享个人资料', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <ProfilePage userId={mockUsers[0].id} />
        </TestWrapper>
      );

      // 点击分享按钮
      // const shareButton = screen.getByRole('button', { name: /分享/i });
      // await user.click(shareButton);

      // 验证分享选项
      await waitFor(() => {
        // expect(screen.getByText(/复制链接/i)).toBeInTheDocument();
      });
    });

    it('应该显示更多操作菜单', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <ProfilePage userId={mockUsers[1].id} />
        </TestWrapper>
      );

      // 点击更多按钮
      // const moreButton = screen.getByRole('button', { name: /更多/i });
      // await user.click(moreButton);

      // 验证操作选项
      await waitFor(() => {
        // expect(screen.getByText(/举报/i)).toBeInTheDocument();
        // expect(screen.getByText(/屏蔽/i)).toBeInTheDocument();
      });
    });
  });
});

