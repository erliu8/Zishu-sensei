/**
 * React Hooks 导出
 */

// 权限相关 Hooks
export {
  usePermissions,
  useEntityGrants,
  usePendingGrants,
  usePermissionCheck,
  usePermissionStats,
  usePermissionUsageLogs,
  usePermissionPresets,
} from './usePermission';

export {
  usePermissionDialog,
  usePermissionQueue,
} from './usePermissionDialog';

// 工具类 Hooks
export {
  useDebounce,
  useThrottle,
  useWindowSize,
  useMediaQuery,
  useClickOutside,
  useKeyPress,
  useOnlineStatus,
  useLocalTime,
  useInterval,
  useTimeout,
  usePrevious,
  useToggle,
  useCounter,
  useArray,
} from './useUtils';

// 导出现有的 Hooks（如果有的话）
// export * from './useKeyboardShortcuts';
// ... 其他 hooks
