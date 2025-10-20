/**
 * Chat 组件测试套件索引
 * 
 * 统一导出所有 Chat 组件测试
 * @module Tests/Components/Chat
 */

// 导出所有测试文件
export * from './Chat.test'
export * from './ChatWindow.test'
export * from './MessageList.test'
export * from './MessageBubble.test'
export * from './InputBox.test'
export * from './VoiceInput.test'
export * from './TypingIndicator.test'

// 导出测试工具
export { chatTestHelpers } from '@/tests/utils/chat-test-helpers'
export { chatMocks, setupChatMocks, cleanupChatMocks } from '@/tests/mocks/chat-mocks'
export { chatTestUtils, testDataGenerator, chatTestConfig } from '@/tests/setup/chat-test-setup'

// 导出测试数据工厂
export {
  createMockMessage,
  createMockConversation,
  createMockSettings,
  MockMessage,
  MockCharacter,
} from '@/tests/mocks/factories'
