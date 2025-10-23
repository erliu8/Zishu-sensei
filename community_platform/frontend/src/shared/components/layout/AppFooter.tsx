/**
 * AppFooter - 应用页脚组件
 * 提供完整的页脚内容，包含链接、版权信息等
 */

'use client';

import { FC } from 'react';
import Link from 'next/link';
import { Github, Twitter, Mail, Heart } from 'lucide-react';
import { Footer, FooterSection, FooterLink, FooterBottom } from './Footer';
import { Button } from '@/shared/components/ui/button';
import { Separator } from '@/shared/components/ui/separator';

export interface AppFooterProps {
  className?: string;
}

const footerLinks = {
  product: [
    { label: '首页', href: '/' },
    { label: '帖子', href: '/posts' },
    { label: '适配器', href: '/adapters' },
    { label: '角色', href: '/characters' },
    { label: '功能特性', href: '/features' },
  ],
  resources: [
    { label: '开发文档', href: '/docs' },
    { label: '使用指南', href: '/guides' },
    { label: 'API文档', href: '/api-docs' },
    { label: '示例代码', href: '/examples' },
    { label: '更新日志', href: '/changelog' },
  ],
  community: [
    { label: '社区论坛', href: '/forum' },
    { label: '贡献指南', href: '/contributing' },
    { label: '问题反馈', href: '/feedback' },
    { label: 'Discord', href: 'https://discord.gg/zishu' },
    { label: 'GitHub', href: 'https://github.com/zishu' },
  ],
  legal: [
    { label: '使用条款', href: '/terms' },
    { label: '隐私政策', href: '/privacy' },
    { label: 'Cookie政策', href: '/cookies' },
    { label: '许可证', href: '/license' },
    { label: '联系我们', href: '/contact' },
  ],
};

const socialLinks = [
  {
    name: 'GitHub',
    href: 'https://github.com/zishu',
    icon: <Github className="h-5 w-5" />,
  },
  {
    name: 'Twitter',
    href: 'https://twitter.com/zishu',
    icon: <Twitter className="h-5 w-5" />,
  },
  {
    name: 'Email',
    href: 'mailto:contact@zishu.ai',
    icon: <Mail className="h-5 w-5" />,
  },
];

export const AppFooter: FC<AppFooterProps> = ({ className }) => {
  const currentYear = new Date().getFullYear();

  return (
    <Footer className={className}>
      {/* Logo 和简介 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 mb-8">
        <div className="lg:col-span-2">
          <div className="flex items-center gap-2 mb-4">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
              <span className="text-white font-bold text-lg">Z</span>
            </div>
            <span className="font-bold text-xl">Zishu</span>
          </div>
          <p className="text-sm text-muted-foreground mb-4 max-w-md">
            Zishu是一个开放的AI角色社区平台，让您轻松创建、分享和探索AI角色。
            我们致力于打造最好的AI角色生态系统。
          </p>
          {/* 社交媒体链接 */}
          <div className="flex items-center gap-2">
            {socialLinks.map((social) => (
              <Button
                key={social.name}
                variant="outline"
                size="sm"
                className="h-9 w-9 p-0"
                asChild
              >
                <a
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={social.name}
                >
                  {social.icon}
                </a>
              </Button>
            ))}
          </div>
        </div>

        {/* 产品链接 */}
        <FooterSection title="产品">
          {footerLinks.product.map((link) => (
            <FooterLink key={link.href} href={link.href} as={Link}>
              {link.label}
            </FooterLink>
          ))}
        </FooterSection>

        {/* 资源链接 */}
        <FooterSection title="资源">
          {footerLinks.resources.map((link) => (
            <FooterLink key={link.href} href={link.href} as={Link}>
              {link.label}
            </FooterLink>
          ))}
        </FooterSection>

        {/* 社区链接 */}
        <FooterSection title="社区">
          {footerLinks.community.map((link) => (
            <FooterLink
              key={link.href}
              href={link.href}
              {...(link.href.startsWith('http') && {
                target: '_blank',
                rel: 'noopener noreferrer',
              })}
              as={link.href.startsWith('http') ? 'a' : Link}
            >
              {link.label}
            </FooterLink>
          ))}
        </FooterSection>
      </div>

      {/* 法律和版权信息 */}
      <FooterBottom>
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          {/* 版权信息 */}
          <div className="flex items-center gap-2 text-center md:text-left">
            <span>© {currentYear} Zishu.</span>
            <span className="hidden md:inline">保留所有权利。</span>
            <span className="flex items-center gap-1">
              使用
              <Heart className="h-3 w-3 fill-red-500 text-red-500" />
              构建
            </span>
          </div>

          {/* 法律链接 */}
          <div className="flex items-center gap-4 flex-wrap justify-center">
            {footerLinks.legal.map((link, index) => (
              <span key={link.href} className="flex items-center gap-4">
                <Link
                  href={link.href}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  {link.label}
                </Link>
                {index < footerLinks.legal.length - 1 && (
                  <Separator orientation="vertical" className="h-4" />
                )}
              </span>
            ))}
          </div>
        </div>
      </FooterBottom>
    </Footer>
  );
};

