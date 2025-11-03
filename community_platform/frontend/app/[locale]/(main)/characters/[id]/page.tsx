/**
 * 角色详情页面
 * @route /characters/[id]
 */

'use client';

import { use } from 'react';
import { useRouter } from 'next/navigation';
import {
  useCharacter,
  useDeleteCharacter,
  useCloneCharacter,
  useArchiveCharacter,
  useCharacterDownload,
} from '@/features/character/hooks';
import { useAuth } from '@/features/auth/hooks';
import {
  Button,
  Badge,
  Separator,
  Card,
} from '@/shared/components';
import { LoadingSpinner, EmptyState, Avatar } from '@/shared/components/common';
import { 
  Edit,
  Trash2,
  Copy,
  Archive,
  Share2,
  Download,
  Heart,
  Star,
  Eye,
  Calendar,
  User,
  ArrowLeft,
  Sparkles,
  MessageCircle,
} from 'lucide-react';
import { CharacterDetail } from '@/features/character/components/CharacterDetail';
import { useToast } from '@/shared/hooks/use-toast';
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
import { useState } from 'react';
import Link from 'next/link';
import { formatDate, formatNumber } from '@/shared/utils/format';

interface CharacterDetailPageProps {
  params: Promise<{ id: string }>;
}

/**
 * 角色详情页面组件
 */
export default function CharacterDetailPage({ params }: CharacterDetailPageProps) {
  const resolvedParams = use(params);
  const characterId = parseInt(resolvedParams.id, 10);
  const router = useRouter();
  const { toast } = useToast();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  
  // 调试信息
  console.log('[角色详情页] 认证状态:', {
    isAuthenticated,
    authLoading,
    hasUser: !!user,
    userId: user?.id,
    userEmail: user?.email
  });
  
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showArchiveDialog, setShowArchiveDialog] = useState(false);

  // 获取角色数据
  const { data: character, isLoading, error, refetch } = useCharacter(characterId);

  // Mutations
  const deleteCharacter = useDeleteCharacter();
  const cloneCharacter = useCloneCharacter();
  const archiveCharacter = useArchiveCharacter();
  
  // 下载功能
  const { downloadCharacter, isPackaging, progress } = useCharacterDownload();

  // 检查是否是角色创建者
  const isOwner = user?.id === character?.creatorId;

  // 处理编辑
  const handleEdit = () => {
    router.push(`/characters/${characterId}/edit`);
  };

  // 处理删除
  const handleDelete = async () => {
    try {
      await deleteCharacter.mutateAsync(characterId);
      toast({
        title: '成功',
        description: '角色已删除',
      });
      router.push('/profile/characters');
    } catch (error: any) {
      toast({
        title: '错误',
        description: error.message || '删除失败',
        variant: 'destructive',
      });
    }
  };

  // 处理克隆
  const handleClone = async () => {
    try {
      const clonedCharacter = await cloneCharacter.mutateAsync(characterId);
      toast({
        title: '成功',
        description: '角色已克隆',
      });
      router.push(`/characters/${clonedCharacter.id}/edit`);
    } catch (error: any) {
      toast({
        title: '错误',
        description: error.message || '克隆失败',
        variant: 'destructive',
      });
    }
  };

  // 处理归档
  const handleArchive = async () => {
    try {
      await archiveCharacter.mutateAsync(characterId);
      toast({
        title: '成功',
        description: '角色已归档',
      });
      setShowArchiveDialog(false);
      refetch();
    } catch (error: any) {
      toast({
        title: '错误',
        description: error.message || '归档失败',
        variant: 'destructive',
      });
    }
  };

  // 处理分享
  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast({
        title: '成功',
        description: '链接已复制到剪贴板',
      });
    } catch (error) {
      toast({
        title: '错误',
        description: '复制失败',
        variant: 'destructive',
      });
    }
  };

  // 处理下载
  const handleDownload = async () => {
    if (!character) return;
    await downloadCharacter(character);
  };

  // 渲染加载状态
  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center py-20">
          <LoadingSpinner size="lg" />
        </div>
      </div>
    );
  }

  // 渲染错误状态
  if (error || !character) {
    return (
      <div className="container mx-auto px-4 py-8">
        <EmptyState
          title="加载失败"
          description={error?.message || '无法找到该角色'}
          action={{
            label: '返回列表',
            onClick: () => router.push('/characters'),
          }}
        />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* 返回按钮 */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => router.back()}
        className="mb-6"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        返回
      </Button>

      {/* 角色头部信息 */}
      <div className="relative mb-8">
        {/* 封面图 */}
        {character.coverUrl && (
          <div className="relative w-full h-64 md:h-80 rounded-lg overflow-hidden mb-6">
            <img
              src={character.coverUrl}
              alt={character.displayName || character.name}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          </div>
        )}

        {/* 角色基本信息 */}
        <div className="flex flex-col md:flex-row gap-6 items-start">
          {/* 头像 */}
          <Avatar
            src={character.avatarUrl}
            alt={character.displayName || character.name}
            fallback={character.name}
            size="2xl"
            className="ring-4 ring-white shadow-xl"
          />

          {/* 信息 */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-2">
                  <h1 className="text-3xl font-bold truncate">
                    {character.displayName || character.name}
                  </h1>
                  {character.published && (
                    <Badge variant="default" className="bg-green-100 text-green-700">
                      已发布
                    </Badge>
                  )}
                  {!character.published && (
                    <Badge variant="outline" className="bg-gray-100 text-gray-700">
                      草稿
                    </Badge>
                  )}
                  {character.adapters.some(a => a.type === 'intelligent') && (
                    <Badge variant="default" className="gap-1">
                      <Sparkles className="h-3 w-3" />
                      智能
                    </Badge>
                  )}
                </div>

                {/* 创建者信息 */}
                <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
                  <div className="flex items-center gap-1">
                    <User className="h-4 w-4" />
                    <Link 
                      href={`/users/${character.creatorId}`}
                      className="hover:underline"
                    >
                      {character.creatorName || '未知用户'}
                    </Link>
                  </div>
                  <div className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    {formatDate(character.createdAt)}
                  </div>
                </div>

                {/* 描述 */}
                <p className="text-muted-foreground mb-4">
                  {character.description}
                </p>

                {/* 标签 */}
                {character.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {character.tags.map((tag) => (
                      <Badge key={tag} variant="secondary">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              {/* 操作按钮 */}
              <div className="flex flex-col gap-2 min-w-fit">
                {isOwner ? (
                  <>
                    <Button onClick={handleEdit} className="gap-2">
                      <Edit className="h-4 w-4" />
                      编辑
                    </Button>
                    <Button variant="outline" onClick={handleClone} className="gap-2">
                      <Copy className="h-4 w-4" />
                      克隆
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={() => setShowArchiveDialog(true)}
                      className="gap-2"
                    >
                      <Archive className="h-4 w-4" />
                      归档
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={() => setShowDeleteDialog(true)}
                      className="gap-2 text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                      删除
                    </Button>
                  </>
                ) : (
                  <>
                    <Button 
                      onClick={handleDownload} 
                      className="gap-2"
                      disabled={isPackaging || authLoading || !isAuthenticated}
                      title={!isAuthenticated ? '请先登录后下载' : undefined}
                    >
                      <Download className="h-4 w-4" />
                      {authLoading ? '加载中...' : 
                       !isAuthenticated ? '登录后下载' : 
                       (isPackaging ? `打包中 ${progress}%` : '下载使用')}
                    </Button>
                    <Button variant="outline" onClick={handleClone} className="gap-2">
                      <Copy className="h-4 w-4" />
                      克隆定制
                    </Button>
                    <Button variant="outline" onClick={handleShare} className="gap-2">
                      <Share2 className="h-4 w-4" />
                      分享
                    </Button>
                  </>
                )}
              </div>
            </div>

            {/* 统计信息 */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <Card className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Download className="h-4 w-4" />
                  <span className="text-xs">下载</span>
                </div>
                <div className="text-2xl font-bold">
                  {formatNumber(character.stats.downloads)}
                </div>
              </Card>
              <Card className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Heart className="h-4 w-4" />
                  <span className="text-xs">收藏</span>
                </div>
                <div className="text-2xl font-bold">
                  {formatNumber(character.stats.favorites)}
                </div>
              </Card>
              <Card className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Star className="h-4 w-4" />
                  <span className="text-xs">评分</span>
                </div>
                <div className="text-2xl font-bold">
                  {character.stats.rating.toFixed(1)}
                </div>
              </Card>
              <Card className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <MessageCircle className="h-4 w-4" />
                  <span className="text-xs">评论</span>
                </div>
                <div className="text-2xl font-bold">
                  {formatNumber(character.stats.comments)}
                </div>
              </Card>
              <Card className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Eye className="h-4 w-4" />
                  <span className="text-xs">浏览</span>
                </div>
                <div className="text-2xl font-bold">
                  {formatNumber(character.stats.views)}
                </div>
              </Card>
            </div>
          </div>
        </div>
      </div>

      <Separator className="my-8" />

      {/* 详细内容 */}
      <CharacterDetail character={character} />

      {/* 删除确认对话框 */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除？</AlertDialogTitle>
            <AlertDialogDescription>
              此操作无法撤销。角色"{character.displayName || character.name}"将被永久删除。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 归档确认对话框 */}
      <AlertDialog open={showArchiveDialog} onOpenChange={setShowArchiveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认归档？</AlertDialogTitle>
            <AlertDialogDescription>
              归档后，角色将不会在公开列表中显示，但仍可以在你的个人中心找到。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleArchive}>
              归档
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

