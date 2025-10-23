/**
 * 依赖管理组件
 * 管理适配器的依赖关系
 */

'use client';

import React, { useState, useCallback } from 'react';
import { Plus, Trash2, Search, Package, AlertTriangle } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Checkbox } from '@/shared/components/ui/checkbox';
import { Badge } from '@/shared/components/ui/badge';
import { Alert, AlertDescription } from '@/shared/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/shared/components/ui/dialog';
import { ScrollArea } from '@/shared/components/ui/scroll-area';
import { Separator } from '@/shared/components/ui/separator';
import type { AdapterDependency } from '../../api/types';
import { cn } from '@/shared/utils/cn';

export interface DependencyManagerProps {
  /** 依赖列表 */
  dependencies: AdapterDependency[];
  /** 依赖变更回调 */
  onDependenciesChange: (dependencies: AdapterDependency[]) => void;
  /** 是否禁用 */
  disabled?: boolean;
  /** 类名 */
  className?: string;
}

// 模拟的适配器搜索结果
interface AdapterSearchResult {
  id: string;
  name: string;
  description: string;
  latestVersion: string;
  author: string;
  downloads: number;
}

export function DependencyManager({
  dependencies,
  onDependenciesChange,
  disabled = false,
  className,
}: DependencyManagerProps) {
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const handleAddDependency = useCallback(
    (adapter: AdapterSearchResult, optional: boolean = false) => {
      // 检查是否已存在
      const exists = dependencies.some((dep) => dep.adapterId === adapter.id);
      if (exists) {
        return;
      }

      const newDependency: AdapterDependency = {
        adapterId: adapter.id,
        name: adapter.name,
        versionRequirement: `^${adapter.latestVersion}`,
        optional,
      };

      onDependenciesChange([...dependencies, newDependency]);
      setIsSearchOpen(false);
    },
    [dependencies, onDependenciesChange]
  );

  const handleRemoveDependency = useCallback(
    (adapterId: string) => {
      onDependenciesChange(dependencies.filter((dep) => dep.adapterId !== adapterId));
    },
    [dependencies, onDependenciesChange]
  );

  const handleUpdateDependency = useCallback(
    (adapterId: string, updates: Partial<AdapterDependency>) => {
      onDependenciesChange(
        dependencies.map((dep) =>
          dep.adapterId === adapterId ? { ...dep, ...updates } : dep
        )
      );
    },
    [dependencies, onDependenciesChange]
  );

  const requiredDependencies = dependencies.filter((dep) => !dep.optional);
  const optionalDependencies = dependencies.filter((dep) => dep.optional);

  // 检测循环依赖
  const hasCircularDependency = false; // 这里应该实现循环依赖检测逻辑

  return (
    <div className={cn('space-y-4', className)}>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>依赖管理</CardTitle>
              <CardDescription>管理适配器所依赖的其他适配器</CardDescription>
            </div>
            <Dialog open={isSearchOpen} onOpenChange={setIsSearchOpen}>
              <DialogTrigger asChild>
                <Button type="button" variant="outline" size="sm" disabled={disabled}>
                  <Plus className="mr-2 h-4 w-4" />
                  添加依赖
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>搜索适配器</DialogTitle>
                  <DialogDescription>
                    搜索并添加此适配器所依赖的其他适配器
                  </DialogDescription>
                </DialogHeader>
                <AdapterSearchDialog onSelect={handleAddDependency} />
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 循环依赖警告 */}
          {hasCircularDependency && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                检测到循环依赖！请检查依赖关系以避免运行时错误。
              </AlertDescription>
            </Alert>
          )}

          {/* 必需依赖 */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-medium">必需依赖</h4>
              <Badge variant="secondary">{requiredDependencies.length}</Badge>
            </div>

            {requiredDependencies.length > 0 ? (
              <div className="space-y-2">
                {requiredDependencies.map((dep) => (
                  <DependencyItem
                    key={dep.adapterId}
                    dependency={dep}
                    onRemove={handleRemoveDependency}
                    onUpdate={handleUpdateDependency}
                    disabled={disabled}
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                暂无必需依赖
              </div>
            )}
          </div>

          <Separator />

          {/* 可选依赖 */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-medium">可选依赖</h4>
              <Badge variant="outline">{optionalDependencies.length}</Badge>
            </div>

            {optionalDependencies.length > 0 ? (
              <div className="space-y-2">
                {optionalDependencies.map((dep) => (
                  <DependencyItem
                    key={dep.adapterId}
                    dependency={dep}
                    onRemove={handleRemoveDependency}
                    onUpdate={handleUpdateDependency}
                    disabled={disabled}
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                暂无可选依赖
              </div>
            )}
          </div>

          {/* 依赖图可视化提示 */}
          {dependencies.length > 0 && (
            <div className="rounded-lg bg-muted/50 p-4">
              <div className="flex items-start gap-3">
                <Package className="mt-0.5 h-5 w-5 text-muted-foreground" />
                <div className="flex-1 space-y-1">
                  <p className="text-sm font-medium">依赖关系</p>
                  <p className="text-xs text-muted-foreground">
                    共 {dependencies.length} 个依赖，其中 {requiredDependencies.length} 个必需，
                    {optionalDependencies.length} 个可选
                  </p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

interface DependencyItemProps {
  dependency: AdapterDependency;
  onRemove: (adapterId: string) => void;
  onUpdate: (adapterId: string, updates: Partial<AdapterDependency>) => void;
  disabled?: boolean;
}

function DependencyItem({ dependency, onRemove, onUpdate, disabled }: DependencyItemProps) {
  const [isEditingVersion, setIsEditingVersion] = useState(false);
  const [versionInput, setVersionInput] = useState(dependency.versionRequirement);

  const handleVersionSave = () => {
    if (versionInput.trim()) {
      onUpdate(dependency.adapterId, { versionRequirement: versionInput.trim() });
    }
    setIsEditingVersion(false);
  };

  return (
    <div className="flex items-center gap-3 rounded-lg border p-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted">
        <Package className="h-5 w-5 text-muted-foreground" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-medium truncate">{dependency.name}</p>
          {dependency.optional && (
            <Badge variant="outline" className="text-xs">
              可选
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 mt-1">
          {isEditingVersion ? (
            <div className="flex items-center gap-2">
              <Input
                value={versionInput}
                onChange={(e) => setVersionInput(e.target.value)}
                onBlur={handleVersionSave}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleVersionSave();
                  } else if (e.key === 'Escape') {
                    setVersionInput(dependency.versionRequirement);
                    setIsEditingVersion(false);
                  }
                }}
                className="h-6 w-32 text-xs"
                placeholder="版本要求"
                autoFocus
                disabled={disabled}
              />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setIsEditingVersion(true)}
              className="text-xs text-muted-foreground hover:text-foreground"
              disabled={disabled}
            >
              版本: {dependency.versionRequirement}
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Checkbox
          id={`optional-${dependency.adapterId}`}
          checked={dependency.optional}
          onCheckedChange={(checked) =>
            onUpdate(dependency.adapterId, { optional: checked as boolean })
          }
          disabled={disabled}
        />
        <Label
          htmlFor={`optional-${dependency.adapterId}`}
          className="text-xs text-muted-foreground cursor-pointer"
        >
          可选
        </Label>

        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => onRemove(dependency.adapterId)}
          disabled={disabled}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

interface AdapterSearchDialogProps {
  onSelect: (adapter: AdapterSearchResult, optional: boolean) => void;
}

function AdapterSearchDialog({ onSelect }: AdapterSearchDialogProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOptional, setSelectedOptional] = useState(false);

  // 模拟搜索结果
  const mockResults: AdapterSearchResult[] = [
    {
      id: 'excel-reader-001',
      name: 'Excel文件读取器',
      description: '提供Excel文件的读取和解析功能',
      latestVersion: '1.2.0',
      author: 'zishu-team',
      downloads: 15234,
    },
    {
      id: 'data-validator-002',
      name: '数据验证器',
      description: '提供数据验证和清洗功能',
      latestVersion: '2.0.1',
      author: 'zishu-team',
      downloads: 8921,
    },
    {
      id: 'chart-generator-003',
      name: '图表生成器',
      description: '生成各类统计图表',
      latestVersion: '1.5.3',
      author: 'community',
      downloads: 12456,
    },
  ];

  const filteredResults = searchQuery
    ? mockResults.filter(
        (result) =>
          result.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          result.description.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : mockResults;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索适配器名称或描述..."
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id="optional-dependency"
            checked={selectedOptional}
            onCheckedChange={(checked) => setSelectedOptional(checked as boolean)}
          />
          <Label htmlFor="optional-dependency" className="cursor-pointer whitespace-nowrap">
            可选依赖
          </Label>
        </div>
      </div>

      <ScrollArea className="h-[400px] pr-4">
        <div className="space-y-2">
          {filteredResults.length > 0 ? (
            filteredResults.map((result) => (
              <button
                key={result.id}
                type="button"
                onClick={() => onSelect(result, selectedOptional)}
                className="w-full rounded-lg border p-4 text-left transition-colors hover:bg-accent"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium">{result.name}</h4>
                      <Badge variant="secondary" className="text-xs">
                        v{result.latestVersion}
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                      {result.description}
                    </p>
                    <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
                      <span>作者: {result.author}</span>
                      <span>下载: {result.downloads.toLocaleString()}</span>
                    </div>
                  </div>
                  <Plus className="h-5 w-5 text-muted-foreground" />
                </div>
              </button>
            ))
          ) : (
            <div className="py-12 text-center text-sm text-muted-foreground">
              未找到匹配的适配器
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

