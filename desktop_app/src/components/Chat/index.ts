/**
 * Chat 组件统一导出
 * 
 * 此文件导出所有聊天相关的增强组件
 */

// 消息渲染
export { MarkdownRenderer } from './MessageRenderer/MarkdownRenderer'
export type { MarkdownRendererProps } from './MessageRenderer/MarkdownRenderer'

// 文件上传
export { FileUploadZone } from './FileUpload/FileUploadZone'
export type { 
  FileUploadZoneProps, 
  UploadedFile 
} from './FileUpload/FileUploadZone'

// 消息搜索
export { MessageSearch } from './MessageSearch/MessageSearch'
export type { 
  MessageSearchProps, 
  SearchResult,
  SearchFilters,
  Message as SearchMessage
} from './MessageSearch/MessageSearch'

// 消息导出
export { MessageExport } from './MessageExport/MessageExport'
export type { 
  MessageExportProps, 
  ExportOptions,
  Message as ExportMessage
} from './MessageExport/MessageExport'

// 消息引用/回复
export { MessageReply } from './MessageReply/MessageReply'
export type { 
  MessageReplyProps, 
  ReplyMessage 
} from './MessageReply/MessageReply'

// 消息收藏夹
export { MessageFavorites } from './MessageFavorites/MessageFavorites'
export type { 
  MessageFavoritesProps, 
  FavoriteMessage 
} from './MessageFavorites/MessageFavorites'

// 快捷回复模板
export { QuickReplyTemplates } from './QuickReply/QuickReplyTemplates'
export type { 
  QuickReplyTemplatesProps, 
  QuickReplyTemplate 
} from './QuickReply/QuickReplyTemplates'

// 消息反应
export { MessageReactions } from './MessageReactions/MessageReactions'
export type { 
  MessageReactionsProps, 
  Reaction 
} from './MessageReactions/MessageReactions'

