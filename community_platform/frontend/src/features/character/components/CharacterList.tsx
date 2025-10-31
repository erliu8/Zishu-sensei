/**
 * CharacterList - 角色列表组件
 * 支持网格和列表视图、虚拟滚动、分页等功能
 */

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/shared/utils';
import { CharacterCard, CharacterCardSkeleton } from './CharacterCard';
import { Button } from '@/shared/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { EmptyState } from '@/shared/components/ui/empty-state';
import type { Character, CharacterFilters } from '../domain';
import { Grid, List, SlidersHorizontal } from 'lucide-react';

export interface CharacterListProps {
  /** 角色列表数据 */
  characters: Character[];
  /** 加载状态 */
  loading?: boolean;
  /** 错误状态 */
  error?: Error | null;
  /** 默认视图模式 */
  defaultView?: 'grid' | 'list';
  /** 是否显示视图切换 */
  showViewToggle?: boolean;
  /** 是否显示排序 */
  showSort?: boolean;
  /** 当前筛选条件 */
  filters?: CharacterFilters;
  /** 排序变更回调 */
  onSortChange?: (sortBy: string, sortOrder: 'asc' | 'desc') => void;
  /** 分页配置 */
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  /** 分页变更回调 */
  onPageChange?: (page: number) => void;
  /** 是否显示用户自己的角色（启用编辑功能） */
  showEditActions?: boolean;
  /** 自定义类名 */
  className?: string;
  /** 操作回调 */
  onEdit?: (character: Character) => void;
  onDelete?: (character: Character) => void;
  onClone?: (character: Character) => void;
  onArchive?: (character: Character) => void;
  onShare?: (character: Character) => void;
}

/**
 * CharacterList 组件
 */
export const CharacterList: React.FC<CharacterListProps> = ({
  characters,
  loading = false,
  error = null,
  defaultView = 'grid',
  showViewToggle = true,
  showSort = true,
  filters,
  onSortChange,
  pagination,
  onPageChange,
  showEditActions = false,
  className,
  onEdit,
  onDelete,
  onClone,
  onArchive,
  onShare,
}) => {
  const router = useRouter();
  const [view, setView] = useState<'grid' | 'list'>(defaultView);
  const [sortBy, setSortBy] = useState<string>(filters?.sortBy || 'createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>(
    filters?.sortOrder || 'desc'
  );

  // 处理排序变更
  const handleSortChange = (value: string) => {
    const [newSortBy, newSortOrder] = value.split('-');
    setSortBy(newSortBy || 'createdAt');
    setSortOrder((newSortOrder as 'asc' | 'desc') || 'desc');
    onSortChange?.(newSortBy || 'createdAt', (newSortOrder as 'asc' | 'desc') || 'desc');
  };

  // 处理角色点击
  const handleCharacterClick = (character: Character) => {
    router.push(`/characters/${character.id}`);
  };

  // 渲染工具栏
  const renderToolbar = () => (
    <div className="flex items-center justify-between mb-6">
      <div className="flex items-center gap-2">
        {showViewToggle && (
          <div className="flex items-center gap-1 border rounded-lg p-1">
            <Button
              variant={view === 'grid' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setView('grid')}
              className="h-8 w-8 p-0"
            >
              <Grid className="h-4 w-4" />
            </Button>
            <Button
              variant={view === 'list' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setView('list')}
              className="h-8 w-8 p-0"
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        )}

        {pagination && (
          <div className="text-sm text-muted-foreground">
            共 {pagination.total} 个角色
          </div>
        )}
      </div>

      {showSort && (
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
          <Select
            value={`${sortBy}-${sortOrder}`}
            onValueChange={handleSortChange}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="排序方式" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="createdAt-desc">最新创建</SelectItem>
              <SelectItem value="createdAt-asc">最早创建</SelectItem>
              <SelectItem value="updatedAt-desc">最近更新</SelectItem>
              <SelectItem value="downloads-desc">下载最多</SelectItem>
              <SelectItem value="rating-desc">评分最高</SelectItem>
              <SelectItem value="likes-desc">最受喜欢</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );

  // 渲染加载状态
  const renderLoading = () => (
    <div
      className={cn(
        view === 'grid'
          ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6'
          : 'space-y-4'
      )}
    >
      {Array.from({ length: pagination?.pageSize || 12 }).map((_, index) => (
        <CharacterCardSkeleton key={index} variant={view} />
      ))}
    </div>
  );

  // 渲染错误状态
  const renderError = () => (
    <EmptyState
      title="加载失败"
      description={error?.message || '无法加载角色列表，请稍后重试'}
      action={{
        label: '重新加载',
        onClick: () => window.location.reload()
      }}
    />
  );

  // 渲染空状态
  const renderEmpty = () => (
    <EmptyState
      title="暂无角色"
      description={
        filters?.search
          ? `没有找到匹配"${filters.search}"的角色`
          : '还没有任何角色，创建第一个角色吧！'
      }
      action={
        !filters?.search ? {
          label: '创建角色',
          onClick: () => router.push('/characters/create')
        } : undefined
      }
    />
  );

  // 渲染分页
  const renderPagination = () => {
    if (!pagination || pagination.totalPages <= 1) return null;

    const { page, totalPages } = pagination;
    const pages: number[] = [];

    // 简单的分页逻辑：显示当前页前后各2页
    const startPage = Math.max(1, page - 2);
    const endPage = Math.min(totalPages, page + 2);

    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }

    return (
      <div className="flex items-center justify-center gap-2 mt-8">
        <Button
          variant="outline"
          size="sm"
          disabled={page === 1}
          onClick={() => onPageChange?.(page - 1)}
        >
          上一页
        </Button>

        {startPage > 1 && (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange?.(1)}
            >
              1
            </Button>
            {startPage > 2 && (
              <span className="px-2 text-muted-foreground">...</span>
            )}
          </>
        )}

        {pages.map((p) => (
          <Button
            key={p}
            variant={p === page ? 'default' : 'outline'}
            size="sm"
            onClick={() => onPageChange?.(p)}
          >
            {p}
          </Button>
        ))}

        {endPage < totalPages && (
          <>
            {endPage < totalPages - 1 && (
              <span className="px-2 text-muted-foreground">...</span>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange?.(totalPages)}
            >
              {totalPages}
            </Button>
          </>
        )}

        <Button
          variant="outline"
          size="sm"
          disabled={page === totalPages}
          onClick={() => onPageChange?.(page + 1)}
        >
          下一页
        </Button>
      </div>
    );
  };

  return (
    <div className={cn('w-full', className)}>
      {renderToolbar()}

      {/* 内容区域 */}
      {loading ? (
        renderLoading()
      ) : error ? (
        renderError()
      ) : characters.length === 0 ? (
        renderEmpty()
      ) : (
        <>
          <div
            className={cn(
              view === 'grid'
                ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6'
                : 'space-y-4'
            )}
          >
            {characters.map((character) => (
              <CharacterCard
                key={character.id}
                character={character}
                variant={view}
                showActions
                isEditable={showEditActions}
                onClick={handleCharacterClick}
                onEdit={onEdit}
                onDelete={onDelete}
                onClone={onClone}
                onArchive={onArchive}
                onShare={onShare}
              />
            ))}
          </div>

          {renderPagination()}
        </>
      )}
    </div>
  );
};

/**
 * CharacterGridList - 简化的网格列表（无工具栏和分页）
 */
export const CharacterGridList: React.FC<{
  characters: Character[];
  loading?: boolean;
  columns?: 2 | 3 | 4 | 5;
  onCharacterClick?: (character: Character) => void;
  className?: string;
}> = ({ 
  characters, 
  loading = false, 
  columns = 4,
  onCharacterClick,
  className 
}) => {
  const colsClass = {
    2: 'sm:grid-cols-2',
    3: 'sm:grid-cols-2 lg:grid-cols-3',
    4: 'sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
    5: 'sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5',
  };

  if (loading) {
    return (
      <div className={cn('grid grid-cols-1 gap-6', colsClass[columns], className)}>
        {Array.from({ length: columns * 2 }).map((_, index) => (
          <CharacterCardSkeleton key={index} variant="grid" />
        ))}
      </div>
    );
  }

  if (characters.length === 0) {
    return (
      <EmptyState
        title="暂无角色"
        description="还没有任何角色"
      />
    );
  }

  return (
    <div className={cn('grid grid-cols-1 gap-6', colsClass[columns], className)}>
      {characters.map((character) => (
        <CharacterCard
          key={character.id}
          character={character}
          variant="grid"
          onClick={onCharacterClick}
        />
      ))}
    </div>
  );
};

