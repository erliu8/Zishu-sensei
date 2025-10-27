/**
 * Services Index
 * 
 * This file exports all service modules for easy importing.
 */

// Core services
export { default as ChatService } from './chat';
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
