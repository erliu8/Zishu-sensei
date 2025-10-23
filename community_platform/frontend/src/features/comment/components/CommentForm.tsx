/**
 * CommentForm Component
 * 评论表单组件
 */

'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/shared/components/ui/button';
import { Textarea } from '@/shared/components/ui/textarea';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@/shared/components/ui/form';
import { Loader2, Send } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/components/ui/avatar';
import { useCreateComment } from '../hooks/useComments';
import type { CommentTargetType } from '../domain/comment.types';
import { cn } from '@/shared/utils/cn';

const commentFormSchema = z.object({
  content: z
    .string()
    .min(1, '评论内容不能为空')
    .max(2000, '评论内容不能超过2000字符'),
});

type CommentFormValues = z.infer<typeof commentFormSchema>;

interface CommentFormProps {
  targetType: CommentTargetType;
  targetId: string;
  parentId?: string;
  placeholder?: string;
  autoFocus?: boolean;
  onSuccess?: () => void;
  onCancel?: () => void;
  className?: string;
  compact?: boolean;
  currentUser?: {
    id: string;
    username: string;
    avatar?: string;
  };
}

export function CommentForm({
  targetType,
  targetId,
  parentId,
  placeholder = '写下你的评论...',
  autoFocus = false,
  onSuccess,
  onCancel,
  className,
  compact = false,
  currentUser,
}: CommentFormProps) {
  const [isFocused, setIsFocused] = useState(false);
  const createComment = useCreateComment();

  const form = useForm<CommentFormValues>({
    resolver: zodResolver(commentFormSchema),
    defaultValues: {
      content: '',
    },
  });

  const onSubmit = async (values: CommentFormValues) => {
    try {
      await createComment.mutateAsync({
        content: values.content,
        targetType,
        targetId,
        parentId,
      });

      form.reset();
      setIsFocused(false);
      onSuccess?.();
    } catch (error) {
      // Error handled by mutation
    }
  };

  const handleCancel = () => {
    form.reset();
    setIsFocused(false);
    onCancel?.();
  };

  const showActions = isFocused || form.watch('content').length > 0;

  return (
    <div className={cn('flex gap-3', className)}>
      {!compact && currentUser && (
        <Avatar className="h-8 w-8">
          <AvatarImage src={currentUser.avatar} alt={currentUser.username} />
          <AvatarFallback>{currentUser.username.charAt(0).toUpperCase()}</AvatarFallback>
        </Avatar>
      )}

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex-1 space-y-3"
        >
          <FormField
            control={form.control}
            name="content"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <Textarea
                    placeholder={placeholder}
                    className={cn(
                      'min-h-[80px] resize-none',
                      compact && 'min-h-[60px] text-sm'
                    )}
                    autoFocus={autoFocus}
                    onFocus={() => setIsFocused(true)}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {showActions && (
            <div className="flex items-center justify-between">
              <div className="text-xs text-muted-foreground">
                {form.watch('content').length} / 2000
              </div>

              <div className="flex gap-2">
                {onCancel && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleCancel}
                    disabled={createComment.isPending}
                  >
                    取消
                  </Button>
                )}

                <Button
                  type="submit"
                  size="sm"
                  disabled={
                    createComment.isPending || !form.formState.isValid
                  }
                >
                  {createComment.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      发送中...
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" />
                      发送
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </form>
      </Form>
    </div>
  );
}

