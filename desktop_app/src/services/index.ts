/**
 * Services Index
 * 
 * This file exports all service modules for easy importing.
 */

// Core services
export { default as ApiService } from './api';
export { default as ChatService } from './chat';
export { default as CharacterService } from './character';
export { default as SettingsService } from './settings';
export { default as DesktopService } from './desktop';
export { default as SoundService } from './sound';
export { default as StorageService } from './storage';

// Adapter services
export { default as AdapterService } from './adapter';

// Type definitions
export * from './types';

// Re-export commonly used types
export type {
  CommandResponse,
  PaginatedResponse,
  AppConfig,
  ChatMessage,
  ChatSession,
  Character,
  SystemInfo,
  AppVersion,
} from './types';
