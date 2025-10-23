/**
 * Packaging Page
 * 打包配置页面
 */

'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PackageConfigForm } from '@/features/packaging/components/PackageConfigForm';
import { useCreatePackage } from '@/features/packaging/hooks/useCreatePackage';
import { useCharacters } from '@/features/character/hooks/useCharacters';
import { useAdapters } from '@/features/adapter/hooks/useAdapters';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { ArrowLeft, Package, History, Settings } from 'lucide-react';
import Link from 'next/link';
import type { CreatePackageInput } from '@/features/packaging/domain/packaging.types';
import { TaskStatsCard } from '@/features/packaging/components/TaskStatsCard';
import { usePackagingStats } from '@/features/packaging/hooks/usePackagingHistory';
import { LoadingSpinner } from '@/shared/components/ui/loading-spinner';

/**
 * Packaging Page Component
 */
export default function PackagingPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('new');

  // Hooks
  const createPackageMutation = useCreatePackage();
  const { data: charactersData, isLoading: isLoadingCharacters } = useCharacters({
    page: 1,
    pageSize: 100,
  });
  const { data: adaptersData, isLoading: isLoadingAdapters } = useAdapters({
    page: 1,
    pageSize: 100,
  });
  const { data: stats } = usePackagingStats();

  // 处理提交
  const handleSubmit = async (values: any) => {
    try {
      const input: CreatePackageInput = {
        config: {
          appName: values.appName,
          version: values.version,
          description: values.description || '',
          icon: values.icon || undefined,
          characterId: values.characterId,
          adapterIds: values.adapterIds,
          platform: values.platform,
          architecture: values.architecture,
          format: values.format,
          includeAssets: values.includeAssets,
          compress: values.compress,
          compressionLevel: values.compressionLevel,
          obfuscate: values.obfuscate,
        },
        immediate: true,
        priority: 'normal',
      };

      const response = await createPackageMutation.mutateAsync(input);
      
      // 跳转到任务详情页
      if (response.data?.id) {
        router.push(`/packaging/${response.data.id}`);
      }
    } catch (error) {
      console.error('Failed to create package:', error);
    }
  };

  // 准备数据
  const characters = charactersData?.items?.map((char: any) => ({
    id: char.id,
    name: char.name,
    avatar: char.avatar,
  })) || [];

  const adapters = adaptersData?.items?.map((adapter: any) => ({
    id: adapter.id,
    name: adapter.name,
    version: adapter.version,
  })) || [];

  if (isLoadingCharacters || isLoadingAdapters) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Package className="h-8 w-8" />
              打包服务
            </h1>
            <p className="text-muted-foreground mt-1">
              将你的 AI 角色打包成独立的应用程序
            </p>
          </div>
          <Button variant="outline" asChild>
            <Link href="/packaging/history">
              <History className="h-4 w-4 mr-2" />
              打包历史
            </Link>
          </Button>
        </div>

        {/* Stats */}
        {stats && (
          <TaskStatsCard stats={stats} className="mb-6" />
        )}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="new">
            <Package className="h-4 w-4 mr-2" />
            新建打包
          </TabsTrigger>
          <TabsTrigger value="templates">
            <Settings className="h-4 w-4 mr-2" />
            模板管理
          </TabsTrigger>
        </TabsList>

        {/* 新建打包 */}
        <TabsContent value="new">
          <div className="grid gap-6 lg:grid-cols-3">
            {/* 表单 */}
            <div className="lg:col-span-2">
              <PackageConfigForm
                onSubmit={handleSubmit}
                isSubmitting={createPackageMutation.isPending}
                characters={characters}
                adapters={adapters}
              />
            </div>

            {/* 侧边栏帮助 */}
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">快速开始</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div>
                    <h4 className="font-medium mb-1">1. 基本信息</h4>
                    <p className="text-muted-foreground">
                      填写应用名称、版本号等基本信息
                    </p>
                  </div>
                  <div>
                    <h4 className="font-medium mb-1">2. 选择角色</h4>
                    <p className="text-muted-foreground">
                      选择要打包的 AI 角色
                    </p>
                  </div>
                  <div>
                    <h4 className="font-medium mb-1">3. 配置平台</h4>
                    <p className="text-muted-foreground">
                      选择目标平台、架构和打包格式
                    </p>
                  </div>
                  <div>
                    <h4 className="font-medium mb-1">4. 高级选项</h4>
                    <p className="text-muted-foreground">
                      配置压缩、混淆等高级选项
                    </p>
                  </div>
                  <div>
                    <h4 className="font-medium mb-1">5. 开始打包</h4>
                    <p className="text-muted-foreground">
                      提交配置，系统将开始打包
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">注意事项</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-muted-foreground">
                  <p>• 打包时间取决于配置和平台</p>
                  <p>• 下载链接有效期为 7 天</p>
                  <p>• 可以随时取消正在进行的任务</p>
                  <p>• 失败的任务可以重试</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">平台支持</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1 text-sm text-muted-foreground">
                  <p>✓ Windows (x64, x86, ARM64)</p>
                  <p>✓ macOS (x64, ARM64, Universal)</p>
                  <p>✓ Linux (x64, x86, ARM64, ARM)</p>
                  <p>✓ Android (ARM64, ARM)</p>
                  <p>✓ iOS (ARM64)</p>
                  <p>✓ Web</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* 模板管理 */}
        <TabsContent value="templates">
          <Card>
            <CardHeader>
              <CardTitle>打包模板</CardTitle>
              <CardDescription>
                保存常用的打包配置为模板，快速创建新的打包任务
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 text-muted-foreground">
                <Settings className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>模板功能即将上线</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

