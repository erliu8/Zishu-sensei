/**
 * PostActions 组件 - 帖子操作
 * 提供点赞、分享、删除等操作功能
 */

'use client';

import { FC, memo, useState } from 'react';
import { Heart, Share2, Bookmark, Flag, Trash2, Edit, MoreVertical, Link as LinkIcon } from 'lucide-react';

import { Button } from '@/shared/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
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
import { useToast } from '@/shared/components/ui/use-toast';
import { cn } from '@/shared/utils/cn';

export interface PostActionsProps {
  postId: string;
  isLiked?: boolean;
  isFavorited?: boolean;
  isAuthor?: boolean;
  likesCount: number;
  onLike?: (postId: string) => void;
  onFavorite?: (postId: string) => void;
  onShare?: (postId: string) => void;
  onEdit?: (postId: string) => void;
  onDelete?: (postId: string) => void;
  onReport?: (postId: string) => void;
  className?: string;
  variant?: 'default' | 'compact';
}

export const PostActions: FC<PostActionsProps> = memo(({
  postId,
  isLiked = false,
  isFavorited = false,
  isAuthor = false,
  likesCount,
  onLike,
  onFavorite,
  onShare,
  onEdit,
  onDelete,
  onReport,
  className,
  variant = 'default',
}) => {
  const { toast } = useToast();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleLike = () => {
    onLike?.(postId);
  };

  const handleFavorite = () => {
    onFavorite?.(postId);
  };

  const handleShare = async () => {
    const url = `${window.location.origin}/posts/${postId}`;
    
    // 尝试使用 Web Share API
    if (navigator.share) {
      try {
        await navigator.share({
          title: '分享帖子',
          url,
        });
        onShare?.(postId);
      } catch (err) {
        // 用户取消分享，不显示错误
        if ((err as Error).name !== 'AbortError') {
          console.error('分享失败:', err);
        }
      }
    } else {
      // 降级到复制链接
      try {
        await navigator.clipboard.writeText(url);
        toast({
          title: '链接已复制',
          description: '帖子链接已复制到剪贴板',
        });
        onShare?.(postId);
      } catch (err) {
        toast({
          title: '复制失败',
          description: '无法复制链接，请手动复制',
          variant: 'destructive',
        });
      }
    }
  };

  const handleCopyLink = async () => {
    const url = `${window.location.origin}/posts/${postId}`;
    try {
      await navigator.clipboard.writeText(url);
      toast({
        title: '链接已复制',
        description: '帖子链接已复制到剪贴板',
      });
    } catch (err) {
      toast({
        title: '复制失败',
        description: '无法复制链接',
        variant: 'destructive',
      });
    }
  };

  const handleEdit = () => {
    onEdit?.(postId);
  };

  const handleDeleteConfirm = async () => {
    setIsDeleting(true);
    try {
      await onDelete?.(postId);
      toast({
        title: '删除成功',
        description: '帖子已成功删除',
      });
      setShowDeleteDialog(false);
    } catch (err) {
      toast({
        title: '删除失败',
        description: '删除帖子时出错，请重试',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleReport = () => {
    onReport?.(postId);
    toast({
      title: '已提交举报',
      description: '我们会尽快审核您的举报',
    });
  };

  // 紧凑模式
  if (variant === 'compact') {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleLike}
          className={cn(
            'gap-1',
            isLiked && 'text-red-500 hover:text-red-600'
          )}
        >
          <Heart className={cn('h-4 w-4', isLiked && 'fill-current')} />
          <span className="text-xs">{likesCount}</span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleFavorite}
          className={cn(
            isFavorited && 'text-yellow-500 hover:text-yellow-600'
          )}
        >
          <Bookmark className={cn('h-4 w-4', isFavorited && 'fill-current')} />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleShare}
        >
          <Share2 className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  // 默认模式
  return (
    <div className={cn('flex items-center justify-between', className)}>
      <div className="flex items-center gap-2">
        {/* 点赞按钮 */}
        <Button
          variant={isLiked ? 'default' : 'outline'}
          size="default"
          onClick={handleLike}
          className={cn(
            'gap-2',
            isLiked && 'bg-red-500 hover:bg-red-600 text-white'
          )}
        >
          <Heart className={cn('h-5 w-5', isLiked && 'fill-current')} />
          <span>{isLiked ? '已点赞' : '点赞'}</span>
          <span className="font-semibold">({likesCount})</span>
        </Button>

        {/* 收藏按钮 */}
        <Button
          variant={isFavorited ? 'default' : 'outline'}
          size="default"
          onClick={handleFavorite}
          className={cn(
            'gap-2',
            isFavorited && 'bg-yellow-500 hover:bg-yellow-600 text-white'
          )}
        >
          <Bookmark className={cn('h-5 w-5', isFavorited && 'fill-current')} />
          <span>{isFavorited ? '已收藏' : '收藏'}</span>
        </Button>

        {/* 分享按钮 */}
        <Button
          variant="outline"
          size="default"
          onClick={handleShare}
          className="gap-2"
        >
          <Share2 className="h-5 w-5" />
          <span>分享</span>
        </Button>
      </div>

      {/* 更多操作 */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon">
            <MoreVertical className="h-5 w-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={handleCopyLink}>
            <LinkIcon className="mr-2 h-4 w-4" />
            复制链接
          </DropdownMenuItem>
          
          {isAuthor ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleEdit}>
                <Edit className="mr-2 h-4 w-4" />
                编辑帖子
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => setShowDeleteDialog(true)}
                className="text-red-600"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                删除帖子
              </DropdownMenuItem>
            </>
          ) : (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleReport}>
                <Flag className="mr-2 h-4 w-4" />
                举报帖子
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* 删除确认对话框 */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除这篇帖子吗？此操作无法撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? '删除中...' : '删除'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
});

PostActions.displayName = 'PostActions';

