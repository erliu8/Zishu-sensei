/**
 * 用户主页
 * @route /users/[id]
 */

'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useUserProfile, useUserStats } from '@/features/user/hooks/useUser';
import { ProfileHeader } from '@/features/user/components/ProfileHeader';
import { ProfileStats } from '@/features/user/components/ProfileStats';
import { ProfileTabs } from '@/features/user/components/ProfileTabs';
import { LoadingSpinner } from '@/shared/components/ui/loading-spinner';
import { EmptyState } from '@/shared/components/ui/empty-state';
import { toast } from '@/shared/components/ui/use-toast';
import { useAuthStore } from '@/features/auth/store';

export default function UserProfilePage() {
  const params = useParams();
  const router = useRouter();
  const userId = params['id'] as string;
  const [activeTab, setActiveTab] = useState('posts');
  const [isFollowing, setIsFollowing] = useState(false);

  const { user: currentUser } = useAuthStore();
  const { user, isLoading: userLoading, error } = useUserProfile(userId);
  const { stats, isLoading: statsLoading } = useUserStats(userId);

  const isCurrentUser = currentUser?.id === userId; 

  const handleFollow = async () => {
    try {
      // TODO: 调用关注API
      setIsFollowing(true);
      toast({
        title: '成功',
        description: `已关注 ${user?.name || user?.username}`,
      });
    } catch (error) {
      toast({
        title: '错误',
        description: '关注失败',
        variant: 'destructive',
      });
    }
  };

  const handleUnfollow = async () => {
    try {
      // TODO: 调用取消关注API
      setIsFollowing(false);
      toast({
        title: '成功',
        description: `已取消关注 ${user?.name || user?.username}`,
      });
    } catch (error) {
      toast({
        title: '错误',
        description: '取消关注失败',
        variant: 'destructive',
      });
    }
  };

  const handleStatsClick = (type: string) => {
    setActiveTab(type);
  };

  if (userLoading || statsLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="container mx-auto py-16">
        <EmptyState
          title="用户不存在"
          description="抱歉，我们找不到这个用户"
          action={{
            label: '返回首页',
            onClick: () => router.push('/'),
          }}
        />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* 用户头部 */}
      <ProfileHeader
        user={user}
        isCurrentUser={isCurrentUser}
        isFollowing={isFollowing}
        onFollow={handleFollow}
        onUnfollow={handleUnfollow}
      />

      {/* 统计信息 */}
      {stats && <ProfileStats stats={stats} onStatsClick={handleStatsClick} />}

      {/* 内容标签页 */}
      <ProfileTabs activeTab={activeTab} onTabChange={setActiveTab} showActivity={false} />

      {/* 内容区域 */}
      <div className="min-h-[400px]">
        {activeTab === 'posts' && (
          <EmptyState title="暂无帖子" description="该用户还没有发布任何帖子" />
        )}
        {activeTab === 'adapters' && (
          <EmptyState title="暂无适配器" description="该用户还没有上传任何适配器" />
        )}
        {activeTab === 'characters' && (
          <EmptyState title="暂无角色" description="该用户还没有创建任何角色" />
        )}
        {activeTab === 'likes' && (
          <EmptyState title="暂无点赞" description="该用户还没有点赞任何内容" />
        )}
        {activeTab === 'favorites' && (
          <EmptyState title="暂无收藏" description="该用户还没有收藏任何内容" />
        )}
      </div>
    </div>
  );
}

