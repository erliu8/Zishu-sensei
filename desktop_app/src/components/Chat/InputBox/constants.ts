/**
 * InputBox 组件常量配置
 * 
 * 定义默认值、表情列表、快捷键提示等常量
 * @module InputBox/constants
 */

import type { SendShortcut, SuggestionType } from './InputBox.types'

// ==================== 默认配置 ====================

/**
 * 默认配置常量
 */
export const DEFAULT_CONFIG = {
  /** 最大字符数 */
  MAX_LENGTH: 10000,
  /** 最大文件大小（字节）- 10MB */
  MAX_FILE_SIZE: 10 * 1024 * 1024,
  /** 最大附件数量 */
  MAX_ATTACHMENTS: 5,
  /** 最小行数 */
  MIN_ROWS: 1,
  /** 最大行数 */
  MAX_ROWS: 10,
  /** 默认发送快捷键 */
  SEND_SHORTCUT: 'ctrl+enter' as SendShortcut,
  /** 占位符文本 */
  PLACEHOLDER: '输入消息...',
  /** 防抖延迟（毫秒） */
  DEBOUNCE_DELAY: 300,
  /** 缩略图最大宽度 */
  THUMBNAIL_MAX_WIDTH: 200,
  /** 缩略图最大高度 */
  THUMBNAIL_MAX_HEIGHT: 200,
} as const

// ==================== 文件类型 ====================

/**
 * 支持的图片类型
 */
export const IMAGE_TYPES = [
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'image/bmp',
] as const

/**
 * 支持的文档类型
 */
export const DOCUMENT_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/csv',
  'text/html',
  'text/markdown',
] as const

/**
 * 支持的音频类型
 */
export const AUDIO_TYPES = [
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/ogg',
  'audio/webm',
  'audio/m4a',
  'audio/flac',
] as const

/**
 * 支持的视频类型
 */
export const VIDEO_TYPES = [
  'video/mp4',
  'video/webm',
  'video/ogg',
  'video/quicktime',
  'video/x-msvideo',
] as const

/**
 * 所有支持的文件类型
 */
export const ALL_FILE_TYPES = [
  ...IMAGE_TYPES,
  ...DOCUMENT_TYPES,
  ...AUDIO_TYPES,
  ...VIDEO_TYPES,
] as const

// ==================== 表情符号 ====================

/**
 * 常用表情符号分类
 */
export const EMOJI_CATEGORIES = [
  {
    name: '笑脸',
    icon: '😀',
    emojis: [
      '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂',
      '🙂', '🙃', '😉', '😊', '😇', '🥰', '😍', '🤩',
      '😘', '😗', '😚', '😙', '😋', '😛', '😜', '🤪',
      '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🤐', '🤨',
    ],
  },
  {
    name: '手势',
    icon: '👍',
    emojis: [
      '👍', '👎', '👊', '✊', '🤛', '🤜', '🤞', '✌️',
      '🤟', '🤘', '👌', '🤏', '👈', '👉', '👆', '👇',
      '☝️', '✋', '🤚', '🖐️', '🖖', '👋', '🤙', '💪',
      '🦾', '🖕', '✍️', '🙏', '🦶', '🦵', '👂', '👃',
    ],
  },
  {
    name: '表情',
    icon: '❤️',
    emojis: [
      '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍',
      '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖',
      '💘', '💝', '💟', '☮️', '✝️', '☪️', '🕉️', '☸️',
      '✡️', '🔯', '🕎', '☯️', '☦️', '🛐', '⛎', '♈',
    ],
  },
  {
    name: '动物',
    icon: '🐶',
    emojis: [
      '🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼',
      '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🐔',
      '🐧', '🐦', '🐤', '🦆', '🦅', '🦉', '🦇', '🐺',
      '🐗', '🐴', '🦄', '🐝', '🐛', '🦋', '🐌', '🐞',
    ],
  },
  {
    name: '食物',
    icon: '🍕',
    emojis: [
      '🍏', '🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇',
      '🍓', '🍈', '🍒', '🍑', '🥭', '🍍', '🥥', '🥝',
      '🍅', '🍆', '🥑', '🥦', '🥬', '🥒', '🌶️', '🌽',
      '🥕', '🥗', '🍕', '🍔', '🌭', '🍟', '🍗', '🥓',
    ],
  },
  {
    name: '活动',
    icon: '⚽',
    emojis: [
      '⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉',
      '🥏', '🎱', '🪀', '🏓', '🏸', '🏒', '🏑', '🥍',
      '🏏', '🥅', '⛳', '🪁', '🏹', '🎣', '🤿', '🥊',
      '🥋', '🎽', '🛹', '🛷', '⛸️', '🥌', '🎿', '⛷️',
    ],
  },
  {
    name: '旅行',
    icon: '🚗',
    emojis: [
      '🚗', '🚕', '🚙', '🚌', '🚎', '🏎️', '🚓', '🚑',
      '🚒', '🚐', '🚚', '🚛', '🚜', '🦯', '🦽', '🦼',
      '🛴', '🚲', '🛵', '🏍️', '🛺', '🚨', '🚔', '🚍',
      '🚘', '🚖', '🚡', '🚠', '🚟', '🚃', '🚋', '🚞',
    ],
  },
  {
    name: '符号',
    icon: '⭐',
    emojis: [
      '⭐', '🌟', '✨', '⚡', '☄️', '💥', '🔥', '🌈',
      '☀️', '🌤️', '⛅', '🌥️', '☁️', '🌦️', '🌧️', '⛈️',
      '🌩️', '🌨️', '❄️', '☃️', '⛄', '🌬️', '💨', '💧',
      '💦', '☔', '☂️', '🌊', '🌫️', '✅', '❌', '⭕',
    ],
  },
] as const

/**
 * 快速表情（最常用）
 */
export const QUICK_EMOJIS = [
  '😀', '😅', '😂', '🤣', '😊', '😍', '🥰', '😘',
  '😎', '🤔', '😢', '😭', '😡', '🤯', '😱', '🥳',
  '👍', '👎', '👏', '🙏', '💪', '✌️', '🤝', '❤️',
  '🎉', '🎊', '🎈', '🎁', '⭐', '✨', '🔥', '💯',
] as const

// ==================== 快捷键提示 ====================

/**
 * 快捷键提示文本
 */
export const SHORTCUT_HINTS: Record<SendShortcut, string> = {
  'enter': 'Enter 发送',
  'ctrl+enter': 'Ctrl+Enter 发送',
  'cmd+enter': '⌘+Enter 发送',
  'shift+enter': 'Shift+Enter 发送',
} as const

/**
 * 操作系统特定的快捷键
 */
export const OS_SHORTCUTS = {
  windows: {
    send: 'Ctrl+Enter',
    newLine: 'Enter',
    bold: 'Ctrl+B',
    italic: 'Ctrl+I',
    underline: 'Ctrl+U',
    code: 'Ctrl+Shift+C',
  },
  macos: {
    send: '⌘+Enter',
    newLine: 'Enter',
    bold: '⌘+B',
    italic: '⌘+I',
    underline: '⌘+U',
    code: '⌘+Shift+C',
  },
  linux: {
    send: 'Ctrl+Enter',
    newLine: 'Enter',
    bold: 'Ctrl+B',
    italic: 'Ctrl+I',
    underline: 'Ctrl+U',
    code: 'Ctrl+Shift+C',
  },
} as const

// ==================== 建议类型图标 ====================

/**
 * 建议类型对应的图标
 */
export const SUGGESTION_TYPE_ICONS: Record<SuggestionType, string> = {
  prompt: '💡',
  command: '⚡',
  template: '📝',
  quick_reply: '💬',
} as const

// ==================== 错误消息 ====================

/**
 * 错误消息常量
 */
export const ERROR_MESSAGES = {
  FILE_TOO_LARGE: '文件大小超过限制',
  FILE_TYPE_NOT_ALLOWED: '不支持的文件类型',
  TOO_MANY_FILES: '附件数量超过限制',
  INVALID_FILE_NAME: '文件名包含非法字符',
  MESSAGE_TOO_LONG: '消息长度超过限制',
  MESSAGE_EMPTY: '消息不能为空',
  UPLOAD_FAILED: '文件上传失败',
  NETWORK_ERROR: '网络错误，请重试',
  UNKNOWN_ERROR: '未知错误',
} as const

// ==================== 文件类型图标 ====================

/**
 * 文件类型对应的图标（可以用 emoji 或自定义图标）
 */
export const FILE_TYPE_ICONS = {
  image: '🖼️',
  document: '📄',
  audio: '🎵',
  video: '🎬',
  pdf: '📕',
  word: '📘',
  excel: '📊',
  powerpoint: '📙',
  text: '📝',
  zip: '🗜️',
  other: '📎',
} as const

// ==================== ARIA 标签 ====================

/**
 * ARIA 标签常量（用于无障碍）
 */
export const ARIA_LABELS = {
  inputBox: '消息输入框',
  sendButton: '发送消息',
  attachmentButton: '添加附件',
  emojiButton: '选择表情',
  voiceButton: '语音输入',
  removeAttachment: '移除附件',
  suggestionItem: '建议提示',
  charCount: '字符计数',
} as const

// ==================== CSS 类名 ====================

/**
 * CSS 类名常量（用于避免魔法字符串）
 */
export const CSS_CLASSES = {
  container: 'inputBox',
  inputContainer: 'inputContainer',
  textarea: 'textarea',
  toolbar: 'toolbar',
  toolButton: 'toolButton',
  sendButton: 'sendButton',
  suggestions: 'suggestions',
  suggestionItem: 'suggestionItem',
  attachments: 'attachments',
  attachmentItem: 'attachmentItem',
  emojiPicker: 'emojiPicker',
  error: 'error',
  disabled: 'disabled',
  focused: 'focused',
  streaming: 'streaming',
  dragging: 'dragging',
} as const

// ==================== 动画持续时间 ====================

/**
 * 动画持续时间常量（毫秒）
 */
export const ANIMATION_DURATION = {
  fast: 150,
  normal: 200,
  slow: 300,
  veryFast: 100,
  verySlow: 500,
} as const

// ==================== 验证规则 ====================

/**
 * 内置验证规则
 */
export const VALIDATION_RULES = {
  /** 不能为空 */
  required: {
    validator: (value: string) => value.trim().length > 0,
    message: '内容不能为空',
  },
  /** 不能只包含空格 */
  noWhitespaceOnly: {
    validator: (value: string) => value.trim().length > 0 || value.length === 0,
    message: '不能只包含空格',
  },
  /** 不能包含 HTML 标签 */
  noHtml: {
    pattern: /^[^<>]*$/,
    message: '不能包含 HTML 标签',
  },
  /** 只能包含字母和数字 */
  alphanumeric: {
    pattern: /^[a-zA-Z0-9]*$/,
    message: '只能包含字母和数字',
  },
  /** 邮箱格式 */
  email: {
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    message: '邮箱格式不正确',
  },
  /** URL 格式 */
  url: {
    pattern: /^https?:\/\/.+/,
    message: 'URL 格式不正确',
  },
} as const

// ==================== 默认建议 ====================

/**
 * 默认建议列表（示例）
 */
export const DEFAULT_SUGGESTIONS = [
  {
    id: 'greeting-1',
    text: '你好！',
    icon: '👋',
    type: 'quick_reply' as SuggestionType,
  },
  {
    id: 'greeting-2',
    text: '早上好！',
    icon: '🌅',
    type: 'quick_reply' as SuggestionType,
  },
  {
    id: 'thanks-1',
    text: '谢谢！',
    icon: '🙏',
    type: 'quick_reply' as SuggestionType,
  },
  {
    id: 'help-1',
    text: '我需要帮助',
    icon: '🆘',
    type: 'prompt' as SuggestionType,
  },
] as const

// ==================== 键盘按键代码 ====================

/**
 * 键盘按键代码
 */
export const KEY_CODES = {
  ENTER: 'Enter',
  ESCAPE: 'Escape',
  TAB: 'Tab',
  BACKSPACE: 'Backspace',
  DELETE: 'Delete',
  ARROW_UP: 'ArrowUp',
  ARROW_DOWN: 'ArrowDown',
  ARROW_LEFT: 'ArrowLeft',
  ARROW_RIGHT: 'ArrowRight',
  SPACE: ' ',
} as const

// ==================== 格式化工具栏操作 ====================

/**
 * 格式化工具栏操作
 */
export const FORMAT_ACTIONS = [
  {
    id: 'bold',
    label: '粗体',
    icon: '𝐁',
    shortcut: 'Ctrl+B',
    wrap: ['**', '**'],
  },
  {
    id: 'italic',
    label: '斜体',
    icon: '𝐼',
    shortcut: 'Ctrl+I',
    wrap: ['*', '*'],
  },
  {
    id: 'underline',
    label: '下划线',
    icon: 'U̲',
    shortcut: 'Ctrl+U',
    wrap: ['__', '__'],
  },
  {
    id: 'strikethrough',
    label: '删除线',
    icon: 'S̶',
    shortcut: 'Ctrl+Shift+X',
    wrap: ['~~', '~~'],
  },
  {
    id: 'code',
    label: '代码',
    icon: '</>',
    shortcut: 'Ctrl+Shift+C',
    wrap: ['`', '`'],
  },
  {
    id: 'link',
    label: '链接',
    icon: '🔗',
    shortcut: 'Ctrl+K',
    wrap: ['[', '](url)'],
  },
] as const

// ==================== 语音识别语言 ====================

/**
 * 支持的语音识别语言
 */
export const VOICE_LANGUAGES = [
  { code: 'zh-CN', name: '中文（简体）' },
  { code: 'zh-TW', name: '中文（繁體）' },
  { code: 'en-US', name: 'English (US)' },
  { code: 'en-GB', name: 'English (UK)' },
  { code: 'ja-JP', name: '日本語' },
  { code: 'ko-KR', name: '한국어' },
  { code: 'fr-FR', name: 'Français' },
  { code: 'de-DE', name: 'Deutsch' },
  { code: 'es-ES', name: 'Español' },
  { code: 'ru-RU', name: 'Русский' },
] as const

// ==================== 主题颜色 ====================

/**
 * 预设主题颜色
 */
export const THEME_COLORS = {
  blue: {
    primary: '#2196f3',
    light: '#e3f2fd',
    dark: '#1976d2',
  },
  green: {
    primary: '#4caf50',
    light: '#e8f5e9',
    dark: '#388e3c',
  },
  purple: {
    primary: '#9c27b0',
    light: '#f3e5f5',
    dark: '#7b1fa2',
  },
  orange: {
    primary: '#ff9800',
    light: '#fff3e0',
    dark: '#f57c00',
  },
  red: {
    primary: '#f44336',
    light: '#ffebee',
    dark: '#d32f2f',
  },
} as const

