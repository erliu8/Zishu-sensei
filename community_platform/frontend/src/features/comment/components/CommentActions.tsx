/**
 * CommentActions Component
 * 评论操作按钮组件
 */

'use client';

import { useState } from 'react';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { Textarea } from '@/shared/components/ui/textarea';
import {
  Heart,
  MessageCircle,
  MoreHorizontal,
  Edit,
  Trash2,
  Flag,
  Copy,
  Share2,
} from 'lucide-react';
import {
  useLikeComment,
  useUnlikeComment,
  useDeleteComment,
  useReportComment,
} from '../hooks/useComments';
import type { Comment } from '../domain/comment.types';
import { cn } from '@/shared/utils/cn';
import { useToast } from '@/shared/hooks/use-toast';

interface CommentActionsProps {
  comment: Comment;
  currentUserId?: string;
  onReply?: () => void;
  onEdit?: () => void;
  className?: string;
}

export function CommentActions({
  comment,
  currentUserId,
  onReply,
  onEdit,
  className,
}: CommentActionsProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [reportReason, setReportReason] = useState('');

  const { toast } = useToast();
  const likeComment = useLikeComment();
  const unlikeComment = useUnlikeComment();
  const deleteComment = useDeleteComment();
  const reportComment = useReportComment();

  const isAuthor = currentUserId === comment.authorId;
  const isLiked = comment.isLiked;

  const handleLikeToggle = async () => {
    try {
      if (isLiked) {
        await unlikeComment.mutateAsync(comment.id);
      } else {
        await likeComment.mutateAsync(comment.id);
      }
    } catch (error) {
      // Error handled by mutation
    }
  };

  const handleDelete = async () => {
    try {
      await deleteComment.mutateAsync(comment.id);
      setShowDeleteDialog(false);
    } catch (error) {
      // Error handled by mutation
    }
  };

  const handleReport = async () => {
    if (!reportReason.trim()) {
      toast({
        variant: 'destructive',
        title: '请填写举报理由',
      });
      return;
    }

    try {
      await reportComment.mutateAsync({
        commentId: comment.id,
        reason: reportReason,
      });
      setShowReportDialog(false);
      setReportReason('');
    } catch (error) {
      // Error handled by mutation
    }
  };

  const handleCopyLink = () => {
    const url = `${window.location.origin}${window.location.pathname}#comment-${comment.id}`;
    navigator.clipboard.writeText(url);
    toast({
      title: '链接已复制',
      description: '评论链接已复制到剪贴板',
    });
  };

  const handleShare = async () => {
    const url = `${window.location.origin}${window.location.pathname}#comment-${comment.id}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: '分享评论',
          text: comment.content.substring(0, 100),
          url,
        });
      } catch (error) {
        // User cancelled
      }
    } else {
      handleCopyLink();
    }
  };

  return (
    <>
      <div className={cn('flex items-center gap-1', className)}>
        {/* 点赞按钮 */}
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            'h-8 gap-1.5 text-muted-foreground hover:text-foreground',
            isLiked && 'text-red-500 hover:text-red-600'
          )}
          onClick={handleLikeToggle}
          disabled={likeComment.isPending || unlikeComment.isPending}
        >
          <Heart
            className={cn('h-4 w-4', isLiked && 'fill-current')}
          />
          {comment.likeCount > 0 && (
            <span className="text-xs">{comment.likeCount}</span>
          )}
        </Button>

        {/* 回复按钮 */}
        {onReply && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 text-muted-foreground hover:text-foreground"
            onClick={onReply}
          >
            <MessageCircle className="h-4 w-4" />
            <span className="text-xs">回复</span>
          </Button>
        )}

        {/* 更多操作菜单 */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
            >
              <MoreHorizontal className="h-4 w-4" />
              <span className="sr-only">更多操作</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handleCopyLink}>
              <Copy className="mr-2 h-4 w-4" />
              复制链接
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleShare}>
              <Share2 className="mr-2 h-4 w-4" />
              分享
            </DropdownMenuItem>

            {isAuthor && (
              <>
                <DropdownMenuSeparator />
                {onEdit && (
                  <DropdownMenuItem onClick={onEdit}>
                    <Edit className="mr-2 h-4 w-4" />
                    编辑
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={() => setShowDeleteDialog(true)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  删除
                </DropdownMenuItem>
              </>
            )}

            {!isAuthor && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={() => setShowReportDialog(true)}
                >
                  <Flag className="mr-2 h-4 w-4" />
                  举报
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* 删除确认对话框 */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              你确定要删除这条评论吗？此操作无法撤销。
              {comment.replyCount > 0 && (
                <span className="mt-2 block text-destructive">
                  注意：该评论有 {comment.replyCount} 条回复，删除后回复也将被删除。
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteComment.isPending ? '删除中...' : '确认删除'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 举报对话框 */}
      <Dialog open={showReportDialog} onOpenChange={setShowReportDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>举报评论</DialogTitle>
            <DialogDescription>
              请说明举报理由，我们会尽快处理。
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="请描述违规内容..."
            value={reportReason}
            onChange={(e) => setReportReason(e.target.value)}
            className="min-h-[100px]"
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowReportDialog(false)}
            >
              取消
            </Button>
            <Button
              onClick={handleReport}
              disabled={reportComment.isPending || !reportReason.trim()}
            >
              {reportComment.isPending ? '提交中...' : '提交举报'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

