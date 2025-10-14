/**
 * InputBox 组件统一导出
 * 
 * 提供组件、类型、工具函数、Hooks 和常量的统一导出入口
 * @module InputBox
 */

// 主组件
export { default as InputBox } from './InputBox'
export { default } from './InputBox'

// 类型定义
export type {
  InputBoxProps,
  Attachment,
  AttachmentType,
  AttachmentStatus,
  AttachmentValidation,
  Suggestion,
  SuggestionType,
  SendShortcut,
  ValidationResult,
  FileSizeFormatOptions,
  FILE_TYPES,
} from './InputBox.types'

// 工具函数
export {
  getFileType,
  getFileExtension,
  getMimeTypeFromExtension,
  formatFileSize,
  parseFileSize,
  validateFile,
  validateFiles,
  fileToDataURL,
  fileToBase64,
  createImageThumbnail,
  insertTextAtCursor,
  getSelectedText,
  replaceSelectedText,
  wrapSelectedText,
  truncateText,
  escapeHtml,
  stripHtml,
  countCharacters,
  debounce,
  throttle,
  copyToClipboard,
  readFromClipboard,
  readFilesFromClipboard,
  generateId,
  sleep,
  isMobileDevice,
  isTouchDevice,
  getOS,
  getBrowser,
} from './utils'

// 自定义 Hooks
export {
  useInputValue,
  useCharCount,
  useAttachments,
  useAutoResize,
  useShortcuts,
  useValidation,
  useDragDrop,
  usePaste,
  useDebouncedCallback,
  useFocus,
  useEmojiPicker,
  useVoiceInput,
  useInputBox,
} from './hooks'

// 常量
export {
  DEFAULT_CONFIG,
  IMAGE_TYPES,
  DOCUMENT_TYPES,
  AUDIO_TYPES,
  VIDEO_TYPES,
  ALL_FILE_TYPES,
  EMOJI_CATEGORIES,
  QUICK_EMOJIS,
  SHORTCUT_HINTS,
  OS_SHORTCUTS,
  SUGGESTION_TYPE_ICONS,
  ERROR_MESSAGES,
  FILE_TYPE_ICONS,
  ARIA_LABELS,
  CSS_CLASSES,
  ANIMATION_DURATION,
  VALIDATION_RULES,
  DEFAULT_SUGGESTIONS,
  KEY_CODES,
  FORMAT_ACTIONS,
  VOICE_LANGUAGES,
  THEME_COLORS,
} from './constants'

