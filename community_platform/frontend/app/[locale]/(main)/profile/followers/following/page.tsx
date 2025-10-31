/**
 * Following Page
 * 关注列表页面
 */

'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, UserCheck } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { FollowingList } from '@/features/social/components/FollowingList';
import { useAuth } from '@/features/auth/hooks/useAuth';

/**
 * FollowingPage Component
 */
export default function FollowingPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();

  // 未登录重定向
  React.useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login?redirect=/profile/followers/following');
    }
  }, [isAuthenticated, router]);

  if (!user) {
    return null;
  }

  const handleUserClick = (userId: string) => {
    router.push(`/users/${userId}`);
  };

  return (
    <div className="container max-w-4xl mx-auto py-8 px-4">
      {/* Header */}
      <div className="mb-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.back()}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          返回
        </Button>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <UserCheck className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">我的关注</h1>
            <p className="text-muted-foreground">
              管理你关注的用户
            </p>
          </div>
        </div>
      </div>

      {/* Following List */}
      <FollowingList
        userId={user.id}
        currentUserId={user.id}
        showHeader={true}
        title="关注列表"
        description="你关注的所有用户"
        pageSize={20}
        onUserClick={handleUserClick}
      />
    </div>
  );
}

