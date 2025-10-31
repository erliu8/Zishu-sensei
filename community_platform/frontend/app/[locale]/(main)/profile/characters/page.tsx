/**
 * 我的角色页面
 * @route /profile/characters
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/shared/components/ui/button';
import { Card } from '@/shared/components/ui/card';
import { EmptyState } from '@/shared/components/ui/empty-state';
import { useAuthStore } from '@/features/auth/store';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/components/ui/alert-dialog';
import { useToast } from '@/shared/hooks/use-toast';
import { Plus, Loader2 } from 'lucide-react';
import {
  useMyCharacters,
  useDeleteCharacter,
  usePublishCharacter,
  useUnpublishCharacter,
  useArchiveCharacter,
} from '@/features/character/hooks';
import { CharacterCard, CharacterCardSkeleton } from '@/features/character/components/CharacterCard';
import type { Character } from '@/features/character/domain';

export default function MyCharactersPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading } = useAuthStore();
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; character?: Character }>({
    open: false,
  });

  // 检查登录状态
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      toast({
        title: '请先登录',
        description: '查看我的角色需要登录账号',
        variant: 'destructive',
      });
      router.push('/login');
    }
  }, [isAuthenticated, authLoading, router, toast]);

  // 获取我的角色列表
  const { data: response, isLoading, error, refetch } = useMyCharacters();
  const characters = response?.items || [];

  // 删除角色
  const deleteMutation = useDeleteCharacter();
  
  // 发布/取消发布
  const publishMutation = usePublishCharacter();
  const unpublishMutation = useUnpublishCharacter();
  
  // 归档
  const archiveMutation = useArchiveCharacter();

  // 处理编辑
  const handleEdit = (character: Character) => {
    router.push(`/characters/${character.id}/edit`);
  };

  // 处理克隆
  const handleClone = async (_character: Character) => {
    // TODO: 实现克隆功能
    toast({
      title: '功能开发中',
      description: '克隆功能即将推出',
    });
  };

  // 处理发布/取消发布
  const handleTogglePublish = async (character: Character) => {
    try {
      if (character.published) {
        await unpublishMutation.mutateAsync(character.id);
        toast({
          title: '取消发布成功',
          description: `角色"${character.displayName || character.name}"已设为草稿`,
        });
      } else {
        await publishMutation.mutateAsync({ id: character.id });
        toast({
          title: '发布成功',
          description: `角色"${character.displayName || character.name}"已发布到角色广场`,
        });
      }
      refetch();
    } catch (error) {
      toast({
        title: character.published ? '取消发布失败' : '发布失败',
        description: error instanceof Error ? error.message : '操作失败，请重试',
        variant: 'destructive',
      });
    }
  };

  // 处理归档
  const handleArchive = async (character: Character) => {
    try {
      await archiveMutation.mutateAsync(character.id);
      toast({
        title: '归档成功',
        description: `角色"${character.displayName || character.name}"已归档`,
      });
      refetch();
    } catch (error) {
      toast({
        title: '归档失败',
        description: error instanceof Error ? error.message : '归档失败，请重试',
        variant: 'destructive',
      });
    }
  };

  // 处理删除确认
  const handleDeleteConfirm = async () => {
    if (!deleteDialog.character) return;

    try {
      await deleteMutation.mutateAsync(deleteDialog.character.id);
      toast({
        title: '删除成功',
        description: `角色"${deleteDialog.character.displayName || deleteDialog.character.name}"已删除`,
      });
      setDeleteDialog({ open: false });
      refetch();
    } catch (error) {
      toast({
        title: '删除失败',
        description: error instanceof Error ? error.message : '删除失败，请重试',
        variant: 'destructive',
      });
    }
  };

  // 等待认证检查
  if (authLoading) {
    return (
      <div className="container mx-auto py-8">
        <div className="max-w-5xl mx-auto">
          <Card className="p-12">
            <div className="flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          </Card>
        </div>
      </div>
    );
  }

  // 未登录
  if (!isAuthenticated) {
    return null; // 会被 useEffect 重定向
  }

  // 错误状态
  if (error) {
    // 如果是401错误，说明token过期，需要重新登录
    const errorMessage = error instanceof Error ? error.message : '无法加载角色列表';
    const isAuthError = errorMessage.includes('401') || errorMessage.includes('未授权') || errorMessage.includes('Unauthorized');
    
    return (
      <div className="container mx-auto py-8">
        <div className="max-w-5xl mx-auto">
          <Card className="p-12">
            <EmptyState
              title={isAuthError ? '登录已过期' : '加载失败'}
              description={isAuthError ? '您的登录已过期，请重新登录' : errorMessage}
              action={{
                label: isAuthError ? '重新登录' : '重试',
                onClick: () => isAuthError ? router.push('/login') : refetch(),
              }}
            />
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* 页面头部 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">我的角色</h1>
            <p className="text-muted-foreground mt-2">管理你创建的所有角色</p>
          </div>
          <Button onClick={() => router.push('/characters/create')}>
            <Plus className="h-4 w-4 mr-2" />
            创建角色
          </Button>
        </div>

        {/* 加载状态 */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <CharacterCardSkeleton key={i} />
            ))}
          </div>
        ) : characters.length === 0 ? (
          /* 空状态 */
          <Card className="p-12">
            <EmptyState
              title="暂无角色"
              description="你还没有创建任何角色，立即创建你的第一个 AI 角色吧！"
              action={{
                label: '创建第一个角色',
                onClick: () => router.push('/characters/create'),
              }}
            />
          </Card>
        ) : (
          /* 角色列表 */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {characters.map((character) => (
              <div key={character.id} className="relative">
                <CharacterCard
                  character={character}
                  isEditable
                  showActions
                  onClick={() => router.push(`/characters/${character.id}`)}
                  onEdit={handleEdit}
                  onDelete={(char) => setDeleteDialog({ open: true, character: char })}
                  onClone={handleClone}
                  onArchive={handleArchive}
                />
                
                {/* 发布/取消发布按钮 */}
                <div className="mt-2">
                  <Button
                    variant={character.published ? 'outline' : 'default'}
                    size="sm"
                    className="w-full"
                    onClick={() => handleTogglePublish(character)}
                    disabled={publishMutation.isPending || unpublishMutation.isPending}
                  >
                    {(publishMutation.isPending || unpublishMutation.isPending) && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    {character.published ? '取消发布' : '发布到广场'}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 删除确认对话框 */}
      <AlertDialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ open })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              你确定要删除角色 "{deleteDialog.character?.displayName || deleteDialog.character?.name}" 吗？
              此操作不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-red-600 hover:bg-red-700"
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
