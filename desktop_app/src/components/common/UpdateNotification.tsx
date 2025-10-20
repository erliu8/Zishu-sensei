import { AnimatePresence, motion } from 'framer-motion';
import React, { useEffect, useState, useCallback } from 'react';
import { Download, RefreshCw, AlertCircle, Check, X, Rocket, Settings } from 'lucide-react';
import { useUpdateCheck, useUpdateDownload, useUpdateInstall, useUpdateFlow } from '../../hooks/useUpdate';
import { UpdateStatus, UpdateType, UpdateTypeColor, formatFileSize, formatRelativeTime } from '../../types/update';

interface UpdateNotificationProps {
  /** 是否自动检查更新 */
  autoCheck?: boolean;
  /** 检查间隔（毫秒） */
  checkInterval?: number;
  /** 是否显示详细信息 */
  showDetails?: boolean;
  /** 自定义样式类名 */
  className?: string;
  /** 自定义位置 */
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  /** 是否可拖拽 */
  draggable?: boolean;
}

/**
 * 更新通知组件
 */
export const UpdateNotification: React.FC<UpdateNotificationProps> = ({
  autoCheck = true,
  checkInterval = 60000, // 1分钟
  showDetails = true,
  className = '',
  position = 'top-right',
  draggable = false,
}) => {
  const [isDismissed, setIsDismissed] = useState(false);
  const [showChangeLog, setShowChangeLog] = useState(false);
  
  const { 
    updateInfo, 
    hasUpdate, 
    isChecking, 
    checkError, 
    checkForUpdates,
    isUpdateAvailable,
    isUpdateInProgress,
    isUpdateFailed 
  } = useUpdateCheck();
  
  const { 
    isDownloading, 
    downloadProgress, 
    downloadError, 
    downloadUpdate, 
    cancelDownload 
  } = useUpdateDownload();
  
  const { 
    isInstalling, 
    installProgress, 
    installError, 
    needsRestart, 
    installUpdate, 
    restartApplication 
  } = useUpdateInstall();
  
  const { 
    currentStep, 
    progress, 
    startUpdateFlow 
  } = useUpdateFlow();

  // 自动检查更新
  useEffect(() => {
    if (!autoCheck) return;

    const check = async () => {
      try {
        await checkForUpdates(false);
      } catch (error) {
        console.warn('Auto update check failed:', error);
      }
    };

    // 立即检查一次
    check();

    // 定期检查
    const interval = setInterval(check, checkInterval);
    return () => clearInterval(interval);
  }, [autoCheck, checkInterval, checkForUpdates]);

  // 处理更新操作
  const handleUpdate = useCallback(async () => {
    if (!updateInfo) return;

    try {
      await startUpdateFlow(updateInfo.version);
    } catch (error) {
      console.error('Update failed:', error);
    }
  }, [updateInfo, startUpdateFlow]);

  const handleDownload = useCallback(async () => {
    if (!updateInfo) return;

    try {
      await downloadUpdate(updateInfo.version);
    } catch (error) {
      console.error('Download failed:', error);
    }
  }, [updateInfo, downloadUpdate]);

  const handleInstall = useCallback(async () => {
    if (!updateInfo) return;

    try {
      await installUpdate(updateInfo.version);
    } catch (error) {
      console.error('Install failed:', error);
    }
  }, [updateInfo, installUpdate]);

  const handleRestart = useCallback(async () => {
    try {
      await restartApplication();
    } catch (error) {
      console.error('Restart failed:', error);
    }
  }, [restartApplication]);

  const handleDismiss = useCallback(() => {
    setIsDismissed(true);
  }, []);

  const handleCancel = useCallback(async () => {
    if (!updateInfo) return;

    try {
      if (isDownloading) {
        await cancelDownload(updateInfo.version);
      }
      setIsDismissed(true);
    } catch (error) {
      console.error('Cancel failed:', error);
    }
  }, [updateInfo, isDownloading, cancelDownload]);

  // 获取位置样式
  const getPositionStyle = () => {
    const base = { position: 'fixed' as const, zIndex: 50 };
    switch (position) {
      case 'top-left':
        return { ...base, top: '16px', left: '16px' };
      case 'bottom-right':
        return { ...base, bottom: '16px', right: '16px' };
      case 'bottom-left':
        return { ...base, bottom: '16px', left: '16px' };
      default:
        return { ...base, top: '16px', right: '16px' };
    }
  };

  // 获取更新类型图标和颜色
  const getUpdateTypeDisplay = () => {
    if (!updateInfo) return { icon: Rocket, color: 'primary' };
    
    const colorMap = {
      Major: { icon: AlertCircle, color: 'destructive' },
      Minor: { icon: Rocket, color: 'default' },
      Patch: { icon: RefreshCw, color: 'secondary' },
      Hotfix: { icon: AlertCircle, color: 'outline' },
      Security: { icon: AlertCircle, color: 'destructive' },
    };
    
    return colorMap[updateInfo.update_type] || { icon: Rocket, color: 'default' };
  };

  // 渲染进度条
  const renderProgressBar = () => {
    const currentProgress = isDownloading ? downloadProgress : 
                           isInstalling ? installProgress : progress;
    
    return (
      <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
        <div 
          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
          style={{ width: `${currentProgress}%` }}
        />
      </div>
    );
  };

  // 渲染操作按钮
  const renderActionButtons = () => {
    if (needsRestart) {
      return (
        <div className="flex gap-2">
          <button
            onClick={handleRestart}
            className="flex items-center gap-1 px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700 transition-colors"
          >
            <RefreshCw size={14} />
            重启应用
          </button>
          <button
            onClick={handleDismiss}
            className="px-3 py-1 bg-gray-600 text-white rounded text-sm hover:bg-gray-700 transition-colors"
          >
            稍后重启
          </button>
        </div>
      );
    }

    if (isUpdateInProgress || currentStep !== 'idle') {
      return (
        <div className="flex gap-2">
          <button
            onClick={handleCancel}
            className="flex items-center gap-1 px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700 transition-colors"
            disabled={isInstalling}
          >
            <X size={14} />
            {isInstalling ? '安装中...' : '取消'}
          </button>
        </div>
      );
    }

    if (updateInfo?.status === UpdateStatus.Downloaded) {
      return (
        <div className="flex gap-2">
          <button
            onClick={handleInstall}
            className="flex items-center gap-1 px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700 transition-colors"
          >
            <Check size={14} />
            立即安装
          </button>
          <button
            onClick={handleDismiss}
            className="px-3 py-1 bg-gray-600 text-white rounded text-sm hover:bg-gray-700 transition-colors"
          >
            稍后安装
          </button>
        </div>
      );
    }

    if (isUpdateAvailable) {
      return (
        <div className="flex gap-2">
          <button
            onClick={handleUpdate}
            className="flex items-center gap-1 px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 transition-colors"
          >
            <Download size={14} />
            立即更新
          </button>
          <button
            onClick={handleDownload}
            className="flex items-center gap-1 px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700 transition-colors"
          >
            <Download size={14} />
            仅下载
          </button>
          <button
            onClick={handleDismiss}
            className="px-3 py-1 bg-gray-600 text-white rounded text-sm hover:bg-gray-700 transition-colors"
          >
            稍后提醒
          </button>
        </div>
      );
    }

    return null;
  };

  // 渲染状态信息
  const renderStatusInfo = () => {
    if (checkError || downloadError || installError) {
      const error = checkError || downloadError || installError;
      return (
        <div className="flex items-center gap-1 text-red-600 text-sm">
          <AlertCircle size={14} />
          {error}
        </div>
      );
    }

    if (isChecking) {
      return (
        <div className="flex items-center gap-1 text-blue-600 text-sm">
          <RefreshCw size={14} className="animate-spin" />
          检查更新中...
        </div>
      );
    }

    if (isDownloading) {
      return (
        <div className="text-blue-600 text-sm">
          下载中... {downloadProgress.toFixed(1)}%
          {updateInfo?.file_size && (
            <span className="text-gray-500 ml-2">
              ({formatFileSize(updateInfo.file_size)})
            </span>
          )}
        </div>
      );
    }

    if (isInstalling) {
      return (
        <div className="text-green-600 text-sm">
          安装中... {installProgress.toFixed(1)}%
        </div>
      );
    }

    if (currentStep === 'completed') {
      return (
        <div className="flex items-center gap-1 text-green-600 text-sm">
          <Check size={14} />
          更新完成
        </div>
      );
    }

    return null;
  };

  // 如果被忽略或没有更新，不显示
  if (isDismissed || (!hasUpdate && !isUpdateInProgress && currentStep === 'idle')) {
    return null;
  }

  const { icon: StatusIcon, color } = getUpdateTypeDisplay();

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: position.includes('top') ? -50 : 50 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: position.includes('top') ? -50 : 50 }}
        style={getPositionStyle()}
        className={`
          bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700
          rounded-lg shadow-lg max-w-sm w-full p-4 ${className}
          ${draggable ? 'cursor-move' : ''}
        `}
        drag={draggable}
        dragMomentum={false}
      >
        <div className="flex items-start gap-3">
          <div className={`text-${color} mt-1`}>
            <StatusIcon size={20} />
          </div>
          
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
              {needsRestart ? '重启以完成更新' :
               isUpdateInProgress || currentStep !== 'idle' ? '正在更新' :
               '有新版本可用'}
            </h3>
            
            {updateInfo && (
              <div className="text-sm text-gray-600 dark:text-gray-300 mb-2">
                <div className="flex items-center gap-2">
                  <span>版本 {updateInfo.version}</span>
                  <span className={`px-2 py-0.5 rounded text-xs bg-${color} text-white`}>
                    {updateInfo.update_type}
                  </span>
                </div>
                {showDetails && (
                  <div className="mt-1 text-xs">
                    <div>发布时间: {formatRelativeTime(updateInfo.release_date)}</div>
                    {updateInfo.file_size && (
                      <div>大小: {formatFileSize(updateInfo.file_size)}</div>
                    )}
                  </div>
                )}
              </div>
            )}

            {renderStatusInfo()}
            
            {(isUpdateInProgress || currentStep !== 'idle') && renderProgressBar()}
            
            {updateInfo && showDetails && updateInfo.changelog && (
              <div className="mt-2">
                <button
                  onClick={() => setShowChangeLog(!showChangeLog)}
                  className="text-blue-600 hover:text-blue-700 text-sm underline"
                >
                  {showChangeLog ? '隐藏' : '查看'}更新日志
                </button>
                {showChangeLog && (
                  <div className="mt-2 p-2 bg-gray-50 dark:bg-gray-700 rounded text-xs max-h-32 overflow-y-auto">
                    <div dangerouslySetInnerHTML={{ __html: updateInfo.changelog }} />
                  </div>
                )}
              </div>
            )}
            
            <div className="mt-3">
              {renderActionButtons()}
            </div>
          </div>
          
          <button
            onClick={handleDismiss}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 ml-2"
          >
            <X size={16} />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
