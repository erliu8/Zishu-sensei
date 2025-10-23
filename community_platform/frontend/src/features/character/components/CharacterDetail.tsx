/**
 * CharacterDetail - 角色详情组件
 * 展示角色的完整详细信息
 */

import React, { useState } from 'react';
import Link from 'next/link';
import { cn } from '@/shared/utils';
import { Avatar } from '@/shared/components/common/Avatar';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Separator } from '@/shared/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import { Progress } from '@/shared/components/ui/progress';
import type { Character } from '../domain';
import type { AdapterType } from '../types';
import {
  Heart,
  Download,
  Eye,
  Star,
  Calendar,
  User,
  Sparkles,
  Code,
  Mic,
  Image as ImageIcon,
  Users,
  Edit,
  Trash2,
  Archive,
  Share2,
  Copy,
  ExternalLink,
  Package,
  CheckCircle2,
} from 'lucide-react';

export interface CharacterDetailProps {
  /** 角色数据 */
  character: Character;
  /** 是否可编辑（用户是创建者） */
  isEditable?: boolean;
  /** 自定义类名 */
  className?: string;
  /** 操作回调 */
  onEdit?: () => void;
  onDelete?: () => void;
  onClone?: () => void;
  onArchive?: () => void;
  onShare?: () => void;
  onDownload?: () => void;
  onFavorite?: () => void;
  onLike?: () => void;
}

/**
 * CharacterDetail 组件
 */
export const CharacterDetail: React.FC<CharacterDetailProps> = ({
  character,
  isEditable = false,
  className,
  onEdit,
  onDelete,
  onClone,
  onArchive,
  onShare,
  onDownload,
  onFavorite,
  onLike,
}) => {
  const [isFavorited, setIsFavorited] = useState(false);
  const [isLiked, setIsLiked] = useState(false);

  const {
    name,
    displayName,
    description,
    avatarUrl,
    coverUrl,
    tags,
    status,
    visibility,
    creatorName,
    creatorId,
    stats,
    adapters,
    personality,
    expressions,
    voices,
    models,
    version,
    published,
    createdAt,
    updatedAt,
  } = character;

  // 处理收藏
  const handleFavorite = () => {
    setIsFavorited(!isFavorited);
    onFavorite?.();
  };

  // 处理点赞
  const handleLike = () => {
    setIsLiked(!isLiked);
    onLike?.();
  };

  // 获取状态标签
  const getStatusBadge = () => {
    if (!published) {
      return <Badge variant="outline">草稿</Badge>;
    }
    switch (status) {
      case 'published':
        return <Badge className="bg-green-100 text-green-700">已发布</Badge>;
      case 'archived':
        return <Badge variant="outline" className="bg-yellow-100 text-yellow-700">已归档</Badge>;
      default:
        return null;
    }
  };

  // 获取可见性标签
  const getVisibilityBadge = () => {
    switch (visibility) {
      case 'public':
        return <Badge variant="secondary">公开</Badge>;
      case 'private':
        return <Badge variant="outline">私有</Badge>;
      case 'unlisted':
        return <Badge variant="outline">不公开</Badge>;
      default:
        return null;
    }
  };

  // 获取适配器类型图标
  const getAdapterTypeIcon = (type: string) => {
    switch (type) {
      case 'soft':
        return <Sparkles className="h-4 w-4" />;
      case 'hard':
        return <Code className="h-4 w-4" />;
      case 'intelligent':
        return <Package className="h-4 w-4" />;
      default:
        return <Code className="h-4 w-4" />;
    }
  };

  // 获取适配器类型标签
  const getAdapterTypeBadge = (type: string) => {
    switch (type) {
      case 'soft':
        return <Badge variant="secondary">软适配器</Badge>;
      case 'hard':
        return <Badge variant="secondary">硬适配器</Badge>;
      case 'intelligent':
        return <Badge variant="default">智能硬适配器</Badge>;
      default:
        return <Badge variant="secondary">{type}</Badge>;
    }
  };

  // 计算完成度
  const completionPercentage = character instanceof Object && 'getCompletionPercentage' in character
    ? (character as any).getCompletionPercentage()
    : 0;

  return (
    <div className={cn('w-full space-y-6', className)}>
      {/* 封面图 */}
      {coverUrl && (
        <div className="relative w-full h-64 md:h-96 overflow-hidden rounded-lg">
          <img
            src={coverUrl}
            alt={displayName || name}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        </div>
      )}

      {/* 头部信息 */}
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row items-start gap-6">
            {/* 头像 */}
            <Avatar
              src={avatarUrl}
              alt={displayName || name}
              fallback={name}
              size="2xl"
              className="ring-4 ring-white shadow-lg"
            />

            <div className="flex-1 min-w-0 space-y-4">
              {/* 标题和操作 */}
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <CardTitle className="text-3xl truncate">
                      {displayName || name}
                    </CardTitle>
                    {getStatusBadge()}
                    {getVisibilityBadge()}
                  </div>
                  
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <Link
                      href={`/users/${creatorId}`}
                      className="flex items-center gap-1 hover:text-primary"
                    >
                      <User className="h-4 w-4" />
                      <span>{creatorName}</span>
                    </Link>
                    <div className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      <span>{new Date(createdAt).toLocaleDateString('zh-CN')}</span>
                    </div>
                    <div>v{version}</div>
                  </div>
                </div>

                {/* 操作按钮 */}
                <div className="flex flex-wrap gap-2">
                  {!isEditable && (
                    <>
                      <Button onClick={handleLike} variant={isLiked ? 'default' : 'outline'}>
                        <Heart className={cn('h-4 w-4 mr-2', isLiked && 'fill-current')} />
                        {stats.likes}
                      </Button>
                      <Button onClick={handleFavorite} variant={isFavorited ? 'default' : 'outline'}>
                        <Star className={cn('h-4 w-4 mr-2', isFavorited && 'fill-current')} />
                        收藏
                      </Button>
                      <Button onClick={onDownload}>
                        <Download className="h-4 w-4 mr-2" />
                        下载
                      </Button>
                      <Button variant="outline" onClick={onShare}>
                        <Share2 className="h-4 w-4 mr-2" />
                        分享
                      </Button>
                    </>
                  )}

                  {isEditable && (
                    <>
                      <Button onClick={onEdit}>
                        <Edit className="h-4 w-4 mr-2" />
                        编辑
                      </Button>
                      <Button variant="outline" onClick={onClone}>
                        <Copy className="h-4 w-4 mr-2" />
                        克隆
                      </Button>
                      <Button variant="outline" onClick={onArchive}>
                        <Archive className="h-4 w-4 mr-2" />
                        归档
                      </Button>
                      <Button variant="destructive" onClick={onDelete}>
                        <Trash2 className="h-4 w-4 mr-2" />
                        删除
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {/* 统计信息 */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted rounded-lg">
                <div className="text-center">
                  <div className="text-2xl font-bold">{stats.downloads >= 1000 ? `${(stats.downloads / 1000).toFixed(1)}k` : stats.downloads}</div>
                  <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                    <Download className="h-3 w-3" />
                    下载
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">{stats.favorites >= 1000 ? `${(stats.favorites / 1000).toFixed(1)}k` : stats.favorites}</div>
                  <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                    <Star className="h-3 w-3" />
                    收藏
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">{stats.rating.toFixed(1)}</div>
                  <div className="text-xs text-muted-foreground">
                    评分 ({stats.ratingCount})
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">{stats.views >= 1000 ? `${(stats.views / 1000).toFixed(1)}k` : stats.views}</div>
                  <div className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                    <Eye className="h-3 w-3" />
                    浏览
                  </div>
                </div>
              </div>

              {/* 完成度（仅编辑模式） */}
              {isEditable && completionPercentage > 0 && completionPercentage < 100 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">配置完成度</span>
                    <span className="font-medium">{completionPercentage}%</span>
                  </div>
                  <Progress value={completionPercentage} className="h-2" />
                </div>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* 详细信息 */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">概览</TabsTrigger>
          <TabsTrigger value="adapters">适配器</TabsTrigger>
          <TabsTrigger value="personality">人格</TabsTrigger>
          <TabsTrigger value="media">多媒体</TabsTrigger>
          <TabsTrigger value="about">关于</TabsTrigger>
        </TabsList>

        {/* 概览 */}
        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>描述</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground whitespace-pre-wrap">{description}</p>
            </CardContent>
          </Card>

          {tags.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>标签</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {tags.map((tag) => (
                    <Badge key={tag} variant="secondary">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* 适配器 */}
        <TabsContent value="adapters" className="space-y-4">
          {adapters.length === 0 ? (
            <Card>
              <CardContent className="py-8">
                <div className="text-center text-muted-foreground">
                  暂无适配器
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {adapters.map((adapter) => (
                <Card key={adapter.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-muted rounded-lg">
                          {getAdapterTypeIcon(adapter.type)}
                        </div>
                        <div>
                          <CardTitle className="text-lg">{adapter.name}</CardTitle>
                          <CardDescription>
                            v{adapter.version} · 优先级 {adapter.priority}
                          </CardDescription>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {getAdapterTypeBadge(adapter.type)}
                        {adapter.enabled && (
                          <Badge variant="default" className="bg-green-100 text-green-700">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            已启用
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* 人格 */}
        <TabsContent value="personality" className="space-y-4">
          {!personality ? (
            <Card>
              <CardContent className="py-8">
                <div className="text-center text-muted-foreground">
                  暂未配置人格
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>MBTI 人格类型</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{personality.mbtiType}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>大五人格特质</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {Object.entries(personality.bigFive).map(([key, value]) => (
                    <div key={key} className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="capitalize">{key}</span>
                        <span className="font-medium">{value}</span>
                      </div>
                      <Progress value={value} className="h-2" />
                    </div>
                  ))}
                </CardContent>
              </Card>

              {personality.coreTraits.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>核心特征</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {personality.coreTraits.map((trait) => (
                        <Badge key={trait} variant="secondary">
                          {trait}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>

        {/* 多媒体 */}
        <TabsContent value="media" className="space-y-4">
          {/* 表情 */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                <CardTitle>表情</CardTitle>
                <Badge variant="secondary">{expressions?.length || 0}</Badge>
              </div>
            </CardHeader>
            {expressions && expressions.length > 0 ? (
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {expressions.slice(0, 6).map((expr) => (
                    <div key={expr.id} className="text-sm text-center p-2 border rounded">
                      {expr.name || expr.trigger}
                    </div>
                  ))}
                </div>
                {expressions.length > 6 && (
                  <div className="text-center mt-4 text-sm text-muted-foreground">
                    还有 {expressions.length - 6} 个表情...
                  </div>
                )}
              </CardContent>
            ) : (
              <CardContent className="py-4 text-center text-muted-foreground text-sm">
                暂无表情
              </CardContent>
            )}
          </Card>

          {/* 语音 */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Mic className="h-5 w-5" />
                <CardTitle>语音</CardTitle>
                <Badge variant="secondary">{voices?.length || 0}</Badge>
              </div>
            </CardHeader>
            {voices && voices.length > 0 ? (
              <CardContent>
                <div className="space-y-2">
                  {voices.map((voice) => (
                    <div key={voice.id} className="flex items-center justify-between p-2 border rounded">
                      <span className="text-sm">{voice.name}</span>
                      {voice.isDefault && (
                        <Badge variant="secondary" className="text-xs">默认</Badge>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            ) : (
              <CardContent className="py-4 text-center text-muted-foreground text-sm">
                暂无语音
              </CardContent>
            )}
          </Card>

          {/* 模型 */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <ImageIcon className="h-5 w-5" />
                <CardTitle>模型</CardTitle>
                <Badge variant="secondary">{models?.length || 0}</Badge>
              </div>
            </CardHeader>
            {models && models.length > 0 ? (
              <CardContent>
                <div className="space-y-2">
                  {models.map((model) => (
                    <div key={model.id} className="flex items-center justify-between p-2 border rounded">
                      <div>
                        <div className="text-sm font-medium">{model.name}</div>
                        <div className="text-xs text-muted-foreground">{model.type}</div>
                      </div>
                      {model.isDefault && (
                        <Badge variant="secondary" className="text-xs">默认</Badge>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            ) : (
              <CardContent className="py-4 text-center text-muted-foreground text-sm">
                暂无模型
              </CardContent>
            )}
          </Card>
        </TabsContent>

        {/* 关于 */}
        <TabsContent value="about" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>版本信息</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">版本号</span>
                <span className="font-medium">v{version}</span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">创建时间</span>
                <span>{new Date(createdAt).toLocaleString('zh-CN')}</span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">更新时间</span>
                <span>{new Date(updatedAt).toLocaleString('zh-CN')}</span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">状态</span>
                <span>{getStatusBadge()}</span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">可见性</span>
                <span>{getVisibilityBadge()}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>创建者</CardTitle>
            </CardHeader>
            <CardContent>
              <Link
                href={`/users/${creatorId}`}
                className="flex items-center gap-3 p-3 hover:bg-muted rounded-lg transition-colors"
              >
                <Avatar
                  fallback={creatorName || 'U'}
                  size="md"
                />
                <div>
                  <div className="font-medium">{creatorName}</div>
                  <div className="text-xs text-muted-foreground">查看主页</div>
                </div>
                <ExternalLink className="h-4 w-4 ml-auto text-muted-foreground" />
              </Link>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

/**
 * CharacterDetailSkeleton - 骨架屏
 */
export const CharacterDetailSkeleton: React.FC<{ className?: string }> = ({ 
  className 
}) => {
  return (
    <div className={cn('w-full space-y-6', className)}>
      <div className="w-full h-64 bg-gray-200 animate-pulse rounded-lg" />
      
      <Card>
        <CardHeader>
          <div className="flex items-start gap-6">
            <div className="w-20 h-20 rounded-full bg-gray-200 animate-pulse" />
            <div className="flex-1 space-y-4">
              <div className="space-y-2">
                <div className="h-8 bg-gray-200 rounded animate-pulse w-1/2" />
                <div className="h-4 bg-gray-200 rounded animate-pulse w-1/3" />
              </div>
              <div className="grid grid-cols-4 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-16 bg-gray-200 rounded animate-pulse" />
                ))}
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardContent className="py-8">
          <div className="space-y-2">
            <div className="h-4 bg-gray-200 rounded animate-pulse w-full" />
            <div className="h-4 bg-gray-200 rounded animate-pulse w-5/6" />
            <div className="h-4 bg-gray-200 rounded animate-pulse w-4/6" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

