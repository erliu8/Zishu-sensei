/**
 * Favorites Page
 * 收藏页面 - 支持帖子、适配器、角色
 */

'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Star,
  FileText,
  Package,
  User,
  Loader2,
  Search,
  Filter,
  Trash2,
  CheckSquare,
  Square,
  X,
} from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import { EmptyState } from '@/shared/components/common/EmptyState';
import { LoadingSpinner } from '@/shared/components/common/LoadingSpinner';
import { Pagination } from '@/shared/components/common/Pagination';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useUserFavorites, useRemoveFavorite } from '@/features/social/hooks/useFavorite';
import { FavoriteTargetType } from '@/features/social/domain/Favorite';
import {
  FavoritePostCard,
  FavoriteAdapterCard,
  FavoriteCharacterCard,
} from '@/features/social/components';
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
import { Badge } from '@/shared/components/ui/badge';

/**
 * FavoritesPage Component
 */
export default function FavoritesPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();
  const [activeTab, setActiveTab] = useState<FavoriteTargetType>(FavoriteTargetType.POST);
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'createdAt' | 'updatedAt'>('createdAt');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<{
    targetType: FavoriteTargetType;
    ids: string[];
    names: string[];
  } | null>(null);

  const pageSize = 12;

  const removeMutation = useRemoveFavorite();

  // 未登录重定向
  React.useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login?redirect=/profile/favorites');
    }
  }, [isAuthenticated, router]);

  // 获取收藏列表
  const {
    data: favoritesData,
    isLoading,
    error,
  } = useUserFavorites(
    (user as any)?.id || 'current',
    activeTab,
    page,
    pageSize
  );

  const favorites = favoritesData?.items || [];
  const totalPages = favoritesData?.totalPages || 1;

  // 搜索和排序
  const filteredFavorites = useMemo(() => {
    let result = [...favorites];

    // 搜索
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter((favorite) => {
        if (activeTab === FavoriteTargetType.POST) {
          const post = favorite.targetPost;
          return (
            post?.title?.toLowerCase().includes(query) ||
            post?.content?.toLowerCase().includes(query)
          );
        } else if (activeTab === FavoriteTargetType.ADAPTER) {
          const adapter = favorite.targetAdapter;
          return (
            adapter?.name?.toLowerCase().includes(query) ||
            adapter?.description?.toLowerCase().includes(query)
          );
        } else {
          const character = favorite.targetCharacter;
          return (
            character?.name?.toLowerCase().includes(query) ||
            character?.description?.toLowerCase().includes(query)
          );
        }
      });
    }

    // 排序
    result.sort((a, b) => {
      const dateA = new Date(a[sortBy]).getTime();
      const dateB = new Date(b[sortBy]).getTime();
      return dateB - dateA;
    });

    return result;
  }, [favorites, searchQuery, sortBy, activeTab]);

  // Tab切换时重置页码和搜索
  const handleTabChange = (value: string) => {
    setActiveTab(value as FavoriteTargetType);
    setPage(1);
    setSearchQuery('');
    setSelectedIds(new Set());
  };

  // 批量选择
  const handleToggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedIds.size === filteredFavorites.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredFavorites.map((f) => f.id)));
    }
  };

  const handleClearSelection = () => {
    setSelectedIds(new Set());
  };

  // 删除收藏
  const handleRemoveClick = (targetId: string, name: string) => {
    setRemoveTarget({ targetType: activeTab, ids: [targetId], names: [name] });
    setRemoveDialogOpen(true);
  };

  const handleBatchRemove = () => {
    const targets = filteredFavorites.filter((f) => selectedIds.has(f.id));
    let names: string[];
    if (activeTab === FavoriteTargetType.POST) {
      names = targets.map((f) => f.targetPost?.title || '此帖子');
    } else if (activeTab === FavoriteTargetType.ADAPTER) {
      names = targets.map((f) => f.targetAdapter?.name || '此适配器');
    } else {
      names = targets.map((f) => f.targetCharacter?.name || '此角色');
    }
    setRemoveTarget({
      targetType: activeTab,
      ids: targets.map((f) => f.targetId),
      names,
    });
    setRemoveDialogOpen(true);
  };

  const handleConfirmRemove = async () => {
    if (!removeTarget) return;

    try {
      for (const targetId of removeTarget.ids) {
        await removeMutation.mutateAsync({
          targetType: removeTarget.targetType,
          targetId,
        });
      }
      setSelectedIds(new Set());
    } finally {
      setRemoveDialogOpen(false);
      setRemoveTarget(null);
    }
  };

  // 导航到详情页
  const handleCardClick = (type: FavoriteTargetType, id: string) => {
    const routes = {
      [FavoriteTargetType.POST]: `/posts/${id}`,
      [FavoriteTargetType.ADAPTER]: `/adapters/${id}`,
      [FavoriteTargetType.CHARACTER]: `/characters/${id}`,
    };
    router.push(routes[type]);
  };

  if (!user) {
    return null;
  }

  const isSelectionMode = selectedIds.size > 0;
  const allSelected = selectedIds.size === filteredFavorites.length && filteredFavorites.length > 0;

  return (
    <div className="container max-w-6xl mx-auto py-8 px-4">
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
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Star className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">我的收藏</h1>
              <p className="text-muted-foreground">
                管理你收藏的帖子、适配器和角色
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value={FavoriteTargetType.POST} className="gap-2">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">帖子</span>
          </TabsTrigger>
          <TabsTrigger value={FavoriteTargetType.ADAPTER} className="gap-2">
            <Package className="h-4 w-4" />
            <span className="hidden sm:inline">适配器</span>
          </TabsTrigger>
          <TabsTrigger value={FavoriteTargetType.CHARACTER} className="gap-2">
            <User className="h-4 w-4" />
            <span className="hidden sm:inline">角色</span>
          </TabsTrigger>
        </TabsList>

        {/* Toolbar */}
        <div className="mt-6 mb-4 space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="搜索收藏内容..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Sort */}
            <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="createdAt">最新收藏</SelectItem>
                <SelectItem value="updatedAt">最近更新</SelectItem>
              </SelectContent>
            </Select>

            {/* Batch Actions */}
            {isSelectionMode && (
              <div className="flex gap-2">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleBatchRemove}
                  disabled={removeMutation.isPending}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  删除 ({selectedIds.size})
                </Button>
                <Button variant="outline" size="sm" onClick={handleClearSelection}>
                  <X className="h-4 w-4 mr-2" />
                  取消
                </Button>
              </div>
            )}
          </div>

          {/* Selection Bar */}
          {filteredFavorites.length > 0 && (
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSelectAll}
                className="h-8"
              >
                {allSelected ? (
                  <CheckSquare className="h-4 w-4 mr-2" />
                ) : (
                  <Square className="h-4 w-4 mr-2" />
                )}
                {allSelected ? '取消全选' : '全选'}
              </Button>
              {isSelectionMode && (
                <Badge variant="secondary">已选择 {selectedIds.size} 项</Badge>
              )}
            </div>
          )}
        </div>

        {/* Posts Tab */}
        <TabsContent value={FavoriteTargetType.POST} className="mt-6">
          {isLoading ? (
            <LoadingSpinner />
          ) : error ? (
            <EmptyState
              icon={FileText}
              title="加载失败"
              description="无法加载收藏列表，请稍后重试"
            />
          ) : filteredFavorites.length === 0 ? (
            <EmptyState
              icon={Star}
              title={searchQuery ? '没有找到相关帖子' : '暂无收藏'}
              description={searchQuery ? '试试其他搜索词' : '还没有收藏任何帖子'}
              action={
                searchQuery
                  ? undefined
                  : {
                      label: '去发现',
                      onClick: () => router.push('/posts'),
                    }
              }
            />
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredFavorites.map((favorite) => (
                  <div key={favorite.id} className="relative">
                    <div
                      className="absolute top-2 left-2 z-10 cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleSelect(favorite.id);
                      }}
                    >
                      <div
                        className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                          selectedIds.has(favorite.id)
                            ? 'bg-primary border-primary'
                            : 'bg-background border-muted-foreground/50 hover:border-primary'
                        }`}
                      >
                        {selectedIds.has(favorite.id) && (
                          <CheckSquare className="h-4 w-4 text-primary-foreground" />
                        )}
                      </div>
                    </div>
                    <FavoritePostCard
                      favorite={favorite}
                      onClick={() => handleCardClick(FavoriteTargetType.POST, favorite.targetId)}
                      onRemove={() =>
                        handleRemoveClick(
                          favorite.targetId,
                          favorite.targetPost?.title || '此帖子'
                        )
                      }
                    />
                  </div>
                ))}
              </div>

              {totalPages > 1 && (
                <div className="pt-4">
                  <Pagination
                    currentPage={page}
                    totalPages={totalPages}
                    onPageChange={setPage}
                  />
                </div>
              )}
            </div>
          )}
        </TabsContent>

        {/* Adapters Tab */}
        <TabsContent value={FavoriteTargetType.ADAPTER} className="mt-6">
          {isLoading ? (
            <LoadingSpinner />
          ) : error ? (
            <EmptyState
              icon={Package}
              title="加载失败"
              description="无法加载收藏列表，请稍后重试"
            />
          ) : filteredFavorites.length === 0 ? (
            <EmptyState
              icon={Star}
              title={searchQuery ? '没有找到相关适配器' : '暂无收藏'}
              description={searchQuery ? '试试其他搜索词' : '还没有收藏任何适配器'}
              action={
                searchQuery
                  ? undefined
                  : {
                      label: '去市场',
                      onClick: () => router.push('/adapters'),
                    }
              }
            />
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredFavorites.map((favorite) => (
                  <div key={favorite.id} className="relative">
                    <div
                      className="absolute top-2 left-2 z-10 cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleSelect(favorite.id);
                      }}
                    >
                      <div
                        className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                          selectedIds.has(favorite.id)
                            ? 'bg-primary border-primary'
                            : 'bg-background border-muted-foreground/50 hover:border-primary'
                        }`}
                      >
                        {selectedIds.has(favorite.id) && (
                          <CheckSquare className="h-4 w-4 text-primary-foreground" />
                        )}
                      </div>
                    </div>
                    <FavoriteAdapterCard
                      favorite={favorite}
                      onClick={() => handleCardClick(FavoriteTargetType.ADAPTER, favorite.targetId)}
                      onRemove={() =>
                        handleRemoveClick(
                          favorite.targetId,
                          favorite.targetAdapter?.name || '此适配器'
                        )
                      }
                    />
                  </div>
                ))}
              </div>

              {totalPages > 1 && (
                <div className="pt-4">
                  <Pagination
                    currentPage={page}
                    totalPages={totalPages}
                    onPageChange={setPage}
                  />
                </div>
              )}
            </div>
          )}
        </TabsContent>

        {/* Characters Tab */}
        <TabsContent value={FavoriteTargetType.CHARACTER} className="mt-6">
          {isLoading ? (
            <LoadingSpinner />
          ) : error ? (
            <EmptyState
              icon={User}
              title="加载失败"
              description="无法加载收藏列表，请稍后重试"
            />
          ) : filteredFavorites.length === 0 ? (
            <EmptyState
              icon={Star}
              title={searchQuery ? '没有找到相关角色' : '暂无收藏'}
              description={searchQuery ? '试试其他搜索词' : '还没有收藏任何角色'}
              action={
                searchQuery
                  ? undefined
                  : {
                      label: '去发现',
                      onClick: () => router.push('/characters'),
                    }
              }
            />
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredFavorites.map((favorite) => (
                  <div key={favorite.id} className="relative">
                    <div
                      className="absolute top-2 left-2 z-10 cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleSelect(favorite.id);
                      }}
                    >
                      <div
                        className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                          selectedIds.has(favorite.id)
                            ? 'bg-primary border-primary'
                            : 'bg-background border-muted-foreground/50 hover:border-primary'
                        }`}
                      >
                        {selectedIds.has(favorite.id) && (
                          <CheckSquare className="h-4 w-4 text-primary-foreground" />
                        )}
                      </div>
                    </div>
                    <FavoriteCharacterCard
                      favorite={favorite}
                      onClick={() => handleCardClick(FavoriteTargetType.CHARACTER, favorite.targetId)}
                      onRemove={() =>
                        handleRemoveClick(
                          favorite.targetId,
                          favorite.targetCharacter?.name || '此角色'
                        )
                      }
                    />
                  </div>
                ))}
              </div>

              {totalPages > 1 && (
                <div className="pt-4">
                  <Pagination
                    currentPage={page}
                    totalPages={totalPages}
                    onPageChange={setPage}
                  />
                </div>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Remove Confirmation Dialog */}
      <AlertDialog open={removeDialogOpen} onOpenChange={setRemoveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认取消收藏</AlertDialogTitle>
            <AlertDialogDescription>
              {removeTarget && removeTarget.ids.length > 1 ? (
                <>
                  确定要从收藏中移除这 <span className="font-semibold">{removeTarget.ids.length}</span> 项吗？
                  此操作无法撤销。
                </>
              ) : (
                <>
                  确定要从收藏中移除{' '}
                  <span className="font-semibold">{removeTarget?.names[0]}</span> 吗？
                  此操作无法撤销。
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removeMutation.isPending}>
              取消
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmRemove}
              disabled={removeMutation.isPending}
              className="bg-destructive hover:bg-destructive/90"
            >
              {removeMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  移除中...
                </>
              ) : (
                '确认移除'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

