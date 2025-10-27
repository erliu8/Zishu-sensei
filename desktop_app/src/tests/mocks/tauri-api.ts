/**
 * Tauri API Mocks for Testing
 * 
 * Provides mock implementations of Tauri API functions for unit tests
 */

import { vi } from 'vitest'

// Mock invoke function
export const invoke = vi.fn()

// Mock listen function  
export const listen = vi.fn()

// Mock emit function
export const emit = vi.fn()

// Mock once function
export const once = vi.fn()

// Default exports
export default {
  invoke,
  listen,
  emit,
  once,
}

