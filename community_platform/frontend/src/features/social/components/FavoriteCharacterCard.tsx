/**
 * FavoriteCharacterCard Component
 * 收藏的角色卡片组件
 */

'use client';

import React from 'react';
import { Heart, MessageCircle, Trash2, Calendar, User } from 'lucide-react';
import { Card, CardContent } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/components/ui/avatar';
import { Badge } from '@/shared/components/ui/badge';
import { cn } from '@/shared/utils/cn';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import type { Favorite } from '../domain/Favorite';

/**
 * FavoriteCharacterCard Props
 */
export interface FavoriteCharacterCardProps {
  /** 收藏项 */
  favorite: Favorite;
  /** 点击卡片回调 */
  onClick?: () => void;
  /** 删除回调 */
  onRemove?: () => void;
  /** 自定义类名 */
  className?: string;
}

/**
 * FavoriteCharacterCard Component
 */
export const FavoriteCharacterCard: React.FC<FavoriteCharacterCardProps> = ({
  favorite,
  onClick,
  onRemove,
  className,
}) => {
  const character = favorite.targetCharacter;

  if (!character) {
    return null;
  }

  const author = character.author;
  const initials = author?.displayName
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || author?.username?.slice(0, 2).toUpperCase() || 'U';

  return (
    <Card className={cn('group hover:shadow-md transition-all', className)}>
      <CardContent className="p-4">
        <div className="space-y-3">
          {/* Header with Character Avatar */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <Avatar className="h-12 w-12 shrink-0">
                <AvatarImage src={character.avatar} alt={character.name} />
                <AvatarFallback>
                  <User className="h-6 w-6" />
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <h3
                  className="font-semibold line-clamp-1 cursor-pointer hover:text-primary transition-colors"
                  onClick={onClick}
                >
                  {character.name}
                </h3>
                {character.title && (
                  <p className="text-xs text-muted-foreground line-clamp-1">
                    {character.title}
                  </p>
                )}
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
              onClick={(e) => {
                e.stopPropagation();
                onRemove?.();
              }}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>

          {/* Description */}
          {character.description && (
            <p
              className="text-sm text-muted-foreground line-clamp-2 cursor-pointer"
              onClick={onClick}
            >
              {character.description}
            </p>
          )}

          {/* Personality Tags */}
          {character.personality && (
            <div className="flex flex-wrap gap-1">
              {character.personality.traits?.slice(0, 3).map((trait, index) => (
                <Badge key={index} variant="secondary" className="text-xs">
                  {trait}
                </Badge>
              ))}
              {character.personality.mbti && (
                <Badge variant="default" className="text-xs">
                  {character.personality.mbti}
                </Badge>
              )}
            </div>
          )}

          {/* Author Info */}
          <div className="flex items-center gap-2">
            <Avatar className="h-6 w-6">
              <AvatarImage src={author?.avatar} alt={author?.displayName} />
              <AvatarFallback className="text-xs">{initials}</AvatarFallback>
            </Avatar>
            <span className="text-xs text-muted-foreground">
              {author?.displayName || '未知创作者'}
            </span>
          </div>

          {/* Stats & Date */}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <Heart className="h-3 w-3" />
                {character.likeCount || 0}
              </span>
              <span className="flex items-center gap-1">
                <MessageCircle className="h-3 w-3" />
                {character.commentCount || 0}
              </span>
            </div>
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {format(new Date(favorite.createdAt), 'MM/dd', { locale: zhCN })}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default FavoriteCharacterCard;

