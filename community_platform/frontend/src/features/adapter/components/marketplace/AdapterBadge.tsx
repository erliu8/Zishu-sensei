/**
 * 适配器徽章组件
 * 用于显示适配器类型、兼容性等标识
 * @module features/adapter/components/marketplace
 */

import React from 'react';
import { Badge } from '@/shared/components/ui/badge';
import { AdapterType, CompatibilityLevel, CapabilityLevel } from '../../domain';
import { 
  Sparkles, 
  CheckCircle2, 
  AlertCircle, 
  XCircle,
  Star,
  TrendingUp,
  Zap,
  Plug,
  MessageSquare,
  Bot,
} from 'lucide-react';
import { cn } from '@/shared/utils';

/**
 * 适配器类型徽章属性
 */
export interface AdapterTypeBadgeProps {
  /** 适配器类型 */
  type: AdapterType;
  /** 是否显示图标 */
  showIcon?: boolean;
  /** 自定义样式 */
  className?: string;
}

/**
 * 适配器类型徽章
 * 显示名称已更新：硬适配器→插件，软适配器→提示词工程，智能硬适配器→微调模型
 */
export const AdapterTypeBadge: React.FC<AdapterTypeBadgeProps> = ({ 
  type, 
  showIcon = true,
  className 
}) => {
  const config = {
    [AdapterType.SOFT]: {
      label: '角色提示词',
      icon: MessageSquare,
      variant: 'default' as const,
      className: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    },
    [AdapterType.HARD]: {
      label: '插件',
      icon: Plug,
      variant: 'secondary' as const,
      className: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
    },
    [AdapterType.INTELLIGENT]: {
      label: '微调模型',
      icon: Bot,
      variant: 'default' as const,
      className: 'bg-gradient-to-r from-purple-100 to-pink-100 text-purple-800 dark:from-purple-900 dark:to-pink-900 dark:text-purple-200',
    },
  };

  const { label, icon: Icon, className: colorClass } = config[type];

  return (
    <Badge className={cn(colorClass, className)}>
      {showIcon && <Icon className="mr-1 h-3 w-3" />}
      <span>{label}</span>
    </Badge>
  );
};

/**
 * 兼容性徽章属性
 */
export interface CompatibilityBadgeProps {
  /** 兼容性级别 */
  level: CompatibilityLevel;
  /** 是否显示图标 */
  showIcon?: boolean;
  /** 自定义样式 */
  className?: string;
}

/**
 * 兼容性徽章
 */
export const CompatibilityBadge: React.FC<CompatibilityBadgeProps> = ({ 
  level, 
  showIcon = true,
  className 
}) => {
  const config = {
    [CompatibilityLevel.FULL]: {
      label: '完全兼容',
      icon: CheckCircle2,
      className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    },
    [CompatibilityLevel.PARTIAL]: {
      label: '部分兼容',
      icon: AlertCircle,
      className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    },
    [CompatibilityLevel.INCOMPATIBLE]: {
      label: '不兼容',
      icon: XCircle,
      className: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    },
  };

  const { label, icon: Icon, className: colorClass } = config[level];

  return (
    <Badge className={cn(colorClass, className)}>
      {showIcon && <Icon className="mr-1 h-3 w-3" />}
      <span>{label}</span>
    </Badge>
  );
};

/**
 * 能力等级徽章属性
 */
export interface CapabilityBadgeProps {
  /** 能力等级 */
  level: CapabilityLevel;
  /** 是否显示图标 */
  showIcon?: boolean;
  /** 自定义样式 */
  className?: string;
}

/**
 * 能力等级徽章
 */
export const CapabilityBadge: React.FC<CapabilityBadgeProps> = ({ 
  level, 
  showIcon = true,
  className 
}) => {
  const config = {
    [CapabilityLevel.BASIC]: {
      label: '基础',
      icon: Star,
      className: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
    },
    [CapabilityLevel.INTERMEDIATE]: {
      label: '中级',
      icon: TrendingUp,
      className: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    },
    [CapabilityLevel.ADVANCED]: {
      label: '高级',
      icon: Zap,
      className: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
    },
    [CapabilityLevel.EXPERT]: {
      label: '专家',
      icon: Sparkles,
      className: 'bg-gradient-to-r from-yellow-100 to-orange-100 text-orange-800 dark:from-yellow-900 dark:to-orange-900 dark:text-orange-200',
    },
  };

  const { label, icon: Icon, className: colorClass } = config[level];

  return (
    <Badge className={cn(colorClass, className)}>
      {showIcon && <Icon className="mr-1 h-3 w-3" />}
      <span>{label}</span>
    </Badge>
  );
};

/**
 * 推荐徽章属性
 */
export interface FeaturedBadgeProps {
  /** 自定义样式 */
  className?: string;
}

/**
 * 推荐徽章
 */
export const FeaturedBadge: React.FC<FeaturedBadgeProps> = ({ className }) => {
  return (
    <Badge className={cn('bg-gradient-to-r from-yellow-400 to-orange-400 text-white', className)}>
      <Sparkles className="mr-1 h-3 w-3" />
      <span>推荐</span>
    </Badge>
  );
};

/**
 * 新品徽章属性
 */
export interface NewBadgeProps {
  /** 自定义样式 */
  className?: string;
}

/**
 * 新品徽章
 */
export const NewBadge: React.FC<NewBadgeProps> = ({ className }) => {
  return (
    <Badge className={cn('bg-gradient-to-r from-green-400 to-teal-400 text-white', className)}>
      <Sparkles className="mr-1 h-3 w-3" />
      <span>NEW</span>
    </Badge>
  );
};

