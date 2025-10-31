/**
 * 角色模板页面（热门角色）
 * @route /characters/templates
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  useCharacters,
  useCloneCharacter,
} from '@/features/character/hooks';
import type { CharacterFilters } from '@/features/character/domain';
import {
  Button,
  Input,
  Badge,
  Separator,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components';
import { LoadingSpinner, EmptyState, Pagination, Avatar } from '@/shared/components/common';
import { 
  Search, 
  Copy, 
  Download,
  Star,
  TrendingUp,
  Sparkles,
  Eye,
  Heart,
} from 'lucide-react';
import { useToast } from '@/shared/hooks/use-toast';
import { formatNumber } from '@/shared/utils/format';

/**
 * 排序选项
 */
const SORT_OPTIONS = [
  { value: 'downloads', label: '最多下载' },
  { value: 'rating', label: '评分最高' },
  { value: 'favorites', label: '最多收藏' },
  { value: 'createdAt', label: '最新发布' },
] as const;

/**
 * 角色模板页面组件
 */
export default function CharacterTemplatesPage() {
  const router = useRouter();
  const { toast } = useToast();

  // 本地状态
  const [page, setPage] = useState(1);
  const [pageSize] = useState(12);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('downloads');
  const [sortOrder] = useState<'asc' | 'desc'>('desc');

  // 构建查询参数 - 只查询已发布的、公开的角色
  const queryParams: CharacterFilters = {
    page,
    pageSize,
    search: searchQuery || undefined,
    sortBy: sortBy as any,
    sortOrder,
    publishedOnly: true,
    visibility: 'public' as any,
  };

  // 获取数据
  const { data: charactersData, isLoading, error, refetch } = useCharacters(queryParams);

  // Mutations
  const cloneCharacter = useCloneCharacter();

  // 处理搜索
  const handleSearch = (value: string) => {
    setSearchQuery(value);
    setPage(1);
  };

  // 处理排序变化
  const handleSortChange = (value: string) => {
    setSortBy(value);
    setPage(1);
  };

  // 处理分页
  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // 处理查看详情
  const handleViewDetails = (characterId: string) => {
    router.push(`/characters/${characterId}`);
  };

  // 处理克隆角色
  const handleClone = async (characterId: number) => {
    try {
      const clonedCharacter = await cloneCharacter.mutateAsync(characterId);
      toast({
        title: '成功',
        description: '角色模板已克隆，可以进行定制',
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

  return (
    <div className="container mx-auto px-4 py-8">
      {/* 页面头部 */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <TrendingUp className="h-8 w-8 text-primary" />
              <h1 className="text-3xl font-bold">角色模板</h1>
              <Badge variant="default" className="gap-1">
                <Sparkles className="h-3 w-3" />
                热门推荐
              </Badge>
            </div>
            <p className="text-muted-foreground">
              浏览社区中最受欢迎的角色模板，克隆并定制为你的专属AI助手
            </p>
          </div>
          <Button onClick={() => router.push('/characters/create')} size="lg">
            创建新角色
          </Button>
        </div>

        <Separator className="my-6" />

        {/* 搜索和筛选工具栏 */}
        <Card className="p-4">
          {/* 搜索栏 */}
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="搜索角色模板..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* 工具栏 */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            {/* 左侧：统计信息 */}
            <div className="text-sm text-muted-foreground">
              {charactersData && (
                <>
                  共找到 <span className="font-medium text-foreground">{charactersData.total}</span> 个角色模板
                </>
              )}
            </div>

            {/* 右侧：排序 */}
            <div className="flex items-center gap-2">
              <Select value={sortBy} onValueChange={handleSortChange}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SORT_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </Card>
      </div>

      {/* 角色模板列表 */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <LoadingSpinner size="lg" />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-20">
          <EmptyState
            title="加载失败"
            description={error.message || '无法加载角色模板列表，请稍后重试'}
            action={{
              label: '重试',
              onClick: () => refetch(),
            }}
          />
        </div>
      ) : !charactersData || charactersData.items.length === 0 ? (
        <EmptyState
          title="暂无角色模板"
          description={
            searchQuery
              ? '没有找到符合条件的角色模板，试试其他关键词吧'
              : '还没有角色模板，成为第一个创建的人吧！'
          }
          action={{
            label: '创建新角色',
            onClick: () => router.push('/characters/create'),
          }}
        />
      ) : (
        <>
          {/* 角色卡片网格 */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {charactersData.items.map((character: any) => (
              <Card 
                key={character.id} 
                className="flex flex-col overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => handleViewDetails(character.id)}
              >
                {/* 封面图 */}
                {character.coverUrl ? (
                  <div className="relative w-full h-48 overflow-hidden">
                    <img
                      src={character.coverUrl}
                      alt={character.displayName || character.name}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  </div>
                ) : (
                  <div className="w-full h-48 bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                    <Sparkles className="h-16 w-16 text-primary/40" />
                  </div>
                )}

                <CardHeader className="pb-3">
                  {/* 头像和标题 */}
                  <div className="flex items-start gap-3">
                    <Avatar
                      src={character.avatarUrl}
                      alt={character.displayName || character.name}
                      fallback={character.name}
                      size="md"
                      className="ring-2 ring-white shadow-sm flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-lg truncate">
                        {character.displayName || character.name}
                      </CardTitle>
                      <CardDescription className="text-xs truncate">
                        by {character.creatorName || '未知'}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="flex-1 pb-3">
                  {/* 描述 */}
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                    {character.description}
                  </p>

                  {/* 统计信息 */}
                  <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Download className="h-3 w-3" />
                      <span>{formatNumber(character.stats.downloads)}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Heart className="h-3 w-3" />
                      <span>{formatNumber(character.stats.favorites)}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Star className="h-3 w-3" />
                      <span>{character.stats.rating.toFixed(1)}</span>
                    </div>
                  </div>

                  {/* 标签 */}
                  {character.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-3">
                      {character.tags.slice(0, 3).map((tag: string) => (
                        <Badge key={tag} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                      {character.tags.length > 3 && (
                        <Badge variant="secondary" className="text-xs">
                          +{character.tags.length - 3}
                        </Badge>
                      )}
                    </div>
                  )}
                </CardContent>

                <CardFooter className="pt-3 border-t">
                  <div className="flex gap-2 w-full">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="flex-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleViewDetails(character.id);
                      }}
                    >
                      <Eye className="h-3 w-3 mr-1" />
                      查看
                    </Button>
                    <Button 
                      size="sm" 
                      className="flex-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleClone(character.id);
                      }}
                    >
                      <Copy className="h-3 w-3 mr-1" />
                      克隆定制
                    </Button>
                  </div>
                </CardFooter>
              </Card>
            ))}
          </div>

          {/* 分页 */}
          {charactersData.totalPages > 1 && (
            <div className="mt-8 flex justify-center">
              <Pagination
                currentPage={page}
                totalPages={charactersData.totalPages}
                onPageChange={handlePageChange}
                showFirstLast
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}

