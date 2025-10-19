/**
 * 启动进度组件
 * 显示应用启动的各个阶段和进度信息
 */
import React, { useEffect, useState, useCallback } from 'react';
import { useStartupOptimization } from '../../hooks/useStartupOptimization';
import { StartupPhase, StartupStage } from '../../types/startup';
import './StartupProgress.css';

interface StartupProgressProps {
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
    startupState,
    currentStage,
    getOverallProgress,
    getPhaseProgress,
    getStageProgress,
    isStartupComplete,
  } = useStartupOptimization();

  const [animation, setAnimation] = useState<ProgressAnimation>({
    phase: 'initializing',
    progress: 0,
    message: '正在初始化...',
    isAnimating: false,
  });

  const [visibleStages, setVisibleStages] = useState<StartupStage[]>([]);
  const [showCompleteAnimation, setShowCompleteAnimation] = useState(false);

  // 阶段名称映射
  const stageNameMap: Record<string, string> = {
    'initialize-core': '初始化核心系统',
    'setup-database': '设置数据库连接',
    'load-config': '加载配置文件',
    'initialize-services': '初始化服务',
    'setup-adapters': '设置适配器',
    'initialize-ui': '初始化用户界面',
    'load-themes': '加载主题配置',
    'setup-shortcuts': '设置快捷键',
    'load-characters': '加载角色数据',
    'initialize-workflows': '初始化工作流',
    'setup-performance': '配置性能监控',
    'finalize-startup': '完成启动',
  };

  // 阶段图标映射
  const stageIconMap: Record<string, string> = {
    'initialize-core': '⚙️',
    'setup-database': '🗄️',
    'load-config': '📋',
    'initialize-services': '🔧',
    'setup-adapters': '🔌',
    'initialize-ui': '🎨',
    'load-themes': '🌈',
    'setup-shortcuts': '⌨️',
    'load-characters': '👤',
    'initialize-workflows': '📊',
    'setup-performance': '📈',
    'finalize-startup': '✅',
  };

  // 获取阶段显示名称
  const getStageDisplayName = useCallback((stageId: string): string => {
    return stageNameMap[stageId] || stageId;
  }, []);

  // 获取阶段图标
  const getStageIcon = useCallback((stageId: string): string => {
    return stageIconMap[stageId] || '•';
  }, []);

  // 获取阶段状态文本
  const getStageStatusText = useCallback((stage: StartupStage): string => {
    switch (stage.status) {
      case 'pending':
        return '等待中';
      case 'running':
        return '进行中';
      case 'completed':
        return '已完成';
      case 'failed':
        return '失败';
      case 'skipped':
        return '跳过';
      default:
        return '未知';
    }
  }, []);

  // 获取当前阶段消息
  const getCurrentMessage = useCallback((): string => {
    if (isStartupComplete()) {
      return '启动完成！';
    }

    if (currentStage) {
      const displayName = getStageDisplayName(currentStage.id);
      switch (currentStage.status) {
        case 'running':
          return `正在${displayName}...`;
        case 'completed':
          return `${displayName}完成`;
        case 'failed':
          return `${displayName}失败`;
        default:
          return displayName;
      }
    }

    switch (startupState.phase) {
      case 'initializing':
        return '正在初始化应用...';
      case 'loading':
        return '正在加载资源...';
      case 'configuring':
        return '正在配置系统...';
      case 'ready':
        return '系统准备就绪';
      case 'error':
        return '启动过程中出现错误';
      default:
        return '启动中...';
    }
  }, [isStartupComplete, currentStage, startupState.phase, getStageDisplayName]);

  // 更新动画状态
  const updateAnimation = useCallback(() => {
    const progress = getOverallProgress();
    const message = getCurrentMessage();

    setAnimation(prev => ({
      ...prev,
      phase: startupState.phase,
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
  }, [getOverallProgress, getCurrentMessage, startupState.phase]);

  // 更新可见阶段
  const updateVisibleStages = useCallback(() => {
    if (!showDetails) return;

    const stages = startupState.stages || [];
    const currentPhaseStages = stages.filter(stage => {
      // 显示当前阶段和已完成的阶段
      return stage.status === 'completed' || 
             stage.status === 'running' || 
             stage.status === 'failed';
    });

    setVisibleStages(currentPhaseStages);
  }, [startupState.stages, showDetails]);

  // 监听启动状态变化
  useEffect(() => {
    updateAnimation();
    updateVisibleStages();
  }, [startupState, currentStage, updateAnimation, updateVisibleStages]);

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
              {visibleStages.map((stage) => (
                <div 
                  key={stage.id}
                  className={`stage-item ${stage.status} ${
                    currentStage?.id === stage.id ? 'current' : ''
                  }`}
                >
                  <div className="stage-icon">
                    <span className="stage-emoji">{getStageIcon(stage.id)}</span>
                    <div className={`stage-status-indicator ${stage.status}`} />
                  </div>
                  
                  <div className="stage-content">
                    <div className="stage-name">
                      {getStageDisplayName(stage.id)}
                    </div>
                    <div className="stage-status">
                      {getStageStatusText(stage)}
                      {stage.status === 'running' && (
                        <span className="stage-progress">
                          ({Math.round(getStageProgress(stage.id))}%)
                        </span>
                      )}
                    </div>
                  </div>
                  
                  {stage.duration && (
                    <div className="stage-duration">
                      {stage.duration}ms
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 启动提示 */}
        {showTips && !showCompleteAnimation && (
          <div className="startup-tips">
            <div className="tip-item">
              💡 首次启动需要初始化，请稍候...
            </div>
            {startupState.phase === 'loading' && (
              <div className="tip-item">
                📦 正在加载必要的资源文件
              </div>
            )}
            {startupState.phase === 'configuring' && (
              <div className="tip-item">
                ⚙️ 正在配置应用设置和服务
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
              <span>总耗时: {startupState.totalDuration || 0}ms</span>
              <span>阶段数: {startupState.stages?.length || 0}</span>
            </div>
          </div>
        )}

        {/* 错误状态 */}
        {startupState.phase === 'error' && (
          <div className="startup-error">
            <div className="error-icon">❌</div>
            <p className="error-message">
              启动过程中出现错误，请重试或检查日志
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
