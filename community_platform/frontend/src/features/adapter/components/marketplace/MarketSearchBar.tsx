/**
 * 适配器市场搜索栏组件
 * @module features/adapter/components/marketplace
 */

import React, { useState, useCallback, useEffect } from 'react';
import { Input } from '@/shared/components/ui/input';
import { Button } from '@/shared/components/ui/button';
import { Search, X, TrendingUp } from 'lucide-react';
import { cn } from '@/shared/utils';
import { useDebounce } from '@/shared/hooks';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from '@/shared/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/shared/components/ui/popover';

/**
 * 搜索建议项
 */
export interface SearchSuggestion {
  text: string;
  type: 'name' | 'tag' | 'category' | 'author';
  count?: number;
}

/**
 * 市场搜索栏属性
 */
export interface MarketSearchBarProps {
  /** 搜索关键词 */
  value?: string;
  /** 搜索变化回调 */
  onChange?: (value: string) => void;
  /** 搜索提交回调 */
  onSearch?: (value: string) => void;
  /** 获取搜索建议回调 */
  onGetSuggestions?: (query: string) => Promise<SearchSuggestion[]>;
  /** 占位符 */
  placeholder?: string;
  /** 是否显示建议 */
  showSuggestions?: boolean;
  /** 热门搜索词 */
  trendingSearches?: string[];
  /** 自定义样式 */
  className?: string;
}

/**
 * 市场搜索栏组件
 */
export const MarketSearchBar: React.FC<MarketSearchBarProps> = ({
  value = '',
  onChange,
  onSearch,
  onGetSuggestions,
  placeholder = '搜索适配器...',
  showSuggestions = true,
  trendingSearches = [],
  className,
}) => {
  const [searchValue, setSearchValue] = useState(value);
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [showSuggestionPopover, setShowSuggestionPopover] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // 防抖搜索
  const debouncedSearchValue = useDebounce(searchValue, 300);

  // 获取搜索建议
  const fetchSuggestions = useCallback(async (query: string) => {
    if (!query.trim() || !onGetSuggestions) {
      setSuggestions([]);
      return;
    }

    try {
      setIsLoading(true);
      const results = await onGetSuggestions(query);
      setSuggestions(results);
    } catch (error) {
      console.error('Failed to fetch suggestions:', error);
      setSuggestions([]);
    } finally {
      setIsLoading(false);
    }
  }, [onGetSuggestions]);

  // 监听防抖后的搜索词变化
  useEffect(() => {
    if (showSuggestions && debouncedSearchValue) {
      fetchSuggestions(debouncedSearchValue);
    }
  }, [debouncedSearchValue, showSuggestions, fetchSuggestions]);

  // 处理输入变化
  const handleInputChange = (newValue: string) => {
    setSearchValue(newValue);
    onChange?.(newValue);
    
    if (newValue.trim()) {
      setShowSuggestionPopover(true);
    }
  };

  // 处理搜索
  const handleSearch = () => {
    if (searchValue.trim()) {
      onSearch?.(searchValue.trim());
      setShowSuggestionPopover(false);
    }
  };

  // 处理清除
  const handleClear = () => {
    setSearchValue('');
    onChange?.('');
    setSuggestions([]);
    setShowSuggestionPopover(false);
  };

  // 选择建议
  const handleSelectSuggestion = (suggestion: string) => {
    setSearchValue(suggestion);
    onChange?.(suggestion);
    onSearch?.(suggestion);
    setShowSuggestionPopover(false);
  };

  return (
    <div className={cn('relative', className)}>
      <Popover open={showSuggestionPopover && showSuggestions} onOpenChange={setShowSuggestionPopover}>
        <PopoverTrigger asChild>
          <div className="relative">
            {/* 搜索图标 */}
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            
            {/* 搜索输入框 */}
            <Input
              type="text"
              value={searchValue}
              onChange={(e) => handleInputChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleSearch();
                }
              }}
              placeholder={placeholder}
              className="pl-10 pr-20"
            />

            {/* 右侧操作按钮 */}
            <div className="absolute right-2 top-1/2 flex -translate-y-1/2 gap-1">
              {searchValue && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleClear}
                  className="h-7 px-2"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
              <Button
                size="sm"
                onClick={handleSearch}
                className="h-7"
              >
                搜索
              </Button>
            </div>
          </div>
        </PopoverTrigger>

        {/* 搜索建议弹窗 */}
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command>
            <CommandList>
              {/* 加载状态 */}
              {isLoading && (
                <CommandEmpty>搜索中...</CommandEmpty>
              )}

              {/* 搜索建议 */}
              {!isLoading && suggestions.length > 0 && (
                <CommandGroup heading="搜索建议">
                  {suggestions.map((suggestion, index) => (
                    <CommandItem
                      key={index}
                      onSelect={() => handleSelectSuggestion(suggestion.text)}
                    >
                      <Search className="mr-2 h-4 w-4" />
                      <span className="flex-1">{suggestion.text}</span>
                      {suggestion.count !== undefined && (
                        <span className="text-xs text-muted-foreground">
                          {suggestion.count} 个结果
                        </span>
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}

              {/* 热门搜索 */}
              {!isLoading && suggestions.length === 0 && trendingSearches.length > 0 && (
                <CommandGroup heading="热门搜索">
                  {trendingSearches.map((search: string) => (
                    <CommandItem
                      key={search}
                      onSelect={() => handleSelectSuggestion(search)}
                    >
                      <TrendingUp className="mr-2 h-4 w-4 text-primary" />
                      <span>{search}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}

              {/* 空状态 */}
              {!isLoading && suggestions.length === 0 && trendingSearches.length === 0 && (
                <CommandEmpty>暂无搜索建议</CommandEmpty>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
};

