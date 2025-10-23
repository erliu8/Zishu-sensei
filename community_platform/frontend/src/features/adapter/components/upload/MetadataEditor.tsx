/**
 * 适配器元数据编辑器
 * 支持所有三种适配器类型的元数据配置
 */

'use client';

import React from 'react';
import { useFieldArray, useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Plus, Trash2, Info } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Textarea } from '@/shared/components/ui/textarea';
import { Label } from '@/shared/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { Checkbox } from '@/shared/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { Separator } from '@/shared/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/components/ui/tooltip';
import {
  AdapterType,
  AdapterCategory,
  CapabilityLevel,
  CompatibilityPlatform,
  type AdapterMetadata,
} from '../../api/types';
import { cn } from '@/shared/utils/cn';

// 验证schema
const capabilitySchema = z.object({
  name: z.string().min(1, '能力名称不能为空'),
  description: z.string().min(1, '能力描述不能为空'),
  level: z.nativeEnum(CapabilityLevel),
  inputs: z.array(z.string()).min(1, '至少需要一个输入类型'),
  outputs: z.array(z.string()).min(1, '至少需要一个输出类型'),
});

const metadataSchema = z.object({
  name: z.string().min(1, '适配器名称不能为空').max(100, '名称最多100个字符'),
  description: z.string().min(10, '描述至少10个字符').max(500, '描述最多500个字符'),
  longDescription: z.string().optional(),
  adapterType: z.nativeEnum(AdapterType),
  category: z.nativeEnum(AdapterCategory),
  tags: z.array(z.string()).min(1, '至少需要一个标签').max(10, '最多10个标签'),
  capabilities: z.array(capabilitySchema).min(1, '至少需要声明一个能力'),
  compatibility: z.array(z.nativeEnum(CompatibilityPlatform)).min(1, '至少选择一个兼容平台'),
  systemRequirements: z.object({
    minMemory: z.number().optional(),
    minDiskSpace: z.number().optional(),
    pythonVersion: z.string().optional(),
    nodeVersion: z.string().optional(),
    otherDependencies: z.array(z.string()).optional(),
  }),
  permissions: z.object({
    fileSystemAccess: z.enum(['none', 'read_only', 'read_write']),
    networkAccess: z.boolean(),
    desktopControl: z.boolean(),
    systemApiAccess: z.boolean(),
    codeExecution: z.boolean(),
  }),
  dependencies: z.array(z.object({
    adapterId: z.string(),
    name: z.string(),
    versionRequirement: z.string(),
    optional: z.boolean(),
  })),
  examples: z.array(z.string()).optional(),
  documentationUrl: z.string().url().optional().or(z.literal('')),
  repositoryUrl: z.string().url().optional().or(z.literal('')),
});

export type MetadataFormData = z.infer<typeof metadataSchema>;

export interface MetadataEditorProps {
  /** 初始值 */
  initialData?: Partial<AdapterMetadata>;
  /** 提交回调 */
  onSubmit: (data: AdapterMetadata) => void;
  /** 是否禁用 */
  disabled?: boolean;
  /** 类名 */
  className?: string;
}

export function MetadataEditor({
  initialData,
  onSubmit,
  disabled = false,
  className,
}: MetadataEditorProps) {
  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<MetadataFormData>({
    resolver: zodResolver(metadataSchema),
    defaultValues: {
      name: initialData?.name || '',
      description: initialData?.description || '',
      longDescription: initialData?.longDescription || '',
      adapterType: initialData?.adapterType || AdapterType.SOFT,
      category: initialData?.category || AdapterCategory.OTHER,
      tags: initialData?.tags || [],
      capabilities: initialData?.capabilities || [],
      compatibility: initialData?.compatibility || [],
      systemRequirements: {
        minMemory: initialData?.systemRequirements?.minMemory,
        minDiskSpace: initialData?.systemRequirements?.minDiskSpace,
        pythonVersion: initialData?.systemRequirements?.pythonVersion || '',
        nodeVersion: initialData?.systemRequirements?.nodeVersion || '',
        otherDependencies: initialData?.systemRequirements?.otherDependencies || [],
      },
      permissions: {
        fileSystemAccess: initialData?.permissions?.fileSystemAccess || 'none',
        networkAccess: initialData?.permissions?.networkAccess || false,
        desktopControl: initialData?.permissions?.desktopControl || false,
        systemApiAccess: initialData?.permissions?.systemApiAccess || false,
        codeExecution: initialData?.permissions?.codeExecution || false,
      },
      dependencies: initialData?.dependencies || [],
      examples: initialData?.examples || [],
      documentationUrl: initialData?.documentationUrl || '',
      repositoryUrl: initialData?.repositoryUrl || '',
    },
  });

  const { fields: capabilityFields, append: appendCapability, remove: removeCapability } = useFieldArray({
    control,
    name: 'capabilities',
  });

  const adapterType = watch('adapterType');

  const handleFormSubmit = (data: MetadataFormData) => {
    onSubmit(data as AdapterMetadata);
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className={cn('space-y-6', className)}>
      {/* 基本信息 */}
      <Card>
        <CardHeader>
          <CardTitle>基本信息</CardTitle>
          <CardDescription>填写适配器的基本信息</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">适配器名称 *</Label>
            <Input
              id="name"
              {...register('name')}
              placeholder="例如：Excel数据分析专家"
              disabled={disabled}
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">简短描述 *</Label>
            <Textarea
              id="description"
              {...register('description')}
              placeholder="用一两句话描述这个适配器的主要功能"
              rows={3}
              disabled={disabled}
            />
            {errors.description && (
              <p className="text-sm text-destructive">{errors.description.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="longDescription">详细说明</Label>
            <Textarea
              id="longDescription"
              {...register('longDescription')}
              placeholder="详细介绍适配器的功能、使用场景、注意事项等"
              rows={6}
              disabled={disabled}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="adapterType">适配器类型 *</Label>
              <Controller
                control={control}
                name="adapterType"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange} disabled={disabled}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={AdapterType.SOFT}>
                        软适配器 (提示词 + RAG)
                      </SelectItem>
                      <SelectItem value={AdapterType.HARD}>
                        硬适配器 (原生代码)
                      </SelectItem>
                      <SelectItem value={AdapterType.INTELLIGENT}>
                        智能硬适配器 (微调模型)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
              <AdapterTypeInfo type={adapterType} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">分类 *</Label>
              <Controller
                control={control}
                name="category"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange} disabled={disabled}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={AdapterCategory.DATA_ANALYSIS}>数据分析</SelectItem>
                      <SelectItem value={AdapterCategory.OFFICE_AUTOMATION}>办公自动化</SelectItem>
                      <SelectItem value={AdapterCategory.DESKTOP_CONTROL}>桌面操作</SelectItem>
                      <SelectItem value={AdapterCategory.FILE_PROCESSING}>文件处理</SelectItem>
                      <SelectItem value={AdapterCategory.KNOWLEDGE_QA}>知识问答</SelectItem>
                      <SelectItem value={AdapterCategory.CONTENT_GENERATION}>内容生成</SelectItem>
                      <SelectItem value={AdapterCategory.SYSTEM_INTEGRATION}>系统集成</SelectItem>
                      <SelectItem value={AdapterCategory.CREATIVE_DESIGN}>创意设计</SelectItem>
                      <SelectItem value={AdapterCategory.CODE_GENERATION}>代码生成</SelectItem>
                      <SelectItem value={AdapterCategory.OTHER}>其他</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          <TagInput
            control={control}
            name="tags"
            label="标签 *"
            placeholder="输入标签后按回车"
            disabled={disabled}
            error={errors.tags?.message}
          />
        </CardContent>
      </Card>

      {/* 能力声明 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>能力声明</CardTitle>
              <CardDescription>声明适配器提供的能力</CardDescription>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                appendCapability({
                  name: '',
                  description: '',
                  level: CapabilityLevel.BASIC,
                  inputs: [],
                  outputs: [],
                })
              }
              disabled={disabled}
            >
              <Plus className="mr-2 h-4 w-4" />
              添加能力
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {capabilityFields.map((field, index) => (
            <div key={field.id} className="rounded-lg border p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-medium">能力 #{index + 1}</h4>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => removeCapability(index)}
                  disabled={disabled}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>能力名称</Label>
                  <Input
                    {...register(`capabilities.${index}.name`)}
                    placeholder="例如：Excel数据读取"
                    disabled={disabled}
                  />
                </div>

                <div className="space-y-2">
                  <Label>能力等级</Label>
                  <Controller
                    control={control}
                    name={`capabilities.${index}.level`}
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange} disabled={disabled}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={CapabilityLevel.BASIC}>基础</SelectItem>
                          <SelectItem value={CapabilityLevel.INTERMEDIATE}>中级</SelectItem>
                          <SelectItem value={CapabilityLevel.ADVANCED}>高级</SelectItem>
                          <SelectItem value={CapabilityLevel.EXPERT}>专家</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>能力描述</Label>
                <Textarea
                  {...register(`capabilities.${index}.description`)}
                  placeholder="描述这个能力的具体功能"
                  rows={2}
                  disabled={disabled}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <TagInput
                  control={control}
                  name={`capabilities.${index}.inputs`}
                  label="输入类型"
                  placeholder="输入类型后按回车"
                  disabled={disabled}
                />

                <TagInput
                  control={control}
                  name={`capabilities.${index}.outputs`}
                  label="输出类型"
                  placeholder="输出类型后按回车"
                  disabled={disabled}
                />
              </div>
            </div>
          ))}

          {capabilityFields.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              暂无能力声明，请点击"添加能力"按钮
            </div>
          )}

          {errors.capabilities && (
            <p className="text-sm text-destructive">{errors.capabilities.message}</p>
          )}
        </CardContent>
      </Card>

      {/* 兼容性与系统要求 */}
      <Card>
        <CardHeader>
          <CardTitle>兼容性与系统要求</CardTitle>
          <CardDescription>指定适配器的运行环境要求</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>兼容平台 *</Label>
            <div className="flex flex-wrap gap-4">
              <Controller
                control={control}
                name="compatibility"
                render={({ field }) => (
                  <>
                    {Object.values(CompatibilityPlatform).map((platform) => (
                      <div key={platform} className="flex items-center space-x-2">
                        <Checkbox
                          id={`platform-${platform}`}
                          checked={field.value.includes(platform)}
                          onCheckedChange={(checked) => {
                            const newValue = checked
                              ? [...field.value, platform]
                              : field.value.filter((p) => p !== platform);
                            field.onChange(newValue);
                          }}
                          disabled={disabled}
                        />
                        <Label htmlFor={`platform-${platform}`} className="cursor-pointer">
                          {platform.toUpperCase()}
                        </Label>
                      </div>
                    ))}
                  </>
                )}
              />
            </div>
            {errors.compatibility && (
              <p className="text-sm text-destructive">{errors.compatibility.message}</p>
            )}
          </div>

          <Separator />

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="minMemory">最低内存 (MB)</Label>
              <Input
                id="minMemory"
                type="number"
                {...register('systemRequirements.minMemory', { valueAsNumber: true })}
                placeholder="512"
                disabled={disabled}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="minDiskSpace">最低磁盘空间 (MB)</Label>
              <Input
                id="minDiskSpace"
                type="number"
                {...register('systemRequirements.minDiskSpace', { valueAsNumber: true })}
                placeholder="100"
                disabled={disabled}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="pythonVersion">Python 版本</Label>
              <Input
                id="pythonVersion"
                {...register('systemRequirements.pythonVersion')}
                placeholder=">=3.8"
                disabled={disabled}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="nodeVersion">Node.js 版本</Label>
              <Input
                id="nodeVersion"
                {...register('systemRequirements.nodeVersion')}
                placeholder=">=16.0.0"
                disabled={disabled}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 权限需求 */}
      <Card>
        <CardHeader>
          <CardTitle>权限需求</CardTitle>
          <CardDescription>声明适配器需要的系统权限</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>文件系统访问 *</Label>
            <Controller
              control={control}
              name="permissions.fileSystemAccess"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange} disabled={disabled}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">无需访问</SelectItem>
                    <SelectItem value="read_only">只读</SelectItem>
                    <SelectItem value="read_write">读写</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="space-y-4">
            <PermissionCheckbox
              control={control}
              name="permissions.networkAccess"
              label="网络访问"
              description="需要访问互联网"
              disabled={disabled}
            />

            <PermissionCheckbox
              control={control}
              name="permissions.desktopControl"
              label="桌面控制"
              description="需要控制鼠标、键盘等"
              disabled={disabled}
            />

            <PermissionCheckbox
              control={control}
              name="permissions.systemApiAccess"
              label="系统API访问"
              description="需要调用系统级API"
              disabled={disabled}
            />

            <PermissionCheckbox
              control={control}
              name="permissions.codeExecution"
              label="代码执行"
              description="需要动态执行代码"
              disabled={disabled}
            />
          </div>
        </CardContent>
      </Card>

      {/* 附加信息 */}
      <Card>
        <CardHeader>
          <CardTitle>附加信息</CardTitle>
          <CardDescription>提供文档和仓库链接</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="documentationUrl">文档链接</Label>
            <Input
              id="documentationUrl"
              type="url"
              {...register('documentationUrl')}
              placeholder="https://docs.example.com"
              disabled={disabled}
            />
            {errors.documentationUrl && (
              <p className="text-sm text-destructive">{errors.documentationUrl.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="repositoryUrl">仓库链接</Label>
            <Input
              id="repositoryUrl"
              type="url"
              {...register('repositoryUrl')}
              placeholder="https://github.com/username/repo"
              disabled={disabled}
            />
            {errors.repositoryUrl && (
              <p className="text-sm text-destructive">{errors.repositoryUrl.message}</p>
            )}
          </div>
        </CardContent>
      </Card>
    </form>
  );
}

// 辅助组件

interface TagInputProps {
  control: any;
  name: string;
  label: string;
  placeholder: string;
  disabled?: boolean;
  error?: string;
}

function TagInput({ control, name, label, placeholder, disabled, error }: TagInputProps) {
  const [inputValue, setInputValue] = React.useState('');

  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <div className="space-y-2">
          <Label>{label}</Label>
          <div className="flex gap-2">
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  const trimmed = inputValue.trim();
                  if (trimmed && !field.value.includes(trimmed)) {
                    field.onChange([...field.value, trimmed]);
                    setInputValue('');
                  }
                }
              }}
              placeholder={placeholder}
              disabled={disabled}
            />
          </div>
          {field.value.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {field.value.map((tag: string, index: number) => (
                <Badge key={index} variant="secondary">
                  {tag}
                  <button
                    type="button"
                    className="ml-1 hover:text-destructive"
                    onClick={() => {
                      field.onChange(field.value.filter((_: string, i: number) => i !== index));
                    }}
                    disabled={disabled}
                  >
                    ×
                  </button>
                </Badge>
              ))}
            </div>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
      )}
    />
  );
}

interface PermissionCheckboxProps {
  control: any;
  name: string;
  label: string;
  description: string;
  disabled?: boolean;
}

function PermissionCheckbox({ control, name, label, description, disabled }: PermissionCheckboxProps) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <div className="flex items-start space-x-3 rounded-lg border p-4">
          <Checkbox
            id={name}
            checked={field.value}
            onCheckedChange={field.onChange}
            disabled={disabled}
          />
          <div className="flex-1">
            <Label htmlFor={name} className="cursor-pointer font-medium">
              {label}
            </Label>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
        </div>
      )}
    />
  );
}

function AdapterTypeInfo({ type }: { type: AdapterType }) {
  const info = {
    [AdapterType.SOFT]: {
      title: '软适配器',
      description: '基于提示词工程和RAG技术，适用于知识问答、内容生成等场景',
      color: 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
    },
    [AdapterType.HARD]: {
      title: '硬适配器',
      description: '基于原生代码实现，适用于桌面操作、文件处理等场景',
      color: 'bg-green-500/10 text-green-700 dark:text-green-400',
    },
    [AdapterType.INTELLIGENT]: {
      title: '智能硬适配器',
      description: '基于专业微调模型，适用于数据分析、办公自动化等专业场景',
      color: 'bg-purple-500/10 text-purple-700 dark:text-purple-400',
    },
  };

  const current = info[type];

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn('flex items-center gap-2 rounded-md p-2 text-xs', current.color)}>
            <Info className="h-3 w-3" />
            <span>{current.title}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p className="max-w-xs">{current.description}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

