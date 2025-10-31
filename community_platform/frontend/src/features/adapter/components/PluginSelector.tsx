/**
 * PluginSelector - 插件选择组件
 * 支持选择云端插件或本地插件（对应硬适配器）
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
import { Badge } from '@/shared/components/ui/badge';
import { ScrollArea } from '@/shared/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import { 
  Search, 
  Plus, 
  X, 
  Cloud, 
  HardDrive,
  Check,
} from 'lucide-react';
import { cn } from '@/shared/utils';
import { LocalPathInput } from '@/shared/components/common/LocalPathInput';
import { 
  AdapterType, 
  DeploymentLocation, 
  DeploymentConfig,
  Adapter,
} from '@/features/adapter/domain';

/**
 * 插件引用
 */
export interface PluginReference {
  /** 插件ID */
  id: string;
  /** 插件名称 */
  name: string;
  /** 显示名称 */
  displayName: string;
  /** 版本 */
  version?: string;
  /** 部署配置 */
  deployment: DeploymentConfig;
  /** 是否启用 */
  enabled?: boolean;
}

export interface PluginSelectorProps {
  /** 已选择的插件列表 */
  selectedPlugins?: PluginReference[];
  /** 插件变化回调 */
  onChange: (plugins: PluginReference[]) => void;
  /** 最多可选择的插件数量 */
  maxPlugins?: number;
  /** 可用的云端插件列表 */
  availableCloudPlugins?: Adapter[];
  /** 是否正在加载云端插件 */
  isLoadingCloudPlugins?: boolean;
  /** 自定义样式 */
  className?: string;
}

/**
 * PluginSelector 组件
 */
export const PluginSelector: React.FC<PluginSelectorProps> = ({
  selectedPlugins = [],
  onChange,
  maxPlugins,
  availableCloudPlugins = [],
  isLoadingCloudPlugins = false,
  className,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'cloud' | 'local'>('cloud');
  
  // 本地插件表单状态
  const [localPluginName, setLocalPluginName] = useState('');
  const [localPluginPath, setLocalPluginPath] = useState('');
  const [localPluginDisplayName, setLocalPluginDisplayName] = useState('');

  // 过滤后的云端插件（只显示硬适配器）
  const filteredCloudPlugins = availableCloudPlugins
    .filter((adapter) => adapter.type === AdapterType.HARD)
    .filter((adapter) =>
      adapter.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      adapter.displayName.toLowerCase().includes(searchQuery.toLowerCase())
    );

  // 检查插件是否已被选择
  const isPluginSelected = (pluginId: string) => {
    return selectedPlugins.some((p) => p.id === pluginId);
  };

  // 添加云端插件
  const handleAddCloudPlugin = (adapter: Adapter) => {
    if (maxPlugins && selectedPlugins.length >= maxPlugins) {
      return;
    }

    const newPlugin: PluginReference = {
      id: adapter.id,
      name: adapter.name,
      displayName: adapter.displayName,
      version: adapter.version,
      deployment: {
        location: DeploymentLocation.CLOUD,
        cloudUrl: adapter.deployment?.cloudUrl,
      },
      enabled: true,
    };

    onChange([...selectedPlugins, newPlugin]);
  };

  // 添加本地插件
  const handleAddLocalPlugin = () => {
    if (!localPluginName.trim() || !localPluginPath.trim()) {
      return;
    }

    if (maxPlugins && selectedPlugins.length >= maxPlugins) {
      return;
    }

    const newPlugin: PluginReference = {
      id: `local-${Date.now()}`, // 生成临时ID
      name: localPluginName.trim(),
      displayName: localPluginDisplayName.trim() || localPluginName.trim(),
      deployment: {
        location: DeploymentLocation.LOCAL,
        localPath: localPluginPath.trim(),
      },
      enabled: true,
    };

    onChange([...selectedPlugins, newPlugin]);

    // 重置表单
    setLocalPluginName('');
    setLocalPluginPath('');
    setLocalPluginDisplayName('');
  };

  // 移除插件
  const handleRemovePlugin = (pluginId: string) => {
    onChange(selectedPlugins.filter((p) => p.id !== pluginId));
  };

  // 切换插件启用状态
  const handleTogglePlugin = (pluginId: string) => {
    onChange(
      selectedPlugins.map((p) =>
        p.id === pluginId ? { ...p, enabled: !p.enabled } : p
      )
    );
  };

  return (
    <div className={cn('space-y-4', className)}>
      {/* 已选择的插件列表 */}
      {selectedPlugins.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              已选择的插件
              {maxPlugins && (
                <span className="text-sm text-muted-foreground ml-2">
                  ({selectedPlugins.length}/{maxPlugins})
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {selectedPlugins.map((plugin) => (
                <div
                  key={plugin.id}
                  className={cn(
                    'flex items-center justify-between p-3 rounded-lg border',
                    'transition-colors',
                    plugin.enabled ? 'bg-background' : 'bg-muted/50'
                  )}
                >
                  <div className="flex items-center gap-3 flex-1">
                    {/* 部署位置图标 */}
                    <div className="flex-shrink-0">
                      {plugin.deployment.location === DeploymentLocation.CLOUD ? (
                        <Cloud className="h-4 w-4 text-blue-500" />
                      ) : (
                        <HardDrive className="h-4 w-4 text-green-500" />
                      )}
                    </div>

                    {/* 插件信息 */}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">
                        {plugin.displayName}
                      </div>
                      {plugin.deployment.location === DeploymentLocation.LOCAL && (
                        <div className="text-xs text-muted-foreground truncate">
                          {plugin.deployment.localPath}
                        </div>
                      )}
                    </div>

                    {/* 状态标签 */}
                    <Badge variant={plugin.enabled ? 'default' : 'secondary'}>
                      {plugin.enabled ? '已启用' : '已禁用'}
                    </Badge>
                  </div>

                  {/* 操作按钮 */}
                  <div className="flex items-center gap-1 ml-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleTogglePlugin(plugin.id)}
                    >
                      {plugin.enabled ? '禁用' : '启用'}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemovePlugin(plugin.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 添加插件 */}
      <Card>
        <CardHeader>
          <CardTitle>添加插件</CardTitle>
          <CardDescription>
            从云端选择插件或添加本地插件
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="cloud">
                <Cloud className="h-4 w-4 mr-2" />
                云端插件
              </TabsTrigger>
              <TabsTrigger value="local">
                <HardDrive className="h-4 w-4 mr-2" />
                本地插件
              </TabsTrigger>
            </TabsList>

            {/* 云端插件选择 */}
            <TabsContent value="cloud" className="space-y-4">
              {/* 搜索 */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="搜索插件..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* 插件列表 */}
              <ScrollArea className="h-[300px] pr-4">
                {isLoadingCloudPlugins ? (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    加载中...
                  </div>
                ) : filteredCloudPlugins.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                    <p>没有找到插件</p>
                    {searchQuery && (
                      <p className="text-sm mt-2">
                        尝试使用不同的搜索词
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredCloudPlugins.map((adapter) => {
                      const isSelected = isPluginSelected(adapter.id);
                      const canAdd = !maxPlugins || selectedPlugins.length < maxPlugins;

                      return (
                        <Card
                          key={adapter.id}
                          className={cn(
                            'cursor-pointer transition-all',
                            isSelected && 'border-primary bg-primary/5',
                            !canAdd && !isSelected && 'opacity-50'
                          )}
                        >
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <h4 className="font-medium truncate">
                                  {adapter.displayName}
                                </h4>
                                <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                                  {adapter.description}
                                </p>
                                <div className="flex items-center gap-2 mt-2">
                                  <Badge variant="outline" className="text-xs">
                                    v{adapter.version}
                                  </Badge>
                                  <span className="text-xs text-muted-foreground">
                                    {adapter.stats.downloads} 次下载
                                  </span>
                                </div>
                              </div>

                              <Button
                                size="sm"
                                variant={isSelected ? 'secondary' : 'default'}
                                onClick={() => handleAddCloudPlugin(adapter)}
                                disabled={isSelected || !canAdd}
                              >
                                {isSelected ? (
                                  <>
                                    <Check className="h-4 w-4 mr-1" />
                                    已添加
                                  </>
                                ) : (
                                  <>
                                    <Plus className="h-4 w-4 mr-1" />
                                    添加
                                  </>
                                )}
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>

            {/* 本地插件添加 */}
            <TabsContent value="local" className="space-y-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    插件名称 <span className="text-destructive">*</span>
                  </label>
                  <Input
                    placeholder="例如：my-custom-plugin"
                    value={localPluginName}
                    onChange={(e) => setLocalPluginName(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">显示名称</label>
                  <Input
                    placeholder="例如：我的自定义插件"
                    value={localPluginDisplayName}
                    onChange={(e) => setLocalPluginDisplayName(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    不填写则使用插件名称
                  </p>
                </div>

                <LocalPathInput
                  label="本地路径"
                  value={localPluginPath}
                  onChange={setLocalPluginPath}
                  required
                  showValidation
                  pathType="any"
                  placeholder="/path/to/plugin"
                  description="插件在桌面应用中的完整路径"
                />

                <Button
                  className="w-full"
                  onClick={handleAddLocalPlugin}
                  disabled={
                    !localPluginName.trim() ||
                    !localPluginPath.trim() ||
                    (maxPlugins ? selectedPlugins.length >= maxPlugins : false)
                  }
                >
                  <Plus className="h-4 w-4 mr-2" />
                  添加本地插件
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default PluginSelector;

