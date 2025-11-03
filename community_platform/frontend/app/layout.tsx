import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import '@/styles/globals.css'
import { AppNavbar, AppFooter, AppSidebar } from '@/shared/components/layout'
import { Providers } from './providers'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'Zishu - AI角色社区平台',
  description: '一个开放的AI角色社区平台，让您轻松创建、分享和探索AI角色',
  keywords: ['AI', '角色', '社区', '适配器', 'Zishu'],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Providers>
          <div className="flex min-h-screen flex-col">
            <AppNavbar />
            <div className="flex flex-1">
              <AppSidebar />
              <main className="flex-1">
                {children}
              </main>
            </div>
            <AppFooter />
          </div>
        </Providers>
      </body>
    </html>
  )
}
