/**
 * 适配器上传主组件
 * 整合元数据编辑、文件上传、依赖管理和版本发布功能
 */

'use client';

import React, { useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { 
  ChevronLeft, 
  ChevronRight, 
  Save, 
  Upload as UploadIcon, 
  CheckCircle2,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Progress } from '@/shared/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/shared/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import { Separator } from '@/shared/components/ui/separator';
import { Badge } from '@/shared/components/ui/badge';
import { MetadataEditor, type MetadataFormData } from './MetadataEditor';
import { FileUploadZone, type FileItem } from './FileUploadZone';
import { DependencyManager } from './DependencyManager';
import { VersionPublish, type VersionFormData } from './VersionPublish';
import type {
  AdapterMetadata,
  AdapterVersion,
  AdapterDependency,
  AdapterUploadFormData,
  AdapterType,
  UploadProgress,
} from '../../api/types';
import { cn } from '@/shared/utils/cn';

type UploadStep = 'metadata' | 'files' | 'dependencies' | 'version' | 'review';

interface StepConfig {
  id: UploadStep;
  title: string;
  description: string;
  icon: React.ReactNode;
}

const steps: StepConfig[] = [
  {
    id: 'metadata',
    title: '基本信息',
    description: '填写适配器的元数据',
    icon: '1',
  },
  {
    id: 'files',
    title: '文件上传',
    description: '上传适配器文件',
    icon: '2',
  },
  {
    id: 'dependencies',
    title: '依赖管理',
    description: '配置依赖关系',
    icon: '3',
  },
  {
    id: 'version',
    title: '版本信息',
    description: '设置版本和更新日志',
    icon: '4',
  },
  {
    id: 'review',
    title: '审核发布',
    description: '确认信息并发布',
    icon: '5',
  },
];

export interface AdapterUploadProps {
  /** 适配器ID（编辑模式） */
  adapterId?: string;
  /** 初始数据（编辑模式） */
  initialData?: Partial<AdapterUploadFormData>;
  /** 上传成功回调 */
  onSuccess?: (adapterId: string, versionId: string) => void;
  /** 取消回调 */
  onCancel?: () => void;
  /** 类名 */
  className?: string;
}

export function AdapterUpload({
  adapterId,
  initialData,
  onSuccess,
  onCancel,
  className,
}: AdapterUploadProps) {
  const router = useRouter();
  const metadataFormRef = useRef<HTMLFormElement>(null);
  const versionFormRef = useRef<HTMLFormElement>(null);

  // 步骤管理
  const [currentStep, setCurrentStep] = useState<UploadStep>('metadata');
  const [completedSteps, setCompletedSteps] = useState<Set<UploadStep>>(new Set());

  // 表单数据
  const [metadata, setMetadata] = useState<AdapterMetadata | null>(
    initialData?.metadata || null
  );
  const [files, setFiles] = useState<FileItem[]>([]);
  const [iconFile, setIconFile] = useState<File | null>(null);
  const [screenshotFiles, setScreenshotFiles] = useState<File[]>([]);
  const [dependencies, setDependencies] = useState<AdapterDependency[]>(
    initialData?.metadata?.dependencies || []
  );
  const [version, setVersion] = useState<AdapterVersion | null>(
    initialData?.version || null
  );

  // 上传状态
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress>({
    loaded: 0,
    total: 0,
    percentage: 0,
  });
  const [uploadError, setUploadError] = useState<string | null>(null);

  // 步骤导航
  const currentStepIndex = steps.findIndex((step) => step.id === currentStep);
  const canGoNext = currentStepIndex < steps.length - 1;
  const canGoPrevious = currentStepIndex > 0;

  const goToStep = useCallback((stepId: UploadStep) => {
    setCurrentStep(stepId);
  }, []);

  const goNext = useCallback(() => {
    if (canGoNext) {
      const nextStep = steps[currentStepIndex + 1];
      setCompletedSteps((prev) => new Set([...prev, currentStep]));
      goToStep(nextStep.id);
    }
  }, [canGoNext, currentStep, currentStepIndex, goToStep]);

  const goPrevious = useCallback(() => {
    if (canGoPrevious) {
      const previousStep = steps[currentStepIndex - 1];
      goToStep(previousStep.id);
    }
  }, [canGoPrevious, currentStepIndex, goToStep]);

  // 处理元数据提交
  const handleMetadataSubmit = useCallback((data: AdapterMetadata) => {
    setMetadata(data);
    setCompletedSteps((prev) => new Set([...prev, 'metadata']));
    goNext();
  }, [goNext]);

  // 处理版本提交
  const handleVersionSubmit = useCallback((data: AdapterVersion) => {
    setVersion(data);
    setCompletedSteps((prev) => new Set([...prev, 'version']));
    goNext();
  }, [goNext]);

  // 处理文件上传
  const handleFilesComplete = useCallback(() => {
    const hasValidFiles = files.some((f) => f.status === 'pending' || f.status === 'success');
    if (hasValidFiles) {
      setCompletedSteps((prev) => new Set([...prev, 'files']));
      goNext();
    }
  }, [files, goNext]);

  // 处理依赖完成
  const handleDependenciesComplete = useCallback(() => {
    setCompletedSteps((prev) => new Set([...prev, 'dependencies']));
    goNext();
  }, [goNext]);

  // 最终发布
  const handlePublish = useCallback(async () => {
    if (!metadata || !version) {
      setUploadError('请完成所有必填信息');
      return;
    }

    setIsUploading(true);
    setUploadError(null);

    try {
      // 构建上传数据
      const formData = new FormData();

      // 添加元数据
      formData.append('metadata', JSON.stringify({
        ...metadata,
        dependencies,
      }));

      // 添加版本信息
      formData.append('version', JSON.stringify(version));

      // 添加文件
      files.forEach((fileItem) => {
        if (fileItem.status === 'success' || fileItem.status === 'pending') {
          formData.append('files', fileItem.file);
        }
      });

      // 添加图标
      if (iconFile) {
        formData.append('icon', iconFile);
      }

      // 添加截图
      screenshotFiles.forEach((screenshot) => {
        formData.append('screenshots', screenshot);
      });

      // 模拟上传进度
      const simulateProgress = () => {
        let progress = 0;
        const interval = setInterval(() => {
          progress += 10;
          setUploadProgress({
            loaded: progress,
            total: 100,
            percentage: progress,
          });

          if (progress >= 90) {
            clearInterval(interval);
          }
        }, 200);

        return interval;
      };

      const progressInterval = simulateProgress();

      // TODO: 实际的API调用
      // const response = await uploadAdapter(formData);
      
      // 模拟API延迟
      await new Promise((resolve) => setTimeout(resolve, 2000));

      clearInterval(progressInterval);
      setUploadProgress({
        loaded: 100,
        total: 100,
        percentage: 100,
      });

      // 模拟成功响应
      const mockResponse = {
        id: adapterId || `adapter-${Date.now()}`,
        versionId: `version-${Date.now()}`,
      };

      onSuccess?.(mockResponse.id, mockResponse.versionId);

      // 跳转到适配器详情页
      setTimeout(() => {
        router.push(`/adapters/${mockResponse.id}`);
      }, 1000);

    } catch (error) {
      setUploadError(error instanceof Error ? error.message : '上传失败，请重试');
    } finally {
      setIsUploading(false);
    }
  }, [metadata, version, files, dependencies, iconFile, screenshotFiles, adapterId, onSuccess, router]);

  return (
    <div className={cn('mx-auto max-w-6xl space-y-6', className)}>
      {/* 头部 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">
            {adapterId ? '编辑适配器' : '上传适配器'}
          </h1>
          <p className="mt-2 text-muted-foreground">
            {adapterId ? '更新适配器信息或发布新版本' : '创建并发布新的适配器'}
          </p>
        </div>
        {onCancel && (
          <Button variant="outline" onClick={onCancel}>
            取消
          </Button>
        )}
      </div>

      {/* 步骤指示器 */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            {steps.map((step, index) => (
              <React.Fragment key={step.id}>
                <div className="flex flex-col items-center">
                  <button
                    type="button"
                    onClick={() => goToStep(step.id)}
                    disabled={isUploading}
                    className={cn(
                      'flex h-12 w-12 items-center justify-center rounded-full border-2 font-semibold transition-colors',
                      currentStep === step.id &&
                        'border-primary bg-primary text-primary-foreground',
                      completedSteps.has(step.id) &&
                        currentStep !== step.id &&
                        'border-success bg-success text-success-foreground',
                      currentStep !== step.id &&
                        !completedSteps.has(step.id) &&
                        'border-muted-foreground/25 text-muted-foreground hover:border-muted-foreground/50'
                    )}
                  >
                    {completedSteps.has(step.id) && currentStep !== step.id ? (
                      <CheckCircle2 className="h-6 w-6" />
                    ) : (
                      step.icon
                    )}
                  </button>
                  <div className="mt-2 text-center">
                    <p
                      className={cn(
                        'text-sm font-medium',
                        currentStep === step.id && 'text-primary'
                      )}
                    >
                      {step.title}
                    </p>
                    <p className="hidden text-xs text-muted-foreground sm:block">
                      {step.description}
                    </p>
                  </div>
                </div>
                {index < steps.length - 1 && (
                  <div className="flex-1 mx-4">
                    <Separator
                      className={cn(
                        'h-0.5',
                        completedSteps.has(step.id) && 'bg-success'
                      )}
                    />
                  </div>
                )}
              </React.Fragment>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 步骤内容 */}
      <div className="min-h-[600px]">
        {currentStep === 'metadata' && (
          <MetadataEditor
            initialData={metadata || undefined}
            onSubmit={handleMetadataSubmit}
            disabled={isUploading}
          />
        )}

        {currentStep === 'files' && (
          <Card>
            <CardHeader>
              <CardTitle>上传文件</CardTitle>
              <CardDescription>
                上传适配器的主要文件、图标和截图
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* 主要文件 */}
              <div>
                <h3 className="mb-4 text-lg font-semibold">适配器文件 *</h3>
                <FileUploadZone
                  accept={getAcceptedFileTypes(metadata?.adapterType)}
                  maxSize={100 * 1024 * 1024}
                  maxFiles={20}
                  multiple
                  files={files}
                  onFilesChange={setFiles}
                  disabled={isUploading}
                  helperText={getFileHelperText(metadata?.adapterType)}
                />
              </div>

              <Separator />

              {/* 图标 */}
              <div>
                <h3 className="mb-4 text-lg font-semibold">适配器图标</h3>
                <FileUploadZone
                  accept="image/*"
                  maxSize={2 * 1024 * 1024}
                  maxFiles={1}
                  multiple={false}
                  files={iconFile ? [{
                    file: iconFile,
                    id: 'icon',
                    status: 'pending',
                    progress: 0,
                  }] : []}
                  onFilesChange={(items) => setIconFile(items[0]?.file || null)}
                  disabled={isUploading}
                  helperText="推荐尺寸: 512x512, 支持 PNG、JPG、SVG 格式"
                />
              </div>

              <Separator />

              {/* 截图 */}
              <div>
                <h3 className="mb-4 text-lg font-semibold">功能截图</h3>
                <FileUploadZone
                  accept="image/*"
                  maxSize={5 * 1024 * 1024}
                  maxFiles={6}
                  multiple
                  files={screenshotFiles.map((file, index) => ({
                    file,
                    id: `screenshot-${index}`,
                    status: 'pending' as const,
                    progress: 0,
                  }))}
                  onFilesChange={(items) =>
                    setScreenshotFiles(items.map((item) => item.file))
                  }
                  disabled={isUploading}
                  helperText="最多6张，展示适配器的主要功能和界面"
                />
              </div>
            </CardContent>
          </Card>
        )}

        {currentStep === 'dependencies' && (
          <DependencyManager
            dependencies={dependencies}
            onDependenciesChange={setDependencies}
            disabled={isUploading}
          />
        )}

        {currentStep === 'version' && (
          <VersionPublish
            initialData={version || undefined}
            currentVersion={initialData?.version?.version}
            onSubmit={handleVersionSubmit}
            disabled={isUploading}
            isNewVersion={!adapterId}
          />
        )}

        {currentStep === 'review' && (
          <ReviewStep
            metadata={metadata}
            version={version}
            files={files}
            dependencies={dependencies}
            isUploading={isUploading}
            uploadProgress={uploadProgress}
            uploadError={uploadError}
            onPublish={handlePublish}
          />
        )}
      </div>

      {/* 底部导航 */}
      <Card>
        <CardContent className="flex items-center justify-between pt-6">
          <Button
            variant="outline"
            onClick={goPrevious}
            disabled={!canGoPrevious || isUploading}
          >
            <ChevronLeft className="mr-2 h-4 w-4" />
            上一步
          </Button>

          <div className="text-sm text-muted-foreground">
            步骤 {currentStepIndex + 1} / {steps.length}
          </div>

          {currentStep === 'review' ? (
            <Button
              onClick={handlePublish}
              disabled={isUploading || !metadata || !version}
            >
              {isUploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  发布中...
                </>
              ) : (
                <>
                  <UploadIcon className="mr-2 h-4 w-4" />
                  发布适配器
                </>
              )}
            </Button>
          ) : (
            <Button
              onClick={() => {
                // 触发相应表单的提交
                if (currentStep === 'metadata' && metadataFormRef.current) {
                  metadataFormRef.current.dispatchEvent(
                    new Event('submit', { cancelable: true, bubbles: true })
                  );
                } else if (currentStep === 'version' && versionFormRef.current) {
                  versionFormRef.current.dispatchEvent(
                    new Event('submit', { cancelable: true, bubbles: true })
                  );
                } else if (currentStep === 'files') {
                  handleFilesComplete();
                } else if (currentStep === 'dependencies') {
                  handleDependenciesComplete();
                } else {
                  goNext();
                }
              }}
              disabled={!canGoNext || isUploading}
            >
              下一步
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// 辅助组件
interface ReviewStepProps {
  metadata: AdapterMetadata | null;
  version: AdapterVersion | null;
  files: FileItem[];
  dependencies: AdapterDependency[];
  isUploading: boolean;
  uploadProgress: UploadProgress;
  uploadError: string | null;
  onPublish: () => void;
}

function ReviewStep({
  metadata,
  version,
  files,
  dependencies,
  isUploading,
  uploadProgress,
  uploadError,
}: ReviewStepProps) {
  return (
    <div className="space-y-6">
      {/* 上传错误 */}
      {uploadError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>上传失败</AlertTitle>
          <AlertDescription>{uploadError}</AlertDescription>
        </Alert>
      )}

      {/* 上传进度 */}
      {isUploading && (
        <Alert>
          <Loader2 className="h-4 w-4 animate-spin" />
          <AlertTitle>正在上传...</AlertTitle>
          <AlertDescription>
            <Progress value={uploadProgress.percentage} className="mt-2" />
            <p className="mt-2 text-sm">
              {uploadProgress.percentage}% 完成
            </p>
          </AlertDescription>
        </Alert>
      )}

      {/* 审核信息 */}
      <Card>
        <CardHeader>
          <CardTitle>确认发布信息</CardTitle>
          <CardDescription>
            请仔细检查以下信息，确认无误后点击"发布适配器"
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 基本信息 */}
          <div>
            <h3 className="mb-3 font-semibold">基本信息</h3>
            <dl className="grid gap-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">名称:</dt>
                <dd className="font-medium">{metadata?.name || '-'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">类型:</dt>
                <dd>
                  <Badge>{getAdapterTypeLabel(metadata?.adapterType)}</Badge>
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">分类:</dt>
                <dd className="font-medium">{metadata?.category || '-'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">版本:</dt>
                <dd className="font-medium">{version?.version || '-'}</dd>
              </div>
            </dl>
          </div>

          <Separator />

          {/* 文件统计 */}
          <div>
            <h3 className="mb-3 font-semibold">上传文件</h3>
            <dl className="grid gap-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">适配器文件:</dt>
                <dd className="font-medium">{files.length} 个</dd>
              </div>
            </dl>
          </div>

          <Separator />

          {/* 依赖 */}
          <div>
            <h3 className="mb-3 font-semibold">依赖关系</h3>
            <dl className="grid gap-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">依赖数量:</dt>
                <dd className="font-medium">{dependencies.length} 个</dd>
              </div>
            </dl>
          </div>

          <Separator />

          {/* 能力 */}
          <div>
            <h3 className="mb-3 font-semibold">能力声明</h3>
            <div className="flex flex-wrap gap-2">
              {metadata?.capabilities.map((capability, index) => (
                <Badge key={index} variant="secondary">
                  {capability.name}
                </Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// 辅助函数
function getAcceptedFileTypes(adapterType?: AdapterType): string {
  switch (adapterType) {
    case 'soft':
      return '.json,.yaml,.yml,.txt,.md';
    case 'hard':
    case 'intelligent':
      return '.py,.js,.ts,.zip,.tar.gz';
    default:
      return '*';
  }
}

function getFileHelperText(adapterType?: AdapterType): string {
  switch (adapterType) {
    case 'soft':
      return '支持 JSON、YAML、Markdown 等配置文件';
    case 'hard':
      return '支持 Python、JavaScript 源代码文件或压缩包';
    case 'intelligent':
      return '支持模型文件、Python 代码或压缩包';
    default:
      return '请先选择适配器类型';
  }
}

function getAdapterTypeLabel(adapterType?: AdapterType): string {
  switch (adapterType) {
    case 'soft':
      return '软适配器';
    case 'hard':
      return '硬适配器';
    case 'intelligent':
      return '智能硬适配器';
    default:
      return '未知';
  }
}

