/**
 * 搜索模块 - SearchBar 组件
 * 全局搜索栏，支持搜索建议和历史记录
 */

'use client';

import { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Search, X, Clock, TrendingUp, Loader2 } from 'lucide-react';
import { Input } from '@/shared/components/ui/input';
import { Button } from '@/shared/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/shared/components/ui/popover';
import { cn } from '@/shared/utils/cn';
import { useDebounce } from '@/shared/hooks/useDebounce';
import { useSearchSuggestions, useTrendingSearch } from '../hooks/useSearch';
import { useSearchHistory } from '../hooks/useSearchHistory';
import { SearchType } from '../domain';

export interface SearchBarProps {
  /** 类名 */
  className?: string;
  /** 占位符 */
  placeholder?: string;
  /** 初始搜索关键词 */
  defaultValue?: string;
  /** 是否显示建议 */
  showSuggestions?: boolean;
  /** 是否显示历史记录 */
  showHistory?: boolean;
  /** 是否显示热门搜索 */
  showTrending?: boolean;
  /** 搜索类型 */
  type?: SearchType;
  /** 搜索回调 */
  onSearch?: (query: string) => void;
  /** 尺寸 */
  size?: 'sm' | 'md' | 'lg';
}

/**
 * SearchBar 组件
 */
export function SearchBar({
  className,
  placeholder = '搜索帖子、适配器、角色...',
  defaultValue = '',
  showSuggestions = true,
  showHistory = true,
  showTrending = true,
  type,
  onSearch,
  size = 'md',
}: SearchBarProps) {
  const router = useRouter();
  const [query, setQuery] = useState(defaultValue);
  const [isOpen, setIsOpen] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // 防抖搜索词
  const debouncedQuery = useDebounce(query, 300);

  // 搜索建议
  const { data: suggestions, isLoading: isLoadingSuggestions } = useSearchSuggestions(
    debouncedQuery,
    type,
  );

  // 热门搜索
  const { data: trending } = useTrendingSearch(5);

  // 搜索历史
  const { removeHistory, clearHistory, getRecent } = useSearchHistory();

  // 是否显示建议面板
  const showSuggestionsPanel =
    isFocused &&
    (showSuggestions && suggestions && suggestions.length > 0) ||
    (showHistory && getRecent(5).length > 0) ||
    (showTrending && trending && trending.length > 0);

  /**
   * 执行搜索
   */
  const handleSearch = useCallback(
    (searchQuery: string) => {
      const trimmed = searchQuery.trim();
      if (!trimmed) return;

      setIsOpen(false);
      setIsFocused(false);
      inputRef.current?.blur();

      if (onSearch) {
        onSearch(trimmed);
      } else {
        // 导航到搜索结果页
        const params = new URLSearchParams({ q: trimmed });
        if (type) {
          params.append('type', type);
        }
        router.push(`/search?${params.toString()}`);
      }
    },
    [onSearch, router, type]
  );

  /**
   * 处理键盘事件
   */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        handleSearch(query);
      } else if (e.key === 'Escape') {
        setIsOpen(false);
        setIsFocused(false);
        inputRef.current?.blur();
      }
    },
    [query, handleSearch]
  );

  /**
   * 清空输入
   */
  const handleClear = useCallback(() => {
    setQuery('');
    inputRef.current?.focus();
  }, []);

  /**
   * 选择建议
   */
  const handleSelectSuggestion = useCallback(
    (text: string) => {
      setQuery(text);
      handleSearch(text);
    },
    [handleSearch]
  );

  /**
   * 删除历史记录
   */
  const handleRemoveHistory = useCallback(
    (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      removeHistory(id);
    },
    [removeHistory]
  );

  // 尺寸样式
  const sizeClasses = {
    sm: 'h-8 text-sm',
    md: 'h-10 text-base',
    lg: 'h-12 text-lg',
  };

  return (
    <div className={cn('relative', className)}>
      <Popover open={isOpen && showSuggestionsPanel} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => {
                setIsFocused(true);
                setIsOpen(true);
              }}
              onBlur={() => {
                // 延迟关闭，以便点击建议项
                setTimeout(() => setIsFocused(false), 200);
              }}
              placeholder={placeholder}
              className={cn('pl-9 pr-9', sizeClasses[size])}
            />
            {query && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 h-6 w-6 -translate-y-1/2"
                onClick={handleClear}
              >
                <X className="h-3 w-3" />
              </Button>
            )}
            {isLoadingSuggestions && (
              <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
            )}
          </div>
        </PopoverTrigger>

        <PopoverContent
          className="w-[var(--radix-popover-trigger-width)] p-2"
          align="start"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <div className="space-y-2">
            {/* 搜索建议 */}
            {showSuggestions && suggestions && suggestions.length > 0 && (
              <div>
                <div className="mb-2 flex items-center gap-2 px-2 text-xs font-medium text-muted-foreground">
                  <Search className="h-3 w-3" />
                  搜索建议
                </div>
                <div className="space-y-1">
                  {suggestions.map((suggestion, index) => (
                    <button
                      key={index}
                      className="w-full rounded-md px-3 py-2 text-left text-sm hover:bg-accent"
                      onClick={() => handleSelectSuggestion(suggestion.text)}
                    >
                      {suggestion.text}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 搜索历史 */}
            {showHistory && getRecent(5).length > 0 && (
              <div>
                <div className="mb-2 flex items-center justify-between px-2">
                  <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    最近搜索
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-auto px-2 py-1 text-xs"
                    onClick={clearHistory}
                  >
                    清空
                  </Button>
                </div>
                <div className="space-y-1">
                  {getRecent(5).map((item) => (
                    <div
                      key={item.id}
                      className="group flex items-center justify-between rounded-md px-3 py-2 hover:bg-accent"
                    >
                      <button
                        className="flex-1 text-left text-sm"
                        onClick={() => handleSelectSuggestion(item.query)}
                      >
                        {item.query}
                      </button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100"
                        onClick={(e) => handleRemoveHistory(e, item.id)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 热门搜索 */}
            {showTrending && trending && trending.length > 0 && (
              <div>
                <div className="mb-2 flex items-center gap-2 px-2 text-xs font-medium text-muted-foreground">
                  <TrendingUp className="h-3 w-3" />
                  热门搜索
                </div>
                <div className="space-y-1">
                  {trending.map((item, index) => (
                    <button
                      key={index}
                      className="w-full rounded-md px-3 py-2 text-left text-sm hover:bg-accent"
                      onClick={() => handleSelectSuggestion(item.query)}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            'flex h-5 w-5 items-center justify-center rounded text-xs font-medium',
                            index < 3
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted text-muted-foreground'
                          )}
                        >
                          {item.rank}
                        </span>
                        <span className="flex-1">{item.query}</span>
                        {item.rankChange !== undefined && (
                          <span
                            className={cn(
                              'text-xs',
                              item.rankChange > 0
                                ? 'text-green-600'
                                : item.rankChange < 0
                                ? 'text-red-600'
                                : 'text-muted-foreground'
                            )}
                          >
                            {item.rankChange > 0 && '+'}
                            {item.rankChange}
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

