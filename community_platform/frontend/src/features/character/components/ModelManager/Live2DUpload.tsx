/**
 * Live2DUpload 组件
 * Live2D 模型上传和管理
 */

'use client';

import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Progress } from '@/shared/components/ui/progress';
import { Badge } from '@/shared/components/ui/badge';
import { Alert, AlertDescription } from '@/shared/components/ui/alert';
import { FileUploader } from '@/shared/components/common/FileUploader';
import { useToast } from '@/shared/components/ui/use-toast';
import {
  Upload,
  AlertCircle,
  CheckCircle2,
  Info,
  X,
  FileArchive,
  Image as ImageIcon,
} from 'lucide-react';
import { cn } from '@/shared/utils';
import { useUploadModelFile, useValidateModel } from '../../hooks';

export interface Live2DUploadProps {
  /** 角色ID */
  characterId: string;
  /** 上传成功回调 */
  onUploadSuccess?: (modelId: string, modelUrl: string) => void;
  /** 上传失败回调 */
  onUploadError?: (error: Error) => void;
  /** 取消上传回调 */
  onCancel?: () => void;
  /** 自定义类名 */
  className?: string;
}

interface UploadState {
  status: 'idle' | 'validating' | 'uploading' | 'success' | 'error';
  progress: number;
  message?: string;
  modelId?: string;
  modelUrl?: string;
}

export const Live2DUpload: React.FC<Live2DUploadProps> = ({
  characterId,
  onUploadSuccess,
  onUploadError,
  onCancel,
  className,
}) => {
  const { toast } = useToast();

  // 状态
  const [modelFile, setModelFile] = useState<File | null>(null);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [modelName, setModelName] = useState('');
  const [modelVersion, setModelVersion] = useState('1.0.0');
  const [uploadState, setUploadState] = useState<UploadState>({
    status: 'idle',
    progress: 0,
  });

  // Mutations
  const validateModelMutation = useValidateModel();
  const uploadModelMutation = useUploadModelFile();

  // 验证模型文件
  const validateModel = async (file: File): Promise<boolean> => {
    setUploadState({ status: 'validating', progress: 0, message: '正在验证模型文件...' });

    try {
      const result = await validateModelMutation.mutateAsync(file);

      if (result.valid) {
        setUploadState({
          status: 'idle',
          progress: 0,
          message: '模型文件验证通过',
        });

        toast({
          title: '验证成功',
          description: 'Live2D 模型文件格式正确',
        });

        return true;
      } else {
        setUploadState({
          status: 'error',
          progress: 0,
          message: result.errors?.join(', ') || '模型验证失败',
        });

        toast({
          title: '验证失败',
          description: result.errors?.join(', ') || '模型文件格式不正确',
          variant: 'destructive',
        });

        return false;
      }
    } catch (error) {
      setUploadState({
        status: 'error',
        progress: 0,
        message: error instanceof Error ? error.message : '验证失败',
      });

      toast({
        title: '验证失败',
        description: error instanceof Error ? error.message : '未知错误',
        variant: 'destructive',
      });

      return false;
    }
  };

  // 处理模型文件选择
  const handleModelFileChange = async (files: File[]) => {
    if (files.length === 0) return;

    const file = files[0];
    if (!file) return;

    // 检查文件类型（.model3.json 或 .zip）
    const isValidType =
      file.name.endsWith('.model3.json') ||
      file.name.endsWith('.zip') ||
      file.name.endsWith('.cubism3.json');

    if (!isValidType) {
      toast({
        title: '文件类型错误',
        description: '请上传 .model3.json、.cubism3.json 或 .zip 格式的 Live2D 模型文件',
        variant: 'destructive',
      });
      return;
    }

    setModelFile(file);

    // 自动填充模型名称（如果未填写）
    if (!modelName) {
      const name = file.name.replace(/\.(model3\.json|cubism3\.json|zip)$/, '');
      setModelName(name);
    }

    // 验证模型文件
    await validateModel(file);
  };

  // 处理缩略图选择
  const handleThumbnailFileChange = (files: File[]) => {
    if (files.length === 0) return;
    const file = files[0];
    if (!file) return;
    setThumbnailFile(file);
  };

  // 处理文件上传错误
  const handleFileError = (error: string) => {
    toast({
      title: '文件错误',
      description: error,
      variant: 'destructive',
    });
  };

  // 执行上传
  const handleUpload = async () => {
    if (!modelFile) {
      toast({
        title: '请选择文件',
        description: '请先选择要上传的 Live2D 模型文件',
        variant: 'destructive',
      });
      return;
    }

    if (!modelName.trim()) {
      toast({
        title: '请输入模型名称',
        description: '模型名称不能为空',
        variant: 'destructive',
      });
      return;
    }

    try {
      setUploadState({
        status: 'uploading',
        progress: 0,
        message: '正在上传模型文件...',
      });

      // 上传模型文件
      const uploadResult = await uploadModelMutation.mutateAsync({
        file: modelFile,
        characterId,
        onProgress: (progress) => {
          setUploadState((prev) => ({
            ...prev,
            progress: progress,
            message: `正在上传: ${Math.round(progress)}%`,
          }));
        },
      });

      // 如果有缩略图，上传缩略图  
      if (thumbnailFile && uploadResult.modelUrl) {
        setUploadState((prev) => ({
          ...prev,
          message: '正在上传缩略图...',
        }));

        // TODO: 需要获取 modelId 来上传缩略图
        // await uploadThumbnailMutation.mutateAsync({
        //   id: uploadResult.modelId,
        //   file: thumbnailFile,
        // });
      }

      setUploadState({
        status: 'success',
        progress: 100,
        message: '上传成功！',
        modelUrl: uploadResult.modelUrl,
      });

      toast({
        title: '上传成功',
        description: 'Live2D 模型已成功上传',
      });

      onUploadSuccess?.('', uploadResult.modelUrl); // TODO: 需要返回实际的 modelId
    } catch (error) {
      const err = error instanceof Error ? error : new Error('上传失败');

      setUploadState({
        status: 'error',
        progress: 0,
        message: err.message,
      });

      toast({
        title: '上传失败',
        description: err.message,
        variant: 'destructive',
      });

      onUploadError?.(err);
    }
  };

  // 重置表单
  const handleReset = () => {
    setModelFile(null);
    setThumbnailFile(null);
    setModelName('');
    setModelVersion('1.0.0');
    setUploadState({ status: 'idle', progress: 0 });
  };

  const isUploading = uploadState.status === 'uploading' || uploadState.status === 'validating';
  const isSuccess = uploadState.status === 'success';

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader>
        <CardTitle>上传 Live2D 模型</CardTitle>
        <CardDescription>
          支持上传 Live2D Cubism 3.x 或 4.x 模型文件（.model3.json 或 .zip）
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* 状态提示 */}
        {uploadState.message && (
          <Alert
            variant={
              uploadState.status === 'error'
                ? 'destructive'
                : uploadState.status === 'success'
                ? 'default'
                : 'default'
            }
          >
            {uploadState.status === 'error' && <AlertCircle className="h-4 w-4" />}
            {uploadState.status === 'success' && <CheckCircle2 className="h-4 w-4 text-green-600" />}
            {uploadState.status === 'validating' && <Info className="h-4 w-4" />}
            <AlertDescription>{uploadState.message}</AlertDescription>
          </Alert>
        )}

        {/* 上传进度 */}
        {isUploading && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">上传进度</span>
              <span className="font-medium">{uploadState.progress}%</span>
            </div>
            <Progress value={uploadState.progress} className="h-2" />
          </div>
        )}

        {!isSuccess && (
          <>
            {/* 模型文件上传 */}
            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-2">
                <FileArchive className="w-4 h-4" />
                Live2D 模型文件
                <Badge variant="secondary" className="ml-auto">必需</Badge>
              </Label>
              <FileUploader
                accept=".model3.json,.cubism3.json,.zip"
                maxSize={100}
                maxFiles={1}
                onChange={handleModelFileChange}
                onError={handleFileError}
                disabled={isUploading}
              />
              <p className="text-xs text-muted-foreground">
                支持的格式: .model3.json, .cubism3.json, .zip（最大 100MB）
              </p>
            </div>

            {/* 缩略图上传 */}
            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-2">
                <ImageIcon className="w-4 h-4" />
                缩略图
                <Badge variant="outline" className="ml-auto">可选</Badge>
              </Label>
              <FileUploader
                accept="image/*"
                maxSize={5}
                maxFiles={1}
                onChange={handleThumbnailFileChange}
                onError={handleFileError}
                disabled={isUploading}
              />
              <p className="text-xs text-muted-foreground">
                推荐尺寸: 512x512px，支持 JPG、PNG、WebP（最大 5MB）
              </p>
            </div>

            {/* 模型信息 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="model-name">模型名称 *</Label>
                <Input
                  id="model-name"
                  placeholder="例如: 默认模型"
                  value={modelName}
                  onChange={(e) => setModelName(e.target.value)}
                  disabled={isUploading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="model-version">版本号</Label>
                <Input
                  id="model-version"
                  placeholder="例如: 1.0.0"
                  value={modelVersion}
                  onChange={(e) => setModelVersion(e.target.value)}
                  disabled={isUploading}
                />
              </div>
            </div>

            {/* 文件信息预览 */}
            {modelFile && (
              <div className="rounded-lg border bg-muted/50 p-4 space-y-2">
                <h4 className="text-sm font-medium">文件信息</h4>
                <div className="text-xs space-y-1 text-muted-foreground">
                  <div className="flex justify-between">
                    <span>文件名:</span>
                    <span className="font-mono">{modelFile.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>文件大小:</span>
                    <span>{(modelFile.size / 1024 / 1024).toFixed(2)} MB</span>
                  </div>
                  <div className="flex justify-between">
                    <span>文件类型:</span>
                    <span>{modelFile.type || '未知'}</span>
                  </div>
                </div>
              </div>
            )}

            {/* 使用说明 */}
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-1 text-xs">
                  <p className="font-medium mb-2">上传说明:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>支持 Live2D Cubism 3.x 和 4.x 版本模型</li>
                    <li>如果上传 .zip 文件，请确保包含完整的模型资源</li>
                    <li>模型文件会自动验证格式和完整性</li>
                    <li>推荐同时上传缩略图以提供更好的预览效果</li>
                  </ul>
                </div>
              </AlertDescription>
            </Alert>
          </>
        )}

        {/* 成功状态 */}
        {isSuccess && (
          <div className="text-center py-8 space-y-4">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <h3 className="font-medium text-lg">上传成功！</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Live2D 模型已成功上传并保存
              </p>
            </div>
            <Button onClick={handleReset} variant="outline">
              继续上传其他模型
            </Button>
          </div>
        )}
      </CardContent>

      {/* 操作按钮 */}
      {!isSuccess && (
        <div className="px-6 pb-6 flex justify-end gap-2">
          {onCancel && (
            <Button
              variant="outline"
              onClick={onCancel}
              disabled={isUploading}
            >
              <X className="w-4 h-4 mr-2" />
              取消
            </Button>
          )}
          <Button
            onClick={handleUpload}
            disabled={!modelFile || !modelName.trim() || isUploading}
          >
            <Upload className="w-4 h-4 mr-2" />
            {isUploading ? '上传中...' : '开始上传'}
          </Button>
        </div>
      )}
    </Card>
  );
};

Live2DUpload.displayName = 'Live2DUpload';

