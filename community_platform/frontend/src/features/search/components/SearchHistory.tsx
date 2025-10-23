/**
 * 搜索模块 - SearchHistory 组件
 * 搜索历史记录
 */

'use client';

import { Clock, X, Trash2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/shared/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/shared/components/ui/alert-dialog';
import { cn } from '@/shared/utils/cn';
import { useSearchHistory } from '../hooks/useSearchHistory';
import { SearchType } from '../domain';

export interface SearchHistoryProps {
  /** 点击历史项回调 */
  onSelect?: (query: string, type: SearchType) => void;
  /** 最大显示数量 */
  maxItems?: number;
  /** 是否显示为卡片 */
  showAsCard?: boolean;
  /** 类名 */
  className?: string;
}

/**
 * SearchHistory 组件
 */
export function SearchHistory({
  onSelect,
  maxItems = 20,
  showAsCard = true,
  className,
}: SearchHistoryProps) {
  const { history, removeHistory, clearHistory, isEmpty } = useSearchHistory();

  const displayHistory = history.slice(0, maxItems);

  if (isEmpty) {
    return (
      <div className={cn('text-center', className)}>
        <div className="mb-4 inline-flex items-center justify-center rounded-full bg-muted p-8">
          <Clock className="h-12 w-12 text-muted-foreground" />
        </div>
        <h3 className="mb-2 text-lg font-medium">暂无搜索历史</h3>
        <p className="text-sm text-muted-foreground">
          您的搜索记录将会显示在这里
        </p>
      </div>
    );
  }

  const content = (
    <>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-muted-foreground" />
          <h3 className="font-medium">搜索历史</h3>
          <Badge variant="secondary">{history.length}</Badge>
        </div>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-2">
              <Trash2 className="h-4 w-4" />
              清空
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>确认清空历史记录？</AlertDialogTitle>
              <AlertDialogDescription>
                此操作将删除所有搜索历史记录，且无法恢复。
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>取消</AlertDialogCancel>
              <AlertDialogAction onClick={clearHistory}>确认清空</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <div className="space-y-2">
        {displayHistory.map((item) => (
          <div
            key={item.id}
            className="group flex items-center justify-between rounded-md border p-3 transition-colors hover:bg-accent"
          >
            <button
              className="flex flex-1 items-center gap-3 text-left"
              onClick={() => onSelect?.(item.query, item.type)}
            >
              <Clock className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{item.query}</span>
                  <Badge variant="outline" className="text-xs">
                    {getTypeLabel(item.type)}
                  </Badge>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  {item.resultCount !== undefined && (
                    <span>{item.resultCount} 个结果</span>
                  )}
                  <span>
                    {formatDistanceToNow(item.searchedAt, {
                      addSuffix: true,
                      locale: zhCN,
                    })}
                  </span>
                </div>
              </div>
            </button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 opacity-0 group-hover:opacity-100"
              onClick={() => removeHistory(item.id)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>

      {history.length > maxItems && (
        <p className="mt-4 text-center text-sm text-muted-foreground">
          显示最近 {maxItems} 条记录，共 {history.length} 条
        </p>
      )}
    </>
  );

  if (showAsCard) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>搜索历史</CardTitle>
          <CardDescription>您最近的搜索记录</CardDescription>
        </CardHeader>
        <CardContent>{content}</CardContent>
      </Card>
    );
  }

  return <div className={className}>{content}</div>;
}

/**
 * 获取类型标签
 */
function getTypeLabel(type: SearchType): string {
  const labels: Record<SearchType, string> = {
    [SearchType.ALL]: '全部',
    [SearchType.POST]: '帖子',
    [SearchType.ADAPTER]: '适配器',
    [SearchType.CHARACTER]: '角色',
    [SearchType.USER]: '用户',
  };
  return labels[type] || '全部';
}

