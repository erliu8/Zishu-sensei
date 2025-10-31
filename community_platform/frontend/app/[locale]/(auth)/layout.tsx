import type { Metadata } from 'next';
import Link from 'next/link';
import { Sparkles } from 'lucide-react';

export const metadata: Metadata = {
  title: {
    template: '%s | Zishu 社区平台',
    default: '认证',
  },
  description: 'Zishu AI 角色社区平台 - 登录、注册、密码管理',
};

/**
 * 认证布局组件
 * 用于所有认证相关页面 (登录、注册、忘记密码、重置密码)
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* 左侧品牌展示区 */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary/10 via-primary/5 to-background relative overflow-hidden">
        <div className="absolute inset-0 bg-grid-white/10" />
        <div className="relative z-10 flex flex-col justify-center px-12 xl:px-20">
          {/* Logo 和品牌名称 */}
          <div className="mb-8">
            <Link
              href="/"
              className="inline-flex items-center gap-3 group transition-all"
            >
              <div className="relative">
                <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full group-hover:bg-primary/30 transition-all" />
                <Sparkles className="h-10 w-10 text-primary relative z-10" />
              </div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                Zishu
              </h1>
            </Link>
          </div>

          {/* 主标语 */}
          <div className="space-y-6 max-w-lg">
            <h2 className="text-4xl xl:text-5xl font-bold leading-tight">
              打造您的
              <br />
              <span className="bg-gradient-to-r from-primary via-purple-500 to-pink-500 bg-clip-text text-transparent">
                AI 角色世界
              </span>
            </h2>
            <p className="text-lg text-muted-foreground leading-relaxed">
              在 Zishu
              社区平台，创建、分享和定制您的专属AI角色。探索无限可能，与全球创作者一起构建未来的智能交互体验。
            </p>
          </div>

          {/* 特性亮点 */}
          <div className="mt-12 grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <span className="text-2xl">🎭</span>
              </div>
              <h3 className="font-semibold">角色创建</h3>
              <p className="text-sm text-muted-foreground">
                自定义人格、表情和语音
              </p>
            </div>
            <div className="space-y-2">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <span className="text-2xl">🔌</span>
              </div>
              <h3 className="font-semibold">适配器市场</h3>
              <p className="text-sm text-muted-foreground">
                丰富的扩展和插件生态
              </p>
            </div>
            <div className="space-y-2">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <span className="text-2xl">📦</span>
              </div>
              <h3 className="font-semibold">一键打包</h3>
              <p className="text-sm text-muted-foreground">
                快速部署您的AI角色
              </p>
            </div>
            <div className="space-y-2">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <span className="text-2xl">👥</span>
              </div>
              <h3 className="font-semibold">活跃社区</h3>
              <p className="text-sm text-muted-foreground">
                与创作者交流和学习
              </p>
            </div>
          </div>
        </div>

        {/* 装饰元素 */}
        <div className="absolute top-20 right-20 w-72 h-72 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-20 left-20 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl" />
      </div>

      {/* 右侧表单区域 */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-md">
          {/* 移动端 Logo */}
          <div className="lg:hidden mb-8 text-center">
            <Link href="/" className="inline-flex items-center gap-2 group">
              <Sparkles className="h-8 w-8 text-primary" />
              <h1 className="text-2xl font-bold">Zishu</h1>
            </Link>
          </div>

          {/* 表单内容 */}
          {children}

          {/* 页脚 */}
          <div className="mt-8 text-center text-sm text-muted-foreground">
            <p>
              继续即表示您同意我们的{' '}
              <Link href="/terms" className="text-primary hover:underline">
                服务条款
              </Link>{' '}
              和{' '}
              <Link href="/privacy" className="text-primary hover:underline">
                隐私政策
              </Link>
            </p>
          </div>

          {/* 返回首页 */}
          <div className="mt-4 text-center">
            <Link
              href="/"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              ← 返回首页
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

