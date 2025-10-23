/**
 * 表情列表组件
 * @module features/character/components/ExpressionManager/ExpressionList
 */

'use client';

import React, { useState } from 'react';
import {
  MoreVertical,
  Trash2,
  Copy,
  Edit,
  Star,
  StarOff,
  Eye,
  EyeOff,
  GripVertical,
  Image as ImageIcon,
} from 'lucide-react';
import { Card, CardContent } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import { Checkbox } from '@/shared/components/ui/checkbox';
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
import { Input } from '@/shared/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import type { Expression } from '../../domain/expression';
import { EmotionType, ExpressionUtils } from '../../domain/expression';
import { cn } from '@/shared/utils/cn';

interface ExpressionListProps {
  expressions: Expression[];
  selectedIds?: string[];
  onSelect?: (ids: string[]) => void;
  onEdit?: (expression: Expression) => void;
  onDelete?: (id: string) => void;
  onDuplicate?: (id: string) => void;
  onToggleStatus?: (id: string, isActive: boolean) => void;
  onSetDefault?: (id: string) => void;
  className?: string;
  enableSelection?: boolean;
  enableReorder?: boolean;
}

export function ExpressionList({
  expressions,
  selectedIds = [],
  onSelect,
  onEdit,
  onDelete,
  onDuplicate,
  onToggleStatus,
  onSetDefault,
  className,
  enableSelection = false,
  enableReorder = false,
}: ExpressionListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [emotionFilter, setEmotionFilter] = useState<EmotionType | 'all'>('all');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // 过滤表情
  const filteredExpressions = expressions.filter((exp) => {
    const matchesSearch =
      exp.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      exp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      exp.description?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesEmotion = emotionFilter === 'all' || exp.emotionType === emotionFilter;

    return matchesSearch && matchesEmotion;
  });

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      onSelect?.(filteredExpressions.map((exp) => exp.id));
    } else {
      onSelect?.([]);
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    if (checked) {
      onSelect?.([...selectedIds, id]);
    } else {
      onSelect?.(selectedIds.filter((selectedId) => selectedId !== id));
    }
  };

  const handleDelete = (id: string) => {
    setDeleteId(id);
  };

  const confirmDelete = () => {
    if (deleteId) {
      onDelete?.(deleteId);
      setDeleteId(null);
    }
  };

  return (
    <div className={cn('space-y-4', className)}>
      {/* 过滤和搜索 */}
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <Input
            placeholder="搜索表情..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Select
          value={emotionFilter}
          onValueChange={(value) => setEmotionFilter(value as EmotionType | 'all')}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="筛选情绪" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部情绪</SelectItem>
            {Object.values(EmotionType).map((emotion) => (
              <SelectItem key={emotion} value={emotion}>
                {ExpressionUtils.getEmotionDisplayName(emotion)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* 批量操作栏 */}
      {enableSelection && selectedIds.length > 0 && (
        <Card className="bg-primary/5">
          <CardContent className="flex items-center justify-between py-3">
            <span className="text-sm font-medium">
              已选择 {selectedIds.length} 项
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onSelect?.([])}
              >
                取消选择
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  // TODO: 实现批量删除
                }}
              >
                批量删除
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 表情列表 */}
      {filteredExpressions.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <ImageIcon className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-center">
              {searchTerm || emotionFilter !== 'all'
                ? '没有找到匹配的表情'
                : '暂无表情数据'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredExpressions.map((expression) => (
            <ExpressionCard
              key={expression.id}
              expression={expression}
              selected={selectedIds.includes(expression.id)}
              onSelect={
                enableSelection
                  ? (checked) => handleSelectOne(expression.id, checked)
                  : undefined
              }
              onEdit={() => onEdit?.(expression)}
              onDelete={() => handleDelete(expression.id)}
              onDuplicate={() => onDuplicate?.(expression.id)}
              onToggleStatus={(isActive) =>
                onToggleStatus?.(expression.id, isActive)
              }
              onSetDefault={() => onSetDefault?.(expression.id)}
              showReorderHandle={enableReorder}
            />
          ))}
        </div>
      )}

      {/* 删除确认对话框 */}
      <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              此操作无法撤销。确定要删除这个表情吗？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive">
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

interface ExpressionCardProps {
  expression: Expression;
  selected?: boolean;
  onSelect?: (checked: boolean) => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onDuplicate?: () => void;
  onToggleStatus?: (isActive: boolean) => void;
  onSetDefault?: () => void;
  showReorderHandle?: boolean;
}

function ExpressionCard({
  expression,
  selected,
  onSelect,
  onEdit,
  onDelete,
  onDuplicate,
  onToggleStatus,
  onSetDefault,
  showReorderHandle,
}: ExpressionCardProps) {
  return (
    <Card
      className={cn(
        'group relative overflow-hidden transition-all hover:shadow-md',
        selected && 'ring-2 ring-primary',
        !expression.isActive && 'opacity-60'
      )}
    >
      {/* 缩略图 */}
      <div className="relative aspect-video bg-gradient-to-br from-primary/10 to-primary/5">
        {expression.thumbnailUrl ? (
          <img
            src={expression.thumbnailUrl}
            alt={expression.displayName}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <ImageIcon className="h-16 w-16 text-muted-foreground" />
          </div>
        )}

        {/* 拖拽手柄 */}
        {showReorderHandle && (
          <div className="absolute top-2 left-2 cursor-move bg-background/80 rounded p-1">
            <GripVertical className="h-4 w-4" />
          </div>
        )}

        {/* 选择框 */}
        {onSelect && (
          <div className="absolute top-2 right-2">
            <Checkbox
              checked={selected}
              onCheckedChange={onSelect}
              className="bg-background"
            />
          </div>
        )}

        {/* 默认标识 */}
        {expression.isDefault && (
          <Badge className="absolute bottom-2 left-2">
            <Star className="h-3 w-3 mr-1" />
            默认
          </Badge>
        )}

        {/* 状态标识 */}
        {!expression.isActive && (
          <Badge variant="secondary" className="absolute bottom-2 right-2">
            <EyeOff className="h-3 w-3 mr-1" />
            已禁用
          </Badge>
        )}
      </div>

      <CardContent className="p-4 space-y-3">
        {/* 标题和情绪 */}
        <div>
          <div className="flex items-start justify-between gap-2">
            <h4 className="font-semibold line-clamp-1">{expression.displayName}</h4>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onEdit}>
                  <Edit className="mr-2 h-4 w-4" />
                  编辑
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onDuplicate}>
                  <Copy className="mr-2 h-4 w-4" />
                  复制
                </DropdownMenuItem>
                {!expression.isDefault && (
                  <DropdownMenuItem onClick={onSetDefault}>
                    <Star className="mr-2 h-4 w-4" />
                    设为默认
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  onClick={() => onToggleStatus?.(!expression.isActive)}
                >
                  {expression.isActive ? (
                    <>
                      <EyeOff className="mr-2 h-4 w-4" />
                      禁用
                    </>
                  ) : (
                    <>
                      <Eye className="mr-2 h-4 w-4" />
                      启用
                    </>
                  )}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onDelete} className="text-destructive">
                  <Trash2 className="mr-2 h-4 w-4" />
                  删除
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <Badge variant="outline" className="mt-2">
            {ExpressionUtils.getEmotionDisplayName(expression.emotionType)}
          </Badge>
        </div>

        {/* 描述 */}
        {expression.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {expression.description}
          </p>
        )}

        {/* 统计信息 */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span>{expression.triggers?.length || 0} 个触发条件</span>
          {expression.tags && expression.tags.length > 0 && (
            <span>{expression.tags.length} 个标签</span>
          )}
        </div>

        {/* 标签 */}
        {expression.tags && expression.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {expression.tags.slice(0, 3).map((tag) => (
              <Badge key={tag} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
            {expression.tags.length > 3 && (
              <Badge variant="secondary" className="text-xs">
                +{expression.tags.length - 3}
              </Badge>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

