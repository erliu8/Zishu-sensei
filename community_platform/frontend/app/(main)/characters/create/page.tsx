/**
 * 创建角色页面
 * @route /characters/create
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCreateCharacter } from '@/features/character/hooks';
import { useSession } from 'next-auth/react';
import {
  Button,
  Card,
  Separator,
} from '@/shared/components';
import { 
  ArrowLeft,
  Save,
  Eye,
  Sparkles,
} from 'lucide-react';
import { CharacterCreator } from '@/features/character/components/CharacterCreator';
import { useToast } from '@/shared/hooks/use-toast';
import type { CreateCharacterInput } from '@/features/character/domain';

/**
 * 创建角色页面组件
 */
export default function CreateCharacterPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { data: session } = useSession();
  const [isSaving, setIsSaving] = useState(false);

  // Mutations
  const createCharacter = useCreateCharacter();

  // 检查登录状态
  if (!session) {
    router.push('/login?redirect=/characters/create');
    return null;
  }

  // 处理保存草稿
  const handleSaveDraft = async (data: CreateCharacterInput) => {
    setIsSaving(true);
    try {
      const newCharacter = await createCharacter.mutateAsync(data);
      toast.success('角色草稿已保存');
      router.push(`/characters/${newCharacter.id}/edit`);
    } catch (error: any) {
      toast.error(error.message || '保存失败');
    } finally {
      setIsSaving(false);
    }
  };

  // 处理发布
  const handlePublish = async (data: CreateCharacterInput) => {
    setIsSaving(true);
    try {
      const newCharacter = await createCharacter.mutateAsync({
        ...data,
      });
      // TODO: 调用发布接口
      toast.success('角色已创建并发布');
      router.push(`/characters/${newCharacter.id}`);
    } catch (error: any) {
      toast.error(error.message || '创建失败');
    } finally {
      setIsSaving(false);
    }
  };

  // 处理取消
  const handleCancel = () => {
    if (confirm('确定要放弃创建吗？未保存的内容将会丢失。')) {
      router.back();
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* 页面头部 */}
      <div className="mb-8">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCancel}
          className="mb-6"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          返回
        </Button>

        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Sparkles className="h-8 w-8 text-primary" />
              <h1 className="text-3xl font-bold">创建 AI 角色</h1>
            </div>
            <p className="text-muted-foreground">
              打造你的专属 AI 助手，赋予它独特的人格、声音和外观
            </p>
          </div>
        </div>

        <Separator className="my-6" />
      </div>

      {/* 创建向导 */}
      <CharacterCreator
        onSaveDraft={handleSaveDraft}
        onPublish={handlePublish}
        onCancel={handleCancel}
        isLoading={isSaving}
      />
    </div>
  );
}

