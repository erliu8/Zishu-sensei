# 首页与导航功能文档

本文档描述了Zishu社区平台的首页和导航系统的实现。

## 📑 目录

- [首页组件](#首页组件)
- [导航栏](#导航栏)
- [侧边栏](#侧边栏)
- [页脚](#页脚)
- [使用说明](#使用说明)

## 🏠 首页组件

首页（`app/page.tsx`）是平台的主要入口，展示以下内容：

### 1. 精选推荐区 (FeaturedSection)

**位置**: `src/features/home/components/FeaturedSection.tsx`

展示平台精选的内容，包括：
- 一个主推荐位（大图展示）
- 两个副推荐位（小图展示）
- 支持帖子、适配器、角色三种类型

**特性**:
- 响应式网格布局（移动端单列，桌面端3列）
- 悬停效果（图片缩放、文字变色）
- 渐变叠加层提升可读性
- 类型标识徽章

### 2. 社区动态 (TrendingPosts)

**位置**: `src/features/home/components/TrendingPosts.tsx`

展示社区帖子，包含两个标签页：
- **热门帖子**: 按浏览量排序
- **最新发布**: 按发布时间排序

**特性**:
- Tab切换
- 网格布局展示（响应式1-3列）
- 使用`PostCard`组件统一样式
- 加载状态和空状态处理
- "查看全部"链接

### 3. 最新适配器 (LatestAdapters)

**位置**: `src/features/home/components/LatestAdapters.tsx`

展示最新发布的适配器：
- 适配器卡片展示
- 类型标识（软/硬/智能硬适配器）
- 版本信息
- 评分和下载量统计
- 作者信息

**特性**:
- 网格布局（响应式1-3列）
- 悬停效果
- 类型颜色标识
- "浏览市场"链接

### 4. 热门角色 (TrendingCharacters)

**位置**: `src/features/home/components/TrendingCharacters.tsx`

展示平台热门AI角色：
- 角色头像/封面展示
- 角色名称和描述
- 创建者信息
- 点赞和使用量统计
- 公开/私有标识

**特性**:
- 网格布局（响应式1-3列）
- 图片封面或默认图标
- 悬停效果
- "探索更多"链接

## 🧭 导航栏

### AppNavbar

**位置**: `src/shared/components/layout/AppNavbar.tsx`

全局导航栏，包含以下元素：

#### 1. Logo和品牌
- Zishu品牌标识
- 渐变色背景
- 点击返回首页

#### 2. 导航菜单
桌面端显示的主导航：
- 首页 (/)
- 帖子 (/posts)
- 适配器 (/adapters)
- 角色 (/characters)

每个菜单项：
- 图标 + 文字
- 活动状态高亮
- 悬停效果

#### 3. 搜索栏
- 桌面端：显示搜索框和快捷键提示（⌘K）
- 移动端：显示搜索图标
- 点击打开搜索对话框

#### 4. 通知下拉 (NotificationDropdown)
- 通知图标
- 未读数量徽章
- 下拉菜单显示通知列表
- 支持标记已读
- 通知类型图标（点赞、评论、关注等）

#### 5. 用户菜单 (UserMenu)
- 用户头像
- 下拉菜单：
  - 个人主页
  - 我的帖子
  - 我的适配器
  - 我的角色
  - 我的收藏
  - 设置
  - 退出登录
- 未登录时显示登录/注册按钮

#### 6. 移动端菜单
- 汉堡菜单图标
- 展开显示导航项
- 响应式设计

**特性**:
- 粘性定位（sticky top）
- 毛玻璃效果（backdrop-blur）
- 响应式布局
- 路径高亮

### SearchBar

**位置**: `src/shared/components/layout/SearchBar.tsx`

全局搜索对话框：

**功能**:
- 实时搜索（300ms防抖）
- 搜索结果分类显示（帖子、适配器、角色）
- 热门搜索推荐
- 最近搜索历史
- 键盘导航支持
- ⌘K / Ctrl+K 快捷键

**搜索结果显示**:
- 类型图标和标识
- 标题和描述
- 相关徽章
- 点击跳转

### NotificationDropdown

**位置**: `src/shared/components/layout/NotificationDropdown.tsx`

通知下拉菜单：

**功能**:
- 显示通知列表
- 未读数量徽章
- 通知类型分类：
  - 点赞（红色心形图标）
  - 评论（蓝色消息图标）
  - 关注（绿色用户图标）
  - 适配器（紫色包裹图标）
  - 系统（灰色铃铛图标）
- 标记单个已读
- 全部标记已读
- 通知设置入口

**UI特性**:
- 滚动区域（最多显示400px）
- 未读通知背景高亮
- 时间相对显示（如"5分钟前"）
- "查看全部通知"链接

### UserMenu

**位置**: `src/shared/components/layout/UserMenu.tsx`

用户菜单下拉：

**已登录状态**:
- 显示用户头像
- 用户名和邮箱
- 功能菜单：
  - 个人主页
  - 我的内容（帖子/适配器/角色）
  - 我的收藏
  - 设置
  - 退出登录

**未登录状态**:
- 登录按钮
- 注册按钮

## 📋 侧边栏

### AppSidebar

**位置**: `src/shared/components/layout/AppSidebar.tsx`

侧边栏导航，包含多个导航区域：

#### 1. 快速导航
- 首页
- 热门
- 最新
- 精选

#### 2. 浏览内容
- 帖子
- 适配器
- 角色

#### 3. 热门分类
- 分类列表（带颜色标识）
- 分类文章数量
- 滚动区域
- "查看全部"链接

#### 4. 个人中心
- 我的收藏
- 设置

#### 5. 帮助中心
- 帮助中心按钮

**特性**:
- 固定宽度（256px）
- 卡片式分区
- 路径高亮
- 悬停效果

## 🦶 页脚

### AppFooter

**位置**: `src/shared/components/layout/AppFooter.tsx`

完整的页脚组件：

#### 1. Logo和简介
- 品牌标识
- 平台简介
- 社交媒体链接（GitHub、Twitter、Email）

#### 2. 链接分组
- **产品**: 首页、帖子、适配器、角色、功能特性
- **资源**: 开发文档、使用指南、API文档、示例代码、更新日志
- **社区**: 社区论坛、贡献指南、问题反馈、Discord、GitHub

#### 3. 版权和法律
- 版权声明
- 法律链接：使用条款、隐私政策、Cookie政策、许可证、联系我们

**布局**:
- 响应式网格（移动端单列，桌面端5列）
- 分隔线
- 底部版权区域

## 🎨 使用说明

### 基本布局结构

主布局在 `app/layout.tsx` 中定义：

```tsx
import { AppNavbar, AppFooter } from '@/shared/components/layout'

export default function RootLayout({ children }) {
  return (
    <html lang="zh-CN">
      <body>
        <Providers>
          <div className="flex min-h-screen flex-col">
            <AppNavbar />
            <main className="flex-1">
              {children}
            </main>
            <AppFooter />
          </div>
        </Providers>
      </body>
    </html>
  )
}
```

### 添加侧边栏的页面布局

对于需要侧边栏的页面：

```tsx
import { AppSidebar } from '@/shared/components/layout'

export default function PageWithSidebar() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex gap-6">
        <AppSidebar />
        <main className="flex-1">
          {/* 页面内容 */}
        </main>
      </div>
    </div>
  )
}
```

### 自定义首页内容

修改 `app/page.tsx` 中的 `featuredItems` 数据来自定义精选内容：

```tsx
const featuredItems = [
  {
    id: '1',
    title: '标题',
    description: '描述',
    image: '/images/featured/main.jpg',
    type: 'post', // 或 'adapter', 'character'
    link: '/posts/1',
    badge: '置顶', // 可选
  },
  // ...更多项
]
```

## 🔧 配置选项

### 导航栏配置

在 `AppNavbar.tsx` 中的 `navItems` 数组修改导航项：

```tsx
const navItems: NavItem[] = [
  {
    label: '首页',
    href: '/',
    icon: <Home className="h-4 w-4" />,
  },
  // 添加更多导航项
]
```

### 页脚链接配置

在 `AppFooter.tsx` 中的 `footerLinks` 对象修改页脚链接：

```tsx
const footerLinks = {
  product: [...],
  resources: [...],
  community: [...],
  legal: [...],
}
```

## 📱 响应式设计

所有组件都采用响应式设计：

- **移动端** (< 768px): 单列布局，汉堡菜单
- **平板** (768px - 1024px): 2列布局
- **桌面端** (> 1024px): 3列布局，完整导航

## 🎯 核心特性

1. **性能优化**
   - Suspense边界处理加载状态
   - 图片懒加载
   - 防抖搜索

2. **用户体验**
   - 悬停效果
   - 加载状态
   - 空状态处理
   - 键盘导航支持

3. **可访问性**
   - 语义化HTML
   - ARIA标签
   - 键盘快捷键

4. **国际化准备**
   - 中文界面
   - date-fns本地化支持
   - 可扩展的语言支持

## 🔮 未来扩展

1. **搜索增强**
   - 实际API集成
   - 搜索过滤器
   - 搜索历史持久化

2. **通知系统**
   - WebSocket实时通知
   - 通知偏好设置
   - 通知分组

3. **用户认证**
   - OAuth登录
   - 会话管理
   - 权限控制

4. **个性化**
   - 用户偏好设置
   - 自定义主题
   - 首页内容推荐算法

## 📚 相关文档

- [组件库文档](./COMPONENT_LIBRARY.md)
- [API文档](./API_DOCUMENTATION.md)
- [主题系统](./THEMING.md)
- [开发指南](./DEVELOPMENT.md)

---

**最后更新**: 2025-10-23
**版本**: 1.0.0

