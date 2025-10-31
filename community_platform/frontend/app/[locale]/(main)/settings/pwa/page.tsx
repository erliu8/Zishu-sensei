import { Metadata } from 'next'
import PWASettings from '@/infrastructure/pwa/PWASettings'

export const metadata: Metadata = {
  title: 'PWA 设置',
  description: '管理应用安装、缓存和通知设置',
}

export default function PWASettingsPage() {
  return (
    <div className="container mx-auto max-w-4xl p-6">
      <PWASettings 
        vapidPublicKey={process.env['NEXT_PUBLIC_VAPID_PUBLIC_KEY']}
      />
    </div>
  )
}

