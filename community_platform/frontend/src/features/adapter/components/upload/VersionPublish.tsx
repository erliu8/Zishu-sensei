/**
 * 版本发布组件
 * 管理适配器版本信息和发布流程
 */

'use client';

import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { GitBranch, Calendar, FileText, AlertCircle } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Textarea } from '@/shared/components/ui/textarea';
import { Label } from '@/shared/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Alert, AlertDescription } from '@/shared/components/ui/alert';
import { Badge } from '@/shared/components/ui/badge';
import { Separator } from '@/shared/components/ui/separator';
import type { AdapterVersion } from '../../api/types';
import { cn } from '@/shared/utils/cn';

const versionSchema = z.object({
  version: z
    .string()
    .min(1, '版本号不能为空')
    .regex(/^\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?$/, '版本号格式不正确，应为 x.y.z 格式'),
  description: z.string().min(1, '版本描述不能为空').max(200, '描述最多200个字符'),
  changelog: z.string().min(10, '更新日志至少10个字符').max(5000, '更新日志最多5000个字符'),
});

export type VersionFormData = z.infer<typeof versionSchema>;

export interface VersionPublishProps {
  /** 初始值 */
  initialData?: Partial<AdapterVersion>;
  /** 当前最新版本（用于版本号验证） */
  currentVersion?: string;
  /** 提交回调 */
  onSubmit: (data: AdapterVersion) => void;
  /** 是否禁用 */
  disabled?: boolean;
  /** 类名 */
  className?: string;
  /** 是否为新版本发布 */
  isNewVersion?: boolean;
}

export function VersionPublish({
  initialData,
  currentVersion,
  onSubmit,
  disabled = false,
  className,
  isNewVersion = true,
}: VersionPublishProps) {
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<VersionFormData>({
    resolver: zodResolver(versionSchema),
    defaultValues: {
      version: initialData?.version || '',
      description: initialData?.description || '',
      changelog: initialData?.changelog || '',
    },
  });

  const version = watch('version');

  const handleFormSubmit = (data: VersionFormData) => {
    const versionData: AdapterVersion = {
      ...data,
      publishedAt: new Date().toISOString(),
      downloads: 0,
      isLatest: true,
    };
    onSubmit(versionData);
  };

  // 版本号验证
  const versionValidation = validateVersion(version, currentVersion);

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className={cn('space-y-6', className)}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitBranch className="h-5 w-5" />
            版本信息
          </CardTitle>
          <CardDescription>
            {isNewVersion
              ? '填写新版本的信息和更新日志'
              : '查看或编辑版本信息'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 版本号 */}
          <div className="space-y-2">
            <Label htmlFor="version">版本号 *</Label>
            <div className="flex items-start gap-3">
              <div className="flex-1 space-y-2">
                <Input
                  id="version"
                  {...register('version')}
                  placeholder="1.0.0"
                  disabled={disabled}
                />
                {errors.version && (
                  <p className="text-sm text-destructive">{errors.version.message}</p>
                )}
              </div>
              {currentVersion && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">当前:</span>
                  <Badge variant="outline">{currentVersion}</Badge>
                </div>
              )}
            </div>

            {/* 版本号规范说明 */}
            <div className="rounded-lg bg-muted/50 p-3 text-sm">
              <p className="font-medium mb-1">版本号规范 (语义化版本)</p>
              <ul className="space-y-1 text-muted-foreground">
                <li>• 主版本号.次版本号.修订号 (例如: 1.0.0)</li>
                <li>• 主版本号: 不兼容的API修改</li>
                <li>• 次版本号: 向下兼容的功能性新增</li>
                <li>• 修订号: 向下兼容的问题修正</li>
                <li>• 可选预发布标识 (例如: 1.0.0-beta.1)</li>
              </ul>
            </div>

            {/* 版本验证反馈 */}
            {version && versionValidation && (
              <Alert variant={versionValidation.isValid ? 'default' : 'destructive'}>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{versionValidation.message}</AlertDescription>
              </Alert>
            )}
          </div>

          <Separator />

          {/* 版本描述 */}
          <div className="space-y-2">
            <Label htmlFor="description">版本描述 *</Label>
            <Input
              id="description"
              {...register('description')}
              placeholder="简短描述本次更新的主要内容"
              disabled={disabled}
            />
            {errors.description && (
              <p className="text-sm text-destructive">{errors.description.message}</p>
            )}
            <p className="text-xs text-muted-foreground">
              用一句话概括本次版本的主要变化
            </p>
          </div>

          {/* 更新日志 */}
          <div className="space-y-2">
            <Label htmlFor="changelog">更新日志 *</Label>
            <Textarea
              id="changelog"
              {...register('changelog')}
              placeholder="详细描述本次更新的内容...&#10;&#10;建议格式:&#10;## 新增功能&#10;- 功能1&#10;- 功能2&#10;&#10;## 问题修复&#10;- 修复了...&#10;&#10;## 性能优化&#10;- 优化了..."
              rows={12}
              disabled={disabled}
              className="font-mono text-sm"
            />
            {errors.changelog && (
              <p className="text-sm text-destructive">{errors.changelog.message}</p>
            )}
            <p className="text-xs text-muted-foreground">
              支持 Markdown 格式，建议分类说明新增功能、问题修复、性能优化等
            </p>
          </div>

          {/* 更新日志模板 */}
          <ChangelogTemplate onUseTemplate={(_template) => {
            // 这里可以通过 setValue 设置值，但需要从外部传入 setValue
            // 为了简化，这里提供一个示例
          }} />
        </CardContent>
      </Card>

      {/* 发布前检查清单 */}
      {isNewVersion && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              发布前检查
            </CardTitle>
            <CardDescription>
              确保以下事项都已完成
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <ChecklistItem text="代码已经过充分测试" />
              <ChecklistItem text="文档已更新至最新版本" />
              <ChecklistItem text="破坏性变更已在更新日志中标注" />
              <ChecklistItem text="依赖关系已正确配置" />
              <ChecklistItem text="版本号符合语义化版本规范" />
              <ChecklistItem text="更新日志详细且准确" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* 版本历史预览 */}
      {currentVersion && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              版本对比
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <div className="text-sm font-medium text-muted-foreground">当前版本</div>
                <div className="rounded-lg border p-4">
                  <Badge variant="outline" className="mb-2">
                    {currentVersion}
                  </Badge>
                  <p className="text-sm text-muted-foreground">
                    {initialData?.publishedAt
                      ? `发布于 ${new Date(initialData.publishedAt).toLocaleDateString()}`
                      : '暂无发布信息'}
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                <div className="text-sm font-medium text-muted-foreground">新版本</div>
                <div className="rounded-lg border p-4 border-primary/50 bg-primary/5">
                  <Badge className="mb-2">{version || '未设置'}</Badge>
                  <p className="text-sm text-muted-foreground">
                    即将发布
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </form>
  );
}

interface ChecklistItemProps {
  text: string;
}

function ChecklistItem({ text }: ChecklistItemProps) {
  const [checked, setChecked] = React.useState(false);

  return (
    <label className="flex items-start gap-3 cursor-pointer group">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => setChecked(e.target.checked)}
        className="mt-1 h-4 w-4 rounded border-muted-foreground/50 text-primary focus:ring-2 focus:ring-primary focus:ring-offset-2"
      />
      <span
        className={cn(
          'text-sm transition-colors',
          checked ? 'text-muted-foreground line-through' : 'group-hover:text-foreground'
        )}
      >
        {text}
      </span>
    </label>
  );
}

interface ChangelogTemplateProps {
  onUseTemplate: (template: string) => void;
}

function ChangelogTemplate({ onUseTemplate }: ChangelogTemplateProps) {
  const templates = [
    {
      name: '标准模板',
      content: `## 新增功能
- 

## 问题修复
- 

## 性能优化
- 

## 破坏性变更
- 

## 其他变更
- `,
    },
    {
      name: '简化模板',
      content: `## 本次更新
- 

## 注意事项
- `,
    },
  ];

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium">更新日志模板</h4>
      </div>
      <div className="flex flex-wrap gap-2">
        {templates.map((template) => (
          <Button
            key={template.name}
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onUseTemplate(template.content)}
          >
            使用{template.name}
          </Button>
        ))}
      </div>
    </div>
  );
}

interface VersionValidation {
  isValid: boolean;
  message: string;
}

function validateVersion(newVersion: string, currentVersion?: string): VersionValidation | null {
  if (!newVersion) return null;

  // 检查格式
  const versionRegex = /^(\d+)\.(\d+)\.(\d+)(-[a-zA-Z0-9.]+)?$/;
  const match = newVersion.match(versionRegex);

  if (!match) {
    return {
      isValid: false,
      message: '版本号格式不正确，应为 x.y.z 格式',
    };
  }

  if (!currentVersion) {
    return {
      isValid: true,
      message: '版本号格式正确',
    };
  }

  // 比较版本号
  const currentMatch = currentVersion.match(versionRegex);
  if (!currentMatch) {
    return {
      isValid: true,
      message: '版本号格式正确',
    };
  }

  const [, newMajor, newMinor, newPatch] = match.map(Number);
  const [, currentMajor, currentMinor, currentPatch] = currentMatch.map(Number);

  if (newMajor !== undefined && currentMajor !== undefined && newMajor < currentMajor) {
    return {
      isValid: false,
      message: '主版本号不能小于当前版本',
    };
  }

  if (newMajor !== undefined && currentMajor !== undefined && newMinor !== undefined && currentMinor !== undefined && newMajor === currentMajor && newMinor < currentMinor) {
    return {
      isValid: false,
      message: '次版本号不能小于当前版本',
    };
  }

  if (newMajor !== undefined && currentMajor !== undefined && newMinor !== undefined && currentMinor !== undefined && newPatch !== undefined && currentPatch !== undefined && newMajor === currentMajor && newMinor === currentMinor && newPatch <= currentPatch) {
    return {
      isValid: false,
      message: '修订号必须大于当前版本',
    };
  }

  // 判断版本类型
  let versionType = '';
  if (newMajor !== undefined && currentMajor !== undefined && newMajor > currentMajor) {
    versionType = '主版本更新（破坏性变更）';
  } else if (newMinor !== undefined && currentMinor !== undefined && newMinor > currentMinor) {
    versionType = '次版本更新（新增功能）';
  } else {
    versionType = '修订版本更新（问题修复）';
  }

  return {
    isValid: true,
    message: `版本号有效：${versionType}`,
  };
}

