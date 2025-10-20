/**
 * 日志系统组件导出
 * 
 * 提供完整的日志系统组件：
 * - LogViewer - 日志查看器
 * - LogConfig - 日志配置管理
 * - 相关的 Hook 和服务
 */

export { LogViewer } from './LogViewer';
export { LogConfig } from './LogConfig';

// 便捷组件组合
import React from 'react';
import { LogViewer } from './LogViewer';
import { LogConfig } from './LogConfig';

// 完整的日志管理界面
export interface LogManagementProps {
  /** 初始显示的标签页 */
  initialTab?: 'viewer' | 'config';
  /** 是否显示为模态框 */
  isModal?: boolean;
  /** 关闭回调 */
  onClose?: () => void;
}

export const LogManagement: React.FC<LogManagementProps> = ({
  initialTab = 'viewer',
  isModal = false,
  onClose
}) => {
  const [activeTab, setActiveTab] = React.useState<'viewer' | 'config'>(initialTab);

  return (
    <div className={`log-management ${isModal ? 'modal' : ''}`}>
      <div className="log-management-tabs">
        <button 
          className={`tab-btn ${activeTab === 'viewer' ? 'active' : ''}`}
          onClick={() => setActiveTab('viewer')}
        >
          日志查看
        </button>
        <button 
          className={`tab-btn ${activeTab === 'config' ? 'active' : ''}`}
          onClick={() => setActiveTab('config')}
        >
          系统配置
        </button>
        {isModal && onClose && (
          <button className="btn btn-close" onClick={onClose}>×</button>
        )}
      </div>
      
      <div className="log-management-content">
        {activeTab === 'viewer' && (
          <LogViewer 
            isModal={false}
            autoRefresh={true}
            refreshInterval={30}
          />
        )}
        {activeTab === 'config' && (
          <LogConfig 
            isModal={false}
          />
        )}
      </div>
    </div>
  );
};

export default LogManagement;
