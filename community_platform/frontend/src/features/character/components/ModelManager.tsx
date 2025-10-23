/**
 * ModelManager 主组件
 * 模型管理的顶层容器组件，整合模型选择、上传、预览和物理参数配置
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import { Button } from '@/shared/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/shared/components/ui/card';
import { Alert, AlertDescription } from '@/shared/components/ui/alert';
import { Badge } from '@/shared/components/ui/badge';
import { LoadingSpinner } from '@/shared/components/common';
import { useToast } from '@/shared/components/ui/use-toast';
import {
  Save,
  AlertCircle,
  Plus,
  Trash2,
  Star,
  Upload,
  Eye,
  Settings,
} from 'lucide-react';
import { cn } from '@/shared/utils';
import { ModelPreview } from './ModelManager/ModelPreview';
import { PhysicsConfig } from './ModelManager/PhysicsConfig';
import { Live2DUpload } from './ModelManager/Live2DUpload';
import {
  useModels,
  useUpdateModel,
  useSetDefaultModel,
  useDeleteModel,
} from '../hooks';
import type { Model, UpdateModelInput, PhysicsConfig as PhysicsConfigType } from '../domain';
import { ModelType } from '../types';

export interface ModelManagerProps {
  /** 角色ID */
  characterId: string;
  /** 当前选中的模型ID（受控） */
  selectedModelId?: string;
  /** 选中模型变化回调 */
  onModelChange?: (modelId: string) => void;
  /** 保存成功回调 */
  onSaveSuccess?: (model: Model) => void;
  /** 是否显示上传功能 */
  showUpload?: boolean;
  /** 自定义类名 */
  className?: string;
}

export const ModelManager: React.FC<ModelManagerProps> = ({
  characterId,
  selectedModelId: controlledModelId,
  onModelChange,
  onSaveSuccess,
  showUpload = true,
  className,
}) => {
  const { toast } = useToast();

  // 获取模型列表
  const {
    data: models = [],
    isLoading,
    error,
  } = useModels(characterId);

  // 内部状态：选中的模型
  const [selectedModelId, setSelectedModelId] = useState<string | undefined>(
    controlledModelId
  );

  // 内部状态：是否显示上传界面
  const [showUploadView, setShowUploadView] = useState(false);

  // 内部状态：物理参数（临时值，未保存）
  const [physicsConfig, setPhysicsConfig] = useState<PhysicsConfigType>({
    gravity: 1.0,
    wind: 0.0,
    elasticity: 0.5,
    damping: 0.5,
  });

  // 内部状态：是否启用物理效果
  const [enablePhysics, setEnablePhysics] = useState(true);

  // 内部状态：是否有未保存的更改
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Mutations
  const updateModelMutation = useUpdateModel();
  const setDefaultModelMutation = useSetDefaultModel();
  const deleteModelMutation = useDeleteModel();

  // 获取当前选中的模型
  const selectedModel = models.find((m) => m.id === selectedModelId);

  // 同步受控值
  useEffect(() => {
    if (controlledModelId !== undefined) {
      setSelectedModelId(controlledModelId);
    }
  }, [controlledModelId]);

  // 当选中的模型改变时，更新物理参数
  useEffect(() => {
    if (selectedModel?.physics) {
      setPhysicsConfig(selectedModel.physics);
      setHasUnsavedChanges(false);
    }
  }, [selectedModel]);

  // 如果没有模型且不在加载中，默认选中第一个或默认模型
  useEffect(() => {
    if (!isLoading && models.length > 0 && !selectedModelId) {
      const defaultModel = models.find((m) => m.isDefault) || models[0];
      setSelectedModelId(defaultModel.id);
    }
  }, [models, isLoading, selectedModelId]);

  // 处理模型选择
  const handleModelSelect = (modelId: string) => {
    if (hasUnsavedChanges) {
      const confirmed = window.confirm('有未保存的更改，确定要切换模型吗？');
      if (!confirmed) return;
    }

    setSelectedModelId(modelId);
    onModelChange?.(modelId);
  };

  // 处理物理参数变化
  const handlePhysicsChange = (config: PhysicsConfigType) => {
    setPhysicsConfig(config);
    setHasUnsavedChanges(true);
  };

  // 处理保存
  const handleSave = async () => {
    if (!selectedModel) {
      toast({
        title: '保存失败',
        description: '请先选择一个模型',
        variant: 'destructive',
      });
      return;
    }

    try {
      const input: UpdateModelInput = {
        physics: physicsConfig,
      };

      const updatedModel = await updateModelMutation.mutateAsync({
        id: selectedModel.id,
        input,
      });

      setHasUnsavedChanges(false);

      toast({
        title: '保存成功',
        description: '模型配置已更新',
      });

      onSaveSuccess?.(updatedModel);
    } catch (error) {
      toast({
        title: '保存失败',
        description: error instanceof Error ? error.message : '未知错误',
        variant: 'destructive',
      });
    }
  };

  // 处理设置默认模型
  const handleSetDefault = async (modelId: string) => {
    try {
      await setDefaultModelMutation.mutateAsync(modelId);

      toast({
        title: '设置成功',
        description: '已设置为默认模型',
      });
    } catch (error) {
      toast({
        title: '设置失败',
        description: error instanceof Error ? error.message : '未知错误',
        variant: 'destructive',
      });
    }
  };

  // 处理删除模型
  const handleDelete = async (modelId: string) => {
    const confirmed = window.confirm('确定要删除这个模型吗？此操作无法撤销。');
    if (!confirmed) return;

    try {
      await deleteModelMutation.mutateAsync(modelId);

      toast({
        title: '删除成功',
        description: '模型已删除',
      });

      // 如果删除的是当前选中的模型，清空选择
      if (modelId === selectedModelId) {
        setSelectedModelId(undefined);
      }
    } catch (error) {
      toast({
        title: '删除失败',
        description: error instanceof Error ? error.message : '未知错误',
        variant: 'destructive',
      });
    }
  };

  // 处理重置物理参数
  const handleResetPhysics = () => {
    if (selectedModel?.physics) {
      setPhysicsConfig(selectedModel.physics);
      setHasUnsavedChanges(false);
    }
  };

  // 处理上传成功
  const handleUploadSuccess = (modelId: string, modelUrl: string) => {
    setShowUploadView(false);
    setSelectedModelId(modelId);

    toast({
      title: '上传成功',
      description: '模型已成功上传，可以开始配置了',
    });
  };

  // 加载状态
  if (isLoading) {
    return (
      <Card className={className}>
        <CardContent className="p-12 flex items-center justify-center">
          <LoadingSpinner size="lg" text="加载模型配置中..." />
        </CardContent>
      </Card>
    );
  }

  // 错误状态
  if (error) {
    return (
      <Card className={className}>
        <CardContent className="p-8">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              加载模型配置失败: {error instanceof Error ? error.message : '未知错误'}
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  // 上传视图
  if (showUploadView) {
    return (
      <Live2DUpload
        characterId={characterId}
        onUploadSuccess={handleUploadSuccess}
        onCancel={() => setShowUploadView(false)}
        className={className}
      />
    );
  }

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>模型管理</CardTitle>
            <CardDescription>
              管理角色的 3D/2D 模型，配置物理参数和预览效果
            </CardDescription>
          </div>
          {showUpload && (
            <Button onClick={() => setShowUploadView(true)} variant="outline" size="sm">
              <Plus className="w-4 h-4 mr-2" />
              上传模型
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent>
        {models.length === 0 ? (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              还没有配置模型。请点击"上传模型"按钮开始配置。
            </AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-6">
            {/* 模型选择器 */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">选择模型</label>
                <span className="text-xs text-muted-foreground">
                  {models.length} 个可用模型
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {models.map((model) => {
                  const isSelected = model.id === selectedModelId;

                  return (
                    <Card
                      key={model.id}
                      className={cn(
                        'cursor-pointer transition-all hover:shadow-md',
                        isSelected && 'ring-2 ring-primary'
                      )}
                      onClick={() => handleModelSelect(model.id)}
                    >
                      <CardContent className="p-4">
                        {/* 缩略图 */}
                        {model.thumbnailUrl && (
                          <div className="aspect-square mb-3 rounded-md overflow-hidden bg-muted">
                            <img
                              src={model.thumbnailUrl}
                              alt={model.name}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        )}

                        {/* 模型信息 */}
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium text-sm truncate flex-1">
                              {model.name}
                            </h4>
                            {model.isDefault && (
                              <Star className="w-4 h-4 fill-yellow-400 text-yellow-400 flex-shrink-0" />
                            )}
                          </div>

                          <div className="flex flex-wrap gap-1">
                            <Badge variant="outline" className="text-xs">
                              {model.type}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              v{model.version}
                            </Badge>
                          </div>

                          {/* 操作按钮 */}
                          <div className="flex gap-1 mt-2">
                            {!model.isDefault && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSetDefault(model.id);
                                }}
                                className="h-7 px-2 text-xs flex-1"
                              >
                                <Star className="w-3 h-3 mr-1" />
                                设为默认
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(model.id);
                              }}
                              className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                            >
                              <Trash2 className="w-3 h-3 mr-1" />
                              删除
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>

            {/* 模型详情 Tabs */}
            {selectedModel && (
              <Tabs defaultValue="preview" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="preview">
                    <Eye className="w-4 h-4 mr-2" />
                    预览
                  </TabsTrigger>
                  <TabsTrigger value="physics">
                    <Settings className="w-4 h-4 mr-2" />
                    物理参数
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="preview" className="mt-6">
                  <ModelPreview
                    model={selectedModel}
                    physics={physicsConfig}
                    enablePhysics={enablePhysics}
                  />
                </TabsContent>

                <TabsContent value="physics" className="mt-6">
                  <PhysicsConfig
                    config={physicsConfig}
                    onChange={handlePhysicsChange}
                    onReset={handleResetPhysics}
                    enabled={enablePhysics}
                    onEnabledChange={setEnablePhysics}
                  />
                </TabsContent>
              </Tabs>
            )}
          </div>
        )}
      </CardContent>

      {selectedModel && hasUnsavedChanges && (
        <CardFooter className="border-t bg-muted/50 flex justify-between items-center">
          <div className="flex items-center text-sm text-muted-foreground">
            <AlertCircle className="w-4 h-4 mr-2" />
            有未保存的更改
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleResetPhysics}
              disabled={updateModelMutation.isPending}
            >
              取消
            </Button>
            <Button onClick={handleSave} disabled={updateModelMutation.isPending}>
              {updateModelMutation.isPending ? (
                <>
                  <LoadingSpinner size="sm" className="mr-2" />
                  保存中...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  保存更改
                </>
              )}
            </Button>
          </div>
        </CardFooter>
      )}
    </Card>
  );
};

ModelManager.displayName = 'ModelManager';

