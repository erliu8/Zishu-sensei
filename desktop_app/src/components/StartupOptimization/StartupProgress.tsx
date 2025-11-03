/**
 * 启动进度组件
 * 显示应用启动的各个阶段和进度信息
 */
import React, { useEffect, useState, useCallback } from 'react';
import { useStartupOptimization } from '../../hooks/useStartupOptimization';
import { StartupPhase, PhaseResult } from '../../types/startup';
import './StartupProgress.css';

export interface StartupProgressProps {
  showDetails?: boolean;
  showTips?: boolean;
  onStartupComplete?: () => void;
  className?: string;
}

interface ProgressAnimation {
  phase: StartupPhase;
  progress: number;
  message: string;
  isAnimating: boolean;
}

/**
 * 启动进度组件
 */
export const StartupProgress: React.FC<StartupProgressProps> = ({
  showDetails = true,
  showTips = true,
  onStartupComplete,
  className = '',
}) => {
  const {
    progress: progressState,
    stats: statsState,
    phaseExecution,
  } = useStartupOptimization();

  const [animation, setAnimation] = useState<ProgressAnimation>({
    phase: StartupPhase.AppInitialization,
    progress: 0,
    message: '正在初始化...',
    isAnimating: false,
  });

  const [visibleStages, setVisibleStages] = useState<PhaseResult[]>([]);
  const [showCompleteAnimation, setShowCompleteAnimation] = useState(false);

  // 阶段名称映射
  const stageNameMap: Record<StartupPhase, string> = {
    [StartupPhase.AppInitialization]: '应用初始化',
    [StartupPhase.DatabaseConnection]: '数据库连接',
    [StartupPhase.ConfigLoading]: '配置加载',
    [StartupPhase.ThemeLoading]: '主题加载',
    [StartupPhase.AdapterLoading]: '适配器加载',
    [StartupPhase.Live2DModelLoading]: 'Live2D模型加载',
    [StartupPhase.WindowCreation]: '窗口创建',
    [StartupPhase.FrontendInitialization]: '前端初始化',
    [StartupPhase.SystemServices]: '系统服务启动',
    [StartupPhase.NetworkConnection]: '网络连接检查',
    [StartupPhase.Completed]: '启动完成',
  };

  // 阶段图标映射
  const stageIconMap: Record<StartupPhase, string> = {
    [StartupPhase.AppInitialization]: '⚙️',
    [StartupPhase.DatabaseConnection]: '🗄️',
    [StartupPhase.ConfigLoading]: '📋',
    [StartupPhase.ThemeLoading]: '🌈',
    [StartupPhase.AdapterLoading]: '🔌',
    [StartupPhase.Live2DModelLoading]: '👤',
    [StartupPhase.WindowCreation]: '🪟',
    [StartupPhase.FrontendInitialization]: '🎨',
    [StartupPhase.SystemServices]: '🔧',
    [StartupPhase.NetworkConnection]: '🌐',
    [StartupPhase.Completed]: '✅',
  };

  // 获取阶段显示名称
  const getStageDisplayName = useCallback((phase: StartupPhase): string => {
    return stageNameMap[phase] || phase;
  }, []);

  // 获取阶段图标
  const getStageIcon = useCallback((phase: StartupPhase): string => {
    return stageIconMap[phase] || '•';
  }, []);

  // 获取阶段状态文本
  const getStageStatusText = useCallback((result: PhaseResult): string => {
    if (!result.end_time) {
      return '进行中';
    }
    if (result.success) {
      return '已完成';
    }
    return '失败';
  }, []);

  // 检查启动是否完成
  const isStartupComplete = useCallback((): boolean => {
    return progressState.currentPhase === StartupPhase.Completed || progressState.progress >= 1;
  }, [progressState]);

  // 获取当前阶段消息
  const getCurrentMessage = useCallback((): string => {
    if (isStartupComplete()) {
      return '启动完成！';
    }

    if (phaseExecution.currentPhase) {
      const displayName = getStageDisplayName(phaseExecution.currentPhase);
      const result = phaseExecution.phaseResults.get(phaseExecution.currentPhase);
      
      if (result) {
        if (!result.end_time) {
          return `正在${displayName}...`;
        }
        if (result.success) {
          return `${displayName}完成`;
        }
        return `${displayName}失败`;
      }
      return `正在${displayName}...`;
    }

    if (progressState.currentPhase) {
      const displayName = getStageDisplayName(progressState.currentPhase);
      return `正在${displayName}...`;
    }

    return '正在启动应用...';
  }, [isStartupComplete, phaseExecution.currentPhase, phaseExecution.phaseResults, progressState.currentPhase, getStageDisplayName]);

  // 更新动画状态
  const updateAnimation = useCallback(() => {
    const progress = progressState.progress * 100;
    const message = getCurrentMessage();
    const currentPhase = progressState.currentPhase || phaseExecution.currentPhase || StartupPhase.AppInitialization;

    setAnimation(prev => ({
      ...prev,
      phase: currentPhase,
      progress,
      message,
      isAnimating: progress !== prev.progress,
    }));

    // 停止动画状态
    setTimeout(() => {
      setAnimation(prev => ({
        ...prev,
        isAnimating: false,
      }));
    }, 300);
  }, [progressState, phaseExecution.currentPhase, getCurrentMessage]);

  // 更新可见阶段
  const updateVisibleStages = useCallback(() => {
    if (!showDetails) return;

    const results = Array.from(phaseExecution.phaseResults.values());
    // 只显示已开始的阶段（有开始时间的）
    const visibleResults = results.filter(result => result.start_time > 0);

    setVisibleStages(visibleResults);
  }, [phaseExecution.phaseResults, showDetails]);

  // 监听启动状态变化
  useEffect(() => {
    updateAnimation();
    updateVisibleStages();
  }, [progressState, phaseExecution.currentPhase, phaseExecution.phaseResults, updateAnimation, updateVisibleStages]);

  // 处理启动完成
  useEffect(() => {
    if (isStartupComplete() && !showCompleteAnimation) {
      setShowCompleteAnimation(true);
      setTimeout(() => {
        onStartupComplete?.();
      }, 1500);
    }
  }, [isStartupComplete, showCompleteAnimation, onStartupComplete]);

  // 如果启动已完成且没有显示完成动画，不渲染组件
  if (isStartupComplete() && !showCompleteAnimation) {
    return null;
  }

  return (
    <div className={`startup-progress ${className} ${showCompleteAnimation ? 'completed' : ''}`}>
      <div className="startup-backdrop" />
      
      <div className="startup-content">
        {/* 主标题 */}
        <div className="startup-header">
          <div className="startup-logo">
            <div className={`logo-animation ${animation.isAnimating ? 'animating' : ''}`}>
              <div className="logo-circle"></div>
              <div className="logo-text">智书先生</div>
            </div>
          </div>
          
          <h1 className="startup-title">
            {showCompleteAnimation ? '启动完成！' : '正在启动应用'}
          </h1>
          
          <p className="startup-message">{animation.message}</p>
        </div>

        {/* 总体进度条 */}
        <div className="startup-progress-bar">
          <div className="progress-container">
            <div 
              className={`progress-fill ${animation.isAnimating ? 'animating' : ''}`}
              style={{ width: `${animation.progress}%` }}
            />
            <div className="progress-glow" />
          </div>
          <div className="progress-text">
            {Math.round(animation.progress)}%
          </div>
        </div>

        {/* 详细阶段信息 */}
        {showDetails && visibleStages.length > 0 && (
          <div className="startup-stages">
            <h3 className="stages-title">启动详情</h3>
            <div className="stages-list">
              {visibleStages.map((result) => {
                const isRunning = !result.end_time;
                const isCurrent = phaseExecution.currentPhase === result.phase;
                const status = result.success ? 'completed' : (isRunning ? 'running' : 'failed');
                
                return (
                  <div 
                    key={result.phase}
                    className={`stage-item ${status} ${isCurrent ? 'current' : ''}`}
                  >
                    <div className="stage-icon">
                      <span className="stage-emoji">{getStageIcon(result.phase)}</span>
                      <div className={`stage-status-indicator ${status}`} />
                    </div>
                    
                    <div className="stage-content">
                      <div className="stage-name">
                        {getStageDisplayName(result.phase)}
                      </div>
                      <div className="stage-status">
                        {getStageStatusText(result)}
                      </div>
                    </div>
                    
                    {result.duration && (
                      <div className="stage-duration">
                        {result.duration}ms
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 启动提示 */}
        {showTips && !showCompleteAnimation && (
          <div className="startup-tips">
            <div className="tip-item">
              💡 首次启动需要初始化，请稍候...
            </div>
            {(progressState.currentPhase === StartupPhase.ConfigLoading || 
              progressState.currentPhase === StartupPhase.ThemeLoading) && (
              <div className="tip-item">
                📦 正在加载配置和主题文件
              </div>
            )}
            {(progressState.currentPhase === StartupPhase.AdapterLoading || 
              progressState.currentPhase === StartupPhase.Live2DModelLoading) && (
              <div className="tip-item">
                ⚙️ 正在加载适配器和模型资源
              </div>
            )}
          </div>
        )}

        {/* 完成动画 */}
        {showCompleteAnimation && (
          <div className="startup-complete">
            <div className="complete-icon">🎉</div>
            <p className="complete-message">
              启动完成，欢迎使用紫舒！
            </p>
            <div className="complete-stats">
              <span>总耗时: {statsState.stats?.total_duration || 0}ms</span>
              <span>阶段数: {phaseExecution.phaseResults.size || 0}</span>
            </div>
          </div>
        )}

        {/* 错误状态 */}
        {progressState.error && (
          <div className="startup-error">
            <div className="error-icon">❌</div>
            <p className="error-message">
              {progressState.error}
            </p>
            <button 
              className="retry-button"
              onClick={() => window.location.reload()}
            >
              重新启动
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * 简化版启动进度组件
 */
export const SimpleStartupProgress: React.FC<{
  onComplete?: () => void;
}> = ({ onComplete }) => {
  return (
    <StartupProgress
      showDetails={false}
      showTips={false}
      onStartupComplete={onComplete}
      className="simple-startup-progress"
    />
  );
};

/**
 * 全功能启动进度组件
 */
export const FullStartupProgress: React.FC<{
  onComplete?: () => void;
}> = ({ onComplete }) => {
  return (
    <StartupProgress
      showDetails={true}
      showTips={true}
      onStartupComplete={onComplete}
      className="full-startup-progress"
    />
  );
};

export default StartupProgress;
