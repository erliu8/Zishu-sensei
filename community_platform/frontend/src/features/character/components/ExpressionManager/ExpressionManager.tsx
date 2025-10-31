/**
 * 表情管理器主组件
 * @module features/character/components/ExpressionManager/ExpressionManager
 */

'use client';

import React, { useState } from 'react';
import { Plus, Download, Upload as UploadIcon } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/shared/components/ui/card';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { ExpressionList } from './ExpressionList';
import { ExpressionEditor } from './ExpressionEditor';
import {
  useCharacterExpressions,
  useCreateExpression,
  useUpdateExpression,
  useDeleteExpression,
  useDuplicateExpression,
  useToggleExpressionStatus,
  useSetDefaultExpression,
} from '../../hooks/useExpressions';
import type { Expression, CreateExpressionDto, UpdateExpressionDto } from '../../domain/expression';
import { cn } from '@/shared/utils/cn';

interface ExpressionManagerProps {
  characterId: string;
  className?: string;
}

type ViewMode = 'list' | 'create' | 'edit';

export function ExpressionManager({ characterId, className }: ExpressionManagerProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedExpression, setSelectedExpression] = useState<Expression | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // 查询hooks
  const { data: expressions, isLoading, error } = useCharacterExpressions(characterId);

  // 变更hooks
  const createMutation = useCreateExpression();
  const updateMutation = useUpdateExpression();
  const deleteMutation = useDeleteExpression();
  const duplicateMutation = useDuplicateExpression();
  const toggleStatusMutation = useToggleExpressionStatus();
  const setDefaultMutation = useSetDefaultExpression();

  const handleCreate = () => {
    setSelectedExpression(null);
    setViewMode('create');
  };

  const handleEdit = (expression: Expression) => {
    setSelectedExpression(expression);
    setViewMode('edit');
  };

  const handleSave = async (data: CreateExpressionDto | UpdateExpressionDto) => {
    try {
      if (viewMode === 'create') {
        await createMutation.mutateAsync(data as CreateExpressionDto);
      } else if (viewMode === 'edit' && selectedExpression) {
        await updateMutation.mutateAsync({
          id: selectedExpression.id,
          data: data as UpdateExpressionDto,
        });
      }
      setViewMode('list');
      setSelectedExpression(null);
    } catch (error) {
      // 错误已在hook中处理
      console.error('Save failed:', error);
    }
  };

  const handleCancel = () => {
    setViewMode('list');
    setSelectedExpression(null);
  };

  const handleDelete = async (id: string) => {
    await deleteMutation.mutateAsync(id);
  };

  const handleDuplicate = async (id: string) => {
    await duplicateMutation.mutateAsync(id);
  };

  const handleToggleStatus = async (id: string, isActive: boolean) => {
    await toggleStatusMutation.mutateAsync({ id, isActive });
  };

  const handleSetDefault = async (id: string) => {
    await setDefaultMutation.mutateAsync({ characterId, expressionId: id });
  };

  const handleExport = () => {
    if (!expressions || expressions.length === 0) return;

    const dataStr = JSON.stringify(expressions, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `expressions_${characterId}_${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        const importedExpressions = JSON.parse(text);
        // TODO: 实现批量导入逻辑
        console.log('Imported expressions:', importedExpressions);
      } catch (error) {
        console.error('Import failed:', error);
      }
    };
    input.click();
  };

  // 加载状态
  if (isLoading) {
    return (
      <div className={cn('space-y-4', className)}>
        <ExpressionManagerSkeleton />
      </div>
    );
  }

  // 错误状态
  if (error) {
    return (
      <Card className={className}>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <p className="text-destructive">加载失败: {error.message}</p>
          <Button className="mt-4" onClick={() => window.location.reload()}>
            重试
          </Button>
        </CardContent>
      </Card>
    );
  }

  // 列表视图
  if (viewMode === 'list') {
    return (
      <div className={cn('space-y-6', className)}>
        {/* 头部 */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle>表情管理</CardTitle>
                <CardDescription>
                  管理角色的所有表情和触发条件
                  {expressions && (
                    <span className="ml-2">
                      · 共 {expressions.length} 个表情
                    </span>
                  )}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleImport}
                  disabled={!expressions}
                >
                  <UploadIcon className="mr-2 h-4 w-4" />
                  导入
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExport}
                  disabled={!expressions || expressions.length === 0}
                >
                  <Download className="mr-2 h-4 w-4" />
                  导出
                </Button>
                <Button onClick={handleCreate}>
                  <Plus className="mr-2 h-4 w-4" />
                  新建表情
                </Button>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* 表情列表 */}
        <ExpressionList
          expressions={expressions || []}
          selectedIds={selectedIds}
          onSelect={setSelectedIds}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onDuplicate={handleDuplicate}
          onToggleStatus={handleToggleStatus}
          onSetDefault={handleSetDefault}
          enableSelection={true}
          enableReorder={true}
        />

        {/* 统计信息 */}
        {expressions && expressions.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">统计信息</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">总表情数</p>
                  <p className="text-2xl font-bold">{expressions.length}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">已启用</p>
                  <p className="text-2xl font-bold">
                    {expressions.filter((e) => e.isActive).length}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">默认表情</p>
                  <p className="text-2xl font-bold">
                    {expressions.filter((e) => e.isDefault).length}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">触发条件</p>
                  <p className="text-2xl font-bold">
                    {expressions.reduce((sum, e) => sum + (e.triggers?.length || 0), 0)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  // 创建/编辑视图
  return (
    <div className={cn('space-y-6', className)}>
      <Card>
        <CardHeader>
          <CardTitle>
            {viewMode === 'create' ? '创建表情' : '编辑表情'}
          </CardTitle>
          <CardDescription>
            {viewMode === 'create'
              ? '为角色创建新的表情配置'
              : '修改现有表情的配置'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ExpressionEditor
            expression={selectedExpression || undefined}
            characterId={characterId}
            onSave={handleSave}
            onCancel={handleCancel}
          />
        </CardContent>
      </Card>
    </div>
  );
}

// 骨架屏组件
function ExpressionManagerSkeleton() {
  return (
    <>
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32 mb-2" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Card key={i}>
            <Skeleton className="aspect-video w-full" />
            <CardContent className="p-4 space-y-3">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <div className="flex gap-2">
                <Skeleton className="h-5 w-16" />
                <Skeleton className="h-5 w-16" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}

// 导出所有组件
export { ExpressionList } from './ExpressionList';
export { ExpressionEditor } from './ExpressionEditor';
export { TriggerConfig } from './TriggerConfig';

