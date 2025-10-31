/**
 * Live2DModelSelector - Live2D模型选择组件
 * 支持三种方式：云端选择、上传托管、本地部署
 */

import React, { useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Badge } from '@/shared/components/ui/badge';
import { ScrollArea } from '@/shared/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import { 
  Search, 
  Cloud, 
  HardDrive,
  Upload,
  Check,
} from 'lucide-react';
import { cn } from '@/shared/utils';
import { LocalPathInput } from '@/shared/components/common/LocalPathInput';
import { DeploymentLocation } from '@/features/adapter/domain';
import type { Live2DModel } from '@/features/adapter/domain/live2d.types';

/**
 * Live2D模型配置
 */
export interface Live2DModelConfig {
  /** 模型ID（云端）或临时ID（上传/本地） */
  modelId: string;
  /** 模型名称 */
  modelName: string;
  /** 显示名称 */
  displayName: string;
  /** 部署位置 */
  deploymentLocation: DeploymentLocation;
  /** 本地路径（如果是本地部署） */
  localPath?: string;
  /** 上传的文件（如果是上传托管） */
  uploadFile?: File;
  /** 预览图 */
  previewImage?: string;
  /** 完整的Live2D模型信息（如果是云端） */
  fullModel?: Live2DModel;
}

export interface Live2DModelSelectorProps {
  /** 当前选择的模型配置 */
  value?: Live2DModelConfig;
  /** 配置变化回调 */
  onChange: (config: Live2DModelConfig | undefined) => void;
  /** 可用的云端Live2D模型列表 */
  availableModels?: Live2DModel[];
  /** 是否正在加载 */
  isLoading?: boolean;
  /** 自定义样式 */
  className?: string;
}

/**
 * Live2DModelSelector 组件
 */
export const Live2DModelSelector: React.FC<Live2DModelSelectorProps> = ({
  value,
  onChange,
  availableModels = [],
  isLoading = false,
  className,
}) => {
  const [activeTab, setActiveTab] = useState<'cloud' | 'upload' | 'local'>(
    value?.deploymentLocation === DeploymentLocation.LOCAL 
      ? 'local' 
      : value?.uploadFile 
      ? 'upload' 
      : 'cloud'
  );
  const [searchQuery, setSearchQuery] = useState('');
  
  // 上传表单状态
  const [uploadName, setUploadName] = useState('');
  const [uploadDisplayName, setUploadDisplayName] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  
  // 本地部署表单状态
  const [localName, setLocalName] = useState('');
  const [localDisplayName, setLocalDisplayName] = useState('');
  const [localPath, setLocalPath] = useState('');

  // 过滤后的云端模型
  const filteredModels = availableModels.filter((model) =>
    model.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    model.displayName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // 选择云端模型
  const handleSelectCloudModel = (model: Live2DModel) => {
    onChange({
      modelId: model.id,
      modelName: model.name,
      displayName: model.displayName,
      deploymentLocation: DeploymentLocation.CLOUD,
      previewImage: model.coverImage,
      fullModel: model,
    });
  };

  // 处理文件上传
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadFile(file);
      // 如果名称为空，使用文件名（去除扩展名）
      if (!uploadName) {
        const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '');
        setUploadName(nameWithoutExt);
      }
    }
  };

  // 提交上传配置
  const handleSubmitUpload = () => {
    if (!uploadName.trim() || !uploadFile) {
      return;
    }

    onChange({
      modelId: `upload-${Date.now()}`,
      modelName: uploadName.trim(),
      displayName: uploadDisplayName.trim() || uploadName.trim(),
      deploymentLocation: DeploymentLocation.CLOUD,
      uploadFile: uploadFile,
    });
  };

  // 提交本地配置
  const handleSubmitLocal = () => {
    if (!localName.trim() || !localPath.trim()) {
      return;
    }

    onChange({
      modelId: `local-${Date.now()}`,
      modelName: localName.trim(),
      displayName: localDisplayName.trim() || localName.trim(),
      deploymentLocation: DeploymentLocation.LOCAL,
      localPath: localPath.trim(),
    });
  };

  // 清除选择
  const handleClear = () => {
    onChange(undefined);
    setUploadName('');
    setUploadDisplayName('');
    setUploadFile(null);
    setLocalName('');
    setLocalDisplayName('');
    setLocalPath('');
  };

  return (
    <div className={cn('space-y-4', className)}>
      {/* 当前选择的模型 */}
      {value && (
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3 flex-1">
                {/* 预览图 */}
                {value.previewImage && (
                  <div className="w-16 h-16 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                    <img
                      src={value.previewImage}
                      alt={value.displayName}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                
                {/* 图标（如果没有预览图） */}
                {!value.previewImage && (
                  <>
                    {value.deploymentLocation === DeploymentLocation.CLOUD ? (
                      <Cloud className="h-5 w-5 text-blue-500 mt-0.5" />
                    ) : (
                      <HardDrive className="h-5 w-5 text-green-500 mt-0.5" />
                    )}
                  </>
                )}
                
                {/* 信息 */}
                <div className="flex-1">
                  <div className="font-medium">{value.displayName}</div>
                  <div className="text-sm text-muted-foreground mt-1">
                    {value.deploymentLocation === DeploymentLocation.CLOUD 
                      ? value.uploadFile 
                        ? '待上传托管' 
                        : '云端模型'
                      : '本地部署'
                    }
                  </div>
                  {value.deploymentLocation === DeploymentLocation.LOCAL && (
                    <div className="text-xs text-muted-foreground mt-1 font-mono">
                      {value.localPath}
                    </div>
                  )}
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClear}
              >
                更改
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 模型选择器 */}
      {!value && (
        <Card>
          <CardHeader>
            <CardTitle>选择Live2D模型</CardTitle>
            <CardDescription>
              从云端选择、上传托管或使用本地模型
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="cloud">
                  <Cloud className="h-4 w-4 mr-2" />
                  云端
                </TabsTrigger>
                <TabsTrigger value="upload">
                  <Upload className="h-4 w-4 mr-2" />
                  上传
                </TabsTrigger>
                <TabsTrigger value="local">
                  <HardDrive className="h-4 w-4 mr-2" />
                  本地
                </TabsTrigger>
              </TabsList>

              {/* 云端模型选择 */}
              <TabsContent value="cloud" className="space-y-4">
                {/* 搜索 */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="搜索Live2D模型..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>

                {/* 模型列表 */}
                <ScrollArea className="h-[350px] pr-4">
                  {isLoading ? (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                      加载中...
                    </div>
                  ) : filteredModels.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                      <p>没有找到Live2D模型</p>
                      {searchQuery && (
                        <p className="text-sm mt-2">
                          尝试使用不同的搜索词
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      {filteredModels.map((model) => (
                        <Card
                          key={model.id}
                          className="cursor-pointer hover:border-primary transition-all overflow-hidden"
                          onClick={() => handleSelectCloudModel(model)}
                        >
                          {/* 预览图 */}
                          {model.coverImage && (
                            <div className="aspect-square bg-muted relative">
                              <img
                                src={model.coverImage}
                                alt={model.displayName}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          )}
                          
                          {/* 信息 */}
                          <CardContent className="p-3">
                            <h4 className="font-medium text-sm truncate">
                              {model.displayName}
                            </h4>
                            <div className="flex items-center gap-2 mt-2">
                              <Badge variant="outline" className="text-xs">
                                v{model.version}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {model.stats.downloads}下载
                              </span>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>

              {/* 上传托管 */}
              <TabsContent value="upload" className="space-y-4">
                <div className="space-y-4">
                  {/* 文件上传 */}
                  <div className="space-y-2">
                    <Label>
                      Live2D模型文件 <span className="text-destructive">*</span>
                    </Label>
                    <div className="border-2 border-dashed rounded-lg p-6 text-center hover:border-primary transition-colors cursor-pointer">
                      <input
                        type="file"
                        id="model-file-upload"
                        className="hidden"
                        accept=".model3.json,.model.json,.zip"
                        onChange={handleFileChange}
                      />
                      <label 
                        htmlFor="model-file-upload"
                        className="cursor-pointer flex flex-col items-center gap-2"
                      >
                        {uploadFile ? (
                          <>
                            <Check className="h-8 w-8 text-green-500" />
                            <p className="text-sm font-medium">
                              {uploadFile.name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {(uploadFile.size / 1024 / 1024).toFixed(2)} MB
                            </p>
                          </>
                        ) : (
                          <>
                            <Upload className="h-8 w-8 text-muted-foreground" />
                            <p className="text-sm text-muted-foreground">
                              点击上传或拖拽文件至此处
                            </p>
                            <p className="text-xs text-muted-foreground">
                              支持 .model3.json, .model.json, .zip
                            </p>
                          </>
                        )}
                      </label>
                    </div>
                  </div>

                  {/* 模型名称 */}
                  <div className="space-y-2">
                    <Label>
                      模型名称 <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      placeholder="例如：my-live2d-model"
                      value={uploadName}
                      onChange={(e) => setUploadName(e.target.value)}
                    />
                  </div>

                  {/* 显示名称 */}
                  <div className="space-y-2">
                    <Label>显示名称</Label>
                    <Input
                      placeholder="例如：我的Live2D模型"
                      value={uploadDisplayName}
                      onChange={(e) => setUploadDisplayName(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      不填写则使用模型名称
                    </p>
                  </div>

                  {/* 提交按钮 */}
                  <Button
                    className="w-full"
                    onClick={handleSubmitUpload}
                    disabled={!uploadName.trim() || !uploadFile}
                  >
                    <Check className="h-4 w-4 mr-2" />
                    确认上传
                  </Button>
                </div>
              </TabsContent>

              {/* 本地部署 */}
              <TabsContent value="local" className="space-y-4">
                <div className="space-y-4">
                  {/* 模型名称 */}
                  <div className="space-y-2">
                    <Label>
                      模型名称 <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      placeholder="例如：my-local-model"
                      value={localName}
                      onChange={(e) => setLocalName(e.target.value)}
                    />
                  </div>

                  {/* 显示名称 */}
                  <div className="space-y-2">
                    <Label>显示名称</Label>
                    <Input
                      placeholder="例如：我的本地Live2D模型"
                      value={localDisplayName}
                      onChange={(e) => setLocalDisplayName(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      不填写则使用模型名称
                    </p>
                  </div>

                  {/* 本地路径 */}
                  <LocalPathInput
                    label="模型文件路径"
                    value={localPath}
                    onChange={setLocalPath}
                    required
                    showValidation
                    pathType="file"
                    placeholder="/path/to/model.model3.json"
                    description="Live2D模型文件在桌面应用中的完整路径"
                  />

                  {/* 提交按钮 */}
                  <Button
                    className="w-full"
                    onClick={handleSubmitLocal}
                    disabled={!localName.trim() || !localPath.trim()}
                  >
                    <Check className="h-4 w-4 mr-2" />
                    确认配置
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Live2DModelSelector;

