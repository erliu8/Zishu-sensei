/**
 * Favorite Characters Page
 * 收藏的角色页面
 */

'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  User,
  Search,
  Filter,
  Trash2,
  Loader2,
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
import { EmptyState } from '@/shared/components/common/EmptyState';
import { LoadingSpinner } from '@/shared/components/common/LoadingSpinner';
import { Pagination } from '@/shared/components/common/Pagination';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useUserFavorites, useRemoveFavorite } from '@/features/social/hooks/useFavorite';
import { FavoriteTargetType } from '@/features/social/domain/Favorite';
import { FavoriteCharacterCard } from '@/features/social/components';
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
 * FavoriteCharactersPage Component
 */
export default function FavoriteCharactersPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'createdAt' | 'updatedAt'>('createdAt');
  const [mbtiFilter, setMbtiFilter] = useState<string>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<{
    ids: string[];
    names: string[];
  } | null>(null);

  const pageSize = 12;

  const removeMutation = useRemoveFavorite();

  // 未登录重定向
  React.useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login?redirect=/profile/favorites/characters');
    }
  }, [isAuthenticated, router]);

  // 获取收藏列表
  const {
    data: favoritesData,
    isLoading,
    error,
  } = useUserFavorites(
    (user as any)?.id || 'current',
    FavoriteTargetType.CHARACTER,
    page,
    pageSize
  );

  const favorites = favoritesData?.items || [];
  const totalPages = favoritesData?.totalPages || 1;

  // 获取所有MBTI类型
  const mbtiTypes = useMemo(() => {
    const types = new Set<string>();
    favorites.forEach((favorite) => {
      if (favorite.targetCharacter?.personality?.mbti) {
        types.add(favorite.targetCharacter.personality.mbti);
      }
    });
    return Array.from(types).sort();
  }, [favorites]);

  // 搜索、筛选和排序
  const filteredFavorites = useMemo(() => {
    let result = [...favorites];

    // 搜索
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter((favorite) => {
        const character = favorite.targetCharacter;
        return (
          character?.name?.toLowerCase().includes(query) ||
          character?.title?.toLowerCase().includes(query) ||
          character?.description?.toLowerCase().includes(query) ||
          character?.personality?.traits?.some((trait) =>
            trait.toLowerCase().includes(query)
          )
        );
      });
    }

    // MBTI筛选
    if (mbtiFilter !== 'all') {
      result = result.filter(
        (favorite) => favorite.targetCharacter?.personality?.mbti === mbtiFilter
      );
    }

    // 排序
    result.sort((a, b) => {
      const dateA = new Date(a[sortBy]).getTime();
      const dateB = new Date(b[sortBy]).getTime();
      return dateB - dateA; // 降序
    });

    return result;
  }, [favorites, searchQuery, mbtiFilter, sortBy]);

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
    setRemoveTarget({ ids: [targetId], names: [name] });
    setRemoveDialogOpen(true);
  };

  const handleBatchRemove = () => {
    const targets = filteredFavorites.filter((f) => selectedIds.has(f.id));
    setRemoveTarget({
      ids: targets.map((f) => f.targetId),
      names: targets.map((f) => f.targetCharacter?.name || '此角色'),
    });
    setRemoveDialogOpen(true);
  };

  const handleConfirmRemove = async () => {
    if (!removeTarget) return;

    try {
      for (const targetId of removeTarget.ids) {
        await removeMutation.mutateAsync({
          targetType: FavoriteTargetType.CHARACTER,
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
  const handleCardClick = (id: string) => {
    router.push(`/characters/${id}`);
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
              <User className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">收藏的角色</h1>
              <p className="text-muted-foreground">
                共 {favoritesData?.total || 0} 个收藏
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="mb-6 space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜索名称、描述或性格..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* MBTI Filter */}
          {mbtiTypes.length > 0 && (
            <Select value={mbtiFilter} onValueChange={setMbtiFilter}>
              <SelectTrigger className="w-full sm:w-[160px]">
                <SelectValue placeholder="MBTI类型" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部类型</SelectItem>
                {mbtiTypes.map((mbti) => (
                  <SelectItem key={mbti} value={mbti}>
                    {mbti}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

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
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearSelection}
              >
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
              <Badge variant="secondary">
                已选择 {selectedIds.size} 项
              </Badge>
            )}
          </div>
        )}
      </div>

      {/* Content */}
      {isLoading ? (
        <LoadingSpinner />
      ) : error ? (
        <EmptyState
          icon={<User className="w-full h-full" />}
          title="加载失败"
          description="无法加载收藏列表，请稍后重试"
        />
      ) : filteredFavorites.length === 0 ? (
        <EmptyState
          icon={<User className="w-full h-full" />}
          title={searchQuery || mbtiFilter !== 'all' ? '没有找到相关角色' : '暂无收藏'}
          description={
            searchQuery || mbtiFilter !== 'all'
              ? '试试其他搜索条件'
              : '还没有收藏任何角色'
          }
          action={
            searchQuery || mbtiFilter !== 'all'
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
                {/* Selection Checkbox */}
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
                  onClick={() => handleCardClick(favorite.targetId)}
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

      {/* Remove Confirmation Dialog */}
      <AlertDialog open={removeDialogOpen} onOpenChange={setRemoveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认取消收藏</AlertDialogTitle>
            <AlertDialogDescription>
              {removeTarget && removeTarget.ids.length > 1 ? (
                <>
                  确定要从收藏中移除这 <span className="font-semibold">{removeTarget.ids.length}</span> 个角色吗？
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

