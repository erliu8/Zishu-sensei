/**
 * SearchBar - 搜索栏组件
 * 全局搜索对话框，支持搜索帖子、适配器、角色等
 */

'use client';

import { FC, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Search, FileText, Package, Users, TrendingUp, Clock } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { Input } from '@/shared/components/ui/input';
import { Badge } from '@/shared/components/ui/badge';
import { ScrollArea } from '@/shared/components/ui/scroll-area';
import { cn } from '@/shared/utils/cn';

export interface SearchBarProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface SearchResult {
  id: string;
  type: 'post' | 'adapter' | 'character';
  title: string;
  description?: string;
  url: string;
  badge?: string;
}

const typeConfig = {
  post: { label: '帖子', icon: FileText, color: 'text-blue-500' },
  adapter: { label: '适配器', icon: Package, color: 'text-green-500' },
  character: { label: '角色', icon: Users, color: 'text-purple-500' },
};

// 模拟热门搜索
const popularSearches = [
  '智能对话适配器',
  'AI助手角色',
  '新手教程',
  '社区指南',
];

// 模拟最近搜索
const recentSearches = [
  '如何创建角色',
  '适配器开发',
];

export const SearchBar: FC<SearchBarProps> = ({ open, onOpenChange }) => {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // 模拟搜索
  const handleSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }

    setIsSearching(true);
    
    // TODO: 实现真实的搜索API调用
    setTimeout(() => {
      const mockResults: SearchResult[] = [
        {
          id: '1',
          type: 'post',
          title: `关于 "${searchQuery}" 的帖子`,
          description: '这是一篇关于该主题的热门帖子',
          url: '/posts/1',
          badge: '热门',
        },
        {
          id: '2',
          type: 'adapter',
          title: `${searchQuery} 适配器`,
          description: '一个功能强大的适配器',
          url: '/adapters/2',
        },
        {
          id: '3',
          type: 'character',
          title: `${searchQuery} 角色`,
          description: '一个有趣的AI角色',
          url: '/characters/3',
        },
      ];
      setResults(mockResults);
      setIsSearching(false);
    }, 300);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      handleSearch(query);
    }, 300);

    return () => clearTimeout(timer);
  }, [query, handleSearch]);

  // 键盘快捷键
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        onOpenChange(true);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onOpenChange]);

  const handleSelectResult = (url: string) => {
    router.push(url);
    onOpenChange(false);
    setQuery('');
  };

  const handleQuickSearch = (searchQuery: string) => {
    setQuery(searchQuery);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0">
        <DialogHeader className="px-6 pt-6 pb-0">
          <DialogTitle className="sr-only">搜索</DialogTitle>
          <DialogDescription className="sr-only">
            搜索帖子、适配器、角色等内容
          </DialogDescription>
        </DialogHeader>

        {/* 搜索输入框 */}
        <div className="flex items-center gap-3 px-6 py-4 border-b">
          <Search className="h-5 w-5 text-muted-foreground" />
          <Input
            placeholder="搜索帖子、适配器、角色..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 text-base"
            autoFocus
          />
          {isSearching && (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          )}
        </div>

        <ScrollArea className="max-h-[400px]">
          {query.trim() === '' ? (
            // 显示热门搜索和最近搜索
            <div className="px-6 py-4 space-y-6">
              {/* 热门搜索 */}
              <div>
                <div className="flex items-center gap-2 mb-3 text-sm font-medium text-muted-foreground">
                  <TrendingUp className="h-4 w-4" />
                  <span>热门搜索</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {popularSearches.map((search, index) => (
                    <Badge
                      key={index}
                      variant="secondary"
                      className="cursor-pointer hover:bg-secondary/80"
                      onClick={() => handleQuickSearch(search)}
                    >
                      {search}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* 最近搜索 */}
              {recentSearches.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3 text-sm font-medium text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span>最近搜索</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {recentSearches.map((search, index) => (
                      <Badge
                        key={index}
                        variant="outline"
                        className="cursor-pointer hover:bg-accent"
                        onClick={() => handleQuickSearch(search)}
                      >
                        {search}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : results.length > 0 ? (
            // 显示搜索结果
            <div className="py-2">
              {results.map((result) => {
                const Icon = typeConfig[result.type].icon;
                return (
                  <button
                    key={result.id}
                    onClick={() => handleSelectResult(result.url)}
                    className="w-full flex items-start gap-3 px-6 py-3 hover:bg-accent transition-colors text-left"
                  >
                    <div className={cn('mt-1', typeConfig[result.type].color)}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium line-clamp-1">{result.title}</p>
                        {result.badge && (
                          <Badge variant="secondary" className="text-xs">
                            {result.badge}
                          </Badge>
                        )}
                      </div>
                      {result.description && (
                        <p className="text-sm text-muted-foreground line-clamp-1">
                          {result.description}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        {typeConfig[result.type].label}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            // 无结果
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Search className="h-12 w-12 text-muted-foreground/50 mb-2" />
              <p className="text-sm text-muted-foreground">
                未找到相关结果
              </p>
            </div>
          )}
        </ScrollArea>

        {/* 底部提示 */}
        <div className="px-6 py-3 border-t bg-muted/30">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1">
                <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                  ↑↓
                </kbd>
                导航
              </span>
              <span className="flex items-center gap-1">
                <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                  Enter
                </kbd>
                选择
              </span>
              <span className="flex items-center gap-1">
                <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                  Esc
                </kbd>
                关闭
              </span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

