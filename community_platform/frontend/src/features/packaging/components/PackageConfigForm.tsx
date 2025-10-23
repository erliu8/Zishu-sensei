/**
 * PackageConfigForm Component
 * 打包配置表单组件
 */

'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/shared/components/ui/form';
import { Input } from '@/shared/components/ui/input';
import { Textarea } from '@/shared/components/ui/textarea';
import { Button } from '@/shared/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Switch } from '@/shared/components/ui/switch';
import { Slider } from '@/shared/components/ui/slider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Label } from '@/shared/components/ui/label';
import { Badge } from '@/shared/components/ui/badge';
import { PackagingPlatform, PackagingArchitecture, PackagingFormat } from '../domain/packaging.types';
import { PackageConfigDomain } from '../domain/PackageConfig';
import { Loader2, Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/components/ui/tooltip';

/**
 * 表单验证 Schema
 */
const configFormSchema = z.object({
  appName: z.string().min(1, '应用名称不能为空').max(100, '应用名称过长'),
  version: z.string().regex(/^(\d+)\.(\d+)\.(\d+)(?:-([a-zA-Z0-9.-]+))?$/, '版本号格式不正确'),
  description: z.string().max(500, '描述过长').optional(),
  icon: z.string().url('图标链接格式不正确').optional().or(z.literal('')),
  characterId: z.string().min(1, '必须选择一个角色'),
  adapterIds: z.array(z.string()),
  platform: z.nativeEnum(PackagingPlatform),
  architecture: z.nativeEnum(PackagingArchitecture),
  format: z.nativeEnum(PackagingFormat),
  includeAssets: z.boolean(),
  compress: z.boolean(),
  compressionLevel: z.number().min(0).max(9).optional(),
  obfuscate: z.boolean(),
});

type ConfigFormValues = z.infer<typeof configFormSchema>;

/**
 * PackageConfigForm Props
 */
export interface PackageConfigFormProps {
  /** 默认值 */
  defaultValues?: Partial<ConfigFormValues>;
  /** 提交回调 */
  onSubmit: (values: ConfigFormValues) => void;
  /** 是否正在提交 */
  isSubmitting?: boolean;
  /** 可用的角色列表 */
  characters?: Array<{ id: string; name: string; avatar?: string }>;
  /** 可用的适配器列表 */
  adapters?: Array<{ id: string; name: string; version: string }>;
}

/**
 * PackageConfigForm Component
 */
export const PackageConfigForm: React.FC<PackageConfigFormProps> = ({
  defaultValues,
  onSubmit,
  isSubmitting = false,
  characters = [],
  adapters = [],
}) => {
  const [selectedPlatform, setSelectedPlatform] = useState<PackagingPlatform>(
    defaultValues?.platform || PackagingPlatform.WINDOWS
  );

  const form = useForm<ConfigFormValues>({
    resolver: zodResolver(configFormSchema),
    defaultValues: {
      appName: '',
      version: '1.0.0',
      description: '',
      icon: '',
      characterId: '',
      adapterIds: [],
      platform: PackagingPlatform.WINDOWS,
      architecture: PackagingArchitecture.X64,
      format: PackagingFormat.ZIP,
      includeAssets: true,
      compress: true,
      compressionLevel: 6,
      obfuscate: false,
      ...defaultValues,
    },
  });

  const handlePlatformChange = (platform: PackagingPlatform) => {
    setSelectedPlatform(platform);
    form.setValue('platform', platform);

    // 自动选择该平台的第一个支持的架构和格式
    const supportedArchs = PackageConfigDomain.getSupportedArchitectures(platform);
    if (supportedArchs.length > 0) {
      form.setValue('architecture', supportedArchs[0]);
    }

    const supportedFormats = PackageConfigDomain.getSupportedFormats(platform);
    if (supportedFormats.length > 0) {
      form.setValue('format', supportedFormats[0]);
    }
  };

  const supportedArchitectures = PackageConfigDomain.getSupportedArchitectures(selectedPlatform);
  const supportedFormats = PackageConfigDomain.getSupportedFormats(selectedPlatform);

  const estimatedSize = PackageConfigDomain.estimateFileSize({
    ...form.getValues(),
  } as any);

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* 基本信息 */}
        <Card>
          <CardHeader>
            <CardTitle>基本信息</CardTitle>
            <CardDescription>配置应用的基本信息</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="appName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>应用名称 *</FormLabel>
                  <FormControl>
                    <Input placeholder="我的 AI 助手" {...field} />
                  </FormControl>
                  <FormDescription>显示给用户的应用名称</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="version"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>应用版本 *</FormLabel>
                  <FormControl>
                    <Input placeholder="1.0.0" {...field} />
                  </FormControl>
                  <FormDescription>遵循 Semver 版本号规范</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>应用描述</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="这是一个智能 AI 助手应用..."
                      className="min-h-[100px]"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>简要描述应用的功能和特点</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="icon"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>应用图标 URL</FormLabel>
                  <FormControl>
                    <Input placeholder="https://example.com/icon.png" {...field} />
                  </FormControl>
                  <FormDescription>应用图标的 URL 地址</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* 角色和适配器 */}
        <Card>
          <CardHeader>
            <CardTitle>角色与适配器</CardTitle>
            <CardDescription>选择要打包的角色和适配器</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="characterId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>角色 *</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="选择角色" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {characters.map((character) => (
                        <SelectItem key={character.id} value={character.id}>
                          {character.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>选择要打包到应用中的角色</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-2">
              <Label>适配器（可选）</Label>
              <div className="grid grid-cols-2 gap-2 max-h-[200px] overflow-y-auto border rounded-md p-3">
                {adapters.map((adapter) => (
                  <div key={adapter.id} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id={`adapter-${adapter.id}`}
                      value={adapter.id}
                      checked={form.watch('adapterIds').includes(adapter.id)}
                      onChange={(e) => {
                        const current = form.getValues('adapterIds');
                        if (e.target.checked) {
                          form.setValue('adapterIds', [...current, adapter.id]);
                        } else {
                          form.setValue('adapterIds', current.filter((id) => id !== adapter.id));
                        }
                      }}
                      className="rounded border-gray-300"
                    />
                    <label
                      htmlFor={`adapter-${adapter.id}`}
                      className="text-sm cursor-pointer flex-1"
                    >
                      {adapter.name}
                      <span className="text-xs text-muted-foreground ml-1">
                        v{adapter.version}
                      </span>
                    </label>
                  </div>
                ))}
              </div>
              <p className="text-sm text-muted-foreground">
                已选择 {form.watch('adapterIds').length} 个适配器
              </p>
            </div>
          </CardContent>
        </Card>

        {/* 平台配置 */}
        <Card>
          <CardHeader>
            <CardTitle>平台配置</CardTitle>
            <CardDescription>选择目标平台和打包格式</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="platform"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>目标平台 *</FormLabel>
                  <Select onValueChange={handlePlatformChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {Object.values(PackagingPlatform).map((platform) => (
                        <SelectItem key={platform} value={platform}>
                          {platform.toUpperCase()}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="architecture"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>CPU 架构 *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {supportedArchitectures.map((arch) => (
                        <SelectItem key={arch} value={arch}>
                          {arch.toUpperCase()}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="format"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>打包格式 *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {supportedFormats.map((format) => (
                        <SelectItem key={format} value={format}>
                          {format.toUpperCase()}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* 高级选项 */}
        <Card>
          <CardHeader>
            <CardTitle>高级选项</CardTitle>
            <CardDescription>配置压缩、混淆等高级选项</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="includeAssets"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">包含资源文件</FormLabel>
                    <FormDescription>
                      包含角色的图片、音频等资源文件
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="compress"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">启用压缩</FormLabel>
                    <FormDescription>
                      压缩打包文件以减小体积
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />

            {form.watch('compress') && (
              <FormField
                control={form.control}
                name="compressionLevel"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center justify-between">
                      <FormLabel>
                        压缩级别
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="inline h-4 w-4 ml-1 text-muted-foreground" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>0 = 无压缩，9 = 最大压缩</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </FormLabel>
                      <Badge variant="secondary">{field.value}</Badge>
                    </div>
                    <FormControl>
                      <Slider
                        min={0}
                        max={9}
                        step={1}
                        value={[field.value || 6]}
                        onValueChange={(vals) => field.onChange(vals[0])}
                      />
                    </FormControl>
                    <FormDescription>
                      级别越高，压缩越小但耗时越长
                    </FormDescription>
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="obfuscate"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">代码混淆</FormLabel>
                    <FormDescription>
                      混淆代码以提高安全性（会增加打包时间）
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* 预估信息 */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">预估文件大小：</span>
              <Badge variant="secondary">{estimatedSize} MB</Badge>
            </div>
          </CardContent>
        </Card>

        {/* 提交按钮 */}
        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" disabled={isSubmitting}>
            保存为模板
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            开始打包
          </Button>
        </div>
      </form>
    </Form>
  );
};

