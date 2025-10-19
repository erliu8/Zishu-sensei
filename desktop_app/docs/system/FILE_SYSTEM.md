# 文件操作系统文档

> 版本: v1.0.0  
> 更新日期: 2025-10-19  
> 状态: ✅ 已完成

## 📋 概述

文件操作系统是紫舒老师桌面应用的核心模块之一，专注于用户个人对话附件和本地文件的管理。该系统提供了完整的文件上传、下载、预览、搜索和管理功能。

### 🎯 设计目标

- **用户友好**: 提供直观的拖拽上传和文件管理界面
- **高性能**: 支持大文件处理和批量操作
- **安全可靠**: 文件完整性校验和权限控制
- **功能完整**: 涵盖文件生命周期的所有操作

### 🔍 职责划分

**文件操作系统负责**:
- 对话附件的上传和管理
- 本地文件的存储和组织
- 文件预览和下载
- 文件搜索和过滤
- 文件历史记录追踪

**不在职责范围**:
- 云端文件同步（未来功能）
- 主题/适配器文件管理（由主题系统和适配器系统负责）
- 共享文件和协作（未来功能）

---

## 🏗️ 架构设计

### 系统架构

```
┌─────────────────────────────────────────────────────────┐
│                    前端 (React/TypeScript)                │
├─────────────────────────────────────────────────────────┤
│  FileManagerPanel  │  FileDropZone  │  FilePreview     │
│  文件管理面板       │  文件上传区域   │  文件预览组件    │
└────────────┬────────────────────────────────────────────┘
             │
             │ Tauri IPC
             │
┌────────────▼────────────────────────────────────────────┐
│              Rust 后端 (Tauri Commands)                  │
├─────────────────────────────────────────────────────────┤
│  upload_file        │  get_file         │  delete_file  │
│  list_files         │  search_files     │  export_file  │
│  batch_delete       │  get_file_stats   │  copy_file    │
└────────────┬────────────────────────────────────────────┘
             │
             │
┌────────────▼────────────────────────────────────────────┐
│              数据库层 (SQLite)                           │
├─────────────────────────────────────────────────────────┤
│  files 表           │  file_history 表                   │
│  (文件信息)          │  (历史记录)                        │
└────────────┬────────────────────────────────────────────┘
             │
             │
┌────────────▼────────────────────────────────────────────┐
│              文件系统 (本地存储)                         │
└─────────────────────────────────────────────────────────┘
```

### 数据流

1. **上传流程**:
   - 用户拖拽文件或选择文件
   - 前端验证文件类型和大小
   - 读取文件内容为字节数组
   - 通过 Tauri 命令发送到后端
   - 后端计算文件哈希
   - 检查是否重复（去重）
   - 保存文件到本地存储
   - 记录文件信息到数据库
   - 返回文件信息给前端

2. **下载/预览流程**:
   - 前端请求文件内容
   - 后端从数据库查询文件信息
   - 读取文件内容
   - 返回字节数组或文件路径
   - 前端根据文件类型进行预览或下载

---

## 🗄️ 数据库设计

### 文件信息表 (files)

```sql
CREATE TABLE files (
    id TEXT PRIMARY KEY,              -- UUID
    name TEXT NOT NULL,               -- 存储文件名
    original_name TEXT NOT NULL,      -- 原始文件名
    file_path TEXT NOT NULL,          -- 文件路径
    file_size INTEGER NOT NULL,       -- 文件大小(字节)
    file_type TEXT NOT NULL,          -- 文件类型(image/video/document等)
    mime_type TEXT NOT NULL,          -- MIME类型
    hash TEXT NOT NULL,               -- SHA256哈希(用于去重)
    thumbnail_path TEXT,              -- 缩略图路径(可选)
    conversation_id TEXT,             -- 所属对话ID(可选)
    message_id TEXT,                  -- 所属消息ID(可选)
    tags TEXT,                        -- 标签(逗号分隔)
    description TEXT,                 -- 描述
    created_at TEXT NOT NULL,         -- 创建时间
    updated_at TEXT NOT NULL,         -- 更新时间
    accessed_at TEXT NOT NULL,        -- 访问时间
    is_deleted INTEGER DEFAULT 0      -- 是否删除(软删除)
);
```

**索引**:
- `idx_files_conversation`: conversation_id
- `idx_files_message`: message_id
- `idx_files_hash`: hash（用于快速去重）
- `idx_files_type`: file_type（用于按类型筛选）

### 文件历史表 (file_history)

```sql
CREATE TABLE file_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_id TEXT NOT NULL,            -- 文件ID
    action TEXT NOT NULL,             -- 操作类型(created/updated/deleted/exported等)
    details TEXT,                     -- 操作详情(JSON格式)
    created_at TEXT NOT NULL,         -- 操作时间
    FOREIGN KEY (file_id) REFERENCES files(id)
);
```

**索引**:
- `idx_file_history_file_id`: file_id

---

## 🔧 API 文档

### Rust 后端命令

#### 1. upload_file

上传文件到系统。

**请求**:
```rust
UploadFileRequest {
    file_name: String,              // 文件名
    file_data: Vec<u8>,            // 文件内容(字节数组)
    conversation_id: Option<String>, // 所属对话ID
    message_id: Option<String>,     // 所属消息ID
    tags: Option<String>,           // 标签
    description: Option<String>,    // 描述
}
```

**响应**:
```rust
UploadFileResponse {
    file_info: FileInfo,           // 文件信息
    is_duplicate: bool,            // 是否重复(去重)
}
```

**特性**:
- 自动计算 SHA256 哈希
- 文件去重（相同哈希的文件只存储一次）
- 文件大小限制（默认 100MB）
- 自动确定文件类型和 MIME
- 生成唯一文件ID

#### 2. get_file

获取文件信息。

**请求**: `file_id: String`

**响应**: `FileInfo`

**特性**:
- 自动更新访问时间
- 返回完整的文件元数据

#### 3. read_file_content

读取文件内容。

**请求**: `file_id: String`

**响应**: `Vec<u8>` (字节数组)

**用途**: 用于文件预览和下载

#### 4. list_files_by_filter

列出文件（带过滤）。

**请求**:
```rust
conversation_id: Option<String>,  // 按对话筛选
file_type: Option<String>,        // 按类型筛选
limit: Option<i32>,               // 数量限制
offset: Option<i32>,              // 分页偏移
```

**响应**: `Vec<FileInfo>`

**特性**:
- 只返回未删除的文件
- 按创建时间倒序排列
- 支持分页

#### 5. update_file

更新文件信息。

**请求**: `FileInfo` (部分字段)

**响应**: `()`

**可更新字段**:
- name（显示名称）
- tags（标签）
- description（描述）

#### 6. delete_file

删除文件（软删除）。

**请求**: `file_id: String`

**响应**: `()`

**特性**:
- 软删除（标记为已删除，不立即删除物理文件）
- 记录删除历史

#### 7. delete_file_permanent

永久删除文件。

**请求**: `file_id: String`

**响应**: `()`

**特性**:
- 删除物理文件
- 删除数据库记录
- 删除缩略图（如果存在）
- 删除历史记录

#### 8. batch_delete

批量删除文件。

**请求**: `BatchDeleteRequest { file_ids: Vec<String> }`

**响应**: `usize` (删除数量)

#### 9. get_file_history_records

获取文件历史记录。

**请求**: `file_id: String`

**响应**: `Vec<FileHistory>`

#### 10. get_file_statistics

获取文件统计信息。

**响应**:
```rust
FileStats {
    total_files: i64,               // 总文件数
    total_size: i64,                // 总大小
    total_deleted: i64,             // 已删除数量
    by_type: Vec<FileTypeStats>,   // 按类型统计
}
```

#### 11. search_files_by_keyword

搜索文件。

**请求**:
```rust
keyword: String,                   // 关键词
file_type: Option<String>,         // 类型过滤
```

**响应**: `Vec<FileInfo>`

**搜索范围**:
- 文件名
- 原始文件名
- 标签
- 描述

#### 12. cleanup_old_files

清理旧文件。

**请求**: `days: i64` (保留天数)

**响应**: `usize` (清理数量)

**特性**:
- 永久删除超过指定天数的软删除文件
- 删除物理文件和数据库记录

#### 13. export_file

导出文件到指定位置。

**请求**:
```rust
file_id: String,                   // 文件ID
destination: String,               // 目标路径
```

**响应**: `String` (实际导出路径)

#### 14. copy_file

复制文件。

**请求**:
```rust
file_id: String,                   // 源文件ID
new_conversation_id: Option<String>, // 新对话ID
```

**响应**: `FileInfo` (新文件信息)

#### 15. get_file_url

获取文件URL。

**请求**: `file_id: String`

**响应**: `String` (file:// URL)

---

## 🎨 前端组件

### 1. FileDropZone

文件拖拽上传组件。

**属性**:
```typescript
interface FileDropZoneProps {
  onFilesSelected: (files: File[]) => void;
  accept?: string;           // 接受的文件类型
  maxSize?: number;          // 最大文件大小(字节)
  maxFiles?: number;         // 最大文件数量
  disabled?: boolean;
  className?: string;
}
```

**特性**:
- 拖拽上传
- 点击选择
- 文件类型验证
- 文件大小验证
- 实时预览选中的文件
- 单个文件移除

### 2. FileManagerPanel

文件管理面板。

**属性**:
```typescript
interface FileManagerPanelProps {
  conversationId?: string;   // 限定对话
  onFileSelect?: (file: FileInfo) => void;
  allowUpload?: boolean;     // 是否允许上传
  allowDelete?: boolean;     // 是否允许删除
}
```

**特性**:
- 网格/列表视图切换
- 搜索和过滤
- 排序（名称/日期/大小/类型）
- 批量选择和删除
- 文件预览
- 文件下载
- 上传进度显示

### 3. FilePreview

文件预览组件。

**属性**:
```typescript
interface FilePreviewProps {
  fileId: string | null;     // 文件ID
  onClose: () => void;
}
```

**支持的文件类型**:
- **图片**: jpg, png, gif, webp, svg (支持缩放)
- **文本**: txt, md, log
- **代码**: js, ts, py, rs, 等
- **视频**: mp4, webm (内置播放器)
- **音频**: mp3, wav, ogg (内置播放器)
- **PDF**: 显示下载提示（预览功能待实现）

### 4. useFileManager Hook

文件管理 React Hook。

**功能**:
```typescript
const {
  files,                     // 文件列表
  loading,                   // 加载状态
  error,                     // 错误信息
  uploadProgress,            // 上传进度
  loadFiles,                 // 加载文件
  uploadFile,                // 上传单个文件
  uploadFiles,               // 批量上传
  deleteFile,                // 删除文件
  batchDelete,               // 批量删除
  searchFiles,               // 搜索文件
  clearUploadProgress,       // 清除进度
} = useFileManager(options);
```

---

## 🔐 安全特性

### 1. 文件验证

- **类型验证**: 基于 MIME 类型和文件扩展名
- **大小限制**: 默认 100MB，可配置
- **数量限制**: 批量上传默认最多 10 个文件

### 2. 文件去重

- 使用 SHA256 哈希识别重复文件
- 相同文件只存储一次，节省空间
- 返回 `is_duplicate` 标志

### 3. 访问控制

- 文件与对话关联
- 只能访问自己的文件（通过 conversation_id）
- 软删除机制，可恢复

### 4. 路径安全

- 使用 UUID 生成文件名，防止路径遍历
- 文件存储在应用数据目录
- 不暴露真实文件系统路径

---

## 📊 性能优化

### 1. 文件存储

- **本地存储**: 文件存储在应用数据目录的 `uploads/` 子目录
- **文件命名**: UUID + 扩展名，避免冲突
- **去重**: 相同哈希的文件共享存储

### 2. 数据库优化

- **索引**: 在常用查询字段上建立索引
- **分页**: 支持 limit 和 offset
- **软删除**: 标记删除而非立即删除，提升性能

### 3. 前端优化

- **懒加载**: 大文件列表分页加载
- **虚拟滚动**: 未来可集成（如使用 react-window）
- **缓存**: 文件列表和统计信息缓存

---

## 🚀 使用示例

### 前端使用

#### 1. 基本文件上传

```typescript
import { FileDropZone } from '@/components/FileManager';
import { useFileManager } from '@/hooks/useFileManager';

function MyComponent() {
  const { uploadFiles } = useFileManager();

  const handleFilesSelected = async (files: File[]) => {
    await uploadFiles(files, {
      conversationId: 'conv-123',
    });
  };

  return (
    <FileDropZone
      onFilesSelected={handleFilesSelected}
      accept="image/*,.pdf"
      maxSize={10 * 1024 * 1024}
    />
  );
}
```

#### 2. 文件管理面板

```typescript
import { FileManagerPanel } from '@/components/FileManager';

function FileManager() {
  const handleFileSelect = (file: FileInfo) => {
    console.log('Selected file:', file);
  };

  return (
    <FileManagerPanel
      conversationId="conv-123"
      onFileSelect={handleFileSelect}
      allowUpload={true}
      allowDelete={true}
    />
  );
}
```

#### 3. 文件预览

```typescript
import { FilePreview } from '@/components/FileManager';
import { useState } from 'react';

function FileViewer() {
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);

  return (
    <>
      <button onClick={() => setSelectedFileId('file-id-123')}>
        预览文件
      </button>
      
      <FilePreview
        fileId={selectedFileId}
        onClose={() => setSelectedFileId(null)}
      />
    </>
  );
}
```

### 后端使用

#### 1. 在其他模块中使用文件系统

```rust
use crate::database::file::{get_file_info, save_file_info};

// 获取文件信息
let file = get_file_info(&conn, "file-id-123")?;

// 验证文件是否存在
if file.is_none() {
    return Err("File not found".to_string());
}
```

---

## 🔮 未来规划

### 短期（1-2个月）

- [ ] 图片缩略图生成（使用 image crate）
- [ ] PDF 预览支持
- [ ] 视频缩略图生成（使用 ffmpeg）
- [ ] 文件压缩和解压缩

### 中期（3-6个月）

- [ ] 云端文件同步
- [ ] 文件版本控制
- [ ] 文件分享链接
- [ ] OCR 文字识别

### 长期（6个月以上）

- [ ] 文件协作和共享
- [ ] 智能文件分类
- [ ] 文件内容全文搜索
- [ ] 多端文件同步

---

## 🐛 已知问题

1. **缩略图生成**: 当前未实现图片缩略图生成
2. **PDF 预览**: PDF 文件预览需要集成 PDF 渲染库
3. **大文件上传**: 超大文件（>100MB）可能导致内存占用过高
4. **文件恢复**: 软删除的文件无法通过 UI 恢复（需要直接操作数据库）

---

## 📚 相关文档

- [IMPROVEMENT_TODO.md](./IMPROVEMENT_TODO.md) - 待完善清单
- [Tauri 文档](https://tauri.app/)
- [React 文档](https://react.dev/)
- [SQLite 文档](https://www.sqlite.org/docs.html)

---

## 🤝 贡献

欢迎贡献代码和提出改进建议！

---

**文档维护者**: 开发团队  
**最后更新**: 2025-10-19  
**版本**: v1.0.0

