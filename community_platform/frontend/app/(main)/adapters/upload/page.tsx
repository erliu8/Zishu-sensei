/**
 * 上传适配器页面
 * @route /adapters/upload
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useCreateAdapter } from '@/features/adapter/hooks';
import { useAdapterCategories } from '@/features/adapter/hooks/useAdapterCategories';
import { AdapterType, CapabilityLevel } from '@/features/adapter/domain';
import type { CreateAdapterInput, AdapterCapability } from '@/features/adapter/domain';
import {
  Button,
  Card,
  Input,
  Textarea,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Badge,
  Separator,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@/shared/components';
import { LoadingSpinner } from '@/shared/components/common';
import { 
  ArrowLeft,
  Upload,
  X,
  Plus,
  Code,
  Cpu,
  Sparkles,
  HelpCircle,
  Image as ImageIcon,
} from 'lucide-react';
import { useToast } from '@/shared/hooks/use-toast';
import { cn } from '@/shared/utils';

/**
 * 表单验证 Schema
 */
const adapterFormSchema = z.object({
  name: z.string().min(3, '名称至少3个字符').max(50, '名称最多50个字符'),
  displayName: z.string().min(2, '显示名称至少2个字符').max(100, '显示名称最多100个字符'),
  type: z.nativeEnum(AdapterType),
  description: z.string().min(10, '描述至少10个字符').max(500, '描述最多500个字符'),
  readme: z.string().optional(),
  categoryId: z.string().min(1, '请选择分类'),
  tags: z.array(z.string()).min(1, '至少添加1个标签').max(10, '最多10个标签'),
  license: z.string().min(1, '请选择许可证'),
  repositoryUrl: z.string().url('请输入有效的URL').optional().or(z.literal('')),
  documentationUrl: z.string().url('请输入有效的URL').optional().or(z.literal('')),
  homepageUrl: z.string().url('请输入有效的URL').optional().or(z.literal('')),
});

type AdapterFormData = z.infer<typeof adapterFormSchema>;

/**
 * 许可证选项
 */
const LICENSE_OPTIONS = [
  { value: 'MIT', label: 'MIT License' },
  { value: 'Apache-2.0', label: 'Apache License 2.0' },
  { value: 'GPL-3.0', label: 'GNU GPL v3.0' },
  { value: 'BSD-3-Clause', label: 'BSD 3-Clause' },
  { value: 'ISC', label: 'ISC License' },
  { value: 'MPL-2.0', label: 'Mozilla Public License 2.0' },
  { value: 'CC0-1.0', label: 'Creative Commons Zero v1.0' },
  { value: 'Unlicense', label: 'The Unlicense' },
  { value: 'Proprietary', label: 'Proprietary' },
];

/**
 * 上传适配器页面组件
 */
export default function UploadAdapterPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('basic');

  // 获取分类列表
  const { data: categories, isLoading: categoriesLoading } = useAdapterCategories();

  // 创建适配器 mutation
  const createAdapter = useCreateAdapter();

  // 表单状态
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<AdapterFormData>({
    resolver: zodResolver(adapterFormSchema),
    defaultValues: {
      type: AdapterType.SOFT,
      tags: [],
      license: 'MIT',
    },
  });

  // 额外的状态
  const [tagInput, setTagInput] = useState('');
  const [capabilities, setCapabilities] = useState<AdapterCapability[]>([]);
  const [icon, setIcon] = useState<File | null>(null);
  const [coverImage, setCoverImage] = useState<File | null>(null);
  const [screenshots, setScreenshots] = useState<File[]>([]);
  const [systemRequirements, setSystemRequirements] = useState({
    minMemory: '',
    minDiskSpace: '',
    pythonVersion: '',
    nodeVersion: '',
    gpuRequired: false,
  });
  const [permissions, setPermissions] = useState({
    fileSystemAccess: 'read' as const,
    networkAccess: false,
    systemApiAccess: false,
    desktopControl: false,
    codeExecution: false,
  });

  // 监听表单值
  const selectedType = watch('type');
  const tags = watch('tags');

  // 添加标签
  const handleAddTag = () => {
    const trimmedTag = tagInput.trim();
    if (!trimmedTag) return;
    
    const currentTags = tags || [];
    if (currentTags.includes(trimmedTag)) {
      toast.error('标签已存在');
      return;
    }
    
    if (currentTags.length >= 10) {
      toast.error('最多添加10个标签');
      return;
    }
    
    setValue('tags', [...currentTags, trimmedTag]);
    setTagInput('');
  };

  // 删除标签
  const handleRemoveTag = (tagToRemove: string) => {
    const currentTags = tags || [];
    setValue('tags', currentTags.filter(tag => tag !== tagToRemove));
  };

  // 添加能力
  const handleAddCapability = () => {
    setCapabilities([
      ...capabilities,
      {
        name: '新能力',
        description: '请描述此能力',
        level: CapabilityLevel.BASIC,
        inputs: ['text'],
        outputs: ['text'],
      },
    ]);
  };

  // 更新能力
  const handleUpdateCapability = (index: number, field: keyof AdapterCapability, value: any) => {
    const updated = [...capabilities];
    updated[index] = { ...updated[index], [field]: value };
    setCapabilities(updated);
  };

  // 删除能力
  const handleRemoveCapability = (index: number) => {
    setCapabilities(capabilities.filter((_, i) => i !== index));
  };

  // 处理文件上传
  const handleFileChange = (type: 'icon' | 'cover' | 'screenshots', files: FileList | null) => {
    if (!files || files.length === 0) return;

    if (type === 'icon') {
      setIcon(files[0] || null);
    } else if (type === 'cover') {
      setCoverImage(files[0] || null);
    } else if (type === 'screenshots') {
      setScreenshots(Array.from(files));
    }
  };

  // 提交表单
  const onSubmit = async (data: AdapterFormData) => {
    try {
      // 验证能力列表
      if (capabilities.length === 0) {
        toast.error('请至少添加一个能力');
        setActiveTab('capabilities');
        return;
      }

      // 构建创建输入
      const input: CreateAdapterInput = {
        ...data,
        capabilities,
        systemRequirements: {
          minMemory: systemRequirements.minMemory ? parseInt(systemRequirements.minMemory) : undefined,
          minDiskSpace: systemRequirements.minDiskSpace ? parseInt(systemRequirements.minDiskSpace) : undefined,
          pythonVersion: systemRequirements.pythonVersion || undefined,
          nodeVersion: systemRequirements.nodeVersion || undefined,
          gpuRequired: systemRequirements.gpuRequired,
        },
        permissions,
        // TODO: 处理文件上传
        // icon: icon ? await uploadFile(icon) : undefined,
        // coverImage: coverImage ? await uploadFile(coverImage) : undefined,
        // screenshots: screenshots.length > 0 ? await uploadFiles(screenshots) : undefined,
      };

      const result = await createAdapter.mutateAsync(input);
      
      toast.success('适配器创建成功！');
      router.push(`/adapters/${result.id}`);
    } catch (error: any) {
      toast.error(error.message || '创建失败，请重试');
    }
  };

  // 返回
  const handleBack = () => {
    if (confirm('确定要离开吗？未保存的内容将丢失。')) {
      router.back();
    }
  };

  // 获取适配器类型说明
  const getTypeDescription = (type: AdapterType) => {
    switch (type) {
      case AdapterType.SOFT:
        return {
          icon: <Code className="h-5 w-5" />,
          title: '软适配器',
          description: '基于提示词工程和RAG技术，适用于知识问答、内容生成等场景。',
        };
      case AdapterType.HARD:
        return {
          icon: <Cpu className="h-5 w-5" />,
          title: '硬适配器',
          description: '基于原生代码实现，适用于桌面操作、文件处理、系统集成等场景。',
        };
      case AdapterType.INTELLIGENT:
        return {
          icon: <Sparkles className="h-5 w-5" />,
          title: '智能硬适配器',
          description: '基于专业微调模型，适用于数据分析、办公自动化、代码生成等场景。',
        };
    }
  };

  const typeInfo = getTypeDescription(selectedType);

  if (categoriesLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[60vh]">
          <LoadingSpinner size="lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* 顶部导航 */}
      <Button variant="ghost" onClick={handleBack} className="mb-6">
        <ArrowLeft className="mr-2 h-4 w-4" />
        返回
      </Button>

      {/* 页面头部 */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">上传适配器</h1>
        <p className="text-muted-foreground">
          创建并发布你的适配器到社区
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="basic">基本信息</TabsTrigger>
            <TabsTrigger value="capabilities">能力配置</TabsTrigger>
            <TabsTrigger value="requirements">系统要求</TabsTrigger>
            <TabsTrigger value="media">媒体资源</TabsTrigger>
          </TabsList>

          {/* 基本信息 */}
          <TabsContent value="basic" className="space-y-6">
            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4">基本信息</h2>

              {/* 适配器类型 */}
              <div className="mb-6">
                <Label htmlFor="type">适配器类型 *</Label>
                <div className="grid grid-cols-3 gap-4 mt-2">
                  {Object.values(AdapterType).map((type) => {
                    const info = getTypeDescription(type);
                    return (
                      <label
                        key={type}
                        className={cn(
                          'flex flex-col items-center gap-2 p-4 border rounded-lg cursor-pointer transition-all',
                          selectedType === type
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-primary/50'
                        )}
                      >
                        <input
                          type="radio"
                          value={type}
                          {...register('type')}
                          className="sr-only"
                        />
                        {info.icon}
                        <span className="font-medium text-sm">{info.title}</span>
                      </label>
                    );
                  })}
                </div>
                <p className="text-sm text-muted-foreground mt-2 p-3 bg-muted/50 rounded-lg">
                  <HelpCircle className="inline h-4 w-4 mr-1" />
                  {typeInfo.description}
                </p>
              </div>

              <Separator className="my-6" />

              {/* 名称 */}
              <div className="mb-4">
                <Label htmlFor="name">适配器名称 *</Label>
                <Input
                  id="name"
                  placeholder="adapter-name（小写字母和连字符）"
                  {...register('name')}
                  className="mt-2"
                />
                {errors.name && (
                  <p className="text-sm text-destructive mt-1">{errors.name.message}</p>
                )}
              </div>

              {/* 显示名称 */}
              <div className="mb-4">
                <Label htmlFor="displayName">显示名称 *</Label>
                <Input
                  id="displayName"
                  placeholder="适配器的友好显示名称"
                  {...register('displayName')}
                  className="mt-2"
                />
                {errors.displayName && (
                  <p className="text-sm text-destructive mt-1">{errors.displayName.message}</p>
                )}
              </div>

              {/* 描述 */}
              <div className="mb-4">
                <Label htmlFor="description">简短描述 *</Label>
                <Textarea
                  id="description"
                  placeholder="简要介绍适配器的功能和用途"
                  rows={3}
                  {...register('description')}
                  className="mt-2"
                />
                {errors.description && (
                  <p className="text-sm text-destructive mt-1">{errors.description.message}</p>
                )}
              </div>

              {/* 详细说明 */}
              <div className="mb-4">
                <Label htmlFor="readme">详细说明（支持 Markdown）</Label>
                <Textarea
                  id="readme"
                  placeholder="详细的使用文档、示例等（可选）"
                  rows={10}
                  {...register('readme')}
                  className="mt-2 font-mono"
                />
              </div>

              {/* 分类 */}
              <div className="mb-4">
                <Label htmlFor="categoryId">分类 *</Label>
                <Select onValueChange={(value) => setValue('categoryId', value)}>
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="选择分类" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories?.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.categoryId && (
                  <p className="text-sm text-destructive mt-1">{errors.categoryId.message}</p>
                )}
              </div>

              {/* 标签 */}
              <div className="mb-4">
                <Label>标签 *</Label>
                <div className="flex gap-2 mt-2">
                  <Input
                    placeholder="输入标签后按回车"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddTag();
                      }
                    }}
                  />
                  <Button type="button" onClick={handleAddTag}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                {tags && tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {tags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="gap-1">
                        {tag}
                        <X
                          className="h-3 w-3 cursor-pointer"
                          onClick={() => handleRemoveTag(tag)}
                        />
                      </Badge>
                    ))}
                  </div>
                )}
                {errors.tags && (
                  <p className="text-sm text-destructive mt-1">{errors.tags.message}</p>
                )}
              </div>

              {/* 许可证 */}
              <div className="mb-4">
                <Label htmlFor="license">许可证 *</Label>
                <Select
                  defaultValue="MIT"
                  onValueChange={(value) => setValue('license', value)}
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LICENSE_OPTIONS.map((license) => (
                      <SelectItem key={license.value} value={license.value}>
                        {license.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* 外部链接 */}
              <Separator className="my-6" />
              <h3 className="text-lg font-semibold mb-4">相关链接（可选）</h3>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="repositoryUrl">源代码仓库</Label>
                  <Input
                    id="repositoryUrl"
                    type="url"
                    placeholder="https://github.com/..."
                    {...register('repositoryUrl')}
                    className="mt-2"
                  />
                  {errors.repositoryUrl && (
                    <p className="text-sm text-destructive mt-1">{errors.repositoryUrl.message}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="documentationUrl">使用文档</Label>
                  <Input
                    id="documentationUrl"
                    type="url"
                    placeholder="https://..."
                    {...register('documentationUrl')}
                    className="mt-2"
                  />
                  {errors.documentationUrl && (
                    <p className="text-sm text-destructive mt-1">{errors.documentationUrl.message}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="homepageUrl">项目主页</Label>
                  <Input
                    id="homepageUrl"
                    type="url"
                    placeholder="https://..."
                    {...register('homepageUrl')}
                    className="mt-2"
                  />
                  {errors.homepageUrl && (
                    <p className="text-sm text-destructive mt-1">{errors.homepageUrl.message}</p>
                  )}
                </div>
              </div>
            </Card>
          </TabsContent>

          {/* 能力配置 */}
          <TabsContent value="capabilities" className="space-y-6">
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">适配器能力</h2>
                <Button type="button" onClick={handleAddCapability}>
                  <Plus className="mr-2 h-4 w-4" />
                  添加能力
                </Button>
              </div>

              {capabilities.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <p>还没有添加能力</p>
                  <p className="text-sm mt-2">点击上方按钮添加适配器的能力说明</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {capabilities.map((capability, index) => (
                    <Card key={index} className="p-4">
                      <div className="flex items-start justify-between mb-4">
                        <h3 className="font-semibold">能力 #{index + 1}</h3>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveCapability(index)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>

                      <div className="space-y-3">
                        <div>
                          <Label>能力名称</Label>
                          <Input
                            value={capability.name}
                            onChange={(e) => handleUpdateCapability(index, 'name', e.target.value)}
                            placeholder="如：文本生成、数据分析等"
                            className="mt-1"
                          />
                        </div>

                        <div>
                          <Label>能力描述</Label>
                          <Textarea
                            value={capability.description}
                            onChange={(e) => handleUpdateCapability(index, 'description', e.target.value)}
                            placeholder="详细描述这个能力"
                            rows={2}
                            className="mt-1"
                          />
                        </div>

                        <div>
                          <Label>能力等级</Label>
                          <Select
                            value={capability.level}
                            onValueChange={(value) => handleUpdateCapability(index, 'level', value as CapabilityLevel)}
                          >
                            <SelectTrigger className="mt-1">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value={CapabilityLevel.BASIC}>基础</SelectItem>
                              <SelectItem value={CapabilityLevel.INTERMEDIATE}>中级</SelectItem>
                              <SelectItem value={CapabilityLevel.ADVANCED}>高级</SelectItem>
                              <SelectItem value={CapabilityLevel.EXPERT}>专家级</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </Card>
          </TabsContent>

          {/* 系统要求和权限 */}
          <TabsContent value="requirements" className="space-y-6">
            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4">系统要求</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="minMemory">最小内存 (MB)</Label>
                  <Input
                    id="minMemory"
                    type="number"
                    value={systemRequirements.minMemory}
                    onChange={(e) => setSystemRequirements({ ...systemRequirements, minMemory: e.target.value || '' })}
                    placeholder="256"
                    className="mt-2"
                  />
                </div>

                <div>
                  <Label htmlFor="minDiskSpace">最小磁盘空间 (MB)</Label>
                  <Input
                    id="minDiskSpace"
                    type="number"
                    value={systemRequirements.minDiskSpace}
                    onChange={(e) => setSystemRequirements({ ...systemRequirements, minDiskSpace: e.target.value || '' })}
                    placeholder="100"
                    className="mt-2"
                  />
                </div>

                <div>
                  <Label htmlFor="pythonVersion">Python 版本</Label>
                  <Input
                    id="pythonVersion"
                    value={systemRequirements.pythonVersion}
                    onChange={(e) => setSystemRequirements({ ...systemRequirements, pythonVersion: e.target.value })}
                    placeholder=">=3.8"
                    className="mt-2"
                  />
                </div>

                <div>
                  <Label htmlFor="nodeVersion">Node.js 版本</Label>
                  <Input
                    id="nodeVersion"
                    value={systemRequirements.nodeVersion}
                    onChange={(e) => setSystemRequirements({ ...systemRequirements, nodeVersion: e.target.value })}
                    placeholder=">=14.0.0"
                    className="mt-2"
                  />
                </div>
              </div>

              <div className="mt-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={systemRequirements.gpuRequired}
                    onChange={(e) => setSystemRequirements({ ...systemRequirements, gpuRequired: e.target.checked })}
                    className="rounded"
                  />
                  <span>需要 GPU</span>
                </label>
              </div>
            </Card>

            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4">权限需求</h2>
              <div className="space-y-3">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={permissions.networkAccess}
                    onChange={(e) => setPermissions({ ...permissions, networkAccess: e.target.checked })}
                    className="rounded"
                  />
                  <span>网络访问</span>
                </label>

                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={permissions.systemApiAccess}
                    onChange={(e) => setPermissions({ ...permissions, systemApiAccess: e.target.checked })}
                    className="rounded"
                  />
                  <span>系统 API 访问</span>
                </label>

                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={permissions.desktopControl}
                    onChange={(e) => setPermissions({ ...permissions, desktopControl: e.target.checked })}
                    className="rounded"
                  />
                  <span>桌面操作权限</span>
                </label>

                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={permissions.codeExecution}
                    onChange={(e) => setPermissions({ ...permissions, codeExecution: e.target.checked })}
                    className="rounded"
                  />
                  <span>代码执行权限</span>
                </label>

                <div>
                  <Label htmlFor="fileSystemAccess">文件系统访问</Label>
                  <Select
                    value={permissions.fileSystemAccess}
                    onValueChange={(value: any) => setPermissions({ ...permissions, fileSystemAccess: value })}
                  >
                    <SelectTrigger className="mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">无</SelectItem>
                      <SelectItem value="read">只读</SelectItem>
                      <SelectItem value="write">读写</SelectItem>
                      <SelectItem value="full">完全访问</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </Card>
          </TabsContent>

          {/* 媒体资源 */}
          <TabsContent value="media" className="space-y-6">
            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4">媒体资源</h2>
              
              <div className="space-y-6">
                {/* 图标 */}
                <div>
                  <Label>适配器图标</Label>
                  <div className="mt-2 flex items-center gap-4">
                    {icon ? (
                      <div className="relative">
                        <img
                          src={URL.createObjectURL(icon)}
                          alt="Icon preview"
                          className="h-20 w-20 rounded-lg object-cover"
                        />
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          className="absolute -top-2 -right-2"
                          onClick={() => setIcon(null)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center h-20 w-20 border-2 border-dashed rounded-lg cursor-pointer hover:border-primary">
                        <ImageIcon className="h-6 w-6 text-muted-foreground" />
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleFileChange('icon', e.target.files)}
                          className="sr-only"
                        />
                      </label>
                    )}
                    <p className="text-sm text-muted-foreground">
                      推荐尺寸：256x256px
                    </p>
                  </div>
                </div>

                {/* 封面图 */}
                <div>
                  <Label>封面图片</Label>
                  <div className="mt-2">
                    {coverImage ? (
                      <div className="relative inline-block">
                        <img
                          src={URL.createObjectURL(coverImage)}
                          alt="Cover preview"
                          className="h-32 w-auto rounded-lg object-cover"
                        />
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          className="absolute -top-2 -right-2"
                          onClick={() => setCoverImage(null)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center h-32 w-full border-2 border-dashed rounded-lg cursor-pointer hover:border-primary">
                        <ImageIcon className="h-8 w-8 text-muted-foreground mb-2" />
                        <span className="text-sm text-muted-foreground">点击上传封面图</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleFileChange('cover', e.target.files)}
                          className="sr-only"
                        />
                      </label>
                    )}
                  </div>
                </div>

                {/* 截图 */}
                <div>
                  <Label>截图（最多6张）</Label>
                  <div className="mt-2">
                    <label className="flex flex-col items-center justify-center h-32 w-full border-2 border-dashed rounded-lg cursor-pointer hover:border-primary">
                      <ImageIcon className="h-8 w-8 text-muted-foreground mb-2" />
                      <span className="text-sm text-muted-foreground">点击上传截图</span>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={(e) => handleFileChange('screenshots', e.target.files)}
                        className="sr-only"
                      />
                    </label>
                    {screenshots.length > 0 && (
                      <div className="grid grid-cols-3 gap-4 mt-4">
                        {screenshots.map((file, index) => (
                          <div key={index} className="relative">
                            <img
                              src={URL.createObjectURL(file)}
                              alt={`Screenshot ${index + 1}`}
                              className="h-24 w-full rounded-lg object-cover"
                            />
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              className="absolute -top-2 -right-2"
                              onClick={() => setScreenshots(screenshots.filter((_, i) => i !== index))}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          </TabsContent>
        </Tabs>

        {/* 底部操作按钮 */}
        <div className="flex items-center justify-between mt-8 p-6 bg-muted/50 rounded-lg">
          <Button type="button" variant="outline" onClick={handleBack}>
            取消
          </Button>

          <div className="flex items-center gap-4">
            {activeTab !== 'basic' && (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  const tabs = ['basic', 'capabilities', 'requirements', 'media'];
                  const currentIndex = tabs.indexOf(activeTab);
                  if (currentIndex > 0) {
                    setActiveTab(tabs[currentIndex - 1]);
                  }
                }}
              >
                上一步
              </Button>
            )}

            {activeTab !== 'media' ? (
              <Button
                type="button"
                onClick={() => {
                  const tabs = ['basic', 'capabilities', 'requirements', 'media'];
                  const currentIndex = tabs.indexOf(activeTab);
                  if (currentIndex < tabs.length - 1) {
                    setActiveTab(tabs[currentIndex + 1]);
                  }
                }}
              >
                下一步
              </Button>
            ) : (
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <LoadingSpinner className="mr-2 h-4 w-4" />
                    创建中...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    创建适配器
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}

