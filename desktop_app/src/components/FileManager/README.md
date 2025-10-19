# 文件管理器组件

> 紫舒老师桌面应用 - 文件操作系统前端组件

## 📦 组件列表

### FileDropZone
文件拖拽上传组件，支持拖拽和点击选择文件。

**使用示例**:
```tsx
import { FileDropZone } from '@/components/FileManager';

<FileDropZone
  onFilesSelected={(files) => console.log(files)}
  accept="image/*,.pdf"
  maxSize={10 * 1024 * 1024}
  maxFiles={5}
/>
```

### FileManagerPanel
完整的文件管理面板，包含上传、列表、搜索、预览等功能。

**使用示例**:
```tsx
import { FileManagerPanel } from '@/components/FileManager';

<FileManagerPanel
  conversationId="conv-123"
  onFileSelect={(file) => console.log(file)}
  allowUpload={true}
  allowDelete={true}
/>
```

### FilePreview
文件预览组件，支持图片、文本、视频、音频等多种格式。

**使用示例**:
```tsx
import { FilePreview } from '@/components/FileManager';

<FilePreview
  fileId={selectedFileId}
  onClose={() => setSelectedFileId(null)}
/>
```

## 🎯 功能特性

- ✅ 拖拽上传和批量上传
- ✅ 文件类型和大小验证
- ✅ 文件搜索和过滤
- ✅ 网格/列表视图切换
- ✅ 文件预览（多格式支持）
- ✅ 批量操作（选择、删除）
- ✅ 上传进度显示
- ✅ 响应式设计
- ✅ 暗色模式支持

## 📚 相关文档

- [FILE_SYSTEM.md](../../../docs/FILE_SYSTEM.md) - 完整的系统文档
- [IMPROVEMENT_TODO.md](../../../docs/IMPROVEMENT_TODO.md) - 项目待完善清单

