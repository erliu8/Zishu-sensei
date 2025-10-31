/**
 * CharacterCreator - 角色创建向导组件
 * 分步骤引导用户创建角色
 */

import React, { useState } from 'react';
import { cn } from '@/shared/utils';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Textarea } from '@/shared/components/ui/textarea';
import { Label } from '@/shared/components/ui/label';
import { Badge } from '@/shared/components/ui/badge';
import { Progress } from '@/shared/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { useToast } from '@/shared/hooks/use-toast';
import type { CreateCharacterInput } from '../domain';
import { CharacterVisibility } from '../types';
import {
  ChevronLeft,
  ChevronRight,
  Check,
  Upload,
  X,
  Sparkles,
  Info,
  Save,
  AlertCircle,
} from 'lucide-react';
import type { Character } from '../domain';
import { 
  ModelConfigType,
  ThirdPartyModelProvider,
  type CharacterFullConfig, 
  type CharacterModelConfig,
  type LoraAdapterConfig,
  type PromptEngineeringConfig,
} from '../domain/model-config.types';
import type { PluginReference } from '@/features/adapter/components/PluginSelector';
import { PluginSelector } from '@/features/adapter/components/PluginSelector';
import { 
  LoraAdapterSelector,
  type LoraAdapterConfig as SelectorLoraConfig 
} from '@/features/adapter/components/LoraAdapterSelector';
import { 
  Live2DModelSelector, 
  type Live2DModelConfig 
} from '@/features/adapter/components/Live2DModelSelector';
import { DeploymentLocation } from '@/features/adapter/domain/adapter.types';

// 步骤定义
const STEPS = [
  { id: 1, title: '基本信息', description: '设置角色的基本信息' },
  { id: 2, title: 'AI模型', description: '配置AI模型和能力' },
  { id: 3, title: '外观设置', description: 'Live2D模型、头像和封面图' },
  { id: 4, title: '标签插件', description: '标签分类和功能插件' },
  { id: 5, title: '确认创建', description: '检查信息并创建' },
];

export interface CharacterCreatorProps {
  /** 角色数据（用于编辑模式） */
  character?: Character;
  /** 初始数据（用于编辑模式，兼容旧版） */
  initialData?: Partial<CreateCharacterInput>;
  /** 是否为编辑模式 */
  isEditMode?: boolean;
  /** 保存草稿回调 */
  onSaveDraft?: (data: CreateCharacterInput) => Promise<void>;
  /** 发布回调 */
  onPublish?: (data: CreateCharacterInput) => Promise<void>;
  /** 提交回调（兼容旧版） */
  onSubmit?: (data: CreateCharacterInput) => Promise<void>;
  /** 取消回调 */
  onCancel?: () => void;
  /** 是否正在加载 */
  isLoading?: boolean;
  /** 是否可以发布（编辑模式下） */
  canPublish?: boolean;
  /** 自定义类名 */
  className?: string;
}

/**
 * CharacterCreator 组件
 */
export const CharacterCreator: React.FC<CharacterCreatorProps> = ({
  character,
  initialData,
  isEditMode = false,
  onSaveDraft,
  onPublish,
  onSubmit,
  onCancel,
  isLoading: externalLoading = false,
  canPublish = true,
  className,
}) => {
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  console.log('[CharacterCreator] Component mounted', { 
    isEditMode, 
    hasCharacter: !!character,
    hasInitialData: !!initialData,
    canPublish,
    externalLoading
  });

  // 从character或initialData获取初始数据
  const getInitialData = () => {
    if (character) {
      return {
        name: character.name,
        displayName: character.displayName,
        description: character.description,
        avatarUrl: character.avatarUrl,
        coverUrl: character.coverUrl,
        tags: character.tags,
        visibility: character.visibility,
        adapters: character.adapters,
        version: character.version,
        config: character.config,
      };
    }
    return initialData;
  };

  const initial = getInitialData();

  // 表单数据
  const [formData, setFormData] = useState<CreateCharacterInput>({
    name: initial?.name || '',
    displayName: initial?.displayName || '',
    description: initial?.description || '',
    avatarUrl: initial?.avatarUrl || '',
    coverUrl: initial?.coverUrl || '',
    tags: initial?.tags || [],
    visibility: initial?.visibility || CharacterVisibility.PRIVATE,
    adapters: initial?.adapters || [],
    version: initial?.version || '1.0.0',
    config: initial?.config,
  });

  // 表单验证错误
  const [errors, setErrors] = useState<Record<string, string>>({});

  // 临时标签输入
  const [tagInput, setTagInput] = useState('');

  // AI模型配置状态
  const [modelConfigType, setModelConfigType] = useState<ModelConfigType | undefined>(
    initial?.config?.aiModel?.type
  );
  const [aiModelConfig, setAiModelConfig] = useState<CharacterModelConfig | undefined>(
    initial?.config?.aiModel
  );

  // Live2D模型配置状态
  const [live2dConfig, setLive2dConfig] = useState<Live2DModelConfig | undefined>(
    initial?.config?.live2dModel ? {
      modelId: initial.config.live2dModel.modelId,
      modelName: initial.config.live2dModel.modelName,
      displayName: initial.config.live2dModel.displayName,
      deploymentLocation: initial.config.live2dModel.deployment.location,
      localPath: initial.config.live2dModel.deployment.localPath,
    } : undefined
  );

  // 插件配置状态
  const [selectedPlugins, setSelectedPlugins] = useState<PluginReference[]>([]);

  // Lora适配器配置状态（用于步骤2）
  const [loraConfig, setLoraConfig] = useState<SelectorLoraConfig | undefined>();

  // 提示词工程配置状态（用于步骤2）
  const [promptConfig, setPromptConfig] = useState<{
    provider: ThirdPartyModelProvider;
    modelId: string;
    modelName: string;
    systemPrompt: string;
    characterPrompt: string;
  }>({
    provider: ThirdPartyModelProvider.OPENAI,
    modelId: 'gpt-4',
    modelName: 'GPT-4',
    systemPrompt: '',
    characterPrompt: '',
  });

  // 更新表单数据
  const updateFormData = (field: keyof CreateCharacterInput, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // 清除该字段的错误
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  // 构建完整的config对象
  const buildCharacterConfig = (): CharacterFullConfig | undefined => {
    if (!aiModelConfig) {
      return undefined;
    }

    const config: CharacterFullConfig = {
      aiModel: aiModelConfig,
    };

    // 添加Live2D模型配置
    if (live2dConfig) {
      config.live2dModel = {
        modelId: live2dConfig.modelId,
        modelName: live2dConfig.modelName,
        displayName: live2dConfig.displayName,
        deployment: {
          location: live2dConfig.deploymentLocation,
          localPath: live2dConfig.localPath,
          cloudUrl: live2dConfig.fullModel?.deployment.cloudUrl,
        },
        fullModel: live2dConfig.fullModel,
      };
    }

    // 添加插件配置
    if (selectedPlugins.length > 0) {
      config.plugins = selectedPlugins.map(p => p.id);
    }

    return config;
  };

  // 验证当前步骤
  const validateStep = (step: number): boolean => {
    const newErrors: Record<string, string> = {};

    if (step === 1) {
      if (!formData['name']?.trim()) {
        newErrors['name'] = '角色名称不能为空';
      } else if ((formData['name']?.length || 0) > 100) {
        newErrors['name'] = '角色名称不能超过100个字符';
      }

      if (!formData['description']?.trim()) {
        newErrors['description'] = '角色描述不能为空';
      } else if ((formData['description']?.length || 0) > 2000) {
        newErrors['description'] = '角色描述不能超过2000个字符';
      }
    }

    if (step === 2) {
      if (!aiModelConfig) {
        newErrors['aiModel'] = '请配置AI模型';
      }
    }

    // 步骤3和4是可选的，不需要验证

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // 下一步
  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep((prev) => Math.min(prev + 1, STEPS.length));
    }
  };

  // 上一步
  const handlePrevious = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  // 添加标签
  const handleAddTag = () => {
    const tag = tagInput.trim();
    if (tag && !formData.tags?.includes(tag)) {
      if ((formData.tags?.length || 0) >= 20) {
        setErrors({ tags: '最多只能添加20个标签' });
        return;
      }
      updateFormData('tags', [...(formData['tags'] || []), tag]);
      setTagInput('');
    }
  };

  // 删除标签
  const handleRemoveTag = (tag: string) => {
    updateFormData(
      'tags',
      (formData['tags'] || []).filter((t) => t !== tag)
    );
  };

  // 保存草稿
  const handleSaveDraft = async () => {
    if (!validateStep(currentStep)) {
      toast({
        title: '验证失败',
        description: '请检查并修正表单中的错误',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    setErrors({}); // 清除之前的错误
    try {
      // 构建完整的config对象
      const config = buildCharacterConfig();
      const dataToSave = {
        ...formData,
        config,
      };
      
      // 优先使用onSaveDraft，否则使用onSubmit（向后兼容）
      await (onSaveDraft || onSubmit)?.(dataToSave);
      // 成功后跳转（由父组件处理）
    } catch (error: any) {
      console.error('Failed to save character:', error);
      
      // 解析错误消息
      let errorMessage = '保存失败，请重试';
      let errorDetails = '';
      
      if (error.message) {
        errorMessage = error.message;
      }
      
      // 检查是否是网络错误
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        errorMessage = '网络连接失败';
        errorDetails = '请检查您的网络连接后重试';
      }
      
      // 检查是否是超时错误
      if (error.name === 'AbortError' || error.message.includes('timeout')) {
        errorMessage = '请求超时';
        errorDetails = '服务器响应时间过长，请稍后重试';
      }
      
      // 设置错误状态
      setErrors({ submit: errorMessage });
      
      // 显示 toast 通知
      toast({
        title: '保存失败',
        description: errorDetails || errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // 发布
  const handlePublish = async () => {
    if (!validateStep(currentStep)) {
      toast({
        title: '验证失败',
        description: '请检查并修正表单中的错误',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    setErrors({}); // 清除之前的错误
    try {
      // 构建完整的config对象
      const config = buildCharacterConfig();
      const dataToPublish = {
        ...formData,
        config,
      };
      
      // 优先使用onPublish，否则使用onSubmit（向后兼容）
      await (onPublish || onSubmit)?.(dataToPublish);
      // 成功后跳转（由父组件处理）
    } catch (error: any) {
      console.error('Failed to publish character:', error);
      
      // 解析错误消息
      let errorMessage = '发布失败，请重试';
      let errorDetails = '';
      
      if (error.message) {
        errorMessage = error.message;
      }
      
      // 检查是否是网络错误
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        errorMessage = '网络连接失败';
        errorDetails = '请检查您的网络连接后重试';
      }
      
      // 检查是否是超时错误
      if (error.name === 'AbortError' || error.message.includes('timeout')) {
        errorMessage = '请求超时';
        errorDetails = '服务器响应时间过长，请稍后重试';
      }
      
      // 设置错误状态
      setErrors({ submit: errorMessage });
      
      // 显示 toast 通知
      toast({
        title: '发布失败',
        description: errorDetails || errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // 取消创建
  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    } else {
      console.warn('[CharacterCreator] No onCancel handler provided');
    }
  };

  // 渲染步骤指示器
  const renderStepIndicator = () => (
    <div className="flex items-center justify-between mb-8">
      {STEPS.map((step, index) => (
        <React.Fragment key={step.id}>
          <div className="flex flex-col items-center gap-2">
            <div
              className={cn(
                'w-10 h-10 rounded-full flex items-center justify-center font-medium transition-colors',
                currentStep > step.id
                  ? 'bg-primary text-primary-foreground'
                  : currentStep === step.id
                  ? 'bg-primary text-primary-foreground ring-4 ring-primary/20'
                  : 'bg-muted text-muted-foreground'
              )}
            >
              {currentStep > step.id ? (
                <Check className="h-5 w-5" />
              ) : (
                step.id
              )}
            </div>
            <div className="text-center">
              <div className="text-sm font-medium">{step.title}</div>
              <div className="text-xs text-muted-foreground hidden sm:block">
                {step.description}
              </div>
            </div>
          </div>
          {index < STEPS.length - 1 && (
            <div
              className={cn(
                'flex-1 h-1 mx-4 rounded transition-colors',
                currentStep > step.id ? 'bg-primary' : 'bg-muted'
              )}
            />
          )}
        </React.Fragment>
      ))}
    </div>
  );

  // 渲染步骤1：基本信息
  const renderStep1 = () => (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="name">
          角色名称 <span className="text-red-500">*</span>
        </Label>
        <Input
          id="name"
          value={formData['name'] || ''}
          onChange={(e) => updateFormData('name', e.target.value)}
          placeholder="给你的角色起个名字"
          maxLength={100}
          className={errors['name'] ? 'border-red-500' : ''}
        />
        {errors['name'] && (
          <p className="text-sm text-red-500">{errors['name']}</p>
        )}
        <p className="text-xs text-muted-foreground">
          {formData['name']?.length || 0}/100 字符
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="displayName">显示名称（选填）</Label>
        <Input
          id="displayName"
          value={formData.displayName}
          onChange={(e) => updateFormData('displayName', e.target.value)}
          placeholder="可以包含特殊字符的显示名称"
          maxLength={100}
        />
        <p className="text-xs text-muted-foreground">
          显示名称可以使用 emoji 和特殊字符
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">
          角色描述 <span className="text-red-500">*</span>
        </Label>
        <Textarea
          id="description"
          value={formData['description'] || ''}
          onChange={(e) => updateFormData('description', e.target.value)}
          placeholder="详细描述你的角色..."
          rows={6}
          maxLength={2000}
          className={errors['description'] ? 'border-red-500' : ''}
        />
        {errors['description'] && (
          <p className="text-sm text-red-500">{errors['description']}</p>
        )}
        <p className="text-xs text-muted-foreground">
          {formData['description']?.length || 0}/2000 字符
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="visibility">可见性</Label>
        <Select
          value={formData.visibility}
          onValueChange={(value) =>
            updateFormData('visibility', value as CharacterVisibility)
          }
        >
          <SelectTrigger id="visibility">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="private">
              <div className="flex flex-col items-start">
                <div>私有</div>
                <div className="text-xs text-muted-foreground">
                  仅自己可见
                </div>
              </div>
            </SelectItem>
            <SelectItem value="unlisted">
              <div className="flex flex-col items-start">
                <div>不公开</div>
                <div className="text-xs text-muted-foreground">
                  有链接的人可访问
                </div>
              </div>
            </SelectItem>
            <SelectItem value="public">
              <div className="flex flex-col items-start">
                <div>公开</div>
                <div className="text-xs text-muted-foreground">
                  所有人可见
                </div>
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="version">版本号</Label>
        <Input
          id="version"
          value={formData.version}
          onChange={(e) => updateFormData('version', e.target.value)}
          placeholder="1.0.0"
        />
        <p className="text-xs text-muted-foreground">
          建议使用语义化版本号，如 1.0.0
        </p>
      </div>
    </div>
  );

  // 渲染步骤2：AI模型配置
  const renderStep2 = () => {
    const handleModelConfigTypeChange = (type: ModelConfigType) => {
      setModelConfigType(type);
      // 重置AI模型配置
      setAiModelConfig(undefined);
      setLoraConfig(undefined);
      setPromptConfig({
        provider: ThirdPartyModelProvider.OPENAI,
        modelId: 'gpt-4',
        modelName: 'GPT-4',
        systemPrompt: '',
        characterPrompt: '',
      });
    };

    const handleLoraConfigChange = (config: SelectorLoraConfig | undefined) => {
      setLoraConfig(config);
      
      if (config) {
        // 构建AI模型配置
        const aiConfig: LoraAdapterConfig = {
          type: ModelConfigType.LORA_ADAPTER,
          loraAdapter: config.loraId, // 使用ID
          baseModelId: config.baseModelId,
          baseModelName: config.baseModelName,
          deployment: {
            location: DeploymentLocation.CLOUD, // 默认云端部署
          },
        };
        setAiModelConfig(aiConfig);
      } else {
        // 清除AI模型配置
        setAiModelConfig(undefined);
      }
    };

    const handlePromptEngineering = () => {
      // 构建AI模型配置
      const aiConfig: PromptEngineeringConfig = {
        type: ModelConfigType.PROMPT_ENGINEERING,
        provider: promptConfig.provider,
        modelId: promptConfig.modelId,
        modelName: promptConfig.modelName,
        systemPrompt: promptConfig.systemPrompt,
        characterPrompt: promptConfig.characterPrompt,
      };
      setAiModelConfig(aiConfig);
    };

    return (
      <div className="space-y-6">
        <div className="space-y-4">
          <Label>
            选择AI模型配置方式 <span className="text-red-500">*</span>
          </Label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card
              className={cn(
                'cursor-pointer transition-all hover:border-primary',
                modelConfigType === ModelConfigType.LORA_ADAPTER &&
                  'border-primary ring-2 ring-primary/20'
              )}
              onClick={() => handleModelConfigTypeChange(ModelConfigType.LORA_ADAPTER)}
            >
              <CardHeader>
                <CardTitle className="text-lg">Lora适配器</CardTitle>
                <CardDescription>
                  使用社区中的Lora适配器微调模型，适合特定风格和角色
                </CardDescription>
              </CardHeader>
            </Card>
            <Card
              className={cn(
                'cursor-pointer transition-all hover:border-primary',
                modelConfigType === ModelConfigType.PROMPT_ENGINEERING &&
                  'border-primary ring-2 ring-primary/20'
              )}
              onClick={() =>
                handleModelConfigTypeChange(ModelConfigType.PROMPT_ENGINEERING)
              }
            >
              <CardHeader>
                <CardTitle className="text-lg">提示词工程</CardTitle>
                <CardDescription>
                  使用第三方模型API（如OpenAI、Claude）并通过提示词定制
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
          {errors['aiModel'] && (
            <p className="text-sm text-red-500">{errors['aiModel']}</p>
          )}
        </div>

        {modelConfigType === ModelConfigType.LORA_ADAPTER && (
          <div className="space-y-4">
            <Label>选择Lora适配器</Label>
            <LoraAdapterSelector
              value={loraConfig}
              onChange={handleLoraConfigChange}
            />
            {loraConfig && (
              <Card className="bg-green-50 border-green-200">
                <CardContent className="pt-6">
                  <div className="flex items-start gap-3">
                    <Check className="h-5 w-5 text-green-600 mt-0.5" />
                    <div>
                      <p className="font-medium text-green-900">
                        已选择: {loraConfig.loraName}
                      </p>
                      <p className="text-sm text-green-700">
                        基础模型: {loraConfig.baseModelName}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {modelConfigType === ModelConfigType.PROMPT_ENGINEERING && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>模型提供商</Label>
              <Select
                value={promptConfig.provider}
                onValueChange={(value) =>
                  setPromptConfig((prev) => ({
                    ...prev,
                    provider: value as ThirdPartyModelProvider,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ThirdPartyModelProvider.OPENAI}>
                    OpenAI
                  </SelectItem>
                  <SelectItem value={ThirdPartyModelProvider.ANTHROPIC}>
                    Anthropic (Claude)
                  </SelectItem>
                  <SelectItem value={ThirdPartyModelProvider.GOOGLE}>
                    Google (Gemini)
                  </SelectItem>
                  <SelectItem value={ThirdPartyModelProvider.OTHER}>
                    其他/自定义API
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>模型ID</Label>
              <Input
                value={promptConfig.modelId}
                onChange={(e) =>
                  setPromptConfig((prev) => ({
                    ...prev,
                    modelId: e.target.value,
                  }))
                }
                placeholder="例如: gpt-4, claude-3-opus"
              />
            </div>

            <div className="space-y-2">
              <Label>模型名称</Label>
              <Input
                value={promptConfig.modelName}
                onChange={(e) =>
                  setPromptConfig((prev) => ({
                    ...prev,
                    modelName: e.target.value,
                  }))
                }
                placeholder="例如: GPT-4, Claude 3 Opus"
              />
            </div>

            <div className="space-y-2">
              <Label>系统提示词</Label>
              <Textarea
                value={promptConfig.systemPrompt}
                onChange={(e) =>
                  setPromptConfig((prev) => ({
                    ...prev,
                    systemPrompt: e.target.value,
                  }))
                }
                placeholder="定义AI助手的基本行为和角色..."
                rows={4}
              />
            </div>

            <div className="space-y-2">
              <Label>角色提示词</Label>
              <Textarea
                value={promptConfig.characterPrompt}
                onChange={(e) =>
                  setPromptConfig((prev) => ({
                    ...prev,
                    characterPrompt: e.target.value,
                  }))
                }
                placeholder="定义角色的性格、说话风格等..."
                rows={4}
              />
            </div>

            <Button onClick={handlePromptEngineering} variant="outline">
              <Check className="h-4 w-4 mr-2" />
              确认配置
            </Button>

            {aiModelConfig && (
              <Card className="bg-green-50 border-green-200">
                <CardContent className="pt-6">
                  <div className="flex items-start gap-3">
                    <Check className="h-5 w-5 text-green-600 mt-0.5" />
                    <div>
                      <p className="font-medium text-green-900">
                        配置已保存
                      </p>
                      <p className="text-sm text-green-700">
                        {promptConfig.modelName} ({promptConfig.provider})
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    );
  };

  // 渲染步骤3：外观和Live2D
  const renderStep3 = () => (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="avatarUrl">头像 URL</Label>
        <div className="flex gap-2">
          <Input
            id="avatarUrl"
            value={formData.avatarUrl}
            onChange={(e) => updateFormData('avatarUrl', e.target.value)}
            placeholder="https://example.com/avatar.jpg"
          />
          <Button variant="outline" size="icon">
            <Upload className="h-4 w-4" />
          </Button>
        </div>
        {formData.avatarUrl && (
          <div className="mt-2">
            <img
              src={formData.avatarUrl}
              alt="Avatar preview"
              className="w-20 h-20 rounded-full object-cover border-2"
              onError={(e) => {
                (e.target as HTMLImageElement).src =
                  'https://via.placeholder.com/80';
              }}
            />
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="coverUrl">封面图 URL</Label>
        <div className="flex gap-2">
          <Input
            id="coverUrl"
            value={formData.coverUrl}
            onChange={(e) => updateFormData('coverUrl', e.target.value)}
            placeholder="https://example.com/cover.jpg"
          />
          <Button variant="outline" size="icon">
            <Upload className="h-4 w-4" />
          </Button>
        </div>
        {formData.coverUrl && (
          <div className="mt-2">
            <img
              src={formData.coverUrl}
              alt="Cover preview"
              className="w-full h-40 rounded-lg object-cover border-2"
              onError={(e) => {
                (e.target as HTMLImageElement).src =
                  'https://via.placeholder.com/600x160';
              }}
            />
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label>Live2D模型（选填）</Label>
        <Live2DModelSelector
          value={live2dConfig}
          onChange={setLive2dConfig}
        />
        {live2dConfig && (
          <Card className="bg-green-50 border-green-200">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <Check className="h-5 w-5 text-green-600 mt-0.5" />
                <div>
                  <p className="font-medium text-green-900">
                    已选择: {live2dConfig.displayName}
                  </p>
                  <p className="text-sm text-green-700">
                    位置: {live2dConfig.deploymentLocation}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg flex gap-3">
        <Info className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-900">
          <p className="font-medium mb-1">提示</p>
          <p>
            目前仅支持输入图片 URL。未来版本将支持直接上传图片。建议使用
            16:9 的封面图和 1:1 的头像以获得最佳效果。
          </p>
        </div>
      </div>
    </div>
  );

  // 渲染步骤4：标签分类和插件
  const renderStep4 = () => (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="tagInput">添加标签</Label>
        <div className="flex gap-2">
          <Input
            id="tagInput"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddTag();
              }
            }}
            placeholder="输入标签后按回车"
            maxLength={30}
          />
          <Button onClick={handleAddTag} variant="outline">
            添加
          </Button>
        </div>
        {errors['tags'] && (
          <p className="text-sm text-red-500">{errors['tags']}</p>
        )}
        <p className="text-xs text-muted-foreground">
          已添加 {formData['tags']?.length || 0}/20 个标签
        </p>
      </div>

      {(formData['tags']?.length || 0) > 0 && (
        <div className="space-y-2">
          <Label>已添加的标签</Label>
          <div className="flex flex-wrap gap-2">
            {(formData['tags'] || []).map((tag) => (
              <Badge key={tag} variant="secondary" className="gap-1">
                {tag}
                <button
                  onClick={() => handleRemoveTag(tag)}
                  className="ml-1 hover:text-red-500"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        </div>
      )}

      <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex gap-3">
        <Sparkles className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-green-900">
          <p className="font-medium mb-1">标签建议</p>
          <p className="mb-2">添加合适的标签可以帮助其他用户更容易发现你的角色：</p>
          <div className="flex flex-wrap gap-1.5">
            {[
              '助手',
              '陪伴',
              '专业',
              '创意',
              '教育',
              '娱乐',
              '游戏',
              '商务',
            ].map((suggestion) => (
              <Button
                key={suggestion}
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => {
                  if (!(formData['tags'] || []).includes(suggestion)) {
                    updateFormData('tags', [...(formData['tags'] || []), suggestion]);
                  }
                }}
                disabled={(formData['tags'] || []).includes(suggestion)}
              >
                {suggestion}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* 插件选择 */}
      <div className="space-y-2">
        <Label>功能插件（选填）</Label>
        <PluginSelector
          selectedPlugins={selectedPlugins}
          onChange={setSelectedPlugins}
        />
        {selectedPlugins.length > 0 && (
          <Card className="bg-green-50 border-green-200">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <Check className="h-5 w-5 text-green-600 mt-0.5" />
                <div>
                  <p className="font-medium text-green-900">
                    已选择 {selectedPlugins.length} 个插件
                  </p>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {selectedPlugins.map((plugin) => (
                      <Badge key={plugin.id} variant="secondary">
                        {plugin.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );

  // 渲染步骤5：确认创建
  const renderStep5 = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>基本信息</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">角色名称</span>
            <span className="font-medium">{formData['name'] || ''}</span>
          </div>
          {formData.displayName && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">显示名称</span>
              <span className="font-medium">{formData.displayName}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-muted-foreground">可见性</span>
            <Badge variant="secondary">{formData.visibility}</Badge>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">版本号</span>
            <span className="font-medium">{formData.version}</span>
          </div>
          <div>
            <div className="text-muted-foreground mb-1">描述</div>
            <p className="text-sm">{formData['description'] || ''}</p>
          </div>
        </CardContent>
      </Card>

      {(formData['tags']?.length || 0) > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>标签</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {(formData['tags'] || []).map((tag) => (
                <Badge key={tag} variant="secondary">
                  {tag}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* AI模型配置 */}
      {aiModelConfig && (
        <Card>
          <CardHeader>
            <CardTitle>AI模型配置</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">配置类型</span>
              <Badge variant="secondary">
                {aiModelConfig.type === ModelConfigType.LORA_ADAPTER
                  ? 'Lora适配器'
                  : aiModelConfig.type === ModelConfigType.PROMPT_ENGINEERING
                  ? '提示词工程'
                  : '完整模型'}
              </Badge>
            </div>
            {aiModelConfig.type === ModelConfigType.LORA_ADAPTER && (
              <>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Lora适配器</span>
                  <span className="font-medium">
                    {loraConfig?.loraName || '未选择'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">基础模型</span>
                  <span className="font-medium">
                    {aiModelConfig.baseModelName}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">部署位置</span>
                  <Badge variant="outline">
                    {aiModelConfig.deployment.location === DeploymentLocation.CLOUD ? '云端' : '本地'}
                  </Badge>
                </div>
              </>
            )}
            {aiModelConfig.type === ModelConfigType.PROMPT_ENGINEERING && (
              <>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">提供商</span>
                  <Badge variant="outline">{aiModelConfig.provider}</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">模型</span>
                  <span className="font-medium">
                    {aiModelConfig.modelName}
                  </span>
                </div>
                {aiModelConfig.systemPrompt && (
                  <div>
                    <div className="text-muted-foreground mb-1">系统提示词</div>
                    <p className="text-sm bg-muted p-3 rounded-md">
                      {aiModelConfig.systemPrompt.length > 200
                        ? aiModelConfig.systemPrompt.substring(0, 200) + '...'
                        : aiModelConfig.systemPrompt}
                    </p>
                  </div>
                )}
                {aiModelConfig.characterPrompt && (
                  <div>
                    <div className="text-muted-foreground mb-1">角色提示词</div>
                    <p className="text-sm bg-muted p-3 rounded-md">
                      {aiModelConfig.characterPrompt.length > 200
                        ? aiModelConfig.characterPrompt.substring(0, 200) + '...'
                        : aiModelConfig.characterPrompt}
                    </p>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* 外观和Live2D */}
      {(formData.avatarUrl || formData.coverUrl || live2dConfig) && (
        <Card>
          <CardHeader>
            <CardTitle>外观设置</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {formData.avatarUrl && (
              <div>
                <p className="text-sm text-muted-foreground mb-2">头像</p>
                <img
                  src={formData.avatarUrl}
                  alt="Avatar"
                  className="w-20 h-20 rounded-full object-cover border-2"
                />
              </div>
            )}
            {formData.coverUrl && (
              <div>
                <p className="text-sm text-muted-foreground mb-2">封面图</p>
                <img
                  src={formData.coverUrl}
                  alt="Cover"
                  className="w-full h-40 rounded-lg object-cover border-2"
                />
              </div>
            )}
            {live2dConfig && (
              <div>
                <p className="text-sm text-muted-foreground mb-2">Live2D模型</p>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{live2dConfig.displayName}</Badge>
                  <span className="text-xs text-muted-foreground">
                    {live2dConfig.deploymentLocation}
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 插件配置 */}
      {selectedPlugins.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>功能插件</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {selectedPlugins.map((plugin) => (
                <Badge key={plugin.id} variant="secondary">
                  {plugin.name}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg flex gap-3">
        <Info className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-900">
          <p className="font-medium mb-1">下一步</p>
          <p>
            创建角色后，你可以继续配置人格、表情、语音和模型等详细设置。
          </p>
        </div>
      </div>
    </div>
  );

  // 渲染当前步骤内容
  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return renderStep1();
      case 2:
        return renderStep2();
      case 3:
        return renderStep3();
      case 4:
        return renderStep4();
      case 5:
        return renderStep5();
      default:
        return null;
    }
  };

  const progress = (currentStep / STEPS.length) * 100;
  const isLoading = isSubmitting || externalLoading;

  return (
    <div className={cn('w-full max-w-4xl mx-auto', className)}>
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">
            {isEditMode ? '编辑角色' : '创建新角色'}
          </CardTitle>
          <CardDescription>
            {isEditMode
              ? '更新角色的基本信息'
              : '按照向导步骤创建你的 AI 角色'}
          </CardDescription>
          <Progress value={progress} className="mt-4" />
        </CardHeader>

        <CardContent className="space-y-8">
          {renderStepIndicator()}
          
          {/* 通用错误提示区域 */}
          {errors['submit'] && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h4 className="font-medium text-red-900 mb-1">操作失败</h4>
                <p className="text-sm text-red-800">{errors['submit']}</p>
              </div>
              <button
                onClick={() => setErrors(prev => {
                  const newErrors = { ...prev };
                  delete newErrors['submit'];
                  return newErrors;
                })}
                className="text-red-500 hover:text-red-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
          
          {renderStepContent()}

          {/* 操作按钮 */}
          <div className="flex justify-between pt-6 border-t">
            <Button
              variant="outline"
              onClick={currentStep === 1 ? handleCancel : handlePrevious}
              disabled={isLoading}
            >
              {currentStep === 1 ? (
                <>
                  <X className="h-4 w-4 mr-2" />
                  取消
                </>
              ) : (
                <>
                  <ChevronLeft className="h-4 w-4 mr-2" />
                  上一步
                </>
              )}
            </Button>

            {currentStep < STEPS.length ? (
              <Button onClick={handleNext} disabled={isLoading}>
                下一步
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            ) : (
              <div className="flex gap-2">
                {/* 保存草稿按钮 */}
                <Button
                  variant="outline"
                  onClick={handleSaveDraft}
                  disabled={isLoading}
                >
                  <Save className="h-4 w-4 mr-2" />
                  {isEditMode ? '保存' : '保存草稿'}
                </Button>

                {/* 发布按钮 */}
                {(onPublish || !isEditMode) && (
                  <Button
                    onClick={handlePublish}
                    disabled={isLoading || (isEditMode && !canPublish)}
                  >
                    <Check className="h-4 w-4 mr-2" />
                    {isEditMode ? '保存并发布' : '创建并发布'}
                  </Button>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

