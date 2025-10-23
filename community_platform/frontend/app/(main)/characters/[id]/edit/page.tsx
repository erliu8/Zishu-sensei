/**
 * 编辑角色页面
 * @route /characters/[id]/edit
 */

'use client';

import { use, useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  useCharacter,
  useUpdateCharacter,
  usePublishCharacter,
  useUnpublishCharacter,
} from '@/features/character/hooks';
import { useSession } from 'next-auth/react';
import {
  Button,
  Separator,
  Badge,
} from '@/shared/components';
import { LoadingSpinner, EmptyState } from '@/shared/components/common';
import { 
  ArrowLeft,
  Save,
  Eye,
  Sparkles,
  Send,
  Archive,
} from 'lucide-react';
import { CharacterCreator } from '@/features/character/components/CharacterCreator';
import { useToast } from '@/shared/hooks/use-toast';
import type { UpdateCharacterInput } from '@/features/character/domain';
import { CharacterModel } from '@/features/character/domain';

interface EditCharacterPageProps {
  params: Promise<{ id: string }>;
}

/**
 * 编辑角色页面组件
 */
export default function EditCharacterPage({ params }: EditCharacterPageProps) {
  const resolvedParams = use(params);
  const characterId = resolvedParams.id;
  const router = useRouter();
  const { toast } = useToast();
  const { data: session } = useSession();
  const [isSaving, setIsSaving] = useState(false);

  // 获取角色数据
  const { data: character, isLoading, error, refetch } = useCharacter(characterId);

  // Mutations
  const updateCharacter = useUpdateCharacter();
  const publishCharacter = usePublishCharacter();
  const unpublishCharacter = useUnpublishCharacter();

  // 检查登录状态
  if (!session) {
    router.push(`/login?redirect=/characters/${characterId}/edit`);
    return null;
  }

  // 检查是否是角色创建者
  const isOwner = session?.user?.id === character?.creatorId;

  // 处理保存
  const handleSave = async (data: UpdateCharacterInput) => {
    setIsSaving(true);
    try {
      await updateCharacter.mutateAsync({
        id: characterId,
        input: data,
      });
      toast.success('角色已保存');
      refetch();
    } catch (error: any) {
      toast.error(error.message || '保存失败');
    } finally {
      setIsSaving(false);
    }
  };

  // 处理发布
  const handlePublish = async (data: UpdateCharacterInput) => {
    setIsSaving(true);
    try {
      // 先保存
      await updateCharacter.mutateAsync({
        id: characterId,
        input: data,
      });
      
      // 再发布
      await publishCharacter.mutateAsync({
        id: characterId,
      });
      
      toast.success('角色已发布');
      router.push(`/characters/${characterId}`);
    } catch (error: any) {
      toast.error(error.message || '发布失败');
    } finally {
      setIsSaving(false);
    }
  };

  // 处理取消发布
  const handleUnpublish = async () => {
    if (!confirm('确定要取消发布吗？角色将不会在公开列表中显示。')) {
      return;
    }
    
    try {
      await unpublishCharacter.mutateAsync(characterId);
      toast.success('已取消发布');
      refetch();
    } catch (error: any) {
      toast.error(error.message || '操作失败');
    }
  };

  // 处理预览
  const handlePreview = () => {
    router.push(`/characters/${characterId}`);
  };

  // 处理取消
  const handleCancel = () => {
    if (confirm('确定要放弃修改吗？未保存的内容将会丢失。')) {
      router.push(`/characters/${characterId}`);
    }
  };

  // 渲染加载状态
  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center py-20">
          <LoadingSpinner size="lg" />
        </div>
      </div>
    );
  }

  // 渲染错误状态
  if (error || !character) {
    return (
      <div className="container mx-auto px-4 py-8">
        <EmptyState
          title="加载失败"
          description={error?.message || '无法找到该角色'}
          action={{
            label: '返回列表',
            onClick: () => router.push('/characters'),
          }}
        />
      </div>
    );
  }

  // 检查权限
  if (!isOwner) {
    return (
      <div className="container mx-auto px-4 py-8">
        <EmptyState
          title="无权限"
          description="你没有权限编辑此角色"
          action={{
            label: '返回详情',
            onClick: () => router.push(`/characters/${characterId}`),
          }}
        />
      </div>
    );
  }

  // 获取完整度信息
  const characterModel = new CharacterModel(character);
  const readinessCheck = characterModel.isReadyToPublish();
  const completionPercentage = characterModel.getCompletionPercentage();

  return (
    <div className="container mx-auto px-4 py-8">
      {/* 页面头部 */}
      <div className="mb-8">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push(`/characters/${characterId}`)}
          className="mb-6"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          返回详情
        </Button>

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Sparkles className="h-8 w-8 text-primary" />
              <h1 className="text-3xl font-bold">编辑角色</h1>
              {character.published ? (
                <Badge variant="default" className="bg-green-100 text-green-700">
                  已发布
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-gray-100 text-gray-700">
                  草稿
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground">
              完善你的 AI 角色配置 • 完成度 {completionPercentage}%
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={handlePreview}
              className="gap-2"
            >
              <Eye className="h-4 w-4" />
              预览
            </Button>
            
            {character.published && (
              <Button
                variant="outline"
                onClick={handleUnpublish}
                className="gap-2"
              >
                <Archive className="h-4 w-4" />
                取消发布
              </Button>
            )}
          </div>
        </div>

        <Separator className="my-6" />

        {/* 完整度提示 */}
        {!readinessCheck.ready && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center">
                <Sparkles className="h-4 w-4 text-yellow-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-medium text-yellow-900 mb-1">
                  角色配置不完整
                </h3>
                <p className="text-sm text-yellow-800 mb-2">
                  以下配置项需要完善才能发布：
                </p>
                <ul className="text-sm text-yellow-800 list-disc list-inside space-y-1">
                  {readinessCheck.missingItems.map((item) => (
                    <li key={item}>
                      {item === 'name' && '角色名称'}
                      {item === 'description' && '角色描述'}
                      {item === 'personality' && '人格配置'}
                      {item === 'voice' && '语音配置'}
                      {item === 'model' && '模型配置'}
                      {item === 'adapters' && '适配器配置'}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 编辑器 */}
      <CharacterCreator
        character={character}
        onSaveDraft={handleSave}
        onPublish={handlePublish}
        onCancel={handleCancel}
        isLoading={isSaving}
        canPublish={readinessCheck.ready}
      />
    </div>
  );
}

