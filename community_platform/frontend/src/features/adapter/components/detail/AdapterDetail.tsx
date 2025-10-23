/**
 * 适配器详情主组件
 * @module features/adapter/components/detail
 */

'use client';

import { useState } from 'react';
import { 
  Download, 
  Heart, 
  Star, 
  Eye, 
  Share2, 
  Flag, 
  Github, 
  FileText, 
  Globe,
  CheckCircle,
  Code,
  Sparkles,
  Cpu,
} from 'lucide-react';
import {
  Button,
  Card,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Badge,
  Separator,
  Avatar,
  MarkdownViewer,
  ImageGallery,
} from '@/shared/components';
import type { Adapter, AdapterType } from '../../domain';
import { AdapterTypeBadge, CompatibilityBadge } from '../marketplace/AdapterBadge';
import { VersionHistory } from './VersionHistory';
import { DependencyTree } from './DependencyTree';
import { RatingSection } from './RatingSection';
import { ReviewList } from './ReviewList';
import { DownloadStats } from './DownloadStats';
import { CompatibilityInfo } from './CompatibilityInfo';
import { cn } from '@/shared/utils';

/**
 * 适配器详情组件属性
 */
export interface AdapterDetailProps {
  /** 适配器数据 */
  adapter: Adapter;
  /** 下载处理函数 */
  onDownload?: (adapterId: string, version?: string) => void;
  /** 收藏处理函数 */
  onFavorite?: (adapterId: string) => void;
  /** 点赞处理函数 */
  onLike?: (adapterId: string) => void;
  /** 分享处理函数 */
  onShare?: (adapterId: string) => void;
  /** 举报处理函数 */
  onReport?: (adapterId: string) => void;
  /** 是否显示管理按钮（编辑、删除等） */
  showAdminActions?: boolean;
  /** 编辑处理函数 */
  onEdit?: (adapterId: string) => void;
  /** 删除处理函数 */
  onDelete?: (adapterId: string) => void;
  /** 类名 */
  className?: string;
}

/**
 * 获取适配器类型描述
 */
const getAdapterTypeDescription = (type: AdapterType): { icon: React.ReactNode; title: string; description: string } => {
  switch (type) {
    case 'soft':
      return {
        icon: <Code className="h-5 w-5" />,
        title: '软适配器',
        description: '基于提示词工程和RAG技术的AI能力增强，适用于知识问答、内容生成、语言理解等场景。',
      };
    case 'hard':
      return {
        icon: <Cpu className="h-5 w-5" />,
        title: '硬适配器',
        description: '基于原生代码实现的系统级操作能力，适用于桌面操作、文件处理、系统集成等场景。',
      };
    case 'intelligent':
      return {
        icon: <Sparkles className="h-5 w-5" />,
        title: '智能硬适配器',
        description: '基于专业微调模型的智能代码生成和执行，适用于数据分析、办公自动化、代码生成、创意设计等场景。',
      };
    default:
      return {
        icon: <Code className="h-5 w-5" />,
        title: '适配器',
        description: '扩展AI能力的适配器',
      };
  }
};

/**
 * 适配器详情主组件
 */
export function AdapterDetail({
  adapter,
  onDownload,
  onFavorite,
  onLike,
  onShare,
  onReport,
  showAdminActions = false,
  onEdit,
  onDelete,
  className,
}: AdapterDetailProps) {
  const [activeTab, setActiveTab] = useState('overview');
  const typeInfo = getAdapterTypeDescription(adapter.type);

  // 格式化数字显示
  const formatNumber = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  return (
    <div className={cn('space-y-6', className)}>
      {/* 头部信息卡片 */}
      <Card className="p-6">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* 左侧 - 图标和基本信息 */}
          <div className="flex-shrink-0">
            {adapter.icon ? (
              <img
                src={adapter.icon}
                alt={adapter.displayName}
                className="h-24 w-24 rounded-lg object-cover"
              />
            ) : (
              <div className="h-24 w-24 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                {typeInfo.icon}
              </div>
            )}
          </div>

          {/* 中间 - 详细信息 */}
          <div className="flex-1 min-w-0">
            {/* 标题行 */}
            <div className="flex items-start justify-between gap-4 mb-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <h1 className="text-2xl font-bold truncate">{adapter.displayName}</h1>
                  <AdapterTypeBadge type={adapter.type} />
                  {adapter.compatibility && (
                    <CompatibilityBadge level={adapter.compatibility.compatibilityLevel} />
                  )}
                  {adapter.latestVersion?.isStable && (
                    <Badge variant="outline" className="gap-1">
                      <CheckCircle className="h-3 w-3" />
                      稳定版
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground line-clamp-2">{adapter.description}</p>
              </div>
            </div>

            {/* 统计信息 */}
            <div className="flex items-center gap-6 text-sm text-muted-foreground mb-4">
              <div className="flex items-center gap-1">
                <Download className="h-4 w-4" />
                <span>{formatNumber(adapter.stats.downloads)} 下载</span>
              </div>
              <div className="flex items-center gap-1">
                <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                <span>{adapter.stats.rating.toFixed(1)} ({adapter.stats.ratingCount})</span>
              </div>
              <div className="flex items-center gap-1">
                <Heart className="h-4 w-4" />
                <span>{formatNumber(adapter.stats.favorites)} 收藏</span>
              </div>
              <div className="flex items-center gap-1">
                <Eye className="h-4 w-4" />
                <span>{formatNumber(adapter.stats.views)} 浏览</span>
              </div>
            </div>

            {/* 作者和版本信息 */}
            <div className="flex items-center gap-4 mb-4">
              <div className="flex items-center gap-2">
                <Avatar
                  src={adapter.author.avatar}
                  alt={adapter.author.displayName}
                  fallback={adapter.author.displayName[0]}
                  size="sm"
                />
                <div className="text-sm">
                  <div className="font-medium">{adapter.author.displayName}</div>
                  <div className="text-muted-foreground">@{adapter.author.username}</div>
                </div>
              </div>
              <Separator orientation="vertical" className="h-8" />
              <div className="text-sm">
                <div className="font-medium">版本 {adapter.version}</div>
                <div className="text-muted-foreground">
                  更新于 {new Date(adapter.updatedAt).toLocaleDateString('zh-CN')}
                </div>
              </div>
            </div>

            {/* 操作按钮 */}
            <div className="flex items-center gap-2 flex-wrap">
              <Button onClick={() => onDownload?.(adapter.id)} size="lg">
                <Download className="mr-2 h-4 w-4" />
                下载安装
              </Button>
              <Button
                variant={adapter.isFavorited ? 'default' : 'outline'}
                onClick={() => onFavorite?.(adapter.id)}
              >
                <Heart className={cn('mr-2 h-4 w-4', adapter.isFavorited && 'fill-current')} />
                {adapter.isFavorited ? '已收藏' : '收藏'}
              </Button>
              <Button
                variant={adapter.isLiked ? 'default' : 'outline'}
                onClick={() => onLike?.(adapter.id)}
              >
                <Star className={cn('mr-2 h-4 w-4', adapter.isLiked && 'fill-current')} />
                {adapter.isLiked ? '已点赞' : '点赞'}
              </Button>
              <Button variant="outline" onClick={() => onShare?.(adapter.id)}>
                <Share2 className="mr-2 h-4 w-4" />
                分享
              </Button>
              <Button variant="ghost" size="icon" onClick={() => onReport?.(adapter.id)}>
                <Flag className="h-4 w-4" />
              </Button>

              {showAdminActions && (
                <>
                  <Separator orientation="vertical" className="h-8" />
                  <Button variant="outline" onClick={() => onEdit?.(adapter.id)}>
                    编辑
                  </Button>
                  <Button variant="destructive" onClick={() => onDelete?.(adapter.id)}>
                    删除
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* 适配器类型说明 */}
        <Separator className="my-6" />
        <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg">
          <div className="flex-shrink-0 mt-0.5">{typeInfo.icon}</div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold mb-1">{typeInfo.title}</h3>
            <p className="text-sm text-muted-foreground">{typeInfo.description}</p>
          </div>
        </div>
      </Card>

      {/* 标签和分类 */}
      <Card className="p-6">
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-medium mb-2">分类</h3>
            <Badge variant="secondary">{adapter.category.name}</Badge>
          </div>
          {adapter.tags.length > 0 && (
            <div>
              <h3 className="text-sm font-medium mb-2">标签</h3>
              <div className="flex flex-wrap gap-2">
                {adapter.tags.map((tag) => (
                  <Badge key={tag} variant="outline">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          )}
          {adapter.license && (
            <div>
              <h3 className="text-sm font-medium mb-2">许可证</h3>
              <Badge variant="outline">{adapter.license}</Badge>
            </div>
          )}
        </div>
      </Card>

      {/* 外部链接 */}
      {(adapter.repositoryUrl || adapter.documentationUrl || adapter.homepageUrl) && (
        <Card className="p-6">
          <h3 className="text-sm font-medium mb-3">相关链接</h3>
          <div className="flex flex-wrap gap-2">
            {adapter.repositoryUrl && (
              <Button variant="outline" size="sm" asChild>
                <a href={adapter.repositoryUrl} target="_blank" rel="noopener noreferrer">
                  <Github className="mr-2 h-4 w-4" />
                  源代码仓库
                </a>
              </Button>
            )}
            {adapter.documentationUrl && (
              <Button variant="outline" size="sm" asChild>
                <a href={adapter.documentationUrl} target="_blank" rel="noopener noreferrer">
                  <FileText className="mr-2 h-4 w-4" />
                  使用文档
                </a>
              </Button>
            )}
            {adapter.homepageUrl && (
              <Button variant="outline" size="sm" asChild>
                <a href={adapter.homepageUrl} target="_blank" rel="noopener noreferrer">
                  <Globe className="mr-2 h-4 w-4" />
                  项目主页
                </a>
              </Button>
            )}
          </div>
        </Card>
      )}

      {/* 详情标签页 */}
      <Card className="p-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="overview">概览</TabsTrigger>
            <TabsTrigger value="capabilities">能力</TabsTrigger>
            <TabsTrigger value="versions">版本历史</TabsTrigger>
            <TabsTrigger value="dependencies">依赖关系</TabsTrigger>
            <TabsTrigger value="compatibility">兼容性</TabsTrigger>
            <TabsTrigger value="stats">统计数据</TabsTrigger>
            <TabsTrigger value="reviews">评价 ({adapter.stats.ratingCount})</TabsTrigger>
          </TabsList>

          {/* 概览 */}
          <TabsContent value="overview" className="space-y-6">
            {/* 截图和视频 */}
            {(adapter.screenshots && adapter.screenshots.length > 0) && (
              <div>
                <h3 className="text-lg font-semibold mb-4">截图预览</h3>
                <ImageGallery 
                  images={adapter.screenshots.map((src, index) => ({
                    src,
                    alt: `${adapter.displayName} 截图 ${index + 1}`,
                  }))} 
                />
              </div>
            )}

            {adapter.demoVideo && (
              <div>
                <h3 className="text-lg font-semibold mb-4">演示视频</h3>
                <video
                  src={adapter.demoVideo}
                  controls
                  className="w-full rounded-lg"
                  poster={adapter.coverImage}
                />
              </div>
            )}

            {/* 详细说明 */}
            {adapter.readme && (
              <div>
                <h3 className="text-lg font-semibold mb-4">详细说明</h3>
                <MarkdownViewer content={adapter.readme} />
              </div>
            )}
          </TabsContent>

          {/* 能力 */}
          <TabsContent value="capabilities" className="space-y-4">
            <h3 className="text-lg font-semibold mb-4">适配器能力</h3>
            {adapter.capabilities.map((capability, index) => (
              <Card key={index} className="p-4">
                <div className="flex items-start justify-between gap-4 mb-2">
                  <h4 className="font-semibold">{capability.name}</h4>
                  <Badge variant={
                    capability.level === 'expert' ? 'default' :
                    capability.level === 'advanced' ? 'secondary' :
                    'outline'
                  }>
                    {capability.level === 'expert' ? '专家级' :
                     capability.level === 'advanced' ? '高级' :
                     capability.level === 'intermediate' ? '中级' : '基础'}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mb-3">{capability.description}</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="font-medium mb-1">输入类型</div>
                    <div className="flex flex-wrap gap-1">
                      {capability.inputs.map((input) => (
                        <Badge key={input} variant="outline" className="text-xs">
                          {input}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="font-medium mb-1">输出类型</div>
                    <div className="flex flex-wrap gap-1">
                      {capability.outputs.map((output) => (
                        <Badge key={output} variant="outline" className="text-xs">
                          {output}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
                {capability.examples && capability.examples.length > 0 && (
                  <div className="mt-3">
                    <div className="font-medium mb-1 text-sm">示例</div>
                    <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                      {capability.examples.map((example, i) => (
                        <li key={i}>{example}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </Card>
            ))}
          </TabsContent>

          {/* 版本历史 */}
          <TabsContent value="versions">
            <VersionHistory
              versions={adapter.versions || []}
              currentVersion={adapter.version}
              onDownload={(versionId) => onDownload?.(adapter.id, versionId)}
            />
          </TabsContent>

          {/* 依赖关系 */}
          <TabsContent value="dependencies">
            <DependencyTree dependencies={adapter.dependencies} />
          </TabsContent>

          {/* 兼容性 */}
          <TabsContent value="compatibility">
            <CompatibilityInfo
              systemRequirements={adapter.systemRequirements}
              permissions={adapter.permissions}
              compatibility={adapter.compatibility}
            />
          </TabsContent>

          {/* 统计数据 */}
          <TabsContent value="stats">
            <DownloadStats adapterId={adapter.id} stats={adapter.stats} />
          </TabsContent>

          {/* 评价 */}
          <TabsContent value="reviews" className="space-y-6">
            <RatingSection
              adapterId={adapter.id}
              currentRating={adapter.stats.rating}
              ratingCount={adapter.stats.ratingCount}
              userRating={adapter.userRating}
            />
            <Separator />
            <ReviewList adapterId={adapter.id} />
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  );
}

