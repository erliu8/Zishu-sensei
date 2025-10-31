/**
 * 适配器详情页
 * @route /adapters/[id]
 */

'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
  useAdapter,
  useLikeAdapter,
  useUnlikeAdapter,
  useFavoriteAdapter,
  useUnfavoriteAdapter,
  useDownloadAdapter,
  useIncrementAdapterView,
  useRelatedAdapters,
} from '@/features/adapter/hooks';
import { AdapterDetail } from '@/features/adapter/components/detail/AdapterDetail';
import { AdapterCard } from '@/features/adapter/components/marketplace';
import { LoadingSpinner, EmptyState } from '@/shared/components/common';
import { Button, Separator } from '@/shared/components';
import { ArrowLeft, Edit, Trash2 } from 'lucide-react';
import { useToast } from '@/shared/hooks/use-toast';
import { useAuth } from '@/features/auth/hooks';

/**
 * 适配器详情页组件
 */
export default function AdapterDetailPage() {
  const params = useParams();
  const router = useRouter();
  const adapterId = params['id'] as string;
  const { toast } = useToast();

  // 获取当前用户
  const { user } = useAuth();

  // 获取适配器详情
  const { data: adapter, isLoading, error } = useAdapter(adapterId);

  // 获取相关适配器
  const { data: relatedAdapters } = useRelatedAdapters(adapterId, 6);

  // Mutations
  const likeAdapter = useLikeAdapter();
  const unlikeAdapter = useUnlikeAdapter();
  const favoriteAdapter = useFavoriteAdapter();
  const unfavoriteAdapter = useUnfavoriteAdapter();
  const downloadAdapter = useDownloadAdapter();
  const incrementView = useIncrementAdapterView();

  // 增加浏览量
  useEffect(() => {
    if (adapterId) {
      incrementView.mutate(adapterId);
    }
  }, [adapterId]);

  // 处理下载
  const handleDownload = async (adapterId: string, version?: string) => {
    try {
      const downloadUrl = await downloadAdapter.mutateAsync({ id: adapterId, version });
      
      // 触发浏览器下载
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `${adapter?.name || 'adapter'}_${version || adapter?.version}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast({
        title: '成功',
        description: '开始下载适配器',
      });
    } catch (error: any) {
      toast({
        title: '错误',
        description: error.message || '下载失败',
        variant: 'destructive',
      });
    }
  };

  // 处理收藏
  const handleFavorite = async (adapterId: string) => {
    if (!user) {
      toast({
        title: '错误',
        description: '请先登录',
        variant: 'destructive',
      });
      router.push('/login');
      return;
    }

    try {
      if (adapter?.isFavorited) {
        await unfavoriteAdapter.mutateAsync(adapterId);
        toast({
          title: '成功',
          description: '已取消收藏',
        });
      } else {
        await favoriteAdapter.mutateAsync(adapterId);
        toast({
          title: '成功',
          description: '收藏成功',
        });
      }
    } catch (error: any) {
      toast({
        title: '错误',
        description: error.message || '操作失败',
        variant: 'destructive',
      });
    }
  };

  // 处理点赞
  const handleLike = async (adapterId: string) => {
    if (!user) {
      toast({
        title: '错误',
        description: '请先登录',
        variant: 'destructive',
      });
      router.push('/login');
      return;
    }

    try {
      if (adapter?.isLiked) {
        await unlikeAdapter.mutateAsync(adapterId);
      } else {
        await likeAdapter.mutateAsync(adapterId);
        toast({
          title: '成功',
          description: '点赞成功',
        });
      }
    } catch (error: any) {
      toast({
        title: '错误',
        description: error.message || '操作失败',
        variant: 'destructive',
      });
    }
  };

  // 处理分享
  const handleShare = async (id: string) => {
    const shareUrl = `${window.location.origin}/adapters/${id}`;
    
    try {
      if (navigator.share) {
        await navigator.share({
          title: adapter?.displayName,
          text: adapter?.description,
          url: shareUrl,
        });
      } else {
        await navigator.clipboard.writeText(shareUrl);
        toast({
          title: '成功',
          description: '链接已复制到剪贴板',
        });
      }
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        toast({
          title: '错误',
          description: '分享失败',
          variant: 'destructive',
        });
      }
    }
  };

  // 处理举报
  const handleReport = (_id: string) => {
    // TODO: 实现举报功能
    toast({
      title: '提示',
      description: '举报功能即将推出',
    });
  };

  // 处理编辑
  const handleEdit = (id: string) => {
    router.push(`/adapters/${id}/edit`);
  };

  // 处理删除
  const handleDelete = async (_id: string) => {
    if (!confirm('确定要删除这个适配器吗？此操作不可撤销。')) {
      return;
    }

    // TODO: 实现删除功能
    toast({
      title: '提示',
      description: '删除功能即将推出',
    });
  };

  // 返回列表
  const handleBack = () => {
    router.back();
  };

  // 检查是否是作者
  const isAuthor = user && adapter && (user as any).id === adapter.author.id;

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[60vh]">
          <LoadingSpinner size="lg" />
        </div>
      </div>
    );
  }

  if (error || !adapter) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Button variant="ghost" onClick={handleBack} className="mb-6">
          <ArrowLeft className="mr-2 h-4 w-4" />
          返回
        </Button>
        <div className="flex items-center justify-center min-h-[60vh]">
          <EmptyState
            title="适配器不存在"
            description={error?.message || '无法找到该适配器，可能已被删除或不存在'}
            action={{
              label: '返回市场',
              onClick: () => router.push('/adapters'),
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* 顶部导航 */}
      <div className="flex items-center justify-between mb-6">
        <Button variant="ghost" onClick={handleBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          返回
        </Button>

        {isAuthor && (
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => handleEdit(adapterId)}>
              <Edit className="mr-2 h-4 w-4" />
              编辑
            </Button>
            <Button variant="destructive" onClick={() => handleDelete(adapterId)}>
              <Trash2 className="mr-2 h-4 w-4" />
              删除
            </Button>
          </div>
        )}
      </div>

      {/* 适配器详情 */}
      <AdapterDetail
        adapter={adapter}
        onDownload={handleDownload}
        onFavorite={handleFavorite}
        onLike={handleLike}
        onShare={handleShare}
        onReport={handleReport}
        showAdminActions={isAuthor}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />

      {/* 相关适配器 */}
      {relatedAdapters && relatedAdapters.length > 0 && (
        <div className="mt-12">
          <Separator className="mb-8" />
          <h2 className="text-2xl font-bold mb-6">相关推荐</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {relatedAdapters.map((relatedAdapter) => (
              <div 
                key={relatedAdapter.id}
                onClick={() => router.push(`/adapters/${relatedAdapter.id}`)}
                className="cursor-pointer"
              >
                <AdapterCard
                  adapter={relatedAdapter}
                  onDownload={() => handleDownload(relatedAdapter.id)}
                  onFavorite={() => handleFavorite(relatedAdapter.id)}
                  onLike={() => handleLike(relatedAdapter.id)}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

