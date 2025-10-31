/**
 * CommentItem Component
 * 单个评论项组件
 */

'use client';

import { useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/components/ui/avatar';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Textarea } from '@/shared/components/ui/textarea';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { CommentActions } from './CommentActions';
import { CommentForm } from './CommentForm';
import type { Comment } from '../domain/comment.types';
import { formatCommentTime } from '../domain/comment.model';
import { useUpdateComment } from '../hooks/useComments';
import { cn } from '@/shared/utils/cn';

interface CommentItemProps {
  comment: Comment;
  currentUserId?: string;
  depth?: number;
  maxDepth?: number;
  onReplySuccess?: () => void;
  showReplies?: boolean;
  className?: string;
}

export function CommentItem({
  comment,
  currentUserId,
  depth = 0,
  maxDepth = 3,
  onReplySuccess,
  showReplies: initialShowReplies = true,
  className,
}: CommentItemProps) {
  const [isReplying, setIsReplying] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(comment.content);
  const [showReplies, setShowReplies] = useState(initialShowReplies);

  const updateComment = useUpdateComment();

  const hasReplies = comment.replies && comment.replies.length > 0;

  const handleReplyClick = () => {
    setIsReplying(true);
  };

  const handleReplySuccess = () => {
    setIsReplying(false);
    setShowReplies(true);
    onReplySuccess?.();
  };

  const handleReplyCancel = () => {
    setIsReplying(false);
  };

  const handleEditClick = () => {
    setIsEditing(true);
  };

  const handleEditSave = async () => {
    if (editContent.trim() === comment.content) {
      setIsEditing(false);
      return;
    }

    try {
      await updateComment.mutateAsync({
        commentId: comment.id,
        dto: { content: editContent },
      });
      setIsEditing(false);
    } catch (error) {
      // Error handled by mutation
    }
  };

  const handleEditCancel = () => {
    setEditContent(comment.content);
    setIsEditing(false);
  };

  return (
    <div
      id={`comment-${comment.id}`}
      className={cn('group', className)}
    >
      <div className="flex gap-3">
        {/* 头像 */}
        <Avatar className="h-8 w-8 flex-shrink-0">
          <AvatarImage
            src={comment.author.avatar}
            alt={comment.author.displayName}
          />
          <AvatarFallback>
            {comment.author.displayName.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>

        {/* 评论内容区 */}
        <div className="flex-1 min-w-0">
          {/* 作者信息 */}
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-sm">
              {comment.author.displayName}
            </span>
            <span className="text-xs text-muted-foreground">
              @{comment.author.username}
            </span>

            {/* 作者徽章 */}
            {comment.author.badges?.map((badge) => (
              <Badge key={badge} variant="secondary" className="text-xs">
                {badge}
              </Badge>
            ))}

            {/* 编辑标记 */}
            {comment.isEdited && (
              <span className="text-xs text-muted-foreground">(已编辑)</span>
            )}

            {/* 时间 */}
            <span className="text-xs text-muted-foreground">
              {formatCommentTime(comment.createdAt)}
            </span>
          </div>

          {/* 评论内容或编辑框 */}
          {isEditing ? (
            <div className="space-y-2">
              <Textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="min-h-[80px] resize-none text-sm"
                autoFocus
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handleEditSave}
                  disabled={
                    updateComment.isPending ||
                    !editContent.trim() ||
                    editContent === comment.content
                  }
                >
                  {updateComment.isPending ? '保存中...' : '保存'}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleEditCancel}
                  disabled={updateComment.isPending}
                >
                  取消
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-sm text-foreground whitespace-pre-wrap break-words">
              {comment.content}
            </div>
          )}

          {/* 操作按钮 */}
          {!isEditing && (
            <div className="mt-2">
              <CommentActions
                comment={comment}
                currentUserId={currentUserId}
                onReply={handleReplyClick}
                onEdit={handleEditClick}
              />
            </div>
          )}

          {/* 回复表单 */}
          {isReplying && (
            <div className="mt-3">
              <CommentForm
                targetType={comment.targetType}
                targetId={comment.targetId}
                parentId={comment.id}
                placeholder={`回复 @${comment.author.username}...`}
                autoFocus
                onSuccess={handleReplySuccess}
                onCancel={handleReplyCancel}
                compact
              />
            </div>
          )}

          {/* 回复列表 */}
          {hasReplies && (
            <div className="mt-3">
              {/* 展开/收起按钮 */}
              <Button
                variant="ghost"
                size="sm"
                className="h-auto p-0 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => setShowReplies(!showReplies)}
              >
                {showReplies ? (
                  <>
                    <ChevronUp className="mr-1 h-3 w-3" />
                    隐藏 {comment.replyCount} 条回复
                  </>
                ) : (
                  <>
                    <ChevronDown className="mr-1 h-3 w-3" />
                    查看 {comment.replyCount} 条回复
                  </>
                )}
              </Button>

              {/* 嵌套回复 */}
              {showReplies && (
                <div className="mt-3 space-y-4 border-l-2 border-border pl-4">
                  {comment.replies?.map((reply) => (
                    <CommentItem
                      key={reply.id}
                      comment={reply}
                      currentUserId={currentUserId}
                      depth={depth + 1}
                      maxDepth={maxDepth}
                      onReplySuccess={onReplySuccess}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

