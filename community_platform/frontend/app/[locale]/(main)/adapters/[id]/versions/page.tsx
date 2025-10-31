/**
 * 适配器版本历史页
 * @route /adapters/[id]/versions
 */

'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAdapter } from '@/features/adapter/hooks';
import { useAdapterVersions } from '@/features/adapter/hooks/useAdapterVersions';
import { useDownloadAdapter } from '@/features/adapter/hooks';
import type { AdapterVersion } from '@/features/adapter/domain';
import { LoadingSpinner, EmptyState } from '@/shared/components/common';
import { 
  Button, 
  Card, 
  Badge,
  Separator,
  Tabs,
  TabsList,
  TabsTrigger,
  MarkdownViewer,
} from '@/shared/components';
import { 
  ArrowLeft, 
  Download, 
  CheckCircle,
  FileArchive,
  Calendar,
  TrendingUp,
  Shield,
  AlertCircle,
} from 'lucide-react';
import { useToast } from '@/shared/hooks/use-toast';
import { cn } from '@/shared/utils';

/**
 * 格式化文件大小
 */
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * 格式化日期
 */
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - date.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return '今天';
  if (diffDays === 1) return '昨天';
  if (diffDays < 7) return `${diffDays} 天前`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} 周前`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} 月前`;
  
  return date.toLocaleDateString('zh-CN');
}

/**
 * 版本卡片组件
 */
interface VersionCardProps {
  version: AdapterVersion;
  isLatest: boolean;
  isCurrent: boolean;
  onDownload: (versionId: string) => void;
}

function VersionCard({ version, isLatest, isCurrent, onDownload }: VersionCardProps) {
  const [showChangelog, setShowChangelog] = useState(false);

  return (
    <Card className={cn(
      'p-6 transition-all hover:shadow-md',
      isCurrent && 'border-primary'
    )}>
      {/* 版本头部 */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-xl font-semibold">v{version.version}</h3>
            {isLatest && (
              <Badge variant="default" className="gap-1">
                <TrendingUp className="h-3 w-3" />
                最新版本
              </Badge>
            )}
            {isCurrent && (
              <Badge variant="outline" className="gap-1">
                <CheckCircle className="h-3 w-3" />
                当前版本
              </Badge>
            )}
            {version.isStable && (
              <Badge variant="secondary" className="gap-1">
                <Shield className="h-3 w-3" />
                稳定版
              </Badge>
            )}
            {!version.isStable && (
              <Badge variant="destructive" className="gap-1">
                <AlertCircle className="h-3 w-3" />
                测试版
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground">{version.description}</p>
        </div>

        <Button onClick={() => onDownload(version.id)} className="ml-4">
          <Download className="mr-2 h-4 w-4" />
          下载
        </Button>
      </div>

      {/* 版本信息 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Calendar className="h-4 w-4" />
          <span>{formatDate(version.publishedAt)}</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <FileArchive className="h-4 w-4" />
          <span>{formatFileSize(version.fileSize)}</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Download className="h-4 w-4" />
          <span>{version.downloads.toLocaleString()} 次下载</span>
        </div>
        {version.compatibility && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle className="h-4 w-4" />
            <span>兼容 {version.compatibility.minPlatformVersion}+</span>
          </div>
        )}
      </div>

      {/* 更新日志 */}
      {version.changelog && (
        <div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowChangelog(!showChangelog)}
            className="mb-2"
          >
            {showChangelog ? '隐藏' : '查看'}更新日志
          </Button>

          {showChangelog && (
            <div className="mt-3 p-4 bg-muted/50 rounded-lg">
              <MarkdownViewer content={version.changelog} />
            </div>
          )}
        </div>
      )}

      {/* 依赖和要求 */}
      {(version.dependencies.length > 0 || version.systemRequirements) && (
        <Separator className="my-4" />
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {version.dependencies.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-2">依赖项</h4>
            <div className="flex flex-wrap gap-2">
              {version.dependencies.map((dep) => (
                <Badge key={dep.id} variant="outline" className="text-xs">
                  {dep.dependencyName} {dep.versionRequirement}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {version.systemRequirements && (
          <div>
            <h4 className="text-sm font-medium mb-2">系统要求</h4>
            <div className="text-sm text-muted-foreground space-y-1">
              {version.systemRequirements.minMemory && (
                <div>最小内存: {version.systemRequirements.minMemory} MB</div>
              )}
              {version.systemRequirements.pythonVersion && (
                <div>Python: {version.systemRequirements.pythonVersion}</div>
              )}
              {version.systemRequirements.nodeVersion && (
                <div>Node.js: {version.systemRequirements.nodeVersion}</div>
              )}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

/**
 * 版本历史页面组件
 */
export default function AdapterVersionsPage() {
  const params = useParams();
  const router = useRouter();
  const adapterId = params['id'] as string;
  const { toast } = useToast();

  const [filterType, setFilterType] = useState<'all' | 'stable' | 'beta'>('all');

  // 获取适配器信息
  const { data: adapter, isLoading: adapterLoading } = useAdapter(adapterId);

  // 获取版本列表
  const { data: versions, isLoading: versionsLoading } = useAdapterVersions(adapterId);

  // 下载 mutation
  const downloadAdapter = useDownloadAdapter();

  // 处理下载
  const handleDownload = async (versionId: string) => {
    try {
      const version = versions?.find(v => v.id === versionId);
      const downloadUrl = await downloadAdapter.mutateAsync({ 
        id: adapterId, 
        version: version?.version 
      });

      // 触发浏览器下载
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `${adapter?.name || 'adapter'}_${version?.version}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({
        title: '成功',
        description: '开始下载',
      });
    } catch (error: any) {
      toast({
        title: '错误',
        description: error.message || '下载失败',
        variant: 'destructive',
      });
    }
  };

  // 返回详情页
  const handleBack = () => {
    router.push(`/adapters/${adapterId}`);
  };

  // 筛选版本
  const filteredVersions = versions?.filter(version => {
    if (filterType === 'stable') return version.isStable;
    if (filterType === 'beta') return !version.isStable;
    return true;
  }) || [];

  const isLoading = adapterLoading || versionsLoading;

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[60vh]">
          <LoadingSpinner size="lg" />
        </div>
      </div>
    );
  }

  if (!adapter || !versions) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Button variant="ghost" onClick={handleBack} className="mb-6">
          <ArrowLeft className="mr-2 h-4 w-4" />
          返回
        </Button>
        <div className="flex items-center justify-center min-h-[60vh]">
          <EmptyState
            title="加载失败"
            description="无法加载版本历史"
            action={{
              label: '返回详情页',
              onClick: handleBack,
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* 顶部导航 */}
      <Button variant="ghost" onClick={handleBack} className="mb-6">
        <ArrowLeft className="mr-2 h-4 w-4" />
        返回详情页
      </Button>

      {/* 页面头部 */}
      <div className="mb-8">
        <div className="flex items-start gap-4 mb-4">
          {adapter.icon && (
            <img
              src={adapter.icon}
              alt={adapter.displayName}
              className="h-16 w-16 rounded-lg object-cover"
            />
          )}
          <div className="flex-1">
            <h1 className="text-3xl font-bold mb-2">{adapter.displayName}</h1>
            <p className="text-muted-foreground">版本历史</p>
          </div>
        </div>

        <Separator className="my-6" />

        {/* 筛选标签页 */}
        <Tabs value={filterType} onValueChange={(v) => setFilterType(v as any)}>
          <TabsList>
            <TabsTrigger value="all">
              全部版本 ({versions.length})
            </TabsTrigger>
            <TabsTrigger value="stable">
              稳定版 ({versions.filter(v => v.isStable).length})
            </TabsTrigger>
            <TabsTrigger value="beta">
              测试版 ({versions.filter(v => !v.isStable).length})
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* 版本列表 */}
      {filteredVersions.length === 0 ? (
        <EmptyState
          title="暂无版本"
          description={
            filterType === 'stable' 
              ? '暂无稳定版本' 
              : filterType === 'beta'
              ? '暂无测试版本'
              : '暂无任何版本'
          }
        />
      ) : (
        <div className="space-y-4">
          {filteredVersions.map((version) => (
            <VersionCard
              key={version.id}
              version={version}
              isLatest={version.isLatest}
              isCurrent={version.version === adapter.version}
              onDownload={handleDownload}
            />
          ))}
        </div>
      )}

      {/* 统计信息 */}
      {versions.length > 0 && (
        <Card className="p-6 mt-8">
          <h3 className="text-lg font-semibold mb-4">统计信息</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div>
              <div className="text-2xl font-bold">
                {versions.length}
              </div>
              <div className="text-sm text-muted-foreground">总版本数</div>
            </div>
            <div>
              <div className="text-2xl font-bold">
                {versions.filter(v => v.isStable).length}
              </div>
              <div className="text-sm text-muted-foreground">稳定版本</div>
            </div>
            <div>
              <div className="text-2xl font-bold">
                {versions.reduce((sum, v) => sum + v.downloads, 0).toLocaleString()}
              </div>
              <div className="text-sm text-muted-foreground">总下载量</div>
            </div>
            <div>
              <div className="text-2xl font-bold">
                {versions[0] ? formatDate(versions[0].publishedAt) : '-'}
              </div>
              <div className="text-sm text-muted-foreground">最新更新</div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

