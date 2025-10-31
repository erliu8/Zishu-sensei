/**
 * 表情编辑器组件
 * @module features/character/components/ExpressionManager/ExpressionEditor
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Upload, X, FileVideo, Loader2 } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Textarea } from '@/shared/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { Switch } from '@/shared/components/ui/switch';
import { Slider } from '@/shared/components/ui/slider';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import { Separator } from '@/shared/components/ui/separator';
import { TriggerConfig } from './TriggerConfig';
import type {
  Expression,
  CreateExpressionDto,
  UpdateExpressionDto,
  TriggerCondition,
  ExpressionConfig,
} from '../../domain/expression';
import {
  EmotionType,
  ExpressionUtils,
  DEFAULT_EXPRESSION_CONFIG,
} from '../../domain/expression';
import { useUploadExpressionFile } from '../../hooks/useExpressions';
import { cn } from '@/shared/utils/cn';
import { toast } from '@/shared/components/ui/use-toast';

interface ExpressionEditorProps {
  expression?: Expression;
  characterId: string;
  onSave: (data: CreateExpressionDto | UpdateExpressionDto) => void;
  onCancel: () => void;
  className?: string;
}

interface FormData {
  name: string;
  displayName: string;
  description: string;
  emotionType: EmotionType;
  motionGroup: string;
  motionIndex: number;
  expressionFile: string;
  triggers: TriggerCondition[];
  config: ExpressionConfig;
  thumbnailUrl: string;
  previewUrl: string;
  isDefault: boolean;
  isActive: boolean;
  tags: string[];
  weight: number;
}

export function ExpressionEditor({
  expression,
  characterId,
  onSave,
  onCancel,
  className,
}: ExpressionEditorProps) {
  const isEditing = !!expression;
  const uploadMutation = useUploadExpressionFile();

  const [formData, setFormData] = useState<FormData>({
    name: expression?.name || '',
    displayName: expression?.displayName || '',
    description: expression?.description || '',
    emotionType: expression?.emotionType || EmotionType.NEUTRAL,
    motionGroup: expression?.motionGroup || '',
    motionIndex: expression?.motionIndex || 0,
    expressionFile: expression?.expressionFile || '',
    triggers: expression?.triggers || [],
    config: expression?.config || DEFAULT_EXPRESSION_CONFIG,
    thumbnailUrl: expression?.thumbnailUrl || '',
    previewUrl: expression?.previewUrl || '',
    isDefault: expression?.isDefault || false,
    isActive: expression?.isActive !== undefined ? expression.isActive : true,
    tags: expression?.tags || [],
    weight: expression?.weight || 1,
  });

  const [tagInput, setTagInput] = useState('');
  const [errors, setErrors] = useState<string[]>([]);

  // 当情绪类型改变时，自动更新配置
  useEffect(() => {
    if (!isEditing) {
      const emotionDefaults = ExpressionUtils.getEmotionDefaults(formData.emotionType);
      setFormData((prev) => ({
        ...prev,
        config: { ...prev.config, ...emotionDefaults },
      }));
    }
  }, [formData.emotionType, isEditing]);

  const updateField = <K extends keyof FormData>(field: K, value: FormData[K]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const updateConfig = <K extends keyof ExpressionConfig>(
    field: K,
    value: ExpressionConfig[K]
  ) => {
    setFormData((prev) => ({
      ...prev,
      config: { ...prev.config, [field]: value },
    }));
  };

  const handleAddTag = () => {
    const tag = tagInput.trim();
    if (tag && !formData.tags.includes(tag)) {
      updateField('tags', [...formData.tags, tag]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    updateField('tags', formData.tags.filter((t) => t !== tag));
  };

  const handleFileUpload = async (file: File, type: 'thumbnail' | 'preview' | 'expression') => {
    try {
      const result = await uploadMutation.mutateAsync(file);
      
      if (type === 'thumbnail') {
        updateField('thumbnailUrl', result.url);
      } else if (type === 'preview') {
        updateField('previewUrl', result.url);
      } else {
        updateField('expressionFile', result.url);
      }

      toast({
        title: '文件上传成功',
        variant: 'default',
        description: '文件上传成功',
      });
    } catch (error) {
      toast({
        title: '文件上传失败',
        variant: 'destructive',
      });
    }
  };

  const validateForm = (): boolean => {
    const newErrors: string[] = [];

    if (!formData.name.trim()) {
      newErrors.push('表情名称不能为空');
    }

    if (!formData.displayName.trim()) {
      newErrors.push('显示名称不能为空');
    }

    // 验证触发条件
    formData.triggers.forEach((trigger, index) => {
      const result = ExpressionUtils.validateTrigger(trigger);
      if (!result.isValid && result.errors) {
        newErrors.push(`触发条件 ${index + 1}: ${result.errors.join(', ')}`);
      }
    });

    setErrors(newErrors);
    return newErrors.length === 0;
  };

  const handleSave = () => {
    if (!validateForm()) {
      toast({
        title: '请修正表单错误',
        variant: 'destructive',
      });
      return;
    }

    const data: CreateExpressionDto | UpdateExpressionDto = isEditing
      ? {
          displayName: formData.displayName,
          description: formData.description,
          emotionType: formData.emotionType,
          motionGroup: formData.motionGroup,
          motionIndex: formData.motionIndex,
          expressionFile: formData.expressionFile,
          triggers: formData.triggers,
          config: formData.config,
          thumbnailUrl: formData.thumbnailUrl,
          previewUrl: formData.previewUrl,
          isDefault: formData.isDefault,
          isActive: formData.isActive,
          tags: formData.tags,
          weight: formData.weight,
        }
      : {
          characterId,
          name: formData.name,
          displayName: formData.displayName,
          description: formData.description,
          emotionType: formData.emotionType,
          motionGroup: formData.motionGroup,
          motionIndex: formData.motionIndex,
          expressionFile: formData.expressionFile,
          triggers: formData.triggers,
          config: formData.config,
          thumbnailUrl: formData.thumbnailUrl,
          previewUrl: formData.previewUrl,
          isDefault: formData.isDefault,
          isActive: formData.isActive,
          tags: formData.tags,
          weight: formData.weight,
        };

    onSave(data);
  };

  return (
    <div className={cn('space-y-6', className)}>
      {/* 错误提示 */}
      {errors.length > 0 && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <ul className="list-disc list-inside space-y-1 text-destructive">
              {errors.map((error, i) => (
                <li key={i}>{error}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="basic" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="basic">基本信息</TabsTrigger>
          <TabsTrigger value="live2d">Live2D配置</TabsTrigger>
          <TabsTrigger value="triggers">触发条件</TabsTrigger>
          <TabsTrigger value="advanced">高级设置</TabsTrigger>
        </TabsList>

        {/* 基本信息 */}
        <TabsContent value="basic" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>基本信息</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* 表情名称（仅新建时） */}
              {!isEditing && (
                <div className="space-y-2">
                  <Label htmlFor="name">
                    表情名称 <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => updateField('name', e.target.value)}
                    placeholder="例如：happy_01"
                  />
                  <p className="text-xs text-muted-foreground">
                    唯一标识符，创建后不可修改
                  </p>
                </div>
              )}

              {/* 显示名称 */}
              <div className="space-y-2">
                <Label htmlFor="displayName">
                  显示名称 <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="displayName"
                  value={formData.displayName}
                  onChange={(e) => updateField('displayName', e.target.value)}
                  placeholder="例如：开心"
                />
              </div>

              {/* 情绪类型 */}
              <div className="space-y-2">
                <Label>情绪类型</Label>
                <Select
                  value={formData.emotionType}
                  onValueChange={(value: EmotionType) => updateField('emotionType', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.values(EmotionType).map((emotion) => (
                      <SelectItem key={emotion} value={emotion}>
                        {ExpressionUtils.getEmotionDisplayName(emotion)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* 描述 */}
              <div className="space-y-2">
                <Label htmlFor="description">描述</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => updateField('description', e.target.value)}
                  placeholder="描述这个表情的用途和特点..."
                  rows={3}
                />
              </div>

              {/* 标签 */}
              <div className="space-y-2">
                <Label>标签</Label>
                <div className="flex gap-2">
                  <Input
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAddTag()}
                    placeholder="输入标签后按回车"
                  />
                  <Button type="button" onClick={handleAddTag}>
                    添加
                  </Button>
                </div>
                {formData.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {formData.tags.map((tag) => (
                      <Badge key={tag} variant="secondary">
                        {tag}
                        <button
                          type="button"
                          onClick={() => handleRemoveTag(tag)}
                          className="ml-2 hover:text-destructive"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              {/* 缩略图 */}
              <div className="space-y-2">
                <Label>缩略图</Label>
                <FileUploadZone
                  accept="image/*"
                  currentUrl={formData.thumbnailUrl}
                  onUpload={(file) => handleFileUpload(file, 'thumbnail')}
                  onClear={() => updateField('thumbnailUrl', '')}
                  isUploading={uploadMutation.isPending}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Live2D配置 */}
        <TabsContent value="live2d" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Live2D 配置</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* 动作组 */}
              <div className="space-y-2">
                <Label htmlFor="motionGroup">动作组名称</Label>
                <Input
                  id="motionGroup"
                  value={formData.motionGroup}
                  onChange={(e) => updateField('motionGroup', e.target.value)}
                  placeholder="例如：Idle, TapBody"
                />
              </div>

              {/* 动作索引 */}
              <div className="space-y-2">
                <Label htmlFor="motionIndex">动作索引</Label>
                <Input
                  id="motionIndex"
                  type="number"
                  value={formData.motionIndex}
                  onChange={(e) => updateField('motionIndex', parseInt(e.target.value) || 0)}
                  min={0}
                />
              </div>

              {/* 表情文件 */}
              <div className="space-y-2">
                <Label>表情文件</Label>
                <FileUploadZone
                  accept=".exp3.json,.json"
                  currentUrl={formData.expressionFile}
                  onUpload={(file) => handleFileUpload(file, 'expression')}
                  onClear={() => updateField('expressionFile', '')}
                  isUploading={uploadMutation.isPending}
                  fileType="expression"
                />
              </div>

              {/* 预览 */}
              <div className="space-y-2">
                <Label>预览图/视频</Label>
                <FileUploadZone
                  accept="image/*,video/*"
                  currentUrl={formData.previewUrl}
                  onUpload={(file) => handleFileUpload(file, 'preview')}
                  onClear={() => updateField('previewUrl', '')}
                  isUploading={uploadMutation.isPending}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 触发条件 */}
        <TabsContent value="triggers">
          <TriggerConfig
            triggers={formData.triggers}
            onChange={(triggers) => updateField('triggers', triggers)}
          />
        </TabsContent>

        {/* 高级设置 */}
        <TabsContent value="advanced" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>表情配置</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* 持续时间 */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>持续时间</Label>
                  <span className="text-sm text-muted-foreground">
                    {formData.config.duration || 0}ms
                  </span>
                </div>
                <Slider
                  value={[formData.config.duration || 2000]}
                  onValueChange={([value]) => updateConfig('duration', value)}
                  min={0}
                  max={10000}
                  step={100}
                />
              </div>

              {/* 过渡时间 */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>过渡时间</Label>
                  <span className="text-sm text-muted-foreground">
                    {formData.config.transitionDuration || 0}ms
                  </span>
                </div>
                <Slider
                  value={[formData.config.transitionDuration || 300]}
                  onValueChange={([value]) => updateConfig('transitionDuration', value)}
                  min={0}
                  max={2000}
                  step={50}
                />
              </div>

              <Separator />

              {/* 循环播放 */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>循环播放</Label>
                  <p className="text-sm text-muted-foreground">
                    表情动画是否循环播放
                  </p>
                </div>
                <Switch
                  checked={formData.config.loop || false}
                  onCheckedChange={(checked) => updateConfig('loop', checked)}
                />
              </div>

              {/* 自动返回 */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>自动返回默认表情</Label>
                  <p className="text-sm text-muted-foreground">
                    播放完成后自动返回默认表情
                  </p>
                </div>
                <Switch
                  checked={formData.config.autoReturn !== false}
                  onCheckedChange={(checked) => updateConfig('autoReturn', checked)}
                />
              </div>

              <Separator />

              {/* 混合模式 */}
              <div className="space-y-2">
                <Label>混合模式</Label>
                <Select
                  value={formData.config.blendMode || 'replace'}
                  onValueChange={(value: 'replace' | 'blend') =>
                    updateConfig('blendMode', value)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="replace">替换</SelectItem>
                    <SelectItem value="blend">混合</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>其他设置</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* 权重 */}
              <div className="space-y-2">
                <Label htmlFor="weight">权重（用于随机选择）</Label>
                <Input
                  id="weight"
                  type="number"
                  value={formData.weight}
                  onChange={(e) => updateField('weight', parseFloat(e.target.value) || 1)}
                  min={0}
                  step={0.1}
                />
              </div>

              {/* 设为默认 */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>设为默认表情</Label>
                  <p className="text-sm text-muted-foreground">
                    角色的默认表情状态
                  </p>
                </div>
                <Switch
                  checked={formData.isDefault}
                  onCheckedChange={(checked) => updateField('isDefault', checked)}
                />
              </div>

              {/* 启用状态 */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>启用状态</Label>
                  <p className="text-sm text-muted-foreground">
                    是否启用这个表情
                  </p>
                </div>
                <Switch
                  checked={formData.isActive}
                  onCheckedChange={(checked) => updateField('isActive', checked)}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* 操作按钮 */}
      <div className="flex items-center justify-end gap-3 pt-6 border-t">
        <Button variant="outline" onClick={onCancel}>
          取消
        </Button>
        <Button onClick={handleSave}>
          {isEditing ? '保存更改' : '创建表情'}
        </Button>
      </div>
    </div>
  );
}

// 文件上传区域组件
interface FileUploadZoneProps {
  accept: string;
  currentUrl?: string;
  onUpload: (file: File) => void;
  onClear: () => void;
  isUploading?: boolean;
  fileType?: 'image' | 'expression' | 'preview';
}

function FileUploadZone({
  accept,
  currentUrl,
  onUpload,
  onClear,
  isUploading,
  fileType = 'image',
}: FileUploadZoneProps) {
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onUpload(file);
    }
  };

  return (
    <div className="space-y-2">
      {currentUrl ? (
        <div className="relative group">
          {fileType === 'image' || fileType === 'preview' ? (
            <img
              src={currentUrl}
              alt="preview"
              className="w-full h-48 object-cover rounded-lg"
            />
          ) : (
            <div className="flex items-center gap-2 p-4 bg-muted rounded-lg">
              <FileVideo className="h-5 w-5" />
              <span className="text-sm truncate flex-1">{currentUrl}</span>
            </div>
          )}
          <Button
            variant="destructive"
            size="sm"
            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={onClear}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
          {isUploading ? (
            <Loader2 className="h-12 w-12 text-muted-foreground animate-spin" />
          ) : (
            <>
              <Upload className="h-12 w-12 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                点击上传或拖拽文件到这里
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                支持的格式: {accept}
              </p>
            </>
          )}
          <input
            type="file"
            className="hidden"
            accept={accept}
            onChange={handleFileChange}
            disabled={isUploading}
          />
        </label>
      )}
    </div>
  );
}

