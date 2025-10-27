/**
 * API 服务统一导出
 * 
 * @module services/api
 */

// 聊天 API
export { default as ChatAPI } from './chat';
export type { 
  ChatMessage, 
  SendChatMessageRequest, 
  ChatResponse, 
  StreamChunk,
  HistoryMessage,
  ChatHistoryResponse,
  ModelConfig,
  ModelInfo,
  ChatError,
  StreamCallback,
  StreamOptions,
  BatchSendOptions,
  BatchSendResult,
  MessageRole
} from './chat';
export { StreamManager } from './chat';

// 桌面操作 API
export { default as DesktopAPI } from './desktop';
export type {
  DesktopInfo,
  DisplayInfo,
  WindowInfo,
  SystemResources,
  WorkflowDefinition,
  WorkflowStep,
  WorkflowConfig,
  WorkflowExecution,
  ExecutionLog,
  TaskInfo,
  TaskMonitorStats,
  DesktopEventType,
  DesktopEvent,
  DesktopEventListener
} from './desktop';
export { WorkflowStatus, DesktopEventManager } from './desktop';

// 适配器 API
export * from './adapter';
export { default as AdapterAPI } from './adapter';

// 系统 API
export { default as SystemAPI } from './system';
export type {
  SystemInfo,
  AppVersionInfo,
  UpdateInfo,
  AppDataPaths,
  SystemPerformanceMetrics,
  SystemEvent
} from './system';

// WebSocket API
export { WebSocketManager, createWebSocketManager, getDefaultWebSocketManager } from './websocket';
export type { WebSocketConfig, WebSocketMessage, MessageAck, ConnectionStats } from './websocket';

// 数据同步 API
export { SyncManager, createSyncManager } from './sync';
export type { SyncConfig } from './sync';

// API 版本管理
export { VersionManager, createVersionManager, versionUtils } from './version';
export type { 
  ApiVersion, 
  VersionMigration, 
  MigrationStep, 
  VersionCompatibility, 
  VersionManagerConfig 
} from './version';

// 用户 API
export { UserApiService, createUserApiService } from './user';
export type {
  User,
  UserPreferences,
  NotificationPreferences,
  PrivacyPreferences,
  AccessibilityPreferences,
  UserStats,
  UpdateUserParams,
  UpdatePasswordParams,
  SearchUsersParams
} from './user';

// 认证 API
export { AuthApiService, createAuthApiService } from './auth';
export type {
  LoginParams,
  RegisterParams,
  AuthResponse,
  RefreshTokenResponse,
  OAuthProvider,
  OAuthParams,
  TwoFactorSetup,
  TwoFactorVerifyParams
} from './auth';

// 对话 API
export { ConversationApiService, createConversationApiService } from './conversation';
export type {
  Conversation,
  Message,
  MessageAttachment,
  CreateConversationParams,
  UpdateConversationParams,
  SendMessageParams,
  SearchConversationsParams,
  SearchMessagesParams,
  ConversationShareSettings,
  ConversationShare,
  ConversationExportFormat
} from './conversation';

// API 服务工厂
export { 
  ApiServiceFactory, 
  getApiServiceFactory, 
  initializeApiServices, 
  getApiServices,
  apiServices 
} from './factory';
export type { ApiServicesConfig, ApiServices } from './factory';

