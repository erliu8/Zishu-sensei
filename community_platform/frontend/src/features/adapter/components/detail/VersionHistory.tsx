/**
 * 版本历史组件
 * @module features/adapter/components/detail
 */

'use client';

import { useState } from 'react';
import { Download, CheckCircle, Clock, FileText, AlertCircle } from 'lucide-react';
import {
  Button,
  Card,
  Badge,
  Separator,
  MarkdownViewer,
  Collapse,
  EmptyState,
} from '@/shared/components';
import type { AdapterVersion } from '../../domain';
import { cn } from '@/shared/utils';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';

/**
 * 版本历史组件属性
 */
export interface VersionHistoryProps {
  /** 版本列表 */
  versions: AdapterVersion[];
  /** 当前版本 */
  currentVersion?: string;
  /** 下载处理函数 */
  onDownload?: (versionId: string) => void;
  /** 类名 */
  className?: string;
}

/**
 * 格式化文件大小
 */
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

/**
 * 版本历史组件
 */
export function VersionHistory({
  versions,
  currentVersion,
  onDownload,
  className,
}: VersionHistoryProps) {
  const [expandedVersions, setExpandedVersions] = useState<Set<string>>(new Set([versions[0]?.id]));

  const toggleVersion = (versionId: string) => {
    setExpandedVersions((prev) => {
      const next = new Set(prev);
      if (next.has(versionId)) {
        next.delete(versionId);
      } else {
        next.add(versionId);
      }
      return next;
    });
  };

  if (versions.length === 0) {
    return (
      <EmptyState
        icon={<FileText className="h-12 w-12" />}
        title="暂无版本历史"
        description="该适配器还没有发布任何版本"
      />
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">版本历史</h3>
        <div className="text-sm text-muted-foreground">共 {versions.length} 个版本</div>
      </div>

      <div className="space-y-3">
        {versions.map((version, index) => {
          const isExpanded = expandedVersions.has(version.id);
          const isCurrent = version.version === currentVersion;
          const isLatest = version.isLatest;

          return (
            <Card key={version.id} className={cn('overflow-hidden', isCurrent && 'ring-2 ring-primary')}>
              {/* 版本头部 */}
              <div
                className="p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => toggleVersion(version.id)}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <h4 className="font-semibold">版本 {version.version}</h4>
                      {isLatest && (
                        <Badge variant="default">
                          <CheckCircle className="mr-1 h-3 w-3" />
                          最新版
                        </Badge>
                      )}
                      {isCurrent && (
                        <Badge variant="secondary">当前版本</Badge>
                      )}
                      {version.isStable ? (
                        <Badge variant="outline" className="gap-1">
                          <CheckCircle className="h-3 w-3" />
                          稳定版
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="gap-1">
                          <AlertCircle className="h-3 w-3" />
                          测试版
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {version.description}
                    </p>
                  </div>

                  <div className="flex-shrink-0 text-right">
                    <Button
                      size="sm"
                      variant={isCurrent ? 'outline' : 'default'}
                      onClick={(e) => {
                        e.stopPropagation();
                        onDownload?.(version.id);
                      }}
                      disabled={isCurrent}
                    >
                      <Download className="mr-2 h-4 w-4" />
                      {isCurrent ? '已安装' : '下载'}
                    </Button>
                  </div>
                </div>

                {/* 版本元信息 */}
                <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    <span>
                      {formatDistanceToNow(new Date(version.publishedAt), {
                        addSuffix: true,
                        locale: zhCN,
                      })}
                    </span>
                  </div>
                  <Separator orientation="vertical" className="h-4" />
                  <span>{formatFileSize(version.fileSize)}</span>
                  <Separator orientation="vertical" className="h-4" />
                  <span>{version.downloads.toLocaleString()} 次下载</span>
                </div>
              </div>

              {/* 展开的版本详情 */}
              <Collapse isOpen={isExpanded}>
                <Separator />
                <div className="p-4 space-y-4">
                  {/* 更新日志 */}
                  {version.changelog && (
                    <div>
                      <h5 className="font-medium mb-2">更新日志</h5>
                      <div className="prose prose-sm max-w-none dark:prose-invert">
                        <MarkdownViewer content={version.changelog} />
                      </div>
                    </div>
                  )}

                  {/* 依赖信息 */}
                  {version.dependencies.length > 0 && (
                    <div>
                      <h5 className="font-medium mb-2">依赖项 ({version.dependencies.length})</h5>
                      <div className="space-y-2">
                        {version.dependencies.map((dep) => (
                          <div
                            key={dep.id}
                            className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-sm">{dep.dependencyName}</div>
                              {dep.description && (
                                <div className="text-xs text-muted-foreground">
                                  {dep.description}
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs">
                                {dep.versionRequirement}
                              </Badge>
                              {dep.required && (
                                <Badge variant="destructive" className="text-xs">
                                  必需
                                </Badge>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 兼容性信息 */}
                  {version.compatibility && (
                    <div>
                      <h5 className="font-medium mb-2">兼容性</h5>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">最低平台版本: </span>
                          <span className="font-mono">{version.compatibility.minPlatformVersion}</span>
                        </div>
                        {version.compatibility.maxPlatformVersion && (
                          <div>
                            <span className="text-muted-foreground">最高平台版本: </span>
                            <span className="font-mono">{version.compatibility.maxPlatformVersion}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* 系统要求 */}
                  <div>
                    <h5 className="font-medium mb-2">系统要求</h5>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                      {version.systemRequirements.minMemory && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">最小内存:</span>
                          <span>{version.systemRequirements.minMemory} MB</span>
                        </div>
                      )}
                      {version.systemRequirements.minDiskSpace && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">最小磁盘空间:</span>
                          <span>{version.systemRequirements.minDiskSpace} MB</span>
                        </div>
                      )}
                      {version.systemRequirements.pythonVersion && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Python版本:</span>
                          <span className="font-mono">{version.systemRequirements.pythonVersion}</span>
                        </div>
                      )}
                      {version.systemRequirements.nodeVersion && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Node.js版本:</span>
                          <span className="font-mono">{version.systemRequirements.nodeVersion}</span>
                        </div>
                      )}
                      {version.systemRequirements.gpuRequired !== undefined && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">GPU要求:</span>
                          <span>{version.systemRequirements.gpuRequired ? '需要' : '不需要'}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 文件哈希 */}
                  <div>
                    <h5 className="font-medium mb-2">文件验证</h5>
                    <div className="p-3 rounded-lg bg-muted/50 font-mono text-xs break-all">
                      SHA256: {version.fileHash}
                    </div>
                  </div>
                </div>
              </Collapse>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

