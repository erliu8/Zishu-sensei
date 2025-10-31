/**
 * Common Type Definitions
 * 
 * This file contains shared type definitions used across the application.
 */

// ================================
// Command Response Types
// ================================

export interface CommandResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  has_next: boolean;
  has_prev: boolean;
  total_pages: number;
}

// ================================
// Error Types
// ================================

export interface ApiError {
  code: string;
  message: string;
  details?: any;
}

export interface ValidationError {
  field: string;
  message: string;
  value?: any;
}

// ================================
// Configuration Types
// ================================

export interface AppConfig {
  window: WindowConfig;
  character: CharacterConfig;
  theme: ThemeConfig;
  system: SystemConfig;
}

export interface WindowConfig {
  width: number;
  height: number;
  always_on_top: boolean;
  transparent: boolean;
  decorations: boolean;
  resizable: boolean;
  position?: [number, number];
}

export interface CharacterConfig {
  current_character: string;
  scale: number;
  auto_idle: boolean;
  interaction_enabled: boolean;
}

export interface ThemeConfig {
  current_theme: string;
  custom_css?: string;
}

export interface SystemConfig {
  auto_start: boolean;
  minimize_to_tray: boolean;
  close_to_tray: boolean;
  show_notifications: boolean;
}

// ================================
// Chat Types
// ================================

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  metadata?: Record<string, any>;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  created_at: number;
  updated_at: number;
  model_config?: ModelConfig;
}

export interface ModelConfig {
  model_name: string;
  temperature: number;
  max_tokens: number;
  top_p: number;
  frequency_penalty: number;
  presence_penalty: number;
}

// ================================
// Character Types
// ================================

export interface Character {
  id: string;
  name: string;
  display_name: string;
  description: string;
  avatar_url?: string;
  model_path: string;
  motions: CharacterMotion[];
  expressions: CharacterExpression[];
  voice_config?: VoiceConfig;
}

export interface CharacterMotion {
  id: string;
  name: string;
  file_path: string;
  duration: number;
  loop: boolean;
}

export interface CharacterExpression {
  id: string;
  name: string;
  parameters: Record<string, number>;
}

export interface VoiceConfig {
  voice_id: string;
  speed: number;
  pitch: number;
  volume: number;
}

// ================================
// Desktop Types
// ================================

export interface DesktopInfo {
  screen_width: number;
  screen_height: number;
  available_width: number;
  available_height: number;
  scale_factor: number;
  primary_monitor: boolean;
}

// ================================
// System Types
// ================================

export interface SystemInfo {
  os: string;
  arch: string;
  version: string;
  memory_total: number;
  memory_available: number;
  cpu_count: number;
  cpu_model?: string;
}

export interface AppVersion {
  version: string;
  build: string;
  commit: string;
  build_date: string;
}

// ================================
// Utility Types
// ================================

export type SortOrder = 'asc' | 'desc';

export interface PaginationParams {
  page: number;
  page_size: number;
  sort_by?: string;
  sort_order?: SortOrder;
}

export interface SearchParams {
  query: string;
  fields?: string[];
  filters?: Record<string, any>;
  pagination?: PaginationParams;
}

// ================================
// Event Types
// ================================

export interface AppEvent {
  type: string;
  data: any;
  timestamp: number;
}

export interface WindowEvent extends AppEvent {
  type: 'window' | 'resize' | 'move' | 'focus' | 'blur';
  window_id: string;
}

export interface AdapterEvent extends AppEvent {
  type: 'adapter_installed' | 'adapter_uninstalled' | 'adapter_loaded' | 'adapter_unloaded';
  adapter_id: string;
}

// ================================
// API Types
// ================================

export interface ApiRequest<T = any> {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  url: string;
  headers?: Record<string, string>;
  body?: T;
  params?: Record<string, any>;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: ApiError;
  status: number;
  headers: Record<string, string>;
}

// ================================
// Storage Types
// ================================

export interface StorageItem<T = any> {
  key: string;
  value: T;
  expires_at?: number;
  created_at: number;
  updated_at: number;
}

export interface StorageConfig {
  max_size: number;
  default_ttl: number;
  compression: boolean;
}

// ================================
// Plugin Types
// ================================

export interface PluginInfo {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  license: string;
  dependencies: string[];
  capabilities: string[];
  config_schema: Record<string, any>;
}

export interface PluginConfig {
  enabled: boolean;
  settings: Record<string, any>;
  permissions: string[];
}

// ================================
// Export All Types
// ================================

// Removed to avoid circular dependency
// Import adapter types directly from './adapter' when needed
