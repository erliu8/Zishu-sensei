/**
 * CollectionManager Component
 * 收藏夹管理组件
 */

'use client';

import React, { useState } from 'react';
import { Plus, Edit2, Trash2, Loader2, FolderOpen, Check, X } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Textarea } from '@/shared/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
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
import { Badge } from '@/shared/components/ui/badge';
import { Card, CardContent } from '@/shared/components/ui/card';
import {
  useCollections,
  useCreateCollection,
  useUpdateCollection,
  useDeleteCollection,
} from '../hooks/useFavorite';
import type { FavoriteCollection, CreateCollectionInput } from '../domain/Favorite';
import { cn } from '@/shared/utils/cn';

/**
 * CollectionManager Props
 */
export interface CollectionManagerProps {
  /** 用户ID */
  userId?: string;
  /** 打开状态 */
  open: boolean;
  /** 关闭回调 */
  onClose: () => void;
  /** 选择收藏夹回调（可选） */
  onSelectCollection?: (collection: FavoriteCollection) => void;
}

/**
 * CollectionManager Component
 */
export const CollectionManager: React.FC<CollectionManagerProps> = ({
  userId,
  open,
  onClose,
  onSelectCollection,
}) => {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingCollection, setEditingCollection] = useState<FavoriteCollection | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FavoriteCollection | null>(null);
  const [formData, setFormData] = useState<CreateCollectionInput>({
    name: '',
    description: '',
    isPublic: false,
  });

  const { data: collections, isLoading } = useCollections(userId);
  const createMutation = useCreateCollection();
  const updateMutation = useUpdateCollection();
  const deleteMutation = useDeleteCollection();

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      isPublic: false,
    });
    setEditingCollection(null);
    setCreateDialogOpen(false);
  };

  const handleCreate = () => {
    setFormData({
      name: '',
      description: '',
      isPublic: false,
    });
    setEditingCollection(null);
    setCreateDialogOpen(true);
  };

  const handleEdit = (collection: FavoriteCollection) => {
    setFormData({
      name: collection.name,
      description: collection.description || '',
      isPublic: collection.isPublic,
    });
    setEditingCollection(collection);
    setCreateDialogOpen(true);
  };

  const handleSave = async () => {
    try {
      if (editingCollection) {
        await updateMutation.mutateAsync({
          id: editingCollection.id,
          input: formData,
        });
      } else {
        await createMutation.mutateAsync(formData);
      }
      resetForm();
    } catch (error) {
      console.error('Failed to save collection:', error);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;

    try {
      await deleteMutation.mutateAsync(deleteTarget.id);
      setDeleteTarget(null);
    } catch (error) {
      console.error('Failed to delete collection:', error);
    }
  };

  const handleSelect = (collection: FavoriteCollection) => {
    onSelectCollection?.(collection);
    onClose();
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <>
      {/* Main Dialog */}
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderOpen className="h-5 w-5" />
              管理收藏夹
            </DialogTitle>
            <DialogDescription>
              创建和管理你的收藏夹，更好地组织你的收藏内容
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 overflow-y-auto max-h-[50vh] py-2">
            {/* Create Button */}
            <Button
              onClick={handleCreate}
              className="w-full"
              variant="outline"
            >
              <Plus className="h-4 w-4 mr-2" />
              创建新收藏夹
            </Button>

            {/* Collections List */}
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : collections && collections.length > 0 ? (
              <div className="grid gap-3">
                {collections.map((collection) => (
                  <Card
                    key={collection.id}
                    className={cn(
                      'group hover:shadow-md transition-all cursor-pointer',
                      onSelectCollection && 'hover:border-primary'
                    )}
                    onClick={() => onSelectCollection && handleSelect(collection)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-semibold truncate">{collection.name}</h4>
                            {collection.isPublic && (
                              <Badge variant="secondary" className="text-xs">
                                公开
                              </Badge>
                            )}
                          </div>
                          {collection.description && (
                            <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                              {collection.description}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground">
                            {collection.itemCount || 0} 项收藏
                          </p>
                        </div>
                        <div className="flex gap-1 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEdit(collection);
                            }}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteTarget(collection);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <FolderOpen className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">暂无收藏夹</p>
                <p className="text-xs mt-1">创建收藏夹来组织你的收藏</p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={onClose}>
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create/Edit Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingCollection ? '编辑收藏夹' : '创建收藏夹'}
            </DialogTitle>
            <DialogDescription>
              {editingCollection
                ? '修改收藏夹信息'
                : '创建一个新的收藏夹来组织你的收藏'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label htmlFor="name" className="text-sm font-medium">
                名称 <span className="text-destructive">*</span>
              </label>
              <Input
                id="name"
                placeholder="输入收藏夹名称"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                maxLength={50}
              />
              <p className="text-xs text-muted-foreground">
                {formData.name.length}/50
              </p>
            </div>

            <div className="space-y-2">
              <label htmlFor="description" className="text-sm font-medium">
                描述
              </label>
              <Textarea
                id="description"
                placeholder="添加描述（可选）"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                rows={3}
                maxLength={200}
              />
              <p className="text-xs text-muted-foreground">
                {(formData.description?.length || 0)}/200
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant={formData.isPublic ? 'default' : 'outline'}
                size="sm"
                onClick={() =>
                  setFormData({ ...formData, isPublic: !formData.isPublic })
                }
              >
                {formData.isPublic ? (
                  <Check className="h-4 w-4 mr-2" />
                ) : (
                  <X className="h-4 w-4 mr-2" />
                )}
                {formData.isPublic ? '公开' : '私密'}
              </Button>
              <p className="text-xs text-muted-foreground">
                {formData.isPublic ? '其他人可以看到这个收藏夹' : '仅自己可见'}
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={resetForm} disabled={isSaving}>
              取消
            </Button>
            <Button
              onClick={handleSave}
              disabled={!formData.name.trim() || isSaving}
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  保存中...
                </>
              ) : (
                '保存'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={() => setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除收藏夹{' '}
              <span className="font-semibold">{deleteTarget?.name}</span> 吗？
              此操作将移除收藏夹，但不会删除其中的收藏项。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>
              取消
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              className="bg-destructive hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  删除中...
                </>
              ) : (
                '确认删除'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default CollectionManager;

