/**
 * 更新组件导出
 */

export { UpdateNotification } from '../common/UpdateNotification';
export { default as UpdateManager } from './UpdateManager';

// 导出更新相关的 hooks 和服务
export * from '../../hooks/useUpdate';
export * from '../../services/updateService';
export * from '../../types/update';
