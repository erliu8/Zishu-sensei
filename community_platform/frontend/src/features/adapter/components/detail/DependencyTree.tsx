/**
 * 依赖树可视化组件
 * @module features/adapter/components/detail
 */

'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, Package, AlertTriangle, CheckCircle, Info } from 'lucide-react';
import {
  Card,
  Badge,
  Button,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  EmptyState,
} from '@/shared/components';
import type { AdapterDependency } from '../../domain';
import { cn } from '@/shared/utils';

/**
 * 依赖树组件属性
 */
export interface DependencyTreeProps {
  /** 依赖列表 */
  dependencies: AdapterDependency[];
  /** 类名 */
  className?: string;
}

/**
 * 依赖节点属性
 */
interface DependencyNodeProps {
  /** 依赖项 */
  dependency: AdapterDependency;
  /** 嵌套层级 */
  level?: number;
}

/**
 * 依赖类型标签映射
 */
const DependencyTypeMap: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  runtime: { label: '运行时', variant: 'default' },
  development: { label: '开发', variant: 'secondary' },
  peer: { label: '对等', variant: 'outline' },
  optional: { label: '可选', variant: 'outline' },
};

/**
 * 依赖节点组件
 */
function DependencyNode({ dependency, level = 0 }: DependencyNodeProps) {
  const [isExpanded, setIsExpanded] = useState(level === 0);
  const typeInfo = DependencyTypeMap[dependency.type] || DependencyTypeMap['runtime'];

  return (
    <div className={cn('border-l-2 border-muted', level > 0 && 'ml-6')}>
      <div className="flex items-start gap-3 p-3 hover:bg-muted/50 rounded-lg transition-colors">
        {/* 展开/折叠按钮 */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex-shrink-0 mt-0.5 opacity-0 pointer-events-none"
          aria-label={isExpanded ? '折叠' : '展开'}
        >
          {isExpanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </button>

        {/* 依赖图标 */}
        <div className="flex-shrink-0 mt-0.5">
          <Package className="h-5 w-5 text-muted-foreground" />
        </div>

        {/* 依赖信息 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h4 className="font-semibold text-sm">{dependency.dependencyName}</h4>
            <Badge variant="outline" className="text-xs font-mono">
              {dependency.versionRequirement}
            </Badge>
            <Badge variant={typeInfo?.variant || 'default'} className="text-xs">
              {typeInfo?.label || '运行时'}
            </Badge>
            {dependency.required ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="destructive" className="text-xs gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    必需
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  此依赖项是必需的
                </TooltipContent>
              </Tooltip>
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="outline" className="text-xs gap-1">
                    <Info className="h-3 w-3" />
                    可选
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  此依赖项是可选的
                </TooltipContent>
              </Tooltip>
            )}
          </div>

          {dependency.description && (
            <p className="text-sm text-muted-foreground">{dependency.description}</p>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * 依赖树组件
 */
export function DependencyTree({ dependencies, className }: DependencyTreeProps) {
  // 按类型分组依赖
  const groupedDependencies = dependencies.reduce((acc, dep) => {
    const type = dep.type || 'runtime';
    if (!acc[type]) {
      acc[type] = [];
    }
    acc[type].push(dep);
    return acc;
  }, {} as Record<string, AdapterDependency[]>);

  const [showOptional, setShowOptional] = useState(false);

  if (dependencies.length === 0) {
    return (
      <EmptyState
        icon={<Package className="h-12 w-12" />}
        title="无依赖项"
        description="此适配器不依赖其他适配器，可以独立安装使用"
      />
    );
  }

  // 统计信息
  const requiredCount = dependencies.filter((d) => d.required).length;
  const optionalCount = dependencies.filter((d) => !d.required).length;

  return (
    <TooltipProvider>
      <div className={cn('space-y-6', className)}>
      {/* 统计信息卡片 */}
      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Package className="h-5 w-5 text-primary" />
            </div>
            <div>
              <div className="text-2xl font-bold">{dependencies.length}</div>
              <div className="text-sm text-muted-foreground">总依赖项</div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <div className="text-2xl font-bold">{requiredCount}</div>
              <div className="text-sm text-muted-foreground">必需依赖</div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-secondary/50 flex items-center justify-center">
              <Info className="h-5 w-5 text-secondary-foreground" />
            </div>
            <div>
              <div className="text-2xl font-bold">{optionalCount}</div>
              <div className="text-sm text-muted-foreground">可选依赖</div>
            </div>
          </div>
        </div>
      </Card>

      {/* 依赖树 */}
      <div className="space-y-6">
        {Object.entries(groupedDependencies).map(([type, deps]) => {
          const typeInfo = DependencyTypeMap[type] || DependencyTypeMap['runtime'];
          const isOptional = type === 'optional';

          // 如果是可选依赖且未展开，跳过
          if (isOptional && !showOptional) {
            return null;
          }

          return (
            <div key={type}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-semibold">{typeInfo?.label || '运行时'}依赖</h3>
                  <Badge variant={typeInfo?.variant || 'default'}>{deps.length}</Badge>
                </div>
                {type === 'runtime' && (
                  <Badge variant="outline" className="gap-1">
                    <CheckCircle className="h-3 w-3" />
                    安装时自动处理
                  </Badge>
                )}
              </div>

              <Card className="p-4">
                <div className="space-y-2">
                  {deps.map((dep) => (
                    <DependencyNode key={dep.id} dependency={dep} />
                  ))}
                </div>
              </Card>
            </div>
          );
        })}

        {/* 显示/隐藏可选依赖按钮 */}
        {optionalCount > 0 && (
          <div className="flex justify-center">
            <Button
              variant="outline"
              onClick={() => setShowOptional(!showOptional)}
            >
              {showOptional ? '隐藏' : '显示'}可选依赖 ({optionalCount})
            </Button>
          </div>
        )}
      </div>

      {/* 依赖说明 */}
      <Card className="p-4 bg-muted/50">
        <h4 className="font-semibold mb-3">依赖说明</h4>
        <div className="space-y-2 text-sm">
          <div className="flex items-start gap-2">
            <Badge variant="default" className="text-xs mt-0.5">运行时</Badge>
            <span className="text-muted-foreground">
              在适配器运行时必须存在的依赖，安装时会自动下载并安装
            </span>
          </div>
          <div className="flex items-start gap-2">
            <Badge variant="destructive" className="text-xs mt-0.5">必需</Badge>
            <span className="text-muted-foreground">
              必须安装的依赖项，缺少将导致适配器无法正常工作
            </span>
          </div>
          <div className="flex items-start gap-2">
            <Badge variant="outline" className="text-xs mt-0.5">可选</Badge>
            <span className="text-muted-foreground">
              可选的依赖项，安装后可以提供额外的功能
            </span>
          </div>
          <div className="flex items-start gap-2">
            <Badge variant="secondary" className="text-xs mt-0.5">开发</Badge>
            <span className="text-muted-foreground">
              仅在开发环境中需要的依赖，用户使用时不需要安装
            </span>
          </div>
          <div className="flex items-start gap-2">
            <Badge variant="outline" className="text-xs mt-0.5">对等</Badge>
            <span className="text-muted-foreground">
              需要由用户手动安装的依赖，适配器会检查是否已安装
            </span>
          </div>
        </div>
      </Card>
      </div>
    </TooltipProvider>
  );
}

