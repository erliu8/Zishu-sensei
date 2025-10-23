/**
 * 个人主页
 * @route /profile
 */

'use client';

import { useState } from 'react';
import { useCurrentUser, useUserStats, useUploadAvatar } from '@/features/user/hooks/useUser';
import { ProfileHeader } from '@/features/user/components/ProfileHeader';
import { ProfileStats } from '@/features/user/components/ProfileStats';
import { ProfileTabs } from '@/features/user/components/ProfileTabs';
import { LoadingSpinner } from '@/shared/components/ui/loading-spinner';
import { EmptyState } from '@/shared/components/ui/empty-state';
import { useRouter } from 'next/navigation';
import { toast } from '@/shared/components/ui/use-toast';

export default function ProfilePage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('posts');
  
  const { user, isLoading: userLoading } = useCurrentUser();
  const { stats, isLoading: statsLoading } = useUserStats();
  const uploadAvatar = useUploadAvatar();

  const handleChangeAvatar = async (file: File) => {
    try {
      await uploadAvatar.mutateAsync(file);
      toast({
        title: '成功',
        description: '头像更新成功',
      });
    } catch (error) {
      toast({
        title: '错误',
        description: '头像更新失败',
        variant: 'destructive',
      });
    }
  };

  const handleEditProfile = () => {
    router.push('/profile/settings/profile');
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

  if (!user) {
    return (
      <EmptyState
        title="未找到用户"
        description="请先登录"
        action={{
          label: '去登录',
          onClick: () => router.push('/login'),
        }}
      />
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* 用户头部 */}
      <ProfileHeader
        user={user}
        isCurrentUser={true}
        onEditProfile={handleEditProfile}
        onChangeAvatar={handleChangeAvatar}
      />

      {/* 统计信息 */}
      {stats && <ProfileStats stats={stats} onStatsClick={handleStatsClick} />}

      {/* 内容标签页 */}
      <ProfileTabs activeTab={activeTab} onTabChange={setActiveTab} showActivity={true} />

      {/* 内容区域 */}
      <div className="min-h-[400px]">
        {activeTab === 'posts' && (
          <EmptyState
            title="暂无帖子"
            description="你还没有发布任何帖子"
            action={{
              label: '创建帖子',
              onClick: () => router.push('/posts/create'),
            }}
          />
        )}
        {activeTab === 'adapters' && (
          <EmptyState
            title="暂无适配器"
            description="你还没有上传任何适配器"
            action={{
              label: '上传适配器',
              onClick: () => router.push('/adapters/upload'),
            }}
          />
        )}
        {activeTab === 'characters' && (
          <EmptyState
            title="暂无角色"
            description="你还没有创建任何角色"
            action={{
              label: '创建角色',
              onClick: () => router.push('/characters/create'),
            }}
          />
        )}
        {activeTab === 'likes' && (
          <EmptyState title="暂无点赞" description="你还没有点赞任何内容" />
        )}
        {activeTab === 'favorites' && (
          <EmptyState title="暂无收藏" description="你还没有收藏任何内容" />
        )}
        {activeTab === 'activity' && (
          <EmptyState title="暂无活动" description="暂时没有活动记录" />
        )}
      </div>
    </div>
  );
}

