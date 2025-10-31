/**
 * ShareButton Component
 * 社交分享按钮组件
 */

'use client';

import React, { useState } from 'react';
import { Share2, Copy, Facebook, Twitter, Mail, Link as LinkIcon, Check } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import { useToast } from '@/shared/components/ui/use-toast';
import { cn } from '@/shared/utils/cn';

/**
 * ShareButton Props
 */
export interface ShareButtonProps {
  /** 分享的URL */
  url: string;
  /** 分享标题 */
  title?: string;
  /** 分享描述 */
  description?: string;
  /** 按钮变体 */
  variant?: 'default' | 'outline' | 'ghost' | 'secondary';
  /** 按钮大小 */
  size?: 'default' | 'sm' | 'lg' | 'icon';
  /** 自定义类名 */
  className?: string;
  /** 是否禁用 */
  disabled?: boolean;
  /** 是否只显示图标 */
  iconOnly?: boolean;
  /** 启用的分享平台 */
  platforms?: SharePlatform[];
  /** 分享成功回调 */
  onShareSuccess?: (platform: string) => void;
}

/**
 * 分享平台类型
 */
export type SharePlatform =
  | 'copy'
  | 'twitter'
  | 'facebook'
  | 'linkedin'
  | 'email'
  | 'whatsapp'
  | 'telegram';

/**
 * 分享平台配置
 */
interface SharePlatformConfig {
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  getUrl: (url: string, title?: string, description?: string) => string;
  color: string;
}

const sharePlatformConfigs: Record<SharePlatform, SharePlatformConfig> = {
  copy: {
    name: '复制链接',
    icon: Copy,
    getUrl: (url) => url,
    color: 'text-gray-600',
  },
  twitter: {
    name: 'Twitter',
    icon: Twitter,
    getUrl: (url, title) =>
      `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title || '')}`,
    color: 'text-[#1DA1F2]',
  },
  facebook: {
    name: 'Facebook',
    icon: Facebook,
    getUrl: (url) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
    color: 'text-[#4267B2]',
  },
  linkedin: {
    name: 'LinkedIn',
    icon: LinkIcon,
    getUrl: (url) =>
      `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
    color: 'text-[#0077B5]',
  },
  email: {
    name: '邮件',
    icon: Mail,
    getUrl: (url, title, description) =>
      `mailto:?subject=${encodeURIComponent(title || '')}&body=${encodeURIComponent(
        `${description || ''}\n\n${url}`
      )}`,
    color: 'text-gray-600',
  },
  whatsapp: {
    name: 'WhatsApp',
    icon: Share2,
    getUrl: (url, title) =>
      `https://wa.me/?text=${encodeURIComponent(`${title || ''} ${url}`)}`,
    color: 'text-[#25D366]',
  },
  telegram: {
    name: 'Telegram',
    icon: Share2,
    getUrl: (url, title) =>
      `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title || '')}`,
    color: 'text-[#0088CC]',
  },
};

/**
 * ShareButton 组件
 */
export const ShareButton: React.FC<ShareButtonProps> = ({
  url,
  title = '',
  description = '',
  variant = 'ghost',
  size = 'sm',
  className,
  disabled = false,
  iconOnly = false,
  platforms = ['copy', 'twitter', 'facebook', 'linkedin', 'email'],
  onShareSuccess,
}) => {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({
        title: '链接已复制',
        description: '分享链接已复制到剪贴板',
      });
      onShareSuccess?.('copy');
    } catch (error) {
      toast({
        title: '复制失败',
        description: '无法复制链接，请手动复制',
        variant: 'destructive',
      });
    }
  };

  const handleShare = async (platform: SharePlatform) => {
    if (platform === 'copy') {
      await handleCopyLink();
      return;
    }

    const config = sharePlatformConfigs[platform];
    const shareUrl = config.getUrl(url, title, description);

    // 尝试使用 Web Share API（移动端优先）
    if (navigator.share) {
      try {
        await navigator.share({
          title,
          text: description,
          url,
        });
        onShareSuccess?.(platform);
        setIsOpen(false);
        return;
      } catch (error) {
        // 用户取消分享或不支持，继续使用传统方式
      }
    }

    // 传统方式：打开新窗口
    if (platform === 'email') {
      window.location.href = shareUrl;
    } else {
      window.open(shareUrl, '_blank', 'width=600,height=400');
    }

    onShareSuccess?.(platform);
    setIsOpen(false);
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant={variant}
          size={iconOnly ? 'icon-sm' : size}
          className={className}
          disabled={disabled}
          aria-label="分享"
        >
          <Share2 className={cn(!iconOnly && 'mr-2', 'h-4 w-4')} />
          {!iconOnly && <span>分享</span>}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel>分享到</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {platforms.map((platform) => {
          const config = sharePlatformConfigs[platform];
          const Icon = config.icon;
          const isCopyPlatform = platform === 'copy';

          return (
            <DropdownMenuItem
              key={platform}
              onClick={() => handleShare(platform)}
              className="cursor-pointer"
            >
              {isCopyPlatform && copied ? (
                <Check className="mr-2 h-4 w-4 text-green-500" />
              ) : (
                <Icon className={cn('mr-2 h-4 w-4', config.color)} />
              )}
              <span>{isCopyPlatform && copied ? '已复制' : config.name}</span>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

/**
 * QuickShareButton - 快速分享按钮（仅复制链接）
 */
export interface QuickShareButtonProps {
  url: string;
  variant?: 'default' | 'outline' | 'ghost' | 'secondary';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
  disabled?: boolean;
  onSuccess?: () => void;
}

export const QuickShareButton: React.FC<QuickShareButtonProps> = ({
  url,
  variant = 'ghost',
  size = 'icon-sm',
  className,
  disabled = false,
  onSuccess,
}) => {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({
        title: '链接已复制',
        description: '分享链接已复制到剪贴板',
      });
      onSuccess?.();
    } catch (error) {
      toast({
        title: '复制失败',
        description: '无法复制链接，请手动复制',
        variant: 'destructive',
      });
    }
  };

  return (
    <Button
      variant={variant}
      size={size as any}
      className={className}
      onClick={handleCopy}
      disabled={disabled}
      aria-label="复制链接"
    >
      {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
    </Button>
  );
};

export default ShareButton;

