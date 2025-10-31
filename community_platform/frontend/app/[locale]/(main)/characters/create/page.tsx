/**
 * 创建角色页面
 * @route /characters/create
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useCreateCharacter } from '@/features/character/hooks';
import { useSession } from 'next-auth/react';
import { useAuth } from '@/features/auth/hooks/useAuth';
import {
  Button,
  Separator,
} from '@/shared/components';
import { 
  ArrowLeft,
  Sparkles,
} from 'lucide-react';
import { CharacterCreator } from '@/features/character/components/CharacterCreator';
import { CharacterCreatorErrorBoundary } from '@/features/character/components/CharacterCreatorErrorBoundary';
import { useToast } from '@/shared/hooks/use-toast';
import type { CreateCharacterInput } from '@/features/character/domain';

/**
 * 创建角色页面组件
 */
export default function CreateCharacterPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { status: sessionStatus } = useSession();
  const { isAuthenticated: isAuthStoreAuthenticated, isLoading: isAuthStoreLoading } = useAuth();
  const [isSaving, setIsSaving] = useState(false);

  console.log('[CreateCharacterPage] Rendering', { 
    sessionStatus, 
    isAuthStoreAuthenticated, 
    isAuthStoreLoading, 
    isSaving 
  });

  // Mutations
  const createCharacter = useCreateCharacter();

  // 全局错误捕获
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      console.error('[CreateCharacterPage] Uncaught error:', {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: event.error,
      });
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      console.error('[CreateCharacterPage] Unhandled promise rejection:', {
        reason: event.reason,
        promise: event.promise,
      });
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  // 检查登录状态 - 使用 useEffect 避免在渲染期间导航
  useEffect(() => {
    console.log('[CreateCharacterPage] Auth status changed:', { 
      sessionStatus, 
      isAuthStoreAuthenticated, 
      isAuthStoreLoading 
    });
    
    // 在开发环境下，可以通过 URL 参数 ?skip_auth=true 跳过认证检查
    if (typeof window !== 'undefined') {
      const skipAuth = new URLSearchParams(window.location.search).get('skip_auth') === 'true';
      const isDev = process.env.NODE_ENV === 'development';
      
      // 只有在两个认证系统都确认未登录时才重定向
      // 优先使用 Zustand store 的状态，因为它有 token 持久化
      const isLoading = sessionStatus === 'loading' || isAuthStoreLoading;
      const isAuthenticated = isAuthStoreAuthenticated || sessionStatus === 'authenticated';
      
      if (!isLoading && !isAuthenticated) {
        if (isDev && skipAuth) {
          console.warn('[CreateCharacterPage] ⚠️ Auth check bypassed for development');
          return;
        }
        console.log('[CreateCharacterPage] Not authenticated, redirecting to login');
        router.push('/login?redirect=/characters/create');
      } else if (isAuthStoreAuthenticated && sessionStatus === 'unauthenticated') {
        // Zustand store 显示已登录，但 NextAuth session 未登录
        // 这可能是因为页面刷新后 NextAuth session 丢失
        console.warn('[CreateCharacterPage] ⚠️ Auth state mismatch detected:', {
          authStore: 'authenticated',
          nextAuth: 'unauthenticated',
          message: '认证状态不同步，使用 Auth Store 状态'
        });
      }
    }
  }, [sessionStatus, isAuthStoreAuthenticated, isAuthStoreLoading, router]);

  // 计算最终的认证状态
  const isLoading = sessionStatus === 'loading' || isAuthStoreLoading;
  const isAuthenticated = isAuthStoreAuthenticated || sessionStatus === 'authenticated';

  // 如果正在加载，显示加载状态
  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]" />
            <p className="text-muted-foreground">正在验证登录状态...</p>
          </div>
        </div>
      </div>
    );
  }

  // 如果未认证，返回 null（useEffect 会处理重定向）
  // 除非在开发环境下使用了 skip_auth 参数
  if (!isAuthenticated) {
    const skipAuth = typeof window !== 'undefined' && 
      new URLSearchParams(window.location.search).get('skip_auth') === 'true';
    const isDev = process.env.NODE_ENV === 'development';
    
    if (!(isDev && skipAuth)) {
      return null;
    }
  }

  // 处理保存草稿
  const handleSaveDraft = async (data: CreateCharacterInput) => {
    setIsSaving(true);
    try {
      console.log('[CreateCharacter] Saving draft:', data);
      const newCharacter = await createCharacter.mutateAsync(data);
      console.log('[CreateCharacter] Draft saved successfully:', newCharacter);
      toast({
        title: '保存成功',
        description: '角色草稿已保存',
      });
      router.push(`/characters/${newCharacter.id}/edit`);
    } catch (error: any) {
      console.error('[CreateCharacter] Save draft failed:', error);
      toast({
        title: '保存失败',
        description: error.message || '保存失败',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // 处理发布
  const handlePublish = async (data: CreateCharacterInput) => {
    setIsSaving(true);
    try {
      console.log('[CreateCharacter] Publishing character:', data);
      const newCharacter = await createCharacter.mutateAsync({
        ...data,
      });
      console.log('[CreateCharacter] Character published successfully:', newCharacter);
      // TODO: 调用发布接口
      toast({
        title: '发布成功',
        description: '角色已创建并发布',
      });
      router.push(`/characters/${newCharacter.id}`);
    } catch (error: any) {
      console.error('[CreateCharacter] Publish failed:', error);
      toast({
        title: '创建失败',
        description: error.message || '创建失败',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // 处理取消
  const handleCancel = () => {
    console.log('[CreateCharacterPage] Cancel clicked');
    if (confirm('确定要放弃创建吗？未保存的内容将会丢失。')) {
      console.log('[CreateCharacterPage] User confirmed cancel, going back');
      router.back();
    } else {
      console.log('[CreateCharacterPage] User cancelled cancel action');
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
      <CharacterCreatorErrorBoundary>
        <CharacterCreator
          onSaveDraft={handleSaveDraft}
          onPublish={handlePublish}
          onCancel={handleCancel}
          isLoading={isSaving}
        />
      </CharacterCreatorErrorBoundary>
    </div>
  );
}

