/**
 * 更新管理器组件
 * 
 * 提供完整的更新管理界面，包括：
 * - 更新检查和状态显示
 * - 更新配置设置
 * - 版本历史查看
 * - 统计信息显示
 */

import React, { useState, useEffect } from 'react';
import { 
  Settings, 
  RefreshCw, 
  Download, 
  Check, 
  AlertCircle, 
  Clock, 
  BarChart3,
  History,
  Trash2,
  Undo2,
  ExternalLink,
  Info
} from 'lucide-react';
import {
  useUpdateManager,
  useUpdateCheck,
  useUpdateConfig,
  useVersionHistory,
  useUpdateStats,
  useAppVersion
} from '../../hooks/useUpdate';
import {
  UpdateStatus,
  UpdateType,
  UpdateTypeText,
  UpdateStatusText,
  UpdateTypeColor,
  UpdateStatusColor,
  formatFileSize,
  formatDateTime,
  formatRelativeTime,
  updateChannelOptions,
  networkTypeOptions,
  checkIntervalOptions
} from '../../types/update';

interface UpdateManagerProps {
  /** 自定义样式类名 */
  className?: string;
  /** 是否显示为紧凑模式 */
  compact?: boolean;
}

/**
 * 更新管理器主组件
 */
export const UpdateManager: React.FC<UpdateManagerProps> = ({
  className = '',
  compact = false
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'settings' | 'history' | 'stats'>('overview');
  
  const { isInitialized, isInitializing, initError } = useUpdateManager();
  const { currentVersion } = useAppVersion();

  if (!isInitialized) {
    return (
      <div className={`p-6 text-center ${className}`}>
        {isInitializing ? (
          <div className="flex items-center justify-center gap-2">
            <RefreshCw className="animate-spin" size={20} />
            <span>初始化更新管理器...</span>
          </div>
        ) : (
          <div className="text-red-600">
            <AlertCircle className="mx-auto mb-2" size={24} />
            <div>更新管理器初始化失败</div>
            {initError && <div className="text-sm mt-1">{initError}</div>}
          </div>
        )}
      </div>
    );
  }

  const tabs = [
    { id: 'overview', label: '概览', icon: Info },
    { id: 'settings', label: '设置', icon: Settings },
    { id: 'history', label: '历史', icon: History },
    { id: 'stats', label: '统计', icon: BarChart3 },
  ] as const;

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm ${className}`}>
      {/* 标签页导航 */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`
                flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors
                ${activeTab === id
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                }
              `}
            >
              <Icon size={16} />
              {!compact && label}
            </button>
          ))}
        </nav>
      </div>

      {/* 标签页内容 */}
      <div className="p-6">
        {activeTab === 'overview' && <UpdateOverview compact={compact} currentVersion={currentVersion} />}
        {activeTab === 'settings' && <UpdateSettings compact={compact} />}
        {activeTab === 'history' && <UpdateHistory compact={compact} />}
        {activeTab === 'stats' && <UpdateStats compact={compact} />}
      </div>
    </div>
  );
};

/**
 * 更新概览组件
 */
const UpdateOverview: React.FC<{ compact: boolean; currentVersion: string }> = ({ compact, currentVersion }) => {
  const {
    updateInfo,
    hasUpdate,
    isChecking,
    checkError,
    lastCheckTime,
    checkForUpdates,
    isUpdateAvailable,
    isUpdateInProgress,
    isUpdateFailed
  } = useUpdateCheck();

  const handleCheckUpdate = async () => {
    try {
      await checkForUpdates(true);
    } catch (error) {
      console.error('Check update failed:', error);
    }
  };

  return (
    <div className="space-y-6">
      {/* 当前状态卡片 */}
      <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            应用状态
          </h3>
          <button
            onClick={handleCheckUpdate}
            disabled={isChecking}
            className="flex items-center gap-2 px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={isChecking ? 'animate-spin' : ''} size={14} />
            {isChecking ? '检查中...' : '检查更新'}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <div className="text-sm text-gray-600 dark:text-gray-300">当前版本</div>
            <div className="text-lg font-medium text-gray-900 dark:text-white">
              {currentVersion}
            </div>
          </div>
          
          {updateInfo && (
            <div>
              <div className="text-sm text-gray-600 dark:text-gray-300">最新版本</div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-medium text-gray-900 dark:text-white">
                  {updateInfo.version}
                </span>
                <span className={`px-2 py-0.5 rounded text-xs text-white bg-${UpdateTypeColor[updateInfo.update_type]}`}>
                  {UpdateTypeText[updateInfo.update_type]}
                </span>
              </div>
            </div>
          )}
        </div>

        {lastCheckTime && (
          <div className="mt-3 text-sm text-gray-500">
            上次检查: {formatRelativeTime(lastCheckTime.toISOString())}
          </div>
        )}

        {checkError && (
          <div className="mt-3 flex items-center gap-2 text-red-600 text-sm">
            <AlertCircle size={14} />
            {checkError}
          </div>
        )}
      </div>

      {/* 更新信息卡片 */}
      {updateInfo && (
        <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-4">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
                {updateInfo.title}
              </h4>
              <div className="flex items-center gap-2 mt-1">
                <span className={`px-2 py-0.5 rounded text-xs text-white bg-${UpdateStatusColor[updateInfo.status]}`}>
                  {UpdateStatusText[updateInfo.status]}
                </span>
                <span className="text-sm text-gray-500">
                  {formatDateTime(updateInfo.release_date)}
                </span>
              </div>
            </div>
            
            {updateInfo.is_mandatory && (
              <span className="px-2 py-1 bg-red-100 text-red-800 rounded text-xs font-medium">
                强制更新
              </span>
            )}
          </div>

          <p className="text-gray-700 dark:text-gray-300 mb-4">
            {updateInfo.description}
          </p>

          {updateInfo.file_size && (
            <div className="text-sm text-gray-500 mb-4">
              文件大小: {formatFileSize(updateInfo.file_size)}
            </div>
          )}

          {/* 进度显示 */}
          {isUpdateInProgress && (
            <div className="mb-4">
              <div className="flex justify-between text-sm mb-1">
                <span>
                  {updateInfo.status === UpdateStatus.Downloading ? '下载进度' : '安装进度'}
                </span>
                <span>
                  {updateInfo.status === UpdateStatus.Downloading 
                    ? `${updateInfo.download_progress.toFixed(1)}%`
                    : `${updateInfo.install_progress.toFixed(1)}%`
                  }
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ 
                    width: `${updateInfo.status === UpdateStatus.Downloading 
                      ? updateInfo.download_progress 
                      : updateInfo.install_progress
                    }%` 
                  }}
                />
              </div>
            </div>
          )}

          {/* 更新日志 */}
          {updateInfo.changelog && (
            <details className="mt-4">
              <summary className="cursor-pointer text-blue-600 hover:text-blue-700 font-medium">
                查看更新日志
              </summary>
              <div className="mt-2 p-3 bg-gray-50 dark:bg-gray-700 rounded border text-sm">
                <div dangerouslySetInnerHTML={{ __html: updateInfo.changelog }} />
              </div>
            </details>
          )}

          {/* 错误信息 */}
          {updateInfo.error_message && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded">
              <div className="flex items-center gap-2 text-red-800 text-sm">
                <AlertCircle size={14} />
                {updateInfo.error_message}
              </div>
              {updateInfo.retry_count > 0 && (
                <div className="text-red-600 text-xs mt-1">
                  已重试 {updateInfo.retry_count} 次
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 无更新状态 */}
      {!hasUpdate && !isChecking && !checkError && (
        <div className="text-center py-8">
          <Check className="mx-auto mb-3 text-green-600" size={48} />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            应用已是最新版本
          </h3>
          <p className="text-gray-600 dark:text-gray-300">
            当前运行的是最新版本 {currentVersion}
          </p>
        </div>
      )}
    </div>
  );
};

/**
 * 更新设置组件
 */
const UpdateSettings: React.FC<{ compact: boolean }> = ({ compact }) => {
  const { config, isLoading, error, hasChanges, updateConfig, saveConfig, resetConfig } = useUpdateConfig();

  const handleSave = async () => {
    if (!config) return;
    await saveConfig(config);
  };

  const handleReset = () => {
    resetConfig();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <RefreshCw className="animate-spin mr-2" size={20} />
        加载设置中...
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <AlertCircle className="mx-auto mb-2 text-red-600" size={24} />
        <div className="text-red-600">加载设置失败</div>
        <div className="text-sm text-gray-500 mt-1">{error}</div>
      </div>
    );
  }

  if (!config) return null;

  return (
    <div className="space-y-6">
      {/* 保存按钮 */}
      {hasChanges && (
        <div className="flex items-center gap-2 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <Info size={16} className="text-blue-600" />
          <span className="flex-1 text-blue-800">您有未保存的更改</span>
          <div className="flex gap-2">
            <button
              onClick={handleReset}
              className="px-3 py-1 text-gray-600 hover:text-gray-800 text-sm"
            >
              重置
            </button>
            <button
              onClick={handleSave}
              className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
            >
              保存设置
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 基本设置 */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">基本设置</h3>
          
          <div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={config.auto_check_enabled}
                onChange={(e) => updateConfig({ auto_check_enabled: e.target.checked })}
                className="rounded"
              />
              <span className="text-sm">自动检查更新</span>
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              检查间隔
            </label>
            <select
              value={config.check_interval_hours}
              onChange={(e) => updateConfig({ check_interval_hours: parseInt(e.target.value) })}
              className="w-full p-2 border border-gray-300 rounded text-sm"
              disabled={!config.auto_check_enabled}
            >
              {checkIntervalOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              更新通道
            </label>
            <select
              value={config.update_channel}
              onChange={(e) => updateConfig({ update_channel: e.target.value })}
              className="w-full p-2 border border-gray-300 rounded text-sm"
            >
              {updateChannelOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={config.include_prerelease}
                onChange={(e) => updateConfig({ include_prerelease: e.target.checked })}
                className="rounded"
              />
              <span className="text-sm">包含预发布版本</span>
            </label>
          </div>
        </div>

        {/* 高级设置 */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">高级设置</h3>
          
          <div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={config.auto_download_enabled}
                onChange={(e) => updateConfig({ auto_download_enabled: e.target.checked })}
                className="rounded"
              />
              <span className="text-sm">自动下载更新</span>
            </label>
          </div>

          <div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={config.auto_install_enabled}
                onChange={(e) => updateConfig({ auto_install_enabled: e.target.checked })}
                className="rounded"
              />
              <span className="text-sm">自动安装更新</span>
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              允许的网络类型
            </label>
            <select
              value={config.allowed_network_types}
              onChange={(e) => updateConfig({ allowed_network_types: e.target.value })}
              className="w-full p-2 border border-gray-300 rounded text-sm"
            >
              {networkTypeOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              最大重试次数
            </label>
            <input
              type="number"
              min="0"
              max="10"
              value={config.max_retry_count}
              onChange={(e) => updateConfig({ max_retry_count: parseInt(e.target.value) || 0 })}
              className="w-full p-2 border border-gray-300 rounded text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              下载超时时间（秒）
            </label>
            <input
              type="number"
              min="30"
              max="3600"
              value={config.download_timeout_seconds}
              onChange={(e) => updateConfig({ download_timeout_seconds: parseInt(e.target.value) || 300 })}
              className="w-full p-2 border border-gray-300 rounded text-sm"
            />
          </div>
        </div>
      </div>

      {/* 备份设置 */}
      <div className="border-t pt-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">备份设置</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={config.backup_before_update}
                onChange={(e) => updateConfig({ backup_before_update: e.target.checked })}
                className="rounded"
              />
              <span className="text-sm">更新前自动备份</span>
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              最大备份保留数量
            </label>
            <input
              type="number"
              min="1"
              max="10"
              value={config.max_backup_count}
              onChange={(e) => updateConfig({ max_backup_count: parseInt(e.target.value) || 1 })}
              className="w-full p-2 border border-gray-300 rounded text-sm"
              disabled={!config.backup_before_update}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * 版本历史组件
 */
const UpdateHistory: React.FC<{ compact: boolean }> = ({ compact }) => {
  const { history, isLoading, error, rollbackToVersion } = useVersionHistory();

  const handleRollback = async (version: string) => {
    if (confirm(`确定要回滚到版本 ${version} 吗？`)) {
      try {
        await rollbackToVersion(version);
      } catch (error) {
        console.error('Rollback failed:', error);
      }
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <RefreshCw className="animate-spin mr-2" size={20} />
        加载历史中...
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <AlertCircle className="mx-auto mb-2 text-red-600" size={24} />
        <div className="text-red-600">加载历史失败</div>
        <div className="text-sm text-gray-500 mt-1">{error}</div>
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="text-center py-8">
        <History className="mx-auto mb-3 text-gray-400" size={48} />
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
          暂无历史记录
        </h3>
        <p className="text-gray-600 dark:text-gray-300">
          版本更新历史记录将在这里显示
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          版本历史 ({history.length})
        </h3>
      </div>

      <div className="space-y-3">
        {history.map((item, index) => (
          <div
            key={item.id || index}
            className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-600 rounded-lg"
          >
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium text-gray-900 dark:text-white">
                  版本 {item.version}
                </span>
                {item.is_rollback && (
                  <span className="px-2 py-0.5 bg-orange-100 text-orange-800 rounded text-xs">
                    回滚
                  </span>
                )}
                <span className="px-2 py-0.5 bg-gray-100 text-gray-800 rounded text-xs">
                  {item.install_source}
                </span>
              </div>
              
              <div className="text-sm text-gray-600 dark:text-gray-300">
                <div>安装时间: {formatDateTime(item.installed_at)}</div>
                {item.notes && (
                  <div className="mt-1 text-xs">备注: {item.notes}</div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleRollback(item.version)}
                className="flex items-center gap-1 px-2 py-1 text-blue-600 hover:text-blue-700 text-sm"
                title="回滚到此版本"
              >
                <Undo2 size={14} />
                回滚
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * 更新统计组件
 */
const UpdateStats: React.FC<{ compact: boolean }> = ({ compact }) => {
  const { stats, isLoading, error } = useUpdateStats();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <RefreshCw className="animate-spin mr-2" size={20} />
        加载统计中...
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <AlertCircle className="mx-auto mb-2 text-red-600" size={24} />
        <div className="text-red-600">加载统计失败</div>
        <div className="text-sm text-gray-500 mt-1">{error}</div>
      </div>
    );
  }

  if (!stats) return null;

  const successRate = stats.total_updates > 0 
    ? ((stats.installed_updates / stats.total_updates) * 100).toFixed(1)
    : '0';

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">更新统计</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 className="text-blue-600" size={20} />
            <span className="text-sm font-medium text-blue-800">总更新数</span>
          </div>
          <div className="text-2xl font-bold text-blue-900">
            {stats.total_updates}
          </div>
        </div>

        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Check className="text-green-600" size={20} />
            <span className="text-sm font-medium text-green-800">成功安装</span>
          </div>
          <div className="text-2xl font-bold text-green-900">
            {stats.installed_updates}
          </div>
        </div>

        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="text-red-600" size={20} />
            <span className="text-sm font-medium text-red-800">更新失败</span>
          </div>
          <div className="text-2xl font-bold text-red-900">
            {stats.failed_updates}
          </div>
        </div>

        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <History className="text-gray-600" size={20} />
            <span className="text-sm font-medium text-gray-800">版本记录</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">
            {stats.version_count}
          </div>
        </div>
      </div>

      <div className="bg-gradient-to-r from-blue-50 to-green-50 border border-blue-200 rounded-lg p-6">
        <h4 className="text-lg font-semibold text-gray-900 mb-4">成功率</h4>
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <div className="flex justify-between text-sm mb-2">
              <span>成功率</span>
              <span>{successRate}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div 
                className="bg-gradient-to-r from-blue-500 to-green-500 h-3 rounded-full transition-all duration-500"
                style={{ width: `${successRate}%` }}
              />
            </div>
          </div>
          <div className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-green-600">
            {successRate}%
          </div>
        </div>
      </div>
    </div>
  );
};

export default UpdateManager;
