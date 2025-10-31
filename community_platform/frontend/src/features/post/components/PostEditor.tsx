/**
 * PostEditor 组件 - 帖子编辑器
 * 支持 Markdown 和富文本编辑
 */

'use client';

import { FC, useState } from 'react';
import dynamic from 'next/dynamic';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Eye, FileText, Image as ImageIcon, Save, X } from 'lucide-react';

import { CreatePostInput, UpdatePostInput, PostStatus } from '../domain/post.types';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Textarea } from '@/shared/components/ui/textarea';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/shared/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { Separator } from '@/shared/components/ui/separator';
import { cn } from '@/shared/utils/cn';

// 动态导入 Markdown 编辑器和预览组件
const MarkdownEditor = dynamic(
  () => import('@/shared/components/common/MarkdownEditor').then(mod => mod.MarkdownEditor),
  { ssr: false, loading: () => <div className="h-96 bg-muted animate-pulse rounded-md" /> }
);

const MarkdownViewer = dynamic(
  () => import('@/shared/components/common/MarkdownViewer').then(mod => mod.MarkdownViewer),
  { ssr: false }
);

// 表单验证 Schema
const postFormSchema = z.object({
  status: z.nativeEnum(PostStatus).default(PostStatus.DRAFT),
  title: z.string()
    .min(5, '标题至少需要 5 个字符')
    .max(200, '标题不能超过 200 个字符'),
  content: z.string()
    .min(10, '内容至少需要 10 个字符')
    .max(50000, '内容不能超过 50000 个字符'),
  summary: z.string()
    .max(500, '摘要不能超过 500 个字符')
    .optional(),
  coverImage: z.string().url('请输入有效的图片链接').optional().or(z.literal('')),
  categoryId: z.string().optional(),
  tagIds: z.array(z.string()).optional(),
});

type PostFormValues = z.infer<typeof postFormSchema>;

export interface PostEditorProps {
  initialData?: UpdatePostInput;
  categories?: Array<{ id: string; name: string; color?: string }>;
  tags?: Array<{ id: string; name: string }>;
  onSave: (data: CreatePostInput | UpdatePostInput) => Promise<void>;
  onCancel?: () => void;
  className?: string;
  mode?: 'create' | 'edit';
}

export const PostEditor: FC<PostEditorProps> = ({
  initialData,
  categories = [],
  tags = [],
  onSave,
  onCancel,
  className,
  mode = 'create',
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>(initialData?.tagIds || []);
  const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit');

  const form = useForm({
    resolver: zodResolver(postFormSchema),
    mode: 'onChange' as const,
    defaultValues: {
      status: initialData?.status || PostStatus.DRAFT,
      title: initialData?.title || '',
      content: initialData?.content || '',
      summary: initialData?.summary || '',
      coverImage: initialData?.coverImage || '',
      categoryId: initialData?.categoryId || '',
      tagIds: initialData?.tagIds || [],
    },
  });

  const watchedContent = form.watch('content');
  const watchedTitle = form.watch('title');

  // 处理标签选择
  const handleTagToggle = (tagId: string) => {
    setSelectedTags(prev => {
      const newTags = prev.includes(tagId)
        ? prev.filter(id => id !== tagId)
        : [...prev, tagId];
      form.setValue('tagIds', newTags);
      return newTags;
    });
  };

  // 处理表单提交
  const handleSubmit = async (values: PostFormValues) => {
    setIsSubmitting(true);
    try {
      const submitData = {
        ...values,
        ...(mode === 'edit' && initialData?.id ? { id: initialData.id } : {}),
      };
      await onSave(submitData);
    } catch (error) {
      console.error('保存失败:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 字数统计
  const contentLength = watchedContent?.length || 0;
  const titleLength = watchedTitle?.length || 0;

  return (
    <div className={cn('space-y-6', className)}>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
          {/* 顶部操作栏 */}
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">
              {mode === 'create' ? '创建帖子' : '编辑帖子'}
            </h2>
            <div className="flex items-center gap-3">
              {onCancel && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={onCancel}
                  disabled={isSubmitting}
                >
                  <X className="h-4 w-4 mr-2" />
                  取消
                </Button>
              )}
              <Button
                type="submit"
                disabled={isSubmitting}
                className="gap-2"
              >
                <Save className="h-4 w-4" />
                {isSubmitting ? '保存中...' : '保存'}
              </Button>
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* 主编辑区域 */}
            <div className="lg:col-span-2 space-y-6">
              {/* 标题 */}
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>标题 *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="输入帖子标题..."
                        {...field}
                        className="text-lg"
                      />
                    </FormControl>
                    <FormDescription>
                      {titleLength} / 200 字符
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* 摘要 */}
              <FormField
                control={form.control}
                name="summary"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>摘要</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="输入帖子摘要（可选）..."
                        {...field}
                        rows={3}
                      />
                    </FormControl>
                    <FormDescription>
                      将显示在帖子列表中，帮助读者快速了解内容
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* 内容编辑器 */}
              <FormField
                control={form.control}
                name="content"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>内容 *</FormLabel>
                    <FormControl>
                      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
                        <div className="flex items-center justify-between mb-2">
                          <TabsList>
                            <TabsTrigger value="edit" className="gap-2">
                              <FileText className="h-4 w-4" />
                              编辑
                            </TabsTrigger>
                            <TabsTrigger value="preview" className="gap-2">
                              <Eye className="h-4 w-4" />
                              预览
                            </TabsTrigger>
                          </TabsList>
                          <span className="text-sm text-muted-foreground">
                            {contentLength.toLocaleString()} / 50,000 字符
                          </span>
                        </div>
                        <TabsContent value="edit" className="mt-0">
                          <MarkdownEditor
                            value={field.value}
                            onChange={field.onChange}
                            placeholder="开始书写你的内容... 支持 Markdown 格式"
                            minHeight="500px"
                          />
                        </TabsContent>
                        <TabsContent value="preview" className="mt-0">
                          <div className="min-h-[500px] border rounded-md p-6 prose prose-lg dark:prose-invert max-w-none">
                            {field.value ? (
                              <MarkdownViewer content={field.value} />
                            ) : (
                              <p className="text-muted-foreground">暂无内容可预览</p>
                            )}
                          </div>
                        </TabsContent>
                      </Tabs>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* 侧边栏设置 */}
            <div className="space-y-6">
              {/* 发布设置 */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">发布设置</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>状态</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="选择发布状态" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value={PostStatus.DRAFT}>草稿</SelectItem>
                            <SelectItem value={PostStatus.PUBLISHED}>发布</SelectItem>
                            <SelectItem value={PostStatus.ARCHIVED}>归档</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              {/* 分类 */}
              {categories.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">分类</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <FormField
                      control={form.control}
                      name="categoryId"
                      render={({ field }) => (
                        <FormItem>
                          <Select
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="选择分类" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {categories.map((category) => (
                                <SelectItem key={category.id} value={category.id}>
                                  <div className="flex items-center gap-2">
                                    {category.color && (
                                      <div
                                        className="w-3 h-3 rounded-full"
                                        style={{ backgroundColor: category.color }}
                                      />
                                    )}
                                    <span>{category.name}</span>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>
              )}

              {/* 标签 */}
              {tags.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">标签</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {tags.map((tag) => (
                        <Badge
                          key={tag.id}
                          variant={selectedTags.includes(tag.id) ? 'default' : 'outline'}
                          className="cursor-pointer"
                          onClick={() => handleTagToggle(tag.id)}
                        >
                          #{tag.name}
                        </Badge>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      已选择 {selectedTags.length} 个标签
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* 封面图片 */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <ImageIcon className="h-4 w-4" />
                    封面图片
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <FormField
                    control={form.control}
                    name="coverImage"
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input
                            placeholder="图片 URL"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription className="text-xs">
                          输入图片链接地址
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {form.watch('coverImage') && (
                    <div className="mt-4 relative aspect-video rounded-md overflow-hidden border">
                      <img
                        src={form.watch('coverImage')}
                        alt="封面预览"
                        className="object-cover w-full h-full"
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </form>
      </Form>
    </div>
  );
};

