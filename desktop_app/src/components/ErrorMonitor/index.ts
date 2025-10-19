/**
 * 错误监控组件导出
 */

export { default as ErrorMonitorPanel } from './ErrorMonitorPanel'
export { default as ErrorDetailsModal } from './ErrorDetailsModal'

// 类型导出
export type { 
  ErrorDetails,
  ErrorStatistics,
  ErrorMonitorConfig,
  UseErrorMonitorResult,
  ErrorBoundaryProps,
  ErrorBoundaryFallbackProps
} from '../../types/error'

// 服务导出
export { errorMonitoringService } from '../../services/errorMonitoringService'
export { getErrorReportingService, ErrorReportingService } from '../../services/errorReportingService'
export { errorRecoveryService } from '../../services/errorRecoveryService'

// Hook 导出
export { useErrorMonitor } from '../../hooks/useErrorMonitor'

// 工具导出
export { 
  globalErrorCatcher, 
  reportReactError, 
  initializeGlobalErrorCatcher 
} from '../../utils/globalErrorCatcher'
