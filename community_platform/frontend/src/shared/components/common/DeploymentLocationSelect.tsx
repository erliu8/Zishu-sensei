/**
 * DeploymentLocationSelect - 部署位置选择组件
 * 用于选择云端或本地部署
 */

import React from 'react';
import { Label } from '@/shared/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/shared/components/ui/radio-group';
import { Card, CardContent } from '@/shared/components/ui/card';
import { Cloud, HardDrive, Info } from 'lucide-react';
import { cn } from '@/shared/utils';
import { DeploymentLocation } from '@/features/adapter/domain';

export interface DeploymentLocationSelectProps {
  /** 当前选中的位置 */
  value: DeploymentLocation;
  /** 位置变化回调 */
  onChange: (location: DeploymentLocation) => void;
  /** 标签文本 */
  label?: string;
  /** 是否禁用 */
  disabled?: boolean;
  /** 自定义样式 */
  className?: string;
  /** 是否显示描述 */
  showDescription?: boolean;
}

/**
 * 部署位置选项配置
 */
const LOCATION_OPTIONS = [
  {
    value: DeploymentLocation.CLOUD,
    label: '云端部署',
    description: '模型/插件托管在云服务器上，方便分享和更新',
    icon: Cloud,
    iconColor: 'text-blue-500',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
  },
  {
    value: DeploymentLocation.LOCAL,
    label: '本地部署',
    description: '模型/插件存储在本地磁盘上，需要提供完整路径',
    icon: HardDrive,
    iconColor: 'text-green-500',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
  },
];

/**
 * DeploymentLocationSelect 组件
 */
export const DeploymentLocationSelect: React.FC<DeploymentLocationSelectProps> = ({
  value,
  onChange,
  label = '部署位置',
  disabled = false,
  className,
  showDescription = true,
}) => {
  return (
    <div className={cn('space-y-3', className)}>
      {/* 标签 */}
      {label && (
        <Label className="text-base font-medium">
          {label}
        </Label>
      )}

      {/* 单选组 */}
      <RadioGroup
        value={value}
        onValueChange={(val) => onChange(val as DeploymentLocation)}
        disabled={disabled}
        className="grid gap-3 sm:grid-cols-2"
      >
        {LOCATION_OPTIONS.map((option) => {
          const Icon = option.icon;
          const isSelected = value === option.value;

          return (
            <div key={option.value}>
              <RadioGroupItem
                value={option.value}
                id={`location-${option.value}`}
                className="peer sr-only"
              />
              
              <Label
                htmlFor={`location-${option.value}`}
                className={cn(
                  'flex cursor-pointer',
                  disabled && 'cursor-not-allowed opacity-60'
                )}
              >
                <Card
                  className={cn(
                    'w-full transition-all duration-200',
                    'hover:shadow-md',
                    isSelected && [
                      'ring-2 ring-primary',
                      'shadow-md',
                    ],
                    !isSelected && 'hover:border-primary/50'
                  )}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      {/* 图标 */}
                      <div
                        className={cn(
                          'rounded-lg p-2',
                          isSelected ? option.bgColor : 'bg-muted',
                          'transition-colors'
                        )}
                      >
                        <Icon
                          className={cn(
                            'h-5 w-5',
                            isSelected ? option.iconColor : 'text-muted-foreground'
                          )}
                        />
                      </div>

                      {/* 内容 */}
                      <div className="flex-1 space-y-1">
                        <div className="font-medium flex items-center gap-2">
                          {option.label}
                          {isSelected && (
                            <div className="h-2 w-2 rounded-full bg-primary" />
                          )}
                        </div>
                        
                        {showDescription && (
                          <p className="text-sm text-muted-foreground leading-snug">
                            {option.description}
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Label>
            </div>
          );
        })}
      </RadioGroup>

      {/* 提示信息 */}
      {showDescription && (
        <div className="flex items-start gap-2 rounded-lg bg-muted/50 p-3 text-sm">
          <Info className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
          <div className="text-muted-foreground">
            {value === DeploymentLocation.CLOUD ? (
              <span>
                云端部署时，需要上传文件到服务器。上传后可以在社区中分享给其他用户。
              </span>
            ) : (
              <span>
                本地部署时，请确保填写的路径在桌面应用中可访问。文件将不会上传到服务器。
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default DeploymentLocationSelect;

