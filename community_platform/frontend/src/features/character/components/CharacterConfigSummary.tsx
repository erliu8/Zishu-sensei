/**
 * CharacterConfigSummary - 角色配置摘要组件
 * 展示角色的完整配置信息（AI模型、Live2D模型、插件）
 * 用于角色详情页和热门角色展示
 */

import React from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { Separator } from '@/shared/components/ui/separator';
import { 
  Bot, 
  Sparkles, 
  Plug, 
  Cloud, 
  HardDrive,
  MessageSquare,
} from 'lucide-react';
import { cn } from '@/shared/utils';
import type { CharacterFullConfig } from '../domain/model-config.types';
import { ModelConfigType } from '../domain/model-config.types';
import { DeploymentLocation } from '@/features/adapter/domain';

export interface CharacterConfigSummaryProps {
  /** 角色完整配置 */
  config: CharacterFullConfig;
  /** 自定义样式 */
  className?: string;
  /** 是否为紧凑模式 */
  compact?: boolean;
}

/**
 * 获取模型配置类型的显示信息
 */
function getModelConfigDisplay(config: CharacterFullConfig['aiModel']) {
  switch (config.type) {
    case ModelConfigType.FULL_MODEL:
      return {
        icon: Bot,
        label: '完整微调模型',
        description: config.displayName,
        color: 'text-purple-600',
        bgColor: 'bg-purple-100',
      };
    case ModelConfigType.LORA_ADAPTER:
      const loraName = typeof config.loraAdapter === 'string' 
        ? config.loraAdapter 
        : config.loraAdapter.name;
      return {
        icon: Sparkles,
        label: 'Lora技能包',
        description: `${loraName} (基于 ${config.baseModelName})`,
        color: 'text-pink-600',
        bgColor: 'bg-pink-100',
      };
    case ModelConfigType.PROMPT_ENGINEERING:
      return {
        icon: MessageSquare,
        label: '提示词工程',
        description: `${config.modelName} (${config.provider})`,
        color: 'text-blue-600',
        bgColor: 'bg-blue-100',
      };
  }
}

/**
 * CharacterConfigSummary 组件
 */
export const CharacterConfigSummary: React.FC<CharacterConfigSummaryProps> = ({
  config,
  className,
  compact = false,
}) => {
  const modelDisplay = getModelConfigDisplay(config.aiModel);
  const ModelIcon = modelDisplay.icon;

  return (
    <Card className={cn('', className)}>
      <CardHeader className={compact ? 'p-4 pb-3' : undefined}>
        <CardTitle className={compact ? 'text-base' : 'text-lg'}>
          配置信息
        </CardTitle>
        {!compact && (
          <CardDescription>
            角色使用的AI模型、外观和插件配置
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className={compact ? 'p-4 pt-0' : 'space-y-4'}>
        {/* AI模型配置 */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <ModelIcon className="h-4 w-4" />
            <span>AI模型</span>
          </div>
          <div className="flex items-center gap-2 ml-6">
            <Badge variant="outline" className={cn(modelDisplay.bgColor, modelDisplay.color)}>
              {modelDisplay.label}
            </Badge>
            <span className="text-sm">{modelDisplay.description}</span>
          </div>
          
          {/* 部署位置 */}
          {config.aiModel.type !== ModelConfigType.PROMPT_ENGINEERING && 'deployment' in config.aiModel && config.aiModel.deployment && (
            <div className="flex items-center gap-2 ml-6 text-xs text-muted-foreground">
              {config.aiModel.deployment.location === DeploymentLocation.CLOUD ? (
                <>
                  <Cloud className="h-3 w-3" />
                  <span>云端部署</span>
                </>
              ) : (
                <>
                  <HardDrive className="h-3 w-3" />
                  <span>本地部署: {config.aiModel.deployment.localPath}</span>
                </>
              )}
            </div>
          )}
        </div>

        {!compact && <Separator />}

        {/* Live2D模型配置 */}
        {config.live2dModel && (
          <>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Sparkles className="h-4 w-4" />
                <span>Live2D模型</span>
              </div>
              <div className="flex items-center gap-2 ml-6">
                <span className="text-sm font-medium">
                  {config.live2dModel.displayName}
                </span>
              </div>
              
              {/* 部署位置 */}
              <div className="flex items-center gap-2 ml-6 text-xs text-muted-foreground">
                {config.live2dModel.deployment.location === DeploymentLocation.CLOUD ? (
                  <>
                    <Cloud className="h-3 w-3" />
                    <span>云端部署</span>
                  </>
                ) : (
                  <>
                    <HardDrive className="h-3 w-3" />
                    <span>本地部署: {config.live2dModel.deployment.localPath}</span>
                  </>
                )}
              </div>
            </div>

            {!compact && config.plugins && config.plugins.length > 0 && <Separator />}
          </>
        )}

        {/* 插件列表 */}
        {config.plugins && config.plugins.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Plug className="h-4 w-4" />
              <span>已启用插件</span>
              <Badge variant="secondary" className="ml-auto">
                {config.plugins.length}
              </Badge>
            </div>
            <div className="flex flex-wrap gap-2 ml-6">
              {config.plugins.map((pluginId, index) => (
                <Badge key={index} variant="outline" className="text-xs">
                  {pluginId}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* 紧凑模式下的所有配置 */}
        {compact && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-2">
            <div className="flex items-center gap-1">
              <Bot className="h-3 w-3" />
              <span>AI模型</span>
            </div>
            {config.live2dModel && (
              <>
                <span>•</span>
                <div className="flex items-center gap-1">
                  <Sparkles className="h-3 w-3" />
                  <span>Live2D</span>
                </div>
              </>
            )}
            {config.plugins && config.plugins.length > 0 && (
              <>
                <span>•</span>
                <div className="flex items-center gap-1">
                  <Plug className="h-3 w-3" />
                  <span>{config.plugins.length}个插件</span>
                </div>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default CharacterConfigSummary;

