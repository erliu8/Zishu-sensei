# UI 组件库文档

Zishu 社区平台 UI 组件库，基于 **Shadcn/ui** 和 **Radix UI** 构建的企业级 React 组件库。

## 📦 特性

- ✅ **30+ 高质量组件** - 覆盖常见业务场景
- 🎨 **完整主题系统** - 支持亮色/暗色模式
- ♿ **无障碍访问** - 符合 WCAG 2.1 AA 标准
- 🎭 **TypeScript 支持** - 完整的类型定义
- 🎯 **高度可定制** - 基于 Tailwind CSS
- 📱 **响应式设计** - 移动端优先
- 🚀 **性能优化** - 按需加载，Tree-shaking 友好

## 🎨 主题系统

### 暗色模式

使用 `data-theme` 属性或 `dark` class 切换主题：

```tsx
// 方式 1: 使用 data-theme
<html data-theme="dark">

// 方式 2: 使用 class（Tailwind）
<html class="dark">
```

### 自定义主题颜色

在 `tailwind.config.ts` 中修改颜色变量：

```typescript
theme: {
  extend: {
    colors: {
      primary: { ... },
      secondary: { ... },
      // ...
    }
  }
}
```

## 📚 组件分类

### 1. 布局与导航组件

#### Card - 卡片

通用容器组件，用于包裹内容。

```tsx
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/shared/components/ui'

<Card>
  <CardHeader>
    <CardTitle>卡片标题</CardTitle>
    <CardDescription>卡片描述</CardDescription>
  </CardHeader>
  <CardContent>
    <p>卡片内容</p>
  </CardContent>
  <CardFooter>
    <Button>操作按钮</Button>
  </CardFooter>
</Card>
```

#### Dialog - 对话框

模态对话框组件。

```tsx
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle } from '@/shared/components/ui'

<Dialog>
  <DialogTrigger asChild>
    <Button>打开对话框</Button>
  </DialogTrigger>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>对话框标题</DialogTitle>
    </DialogHeader>
    <p>对话框内容</p>
  </DialogContent>
</Dialog>
```

#### Tabs - 标签页

多标签页切换组件。

```tsx
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/shared/components/ui'

<Tabs defaultValue="tab1">
  <TabsList>
    <TabsTrigger value="tab1">标签1</TabsTrigger>
    <TabsTrigger value="tab2">标签2</TabsTrigger>
  </TabsList>
  <TabsContent value="tab1">内容1</TabsContent>
  <TabsContent value="tab2">内容2</TabsContent>
</Tabs>
```

#### Sheet - 侧边抽屉

从侧边滑出的抽屉面板。

```tsx
import { Sheet, SheetTrigger, SheetContent, SheetHeader, SheetTitle } from '@/shared/components/ui'

<Sheet>
  <SheetTrigger asChild>
    <Button>打开侧边栏</Button>
  </SheetTrigger>
  <SheetContent>
    <SheetHeader>
      <SheetTitle>侧边栏标题</SheetTitle>
    </SheetHeader>
    <p>侧边栏内容</p>
  </SheetContent>
</Sheet>
```

---

### 2. 表单组件

#### Button - 按钮

多样式、多尺寸按钮组件。

```tsx
import { Button } from '@/shared/components/ui'

// 基础使用
<Button>默认按钮</Button>

// 不同样式
<Button variant="default">主要按钮</Button>
<Button variant="secondary">次要按钮</Button>
<Button variant="destructive">危险按钮</Button>
<Button variant="outline">轮廓按钮</Button>
<Button variant="ghost">幽灵按钮</Button>
<Button variant="link">链接按钮</Button>
<Button variant="success">成功按钮</Button>
<Button variant="warning">警告按钮</Button>

// 不同尺寸
<Button size="sm">小按钮</Button>
<Button size="default">默认按钮</Button>
<Button size="lg">大按钮</Button>
<Button size="xl">超大按钮</Button>
<Button size="icon"><Icon /></Button>

// 加载状态
<Button loading>加载中...</Button>

// 禁用状态
<Button disabled>禁用按钮</Button>
```

#### Input - 输入框

文本输入组件。

```tsx
import { Input } from '@/shared/components/ui'

<Input type="text" placeholder="请输入内容" />
<Input type="email" placeholder="邮箱" />
<Input type="password" placeholder="密码" />
<Input type="number" placeholder="数字" />
```

#### Textarea - 文本域

多行文本输入组件。

```tsx
import { Textarea } from '@/shared/components/ui'

<Textarea placeholder="请输入内容" rows={4} />
```

#### Select - 选择器

下拉选择组件。

```tsx
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/shared/components/ui'

<Select>
  <SelectTrigger>
    <SelectValue placeholder="请选择" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="1">选项1</SelectItem>
    <SelectItem value="2">选项2</SelectItem>
    <SelectItem value="3">选项3</SelectItem>
  </SelectContent>
</Select>
```

#### Checkbox - 复选框

```tsx
import { Checkbox } from '@/shared/components/ui'

<Checkbox id="terms" />
<label htmlFor="terms">同意条款</label>
```

#### Radio Group - 单选框组

```tsx
import { RadioGroup, RadioGroupItem } from '@/shared/components/ui'

<RadioGroup defaultValue="option1">
  <div className="flex items-center space-x-2">
    <RadioGroupItem value="option1" id="option1" />
    <label htmlFor="option1">选项1</label>
  </div>
  <div className="flex items-center space-x-2">
    <RadioGroupItem value="option2" id="option2" />
    <label htmlFor="option2">选项2</label>
  </div>
</RadioGroup>
```

#### Switch - 开关

```tsx
import { Switch } from '@/shared/components/ui'

<Switch />
<Switch defaultChecked />
```

#### Slider - 滑块

```tsx
import { Slider } from '@/shared/components/ui'

<Slider defaultValue={[50]} max={100} step={1} />
<Slider defaultValue={[20, 80]} max={100} step={1} /> // 范围滑块
```

#### Form - 表单

基于 `react-hook-form` 的表单组件。

```tsx
import { useForm } from 'react-hook-form'
import { Form, FormField, FormItem, FormLabel, FormControl, FormDescription, FormMessage } from '@/shared/components/ui'
import { Input, Button } from '@/shared/components/ui'

function MyForm() {
  const form = useForm()

  const onSubmit = (data) => {
    console.log(data)
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="username"
          render={({ field }) => (
            <FormItem>
              <FormLabel>用户名</FormLabel>
              <FormControl>
                <Input placeholder="请输入用户名" {...field} />
              </FormControl>
              <FormDescription>这是用户名的描述</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit">提交</Button>
      </form>
    </Form>
  )
}
```

---

### 3. 反馈组件

#### Toast - 提示消息

全局消息提示组件。

```tsx
import { useToast } from '@/shared/hooks/use-toast'
import { Button } from '@/shared/components/ui'

function MyComponent() {
  const { toast } = useToast()

  return (
    <Button
      onClick={() => {
        toast({
          title: "提示标题",
          description: "这是提示内容",
        })
      }}
    >
      显示提示
    </Button>
  )
}

// 不同类型的提示
toast({
  title: "成功",
  description: "操作成功！",
  variant: "success",
})

toast({
  title: "警告",
  description: "这是一个警告",
  variant: "warning",
})

toast({
  title: "错误",
  description: "操作失败",
  variant: "error",
})

// 带操作按钮
toast({
  title: "有新消息",
  description: "您有一条新消息",
  action: (
    <ToastAction altText="查看">查看</ToastAction>
  ),
})
```

**重要：** 需要在根布局中添加 `<Toaster />` 组件：

```tsx
// app/layout.tsx
import { Toaster } from '@/shared/components/ui'

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <Toaster />
      </body>
    </html>
  )
}
```

#### Alert - 警告提示

静态警告提示组件。

```tsx
import { Alert, AlertTitle, AlertDescription } from '@/shared/components/ui'
import { AlertCircle } from 'lucide-react'

<Alert>
  <AlertCircle className="h-4 w-4" />
  <AlertTitle>提示</AlertTitle>
  <AlertDescription>这是一个提示信息</AlertDescription>
</Alert>

// 不同样式
<Alert variant="default">默认提示</Alert>
<Alert variant="destructive">错误提示</Alert>
```

#### Badge - 徽章

标签徽章组件。

```tsx
import { Badge } from '@/shared/components/ui'

<Badge>默认</Badge>
<Badge variant="secondary">次要</Badge>
<Badge variant="outline">轮廓</Badge>
<Badge variant="destructive">危险</Badge>
```

#### Progress - 进度条

进度指示器组件。

```tsx
import { Progress } from '@/shared/components/ui'

<Progress value={33} />
<Progress value={66} className="h-2" />
```

#### Skeleton - 骨架屏

加载占位符组件。

```tsx
import { Skeleton } from '@/shared/components/ui'

<Skeleton className="h-12 w-12 rounded-full" />
<Skeleton className="h-4 w-[250px]" />
<Skeleton className="h-4 w-[200px]" />
```

#### LoadingSpinner - 加载旋转器

加载状态指示器。

```tsx
import { LoadingSpinner } from '@/shared/components/ui'

<LoadingSpinner />
<LoadingSpinner size="lg" label="加载中..." />
<LoadingSpinner fullScreen /> // 全屏加载
```

#### Tooltip - 工具提示

悬浮提示组件。

```tsx
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/shared/components/ui'

<TooltipProvider>
  <Tooltip>
    <TooltipTrigger>悬停查看</TooltipTrigger>
    <TooltipContent>
      <p>这是提示内容</p>
    </TooltipContent>
  </Tooltip>
</TooltipProvider>
```

#### Popover - 弹出层

弹出内容组件。

```tsx
import { Popover, PopoverTrigger, PopoverContent } from '@/shared/components/ui'

<Popover>
  <PopoverTrigger>点击打开</PopoverTrigger>
  <PopoverContent>
    <p>弹出内容</p>
  </PopoverContent>
</Popover>
```

---

### 4. 数据展示组件

#### Table - 表格

数据表格组件。

```tsx
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/shared/components/ui'

<Table>
  <TableHeader>
    <TableRow>
      <TableHead>名称</TableHead>
      <TableHead>状态</TableHead>
      <TableHead>操作</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    <TableRow>
      <TableCell>示例1</TableCell>
      <TableCell>激活</TableCell>
      <TableCell><Button size="sm">编辑</Button></TableCell>
    </TableRow>
  </TableBody>
</Table>
```

#### Avatar - 头像

用户头像组件。

```tsx
import { Avatar, AvatarImage, AvatarFallback } from '@/shared/components/ui'

<Avatar>
  <AvatarImage src="/avatar.jpg" alt="用户头像" />
  <AvatarFallback>ZS</AvatarFallback>
</Avatar>
```

#### Calendar - 日历

日期选择器组件。

```tsx
import { Calendar } from '@/shared/components/ui'
import { useState } from 'react'

function MyComponent() {
  const [date, setDate] = useState<Date | undefined>(new Date())

  return (
    <Calendar
      mode="single"
      selected={date}
      onSelect={setDate}
    />
  )
}
```

#### EmptyState - 空状态

无数据状态展示组件。

```tsx
import { EmptyState } from '@/shared/components/ui'
import { FileQuestion } from 'lucide-react'

<EmptyState
  icon={<FileQuestion size={48} />}
  title="暂无数据"
  description="还没有任何内容，快来创建第一条吧！"
  action={{
    label: "创建内容",
    onClick: () => console.log('创建')
  }}
/>
```

---

### 5. 业务组件

#### RoleBadge - 角色徽章

用户角色标识组件（针对 Zishu 社区平台）。

```tsx
import { RoleBadge } from '@/shared/components/ui'

// 普通用户
<RoleBadge role="user" />

// 社区管理员
<RoleBadge role="admin" />

// 不显示图标
<RoleBadge role="admin" showIcon={false} />

// 自定义文本
<RoleBadge role="admin" label="超级管理员" />

// 不同尺寸
<RoleBadge role="admin" size="sm" />
<RoleBadge role="admin" size="lg" />
```

**角色类型：**
- `user` - 普通用户
- `admin` - 社区管理员

---

## 🎯 最佳实践

### 1. 使用组件组合

```tsx
// ✅ 好的做法
<Card>
  <CardHeader>
    <div className="flex items-center justify-between">
      <CardTitle>用户信息</CardTitle>
      <RoleBadge role="admin" />
    </div>
  </CardHeader>
  <CardContent>
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Avatar>
          <AvatarImage src="/avatar.jpg" />
          <AvatarFallback>ZS</AvatarFallback>
        </Avatar>
        <div>
          <h3 className="font-semibold">张三</h3>
          <p className="text-sm text-muted-foreground">admin@example.com</p>
        </div>
      </div>
    </div>
  </CardContent>
</Card>
```

### 2. 响应式设计

使用 Tailwind 的响应式修饰符：

```tsx
<Button className="w-full md:w-auto">
  响应式按钮
</Button>

<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  {/* 响应式网格 */}
</div>
```

### 3. 无障碍访问

确保使用正确的 ARIA 属性：

```tsx
<Button aria-label="关闭对话框" onClick={onClose}>
  <X className="h-4 w-4" />
</Button>

<Input
  type="text"
  id="username"
  aria-describedby="username-description"
/>
<p id="username-description" className="text-sm text-muted-foreground">
  请输入您的用户名
</p>
```

### 4. 加载状态处理

```tsx
function MyComponent() {
  const [loading, setLoading] = useState(false)
  
  if (loading) {
    return <LoadingSpinner fullScreen />
  }
  
  return (
    <div>
      <Button loading={loading} onClick={handleSubmit}>
        提交
      </Button>
    </div>
  )
}
```

### 5. 错误处理

```tsx
function MyComponent() {
  const { toast } = useToast()
  
  const handleError = () => {
    toast({
      title: "错误",
      description: "操作失败，请重试",
      variant: "error",
    })
  }
  
  return <Button onClick={handleSave}>保存</Button>
}
```

---

## 🔧 自定义样式

所有组件都支持 `className` prop 进行样式覆盖：

```tsx
<Button className="bg-gradient-to-r from-purple-500 to-pink-500">
  渐变按钮
</Button>

<Card className="border-2 border-primary">
  高亮卡片
</Card>
```

使用 `cn` 工具函数合并样式：

```tsx
import { cn } from '@/shared/utils/cn'

<div className={cn(
  "base-styles",
  condition && "conditional-styles",
  className
)}>
  内容
</div>
```

---

## 📖 相关资源

- [Radix UI 文档](https://www.radix-ui.com/)
- [Tailwind CSS 文档](https://tailwindcss.com/)
- [React Hook Form 文档](https://react-hook-form.com/)
- [Lucide Icons 图标库](https://lucide.dev/)

---

## 🤝 贡献指南

如需添加新组件或改进现有组件，请遵循：

1. 组件必须支持暗色模式
2. 提供完整的 TypeScript 类型
3. 遵循无障碍访问标准
4. 添加必要的文档和示例
5. 确保组件可组合、可定制

---

**维护者**: Zishu Frontend Team  
**最后更新**: 2025-10-23  
**版本**: 1.0.0

