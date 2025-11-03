/**
 * 性能监控组件导出
 */

export { PerformanceMonitorPanel } from './PerformanceMonitorPanel';
export type { PerformanceMonitorPanelProps } from './PerformanceMonitorPanel';

// 重新导出相关类型
export type {
  PerformanceMetric,
  UserOperation,
  NetworkMetric,
  PerformanceSnapshot,
  PerformanceAlert,
  MonitorConfig,
  PerformanceStats,
  TimePeriod,
  PerformanceCategory,
  AlertSeverity,
  UserOperationType,
} from '../../types/performance';

// 重新导出服务和 Hooks
export { performanceService } from '../../services/performanceService';
export {
  usePerformanceMonitor,
  usePerformanceMetrics,
  useUserOperationTracker,
  useNetworkPerformance,
  usePerformanceSnapshots,
  usePerformanceAlerts,
  useRealTimePerformance,
  usePerformanceReport,
  useOperationTracker,
  usePerformanceUtils,
} from '../../hooks/usePerformanceMonitor';

// 重新导出集成服务
export { 
  performanceIntegration, 
  PerformanceIntegrationService,
  DEFAULT_INTEGRATION_CONFIG 
} from '../../services/performanceIntegration';
export { 
  usePerformanceIntegration, 
  useOperationTracker as useIntegrationOperationTracker, 
  useNetworkTracker, 
  useMetricsTracker 
} from '../../hooks/usePerformanceIntegration';

// 默认导出主组件
import PerformanceMonitorPanel from './PerformanceMonitorPanel';
export default PerformanceMonitorPanel;