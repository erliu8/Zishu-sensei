/**
 * LoraAdapterSelector - Lora适配器选择组件
 * 支持选择云端Lora适配器或本地Lora适配器
 * 需要同时选择基础模型
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { 
  Search, 
  Cloud, 
  HardDrive,
  Check,
  Info,
} from 'lucide-react';
import { cn } from '@/shared/utils';
import { LocalPathInput } from '@/shared/components/common/LocalPathInput';
import { DeploymentLocation } from '@/features/adapter/domain';
import type { 
  LoraAdapter, 
  BaseModel,
} from '@/features/adapter/domain/lora.types';

/**
 * Lora适配器配置
 */
export interface LoraAdapterConfig {
  /** Lora适配器ID（云端）或名称（本地） */
  loraId: string;
  /** Lora适配器名称 */
  loraName: string;
  /** 显示名称 */
  displayName: string;
  /** 基础模型ID */
  baseModelId: string;
  /** 基础模型名称 */
  baseModelName: string;
  /** 部署位置 */
  deploymentLocation: DeploymentLocation;
  /** 本地路径（如果是本地部署） */
  localPath?: string;
  /** 完整的Lora适配器信息（如果是云端） */
  fullAdapter?: LoraAdapter;
}

export interface LoraAdapterSelectorProps {
  /** 当前选择的Lora配置 */
  value?: LoraAdapterConfig;
  /** 配置变化回调 */
  onChange: (config: LoraAdapterConfig | undefined) => void;
  /** 可用的基础模型列表 */
  availableBaseModels?: BaseModel[];
  /** 可用的云端Lora适配器列表 */
  availableLoraAdapters?: LoraAdapter[];
  /** 是否正在加载 */
  isLoading?: boolean;
  /** 自定义样式 */
  className?: string;
}

/**
 * LoraAdapterSelector 组件
 */
export const LoraAdapterSelector: React.FC<LoraAdapterSelectorProps> = ({
  value,
  onChange,
  availableBaseModels = [],
  availableLoraAdapters = [],
  isLoading = false,
  className,
}) => {
  const [activeTab, setActiveTab] = useState<'cloud' | 'local'>(
    value?.deploymentLocation === DeploymentLocation.LOCAL ? 'local' : 'cloud'
  );
  const [searchQuery, setSearchQuery] = useState('');
  
  // 云端Lora选择状态
  const [selectedBaseModelId, setSelectedBaseModelId] = useState(
    value?.baseModelId || ''
  );
  
  // 本地Lora表单状态
  const [localLoraName, setLocalLoraName] = useState(value?.loraName || '');
  const [localLoraDisplayName, setLocalLoraDisplayName] = useState(
    value?.displayName || ''
  );
  const [localLoraPath, setLocalLoraPath] = useState(value?.localPath || '');
  const [localBaseModelId, setLocalBaseModelId] = useState(
    value?.baseModelId || ''
  );

  // 过滤后的Lora适配器（按基础模型和搜索关键词）
  const filteredLoraAdapters = availableLoraAdapters
    .filter((lora) => {
      if (selectedBaseModelId && lora.baseModel.id !== selectedBaseModelId) {
        return false;
      }
      if (searchQuery) {
        return (
          lora.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          lora.displayName.toLowerCase().includes(searchQuery.toLowerCase())
        );
      }
      return true;
    });

  // 选择云端Lora
  const handleSelectCloudLora = (lora: LoraAdapter) => {
    onChange({
      loraId: lora.id,
      loraName: lora.name,
      displayName: lora.displayName,
      baseModelId: lora.baseModel.id,
      baseModelName: lora.baseModel.name,
      deploymentLocation: DeploymentLocation.CLOUD,
      fullAdapter: lora,
    });
  };

  // 提交本地Lora配置
  const handleSubmitLocalLora = () => {
    if (
      !localLoraName.trim() ||
      !localLoraPath.trim() ||
      !localBaseModelId
    ) {
      return;
    }

    const baseModel = availableBaseModels.find(
      (m) => m.id === localBaseModelId
    );
    if (!baseModel) return;

    onChange({
      loraId: `local-${Date.now()}`,
      loraName: localLoraName.trim(),
      displayName: localLoraDisplayName.trim() || localLoraName.trim(),
      baseModelId: baseModel.id,
      baseModelName: baseModel.name,
      deploymentLocation: DeploymentLocation.LOCAL,
      localPath: localLoraPath.trim(),
    });
  };

  // 清除选择
  const handleClear = () => {
    onChange(undefined);
    setSelectedBaseModelId('');
    setLocalLoraName('');
    setLocalLoraDisplayName('');
    setLocalLoraPath('');
    setLocalBaseModelId('');
  };

  return (
    <div className={cn('space-y-4', className)}>
      {/* 当前选择的Lora配置 */}
      {value && (
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3 flex-1">
                {value.deploymentLocation === DeploymentLocation.CLOUD ? (
                  <Cloud className="h-5 w-5 text-blue-500 mt-0.5" />
                ) : (
                  <HardDrive className="h-5 w-5 text-green-500 mt-0.5" />
                )}
                <div className="flex-1">
                  <div className="font-medium">{value.displayName}</div>
                  <div className="text-sm text-muted-foreground mt-1">
                    基础模型: {value.baseModelName}
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

      {/* Lora选择器 */}
      {!value && (
        <Card>
          <CardHeader>
            <CardTitle>选择Lora技能包</CardTitle>
            <CardDescription>
              从云端选择或配置本地的Lora技能包
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="cloud">
                  <Cloud className="h-4 w-4 mr-2" />
                  云端Lora
                </TabsTrigger>
                <TabsTrigger value="local">
                  <HardDrive className="h-4 w-4 mr-2" />
                  本地Lora
                </TabsTrigger>
              </TabsList>

              {/* 云端Lora选择 */}
              <TabsContent value="cloud" className="space-y-4">
                {/* 基础模型选择 */}
                <div className="space-y-2">
                  <Label>基础模型</Label>
                  <Select
                    value={selectedBaseModelId}
                    onValueChange={setSelectedBaseModelId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="选择基础模型" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableBaseModels.map((model) => (
                        <SelectItem key={model.id} value={model.id}>
                          <div className="flex flex-col">
                            <span>{model.displayName}</span>
                            {model.provider && (
                              <span className="text-xs text-muted-foreground">
                                {model.provider}
                              </span>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* 搜索 */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="搜索Lora技能包..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>

                {/* Lora列表 */}
                <ScrollArea className="h-[300px] pr-4">
                  {!selectedBaseModelId ? (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                      <Info className="h-8 w-8 mb-2" />
                      <p>请先选择基础模型</p>
                    </div>
                  ) : isLoading ? (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                      加载中...
                    </div>
                  ) : filteredLoraAdapters.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                      <p>没有找到Lora技能包</p>
                      {searchQuery && (
                        <p className="text-sm mt-2">
                          尝试使用不同的搜索词
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {filteredLoraAdapters.map((lora) => (
                        <Card
                          key={lora.id}
                          className="cursor-pointer hover:border-primary transition-all"
                          onClick={() => handleSelectCloudLora(lora)}
                        >
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1">
                                <h4 className="font-medium">
                                  {lora.displayName}
                                </h4>
                                <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                                  {lora.description}
                                </p>
                                <div className="flex items-center gap-2 mt-2">
                                  <Badge variant="outline" className="text-xs">
                                    v{lora.version}
                                  </Badge>
                                  <span className="text-xs text-muted-foreground">
                                    {lora.stats.downloads} 次下载
                                  </span>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>

              {/* 本地Lora配置 */}
              <TabsContent value="local" className="space-y-4">
                {/* 基础模型选择 */}
                <div className="space-y-2">
                  <Label>
                    基础模型 <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={localBaseModelId}
                    onValueChange={setLocalBaseModelId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="选择基础模型" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableBaseModels.map((model) => (
                        <SelectItem key={model.id} value={model.id}>
                          <div className="flex flex-col">
                            <span>{model.displayName}</span>
                            {model.provider && (
                              <span className="text-xs text-muted-foreground">
                                {model.provider}
                              </span>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Lora名称 */}
                <div className="space-y-2">
                  <Label>
                    Lora技能包名称 <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    placeholder="例如：my-character-lora"
                    value={localLoraName}
                    onChange={(e) => setLocalLoraName(e.target.value)}
                  />
                </div>

                {/* 显示名称 */}
                <div className="space-y-2">
                  <Label>显示名称</Label>
                  <Input
                    placeholder="例如：我的角色Lora"
                    value={localLoraDisplayName}
                    onChange={(e) => setLocalLoraDisplayName(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    不填写则使用Lora名称
                  </p>
                </div>

                {/* 本地路径 */}
                <LocalPathInput
                  label="Lora文件路径"
                  value={localLoraPath}
                  onChange={setLocalLoraPath}
                  required
                  showValidation
                  pathType="file"
                  placeholder="/path/to/lora.safetensors"
                  description="Lora技能包文件在桌面应用中的完整路径"
                />

                {/* 提交按钮 */}
                <Button
                  className="w-full"
                  onClick={handleSubmitLocalLora}
                  disabled={
                    !localLoraName.trim() ||
                    !localLoraPath.trim() ||
                    !localBaseModelId
                  }
                >
                  <Check className="h-4 w-4 mr-2" />
                  确认配置
                </Button>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default LoraAdapterSelector;

