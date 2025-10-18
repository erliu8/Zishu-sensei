# Chat 组件使用指南

> 紫舒老师桌面应用 - 聊天界面增强组件库  
> 版本: 1.0.0  
> 更新日期: 2025-10-18

---

## 📋 目录

1. [概述](#概述)
2. [安装依赖](#安装依赖)
3. [组件列表](#组件列表)
4. [使用示例](#使用示例)
5. [最佳实践](#最佳实践)
6. [常见问题](#常见问题)

---

## 概述

本组件库为紫舒老师桌面应用提供了一套完整的聊天界面增强功能，包括：

- **Markdown 渲染** - 支持 GFM、代码高亮、表格等
- **文件上传** - 拖拽上传、粘贴上传、多文件支持
- **消息搜索** - 全文搜索、正则支持、高级筛选
- **消息导出** - 多格式导出（Markdown/HTML/PDF/Text）
- **消息引用** - 回复功能、引用预览
- **消息收藏** - 标签分类、搜索筛选
- **快捷回复** - 模板管理、变量替换
- **消息反应** - Emoji 反应、统计功能

---

## 安装依赖

```bash
npm install react-markdown@^9.0.0 \
  remark-gfm@^4.0.0 \
  rehype-raw@^7.0.0 \
  rehype-sanitize@^6.0.0 \
  react-syntax-highlighter@^15.5.0 \
  react-dropzone@^14.2.3
```

或使用 yarn:

```bash
yarn add react-markdown@^9.0.0 \
  remark-gfm@^4.0.0 \
  rehype-raw@^7.0.0 \
  rehype-sanitize@^6.0.0 \
  react-syntax-highlighter@^15.5.0 \
  react-dropzone@^14.2.3
```

---

## 组件列表

### 1. MarkdownRenderer - Markdown 渲染器

**功能特性:**
- ✅ 完整 GitHub Flavored Markdown 支持
- ✅ 代码语法高亮（100+ 语言）
- ✅ 代码复制功能
- ✅ 表格、任务列表、自动链接
- ✅ 明暗主题切换
- ✅ 自定义样式

**基础用法:**

```tsx
import { MarkdownRenderer } from '@/components/Chat'

function MyComponent() {
  const markdown = `
# 标题

这是一段**加粗**的文字。

\`\`\`javascript
console.log('Hello, World!')
\`\`\`
  `

  return (
    <MarkdownRenderer
      content={markdown}
      darkMode={false}
      enableCodeCopy={true}
      showLineNumbers={false}
    />
  )
}
```

**Props:**

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| content | string | - | Markdown 内容 (必需) |
| darkMode | boolean | false | 是否使用暗色主题 |
| enableCodeCopy | boolean | true | 是否启用代码复制 |
| showLineNumbers | boolean | false | 是否显示行号 |
| maxHeight | number | - | 最大高度（px） |
| className | string | - | 自定义类名 |

---

### 2. FileUploadZone - 文件上传组件

**功能特性:**
- ✅ 拖拽上传文件
- ✅ 粘贴上传图片
- ✅ 多文件支持
- ✅ 文件类型验证
- ✅ 大小限制
- ✅ 上传进度显示
- ✅ 图片预览

**基础用法:**

```tsx
import { FileUploadZone, UploadedFile } from '@/components/Chat'

function MyComponent() {
  const [files, setFiles] = useState<UploadedFile[]>([])

  const handleUpload = async (file: File) => {
    // 上传逻辑
    const url = await uploadToServer(file)
    return url
  }

  return (
    <FileUploadZone
      files={files}
      onFilesChange={setFiles}
      onUpload={handleUpload}
      accept={['image/*', 'application/pdf']}
      maxSize={10 * 1024 * 1024} // 10MB
      maxFiles={5}
      multiple={true}
      enablePaste={true}
    />
  )
}
```

**Props:**

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| files | UploadedFile[] | - | 已上传文件列表 (必需) |
| onFilesChange | (files: UploadedFile[]) => void | - | 文件变化回调 (必需) |
| onUpload | (file: File) => Promise<string> | - | 上传回调 |
| accept | string[] | ['*'] | 允许的文件类型 |
| maxSize | number | 10MB | 最大文件大小（字节） |
| maxFiles | number | 5 | 最大文件数量 |
| multiple | boolean | true | 是否支持多文件 |
| enablePaste | boolean | true | 是否启用粘贴上传 |

---

### 3. MessageSearch - 消息搜索组件

**功能特性:**
- ✅ 全文搜索
- ✅ 正则表达式支持
- ✅ 高级筛选（时间、用户）
- ✅ 搜索历史记录
- ✅ 结果高亮
- ✅ 快速跳转

**基础用法:**

```tsx
import { MessageSearch, SearchMessage } from '@/components/Chat'

function MyComponent() {
  const messages: SearchMessage[] = [
    {
      id: '1',
      content: 'Hello, world!',
      sender: 'Alice',
      timestamp: Date.now(),
    },
    // ...
  ]

  const handleJumpToMessage = (messageId: string) => {
    // 跳转逻辑
  }

  return (
    <MessageSearch
      messages={messages}
      onJumpToMessage={handleJumpToMessage}
      visible={true}
      onClose={() => setShowSearch(false)}
    />
  )
}
```

**快捷键:**
- `Ctrl/Cmd + F` - 聚焦搜索框
- `Enter` - 下一个结果
- `Shift + Enter` - 上一个结果
- `Esc` - 关闭搜索

---

### 4. MessageExport - 消息导出组件

**功能特性:**
- ✅ 多格式导出（Markdown/HTML/PDF/Text）
- ✅ 自定义导出范围
- ✅ 元数据可选包含
- ✅ 样式美化
- ✅ 日期范围筛选

**基础用法:**

```tsx
import { MessageExport, ExportMessage } from '@/components/Chat'

function MyComponent() {
  const messages: ExportMessage[] = [
    // ...
  ]

  const handleExportComplete = (success: boolean, error?: Error) => {
    if (success) {
      toast.success('导出成功!')
    }
  }

  return (
    <MessageExport
      messages={messages}
      onExportComplete={handleExportComplete}
      visible={true}
      onClose={() => setShowExport(false)}
    />
  )
}
```

---

### 5. MessageReply - 消息引用组件

**功能特性:**
- ✅ 引用预览
- ✅ 跳转到原消息
- ✅ 紧凑模式
- ✅ 取消引用

**基础用法:**

```tsx
import { MessageReply, ReplyMessage } from '@/components/Chat'

function MyComponent() {
  const [replyTo, setReplyTo] = useState<ReplyMessage>()

  return (
    <MessageReply
      replyTo={replyTo}
      onCancelReply={() => setReplyTo(undefined)}
      onJumpToMessage={(id) => scrollToMessage(id)}
      compact={false}
      interactive={true}
    />
  )
}
```

---

### 6. MessageFavorites - 消息收藏夹

**功能特性:**
- ✅ 收藏管理
- ✅ 标签分类
- ✅ 备注功能
- ✅ 搜索筛选
- ✅ 批量操作

**基础用法:**

```tsx
import { MessageFavorites, FavoriteMessage } from '@/components/Chat'

function MyComponent() {
  const [favorites, setFavorites] = useState<FavoriteMessage[]>([])

  const handleToggleFavorite = (messageId: string, isFavorite: boolean) => {
    // 切换收藏状态
  }

  return (
    <MessageFavorites
      favorites={favorites}
      onToggleFavorite={handleToggleFavorite}
      onJumpToMessage={(id) => scrollToMessage(id)}
      visible={true}
      onClose={() => setShowFavorites(false)}
    />
  )
}
```

---

### 7. QuickReplyTemplates - 快捷回复模板

**功能特性:**
- ✅ 预设模板
- ✅ 自定义模板
- ✅ 变量替换（如 {name}, {time}）
- ✅ 快捷键触发
- ✅ 分类管理

**基础用法:**

```tsx
import { QuickReplyTemplates, QuickReplyTemplate } from '@/components/Chat'

function MyComponent() {
  const [templates, setTemplates] = useState<QuickReplyTemplate[]>([])

  const handleUseTemplate = (template: QuickReplyTemplate) => {
    // 使用模板
    const content = template.content
      .replace('{name}', 'Alice')
      .replace('{time}', new Date().toLocaleString())
    
    sendMessage(content)
  }

  return (
    <QuickReplyTemplates
      templates={templates}
      onUseTemplate={handleUseTemplate}
      onAddTemplate={(template) => {
        // 添加模板
      }}
      visible={true}
      onClose={() => setShowTemplates(false)}
    />
  )
}
```

**预设模板:**
- 问候、感谢、稍等、已处理
- 需要更多信息、技术支持
- 会议邀请（带变量）

---

### 8. MessageReactions - 消息反应

**功能特性:**
- ✅ Emoji 反应
- ✅ 常用 emoji 快捷选择
- ✅ 分类 emoji 选择器
- ✅ 反应统计
- ✅ 用户列表显示

**基础用法:**

```tsx
import { MessageReactions, Reaction } from '@/components/Chat'

function MyComponent() {
  const [reactions, setReactions] = useState<Reaction[]>([
    { emoji: '👍', users: ['Alice', 'Bob'], count: 2 },
    { emoji: '❤️', users: ['Charlie'], count: 1 },
  ])

  const handleAddReaction = (messageId: string, emoji: string, user: string) => {
    // 添加反应
  }

  return (
    <MessageReactions
      messageId="msg-123"
      reactions={reactions}
      currentUser="Alice"
      onAddReaction={handleAddReaction}
      onRemoveReaction={handleRemoveReaction}
      compact={false}
    />
  )
}
```

---

## 最佳实践

### 1. 性能优化

```tsx
// 使用 React.memo 优化渲染
const MemoizedMarkdownRenderer = React.memo(MarkdownRenderer)

// 使用 useMemo 缓存计算结果
const filteredMessages = useMemo(() => {
  return messages.filter(/* ... */)
}, [messages, filters])

// 使用 useCallback 缓存回调函数
const handleFileUpload = useCallback(async (file: File) => {
  // ...
}, [dependencies])
```

### 2. 类型安全

```tsx
// 使用 TypeScript 类型
import type { 
  MarkdownRendererProps,
  UploadedFile,
  SearchMessage
} from '@/components/Chat'

// 定义自己的类型
interface MyMessage extends SearchMessage {
  avatar?: string
  metadata?: Record<string, any>
}
```

### 3. 错误处理

```tsx
// 文件上传错误处理
const handleUpload = async (file: File) => {
  try {
    const url = await uploadToServer(file)
    return url
  } catch (error) {
    console.error('Upload failed:', error)
    toast.error('上传失败，请重试')
    throw error
  }
}

// 导出错误处理
const handleExportComplete = (success: boolean, error?: Error) => {
  if (!success) {
    console.error('Export failed:', error)
    toast.error(error?.message || '导出失败')
  }
}
```

### 4. 主题适配

```tsx
// 使用主题 Context
import { useTheme } from '@/contexts/ThemeContext'

function MyComponent() {
  const { theme } = useTheme()
  
  return (
    <MarkdownRenderer
      content={markdown}
      darkMode={theme === 'dark'}
    />
  )
}
```

---

## 常见问题

### Q1: 如何自定义 Markdown 样式？

A: 通过 `className` 属性和 CSS 覆盖：

```tsx
<MarkdownRenderer
  content={markdown}
  className="my-custom-markdown"
/>
```

```css
.my-custom-markdown h1 {
  color: #3b82f6;
  font-size: 2em;
}

.my-custom-markdown code {
  background: #f3f4f6;
  border-radius: 4px;
}
```

### Q2: 如何限制文件上传类型？

A: 使用 `accept` 属性：

```tsx
<FileUploadZone
  accept={[
    'image/jpeg',
    'image/png',
    'image/gif',
    'application/pdf',
  ]}
  // 或使用通配符
  accept={['image/*', 'video/*']}
/>
```

### Q3: 如何实现持久化搜索历史？

A: 结合 localStorage 或数据库：

```tsx
const [searchHistory, setSearchHistory] = useState<string[]>(() => {
  const saved = localStorage.getItem('searchHistory')
  return saved ? JSON.parse(saved) : []
})

useEffect(() => {
  localStorage.setItem('searchHistory', JSON.stringify(searchHistory))
}, [searchHistory])
```

### Q4: 如何自定义快捷回复模板？

A: 通过 `onAddTemplate` 回调：

```tsx
<QuickReplyTemplates
  templates={templates}
  onAddTemplate={(template) => {
    const newTemplate = {
      ...template,
      id: generateId(),
      createdAt: Date.now(),
      useCount: 0,
    }
    setTemplates([...templates, newTemplate])
  }}
/>
```

### Q5: 如何集成消息反应到后端？

A: 实现 `onAddReaction` 和 `onRemoveReaction`:

```tsx
<MessageReactions
  messageId={message.id}
  reactions={message.reactions}
  currentUser={currentUser}
  onAddReaction={async (messageId, emoji, user) => {
    await api.addReaction(messageId, emoji, user)
    // 更新本地状态
  }}
  onRemoveReaction={async (messageId, emoji, user) => {
    await api.removeReaction(messageId, emoji, user)
    // 更新本地状态
  }}
/>
```

---

## 更新日志

### v1.0.0 (2025-10-18)

**新功能:**
- ✅ 实现 Markdown 渲染器
- ✅ 实现文件上传组件
- ✅ 实现消息搜索功能
- ✅ 实现消息导出功能
- ✅ 实现消息引用/回复
- ✅ 实现消息收藏夹
- ✅ 实现快捷回复模板
- ✅ 实现消息反应功能

**已知问题:**
- 暂无

---

## 技术支持

如有问题或建议，请联系开发团队或提交 Issue。

**文档版本:** 1.0.0  
**最后更新:** 2025-10-18

