import { Metadata } from 'next'
import PWAManager from '@/infrastructure/pwa/PWAManager'

export const metadata: Metadata = {
  title: {
    template: '%s | Zishu 社区平台',
    default: 'Zishu 社区平台',
  },
  description: 'AI 角色社区平台 - 分享、创建和探索 AI 角色',
  manifest: '/manifest.json',
  themeColor: '#000000',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Zishu',
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    type: 'website',
    siteName: 'Zishu 社区平台',
    title: 'Zishu 社区平台',
    description: 'AI 角色社区平台 - 分享、创建和探索 AI 角色',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Zishu 社区平台',
    description: 'AI 角色社区平台 - 分享、创建和探索 AI 角色',
  },
}

export default function MainLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <PWAManager
        enableInstallPrompt={true}
        enableUpdatePrompt={true}
        enableNetworkStatus={true}
      />
      {children}
    </>
  )
}

