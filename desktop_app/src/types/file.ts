/**
 * 文件信息
 */
export interface FileInfo {
  id: string;
  name: string;
  original_name: string;
  file_path: string;
  file_size: number;
  file_type: string;
  mime_type: string;
  hash: string;
  thumbnail_path?: string;
  conversation_id?: string;
  message_id?: string;
  tags?: string;
  description?: string;
  created_at: string;
  updated_at: string;
  accessed_at: string;
  is_deleted: boolean;
}

/**
 * 文件历史记录
 */
export interface FileHistory {
  id: number;
  file_id: string;
  action: string;
  details?: string;
  created_at: string;
}

/**
 * 文件统计信息
 */
export interface FileStats {
  total_files: number;
  total_size: number;
  total_deleted: number;
  by_type: FileTypeStats[];
}

/**
 * 按类型统计
 */
export interface FileTypeStats {
  file_type: string;
  count: number;
  total_size: number;
}

/**
 * 上传文件请求
 */
export interface UploadFileRequest {
  file_name: string;
  file_data: number[];
  conversation_id?: string;
  message_id?: string;
  tags?: string;
  description?: string;
}

/**
 * 上传文件响应
 */
export interface UploadFileResponse {
  file_info: FileInfo;
  upload_url?: string;
  is_duplicate?: boolean;
}

/**
 * 批量删除请求
 */
export interface BatchDeleteRequest {
  file_ids: string[];
}

/**
 * 文件过滤选项
 */
export interface FileFilterOptions {
  conversation_id?: string;
  file_type?: string;
  limit?: number;
  offset?: number;
}

/**
 * 文件搜索选项
 */
export interface FileSearchOptions {
  keyword: string;
  file_type?: string;
}

/**
 * 文件上传进度
 */
export interface FileUploadProgress {
  file_id: string;
  file_name: string;
  progress: number; // 0-100
  status: 'pending' | 'uploading' | 'completed' | 'error';
  error?: string;
}

/**
 * 文件类型枚举
 */
export enum FileType {
  Image = 'image',
  Video = 'video',
  Audio = 'audio',
  PDF = 'pdf',
  Document = 'document',
  Spreadsheet = 'spreadsheet',
  Presentation = 'presentation',
  Text = 'text',
  Archive = 'archive',
  Data = 'data',
  Code = 'code',
  Other = 'other',
}

/**
 * 文件类型图标映射
 */
export const FILE_TYPE_ICONS: Record<string, string> = {
  image: '🖼️',
  video: '🎬',
  audio: '🎵',
  pdf: '📄',
  document: '📝',
  spreadsheet: '📊',
  presentation: '📽️',
  text: '📃',
  archive: '📦',
  data: '📋',
  code: '💻',
  other: '📎',
};

/**
 * 文件大小格式化
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * 获取文件类型标签
 */
export function getFileTypeLabel(fileType: string): string {
  const labels: Record<string, string> = {
    image: '图片',
    video: '视频',
    audio: '音频',
    pdf: 'PDF',
    document: '文档',
    spreadsheet: '表格',
    presentation: '演示文稿',
    text: '文本',
    archive: '压缩包',
    data: '数据',
    code: '代码',
    other: '其他',
  };
  
  return labels[fileType] || '未知';
}

/**
 * 检查文件类型是否可预览
 */
export function isPreviewable(fileType: string): boolean {
  return ['image', 'text', 'pdf', 'video', 'audio', 'code'].includes(fileType);
}

/**
 * 获取文件扩展名
 */
export function getFileExtension(fileName: string): string {
  const parts = fileName.split('.');
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
}

/**
 * 验证文件名
 */
export function isValidFileName(fileName: string): boolean {
  // 禁止的字符
  const invalidChars = /[<>:"|?*\x00-\x1f]/g;
  // 禁止的文件名
  const reservedNames = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])$/i;
  
  if (!fileName || fileName.length === 0) return false;
  if (invalidChars.test(fileName)) return false;
  if (reservedNames.test(fileName.split('.')[0])) return false;
  if (fileName.length > 255) return false;
  
  return true;
}

