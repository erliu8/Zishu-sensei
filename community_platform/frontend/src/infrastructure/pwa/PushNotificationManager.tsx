'use client'

import { useState } from 'react'
import { usePushNotification } from './usePushNotification'
import { Bell, BellOff, Check, X } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/shared/components/ui/card'
import { Switch } from '@/shared/components/ui/switch'
import { Label } from '@/shared/components/ui/label'
import { Badge } from '@/shared/components/ui/badge'
import { useToast } from '@/shared/hooks/useToast'
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/shared/components/ui/alert'

interface PushNotificationManagerProps {
  /**
   * VAPID 公钥（从环境变量获取）
   */
  vapidPublicKey?: string

  /**
   * 是否显示测试按钮
   */
  showTestButton?: boolean
}

/**
 * 推送通知管理器组件
 * 提供推送通知的配置和管理界面
 */
export default function PushNotificationManager({
  vapidPublicKey,
  showTestButton = true,
}: PushNotificationManagerProps) {
  const { toast } = useToast()
  const {
    permission,
    subscription,
    isSupported,
    requestPermission,
    subscribe,
    unsubscribe,
    testNotification,
  } = usePushNotification(vapidPublicKey)

  const [isLoading, setIsLoading] = useState(false)

  // 启用推送通知
  const handleEnable = async () => {
    setIsLoading(true)

    try {
      // 1. 请求权限
      const perm = await requestPermission()

      if (perm !== 'granted') {
        toast({
          title: '权限被拒绝',
          description: '无法启用推送通知，请检查浏览器设置',
          variant: 'destructive',
        })
        return
      }

      // 2. 订阅推送
      const sub = await subscribe()

      if (sub) {
        toast({
          title: '推送通知已启用',
          description: '您将收到重要更新的通知',
          icon: <Bell className="h-4 w-4" />,
        })
      } else {
        toast({
          title: '订阅失败',
          description: '无法订阅推送通知，请稍后重试',
          variant: 'destructive',
        })
      }
    } catch (error) {
      console.error('[PushManager] Enable failed:', error)
      toast({
        title: '启用失败',
        description: '发生错误，请稍后重试',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  // 禁用推送通知
  const handleDisable = async () => {
    setIsLoading(true)

    try {
      const success = await unsubscribe()

      if (success) {
        toast({
          title: '推送通知已禁用',
          description: '您将不再收到推送通知',
          icon: <BellOff className="h-4 w-4" />,
        })
      } else {
        toast({
          title: '取消订阅失败',
          description: '无法取消推送通知订阅',
          variant: 'destructive',
        })
      }
    } catch (error) {
      console.error('[PushManager] Disable failed:', error)
      toast({
        title: '禁用失败',
        description: '发生错误，请稍后重试',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  // 测试通知
  const handleTest = async () => {
    try {
      const notification = await testNotification()

      if (notification) {
        toast({
          title: '测试通知已发送',
          description: '请查看系统通知',
        })
      } else {
        toast({
          title: '发送失败',
          description: '请确保已授予通知权限',
          variant: 'destructive',
        })
      }
    } catch (error) {
      console.error('[PushManager] Test failed:', error)
      toast({
        title: '测试失败',
        description: '无法发送测试通知',
        variant: 'destructive',
      })
    }
  }

  // 切换通知
  const handleToggle = async (enabled: boolean) => {
    if (enabled) {
      await handleEnable()
    } else {
      await handleDisable()
    }
  }

  // 不支持推送通知
  if (!isSupported) {
    return (
      <Alert variant="warning">
        <BellOff className="h-4 w-4" />
        <AlertTitle>推送通知不可用</AlertTitle>
        <AlertDescription>
          您的浏览器不支持推送通知功能。请使用现代浏览器以获得最佳体验。
        </AlertDescription>
      </Alert>
    )
  }

  const isEnabled = permission === 'granted' && subscription !== null

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center space-x-2">
              <Bell className="h-5 w-5" />
              <span>推送通知</span>
            </CardTitle>
            <CardDescription>
              接收重要更新和活动通知
            </CardDescription>
          </div>
          <Badge variant={isEnabled ? 'default' : 'secondary'}>
            {isEnabled ? '已启用' : '已禁用'}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* 权限状态 */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="push-notifications" className="text-base">
                启用推送通知
              </Label>
              <p className="text-sm text-muted-foreground">
                允许发送桌面通知
              </p>
            </div>
            <Switch
              id="push-notifications"
              checked={isEnabled}
              onCheckedChange={handleToggle}
              disabled={isLoading}
            />
          </div>

          {/* 权限状态详情 */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="space-y-1">
              <div className="text-muted-foreground">浏览器权限</div>
              <div className="flex items-center space-x-1">
                {permission === 'granted' ? (
                  <>
                    <Check className="h-4 w-4 text-green-500" />
                    <span className="text-green-600 dark:text-green-400">
                      已授予
                    </span>
                  </>
                ) : permission === 'denied' ? (
                  <>
                    <X className="h-4 w-4 text-red-500" />
                    <span className="text-red-600 dark:text-red-400">
                      已拒绝
                    </span>
                  </>
                ) : (
                  <span className="text-muted-foreground">未请求</span>
                )}
              </div>
            </div>

            <div className="space-y-1">
              <div className="text-muted-foreground">订阅状态</div>
              <div className="flex items-center space-x-1">
                {subscription ? (
                  <>
                    <Check className="h-4 w-4 text-green-500" />
                    <span className="text-green-600 dark:text-green-400">
                      已订阅
                    </span>
                  </>
                ) : (
                  <>
                    <X className="h-4 w-4 text-gray-400" />
                    <span className="text-muted-foreground">未订阅</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 权限被拒绝提示 */}
        {permission === 'denied' && (
          <Alert variant="warning">
            <BellOff className="h-4 w-4" />
            <AlertTitle>通知权限被拒绝</AlertTitle>
            <AlertDescription>
              您已拒绝通知权限。要启用通知，请在浏览器设置中允许本站点发送通知。
            </AlertDescription>
          </Alert>
        )}

        {/* 通知类型配置（未来扩展） */}
        {isEnabled && (
          <div className="space-y-3 border-t pt-4">
            <h4 className="font-medium">通知类型</h4>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="notify-posts" className="font-normal">
                  新帖子和回复
                </Label>
                <Switch id="notify-posts" defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="notify-mentions" className="font-normal">
                  @提及和互动
                </Label>
                <Switch id="notify-mentions" defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="notify-updates" className="font-normal">
                  系统更新和公告
                </Label>
                <Switch id="notify-updates" defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="notify-messages" className="font-normal">
                  私信和消息
                </Label>
                <Switch id="notify-messages" defaultChecked />
              </div>
            </div>
          </div>
        )}

        {/* 测试按钮 */}
        {showTestButton && isEnabled && (
          <div className="border-t pt-4">
            <Button onClick={handleTest} variant="outline" className="w-full">
              <Bell className="h-4 w-4 mr-2" />
              发送测试通知
            </Button>
          </div>
        )}

        {/* 帮助信息 */}
        <div className="text-xs text-muted-foreground bg-muted p-3 rounded">
          <strong>提示：</strong>
          推送通知需要浏览器支持。即使离线，您也可以收到通知。
        </div>
      </CardContent>
    </Card>
  )
}

