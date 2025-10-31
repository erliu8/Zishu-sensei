/**
 * Followers Page
 * 粉丝列表页面
 */

'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Users } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import { FollowerList } from '@/features/social/components/FollowerList';
import { FollowingList } from '@/features/social/components/FollowingList';
import { useAuth } from '@/features/auth/hooks/useAuth';

/**
 * FollowersPage Component
 */
export default function FollowersPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();

  // 未登录重定向
  React.useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login?redirect=/profile/followers');
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
            <Users className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">粉丝与关注</h1>
            <p className="text-muted-foreground">
              管理你的粉丝和关注列表
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="followers" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="followers">粉丝</TabsTrigger>
          <TabsTrigger value="following">关注</TabsTrigger>
        </TabsList>

        <TabsContent value="followers" className="mt-6">
          <FollowerList
            userId={user.id}
            currentUserId={user.id}
            showHeader={false}
            pageSize={20}
            onUserClick={handleUserClick}
          />
        </TabsContent>

        <TabsContent value="following" className="mt-6">
          <FollowingList
            userId={user.id}
            currentUserId={user.id}
            showHeader={false}
            pageSize={20}
            onUserClick={handleUserClick}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

