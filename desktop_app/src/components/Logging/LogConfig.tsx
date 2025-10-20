/**
 * 日志配置管理组件
 * 
 * 提供完整的日志系统配置界面：
 * - 基本日志配置
 * - 远程日志上传配置
 * - 高级设置
 * - 配置导入/导出
 */

import React, { useState, useEffect } from 'react';
import { 
  Settings, 
  Upload, 
  Download, 
  Save, 
  RotateCcw, 
  AlertCircle, 
  CheckCircle, 
  Eye, 
  EyeOff,
  Info,
  HelpCircle
} from 'lucide-react';
import { useLogConfig } from '../../hooks/useLogging';
import { LogLevel, LoggerConfig, RemoteLogConfig } from '../../services/loggingService';
import './LogConfig.css';

// ================================
// 类型定义
// ================================

interface LogConfigProps {
  /** 是否显示为模态框 */
  isModal?: boolean;
  /** 关闭回调 */
  onClose?: () => void;
  /** 配置更新回调 */
  onConfigUpdate?: (config: LoggerConfig) => void;
}

interface ConfigValidation {
  isValid: boolean;
  errors: Record<string, string>;
  warnings: Record<string, string>;
}

// ================================
// 主组件
// ================================

export const LogConfig: React.FC<LogConfigProps> = ({
  isModal = false,
  onClose,
  onConfigUpdate
}) => {
  // ================================
  // 状态管理
  // ================================

  const { config, remoteConfig, updateConfig, updateRemoteConfig, isLoading, error } = useLogConfig();
  
  // 本地配置状态
  const [localConfig, setLocalConfig] = useState<LoggerConfig | null>(null);
  const [localRemoteConfig, setLocalRemoteConfig] = useState<RemoteLogConfig | null>(null);
  
  // UI 状态
  const [activeTab, setActiveTab] = useState<'basic' | 'remote' | 'advanced'>('basic');
  const [showApiKey, setShowApiKey] = useState(false);
  const [validation, setValidation] = useState<ConfigValidation>({ isValid: true, errors: {}, warnings: {} });
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [testingConnection, setTestingConnection] = useState(false);

  // ================================
  // 初始化和同步
  // ================================

  useEffect(() => {
    if (config) {
      setLocalConfig({ ...config });
    }
  }, [config]);

  useEffect(() => {
    if (remoteConfig) {
      setLocalRemoteConfig({ ...remoteConfig });
    }
  }, [remoteConfig]);

  // ================================
  // 配置验证
  // ================================

  const validateConfig = (cfg: LoggerConfig, remoteCfg: RemoteLogConfig): ConfigValidation => {
    const errors: Record<string, string> = {};
    const warnings: Record<string, string> = {};

    // 基本配置验证
    if (cfg.maxFileSize < 1024 * 1024) { // 小于1MB
      warnings.maxFileSize = '日志文件大小建议不小于1MB';
    }
    if (cfg.maxFileSize > 1024 * 1024 * 1024) { // 大于1GB
      warnings.maxFileSize = '日志文件大小过大可能影响性能';
    }
    
    if (cfg.retentionDays < 1) {
      errors.retentionDays = '日志保留天数不能小于1天';
    }
    if (cfg.retentionDays > 365) {
      warnings.retentionDays = '日志保留时间过长可能占用大量存储空间';
    }

    // 远程配置验证
    if (remoteCfg.enabled) {
      if (!remoteCfg.endpointUrl) {
        errors.endpointUrl = '启用远程上传时必须设置上传地址';
      } else if (!remoteCfg.endpointUrl.startsWith('http')) {
        errors.endpointUrl = '上传地址必须是有效的HTTP/HTTPS URL';
      }
      
      if (remoteCfg.batchSize < 1) {
        errors.batchSize = '批次大小不能小于1';
      }
      if (remoteCfg.batchSize > 1000) {
        warnings.batchSize = '批次大小过大可能导致请求超时';
      }
      
      if (remoteCfg.uploadIntervalSeconds < 10) {
        warnings.uploadIntervalSeconds = '上传间隔过短可能影响性能';
      }
      if (remoteCfg.uploadIntervalSeconds > 3600) {
        warnings.uploadIntervalSeconds = '上传间隔过长可能导致数据丢失';
      }
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors,
      warnings
    };
  };

  // ================================
  // 事件处理
  // ================================

  const handleConfigChange = (key: keyof LoggerConfig, value: any) => {
    if (!localConfig) return;
    
    const newConfig = { ...localConfig, [key]: value };
    setLocalConfig(newConfig);
    
    if (localRemoteConfig) {
      setValidation(validateConfig(newConfig, localRemoteConfig));
    }
  };

  const handleRemoteConfigChange = (key: keyof RemoteLogConfig, value: any) => {
    if (!localRemoteConfig) return;
    
    const newConfig = { ...localRemoteConfig, [key]: value };
    setLocalRemoteConfig(newConfig);
    
    if (localConfig) {
      setValidation(validateConfig(localConfig, newConfig));
    }
  };

  const handleSave = async () => {
    if (!localConfig || !localRemoteConfig || !validation.isValid) return;
    
    setSaveStatus('saving');
    try {
      await Promise.all([
        updateConfig(localConfig),
        updateRemoteConfig(localRemoteConfig)
      ]);
      
      setSaveStatus('saved');
      onConfigUpdate?.(localConfig);
      
      // 2秒后重置状态
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (error) {
      console.error('保存配置失败:', error);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    }
  };

  const handleReset = () => {
    if (config) setLocalConfig({ ...config });
    if (remoteConfig) setLocalRemoteConfig({ ...remoteConfig });
    setValidation({ isValid: true, errors: {}, warnings: {} });
  };

  const handleTestConnection = async () => {
    if (!localRemoteConfig?.endpointUrl) return;
    
    setTestingConnection(true);
    try {
      // 这里可以发送一个测试请求到远程服务器
      const response = await fetch(localRemoteConfig.endpointUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(localRemoteConfig.apiKey && { 'Authorization': `Bearer ${localRemoteConfig.apiKey}` })
        },
        body: JSON.stringify({ test: true })
      });
      
      if (response.ok) {
        alert('连接测试成功');
      } else {
        alert(`连接测试失败: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      alert(`连接测试失败: ${error}`);
    } finally {
      setTestingConnection(false);
    }
  };

  const handleExportConfig = () => {
    if (!localConfig || !localRemoteConfig) return;
    
    const configData = {
      basic: localConfig,
      remote: localRemoteConfig,
      exportTime: new Date().toISOString(),
      version: '1.0.0'
    };
    
    const blob = new Blob([JSON.stringify(configData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `log-config-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleImportConfig = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const configData = JSON.parse(e.target?.result as string);
        if (configData.basic) setLocalConfig(configData.basic);
        if (configData.remote) setLocalRemoteConfig(configData.remote);
        alert('配置导入成功');
      } catch (error) {
        alert('配置文件格式错误');
      }
    };
    reader.readAsText(file);
  };

  // ================================
  // 渲染方法
  // ================================

  const renderHeader = () => (
    <div className="log-config-header">
      <div className="header-title">
        <Settings size={20} />
        <h2>日志系统配置</h2>
      </div>
      
      <div className="header-actions">
        <button
          onClick={handleExportConfig}
          className="btn btn-secondary btn-small"
          title="导出配置"
        >
          <Download size={14} />
          导出
        </button>
        
        <label className="btn btn-secondary btn-small" title="导入配置">
          <Upload size={14} />
          导入
          <input
            type="file"
            accept=".json"
            onChange={handleImportConfig}
            style={{ display: 'none' }}
          />
        </label>
        
        {isModal && onClose && (
          <button
            className="btn btn-icon btn-close"
            onClick={onClose}
            title="关闭"
          >
            ×
          </button>
        )}
      </div>
    </div>
  );

  const renderTabs = () => (
    <div className="config-tabs">
      <button
        className={`tab-btn ${activeTab === 'basic' ? 'active' : ''}`}
        onClick={() => setActiveTab('basic')}
      >
        基本配置
      </button>
      <button
        className={`tab-btn ${activeTab === 'remote' ? 'active' : ''}`}
        onClick={() => setActiveTab('remote')}
      >
        远程上传
      </button>
      <button
        className={`tab-btn ${activeTab === 'advanced' ? 'active' : ''}`}
        onClick={() => setActiveTab('advanced')}
      >
        高级设置
      </button>
    </div>
  );

  const renderBasicConfig = () => {
    if (!localConfig) return null;
    
    return (
      <div className="config-section">
        <div className="config-group">
          <h3>日志级别设置</h3>
          
          <div className="form-row">
            <label>最小日志级别:</label>
            <select
              value={localConfig.minLevel}
              onChange={(e) => handleConfigChange('minLevel', Number(e.target.value))}
              className="form-select"
            >
              <option value={LogLevel.DEBUG}>DEBUG - 调试信息</option>
              <option value={LogLevel.INFO}>INFO - 一般信息</option>
              <option value={LogLevel.WARN}>WARN - 警告信息</option>
              <option value={LogLevel.ERROR}>ERROR - 错误信息</option>
              <option value={LogLevel.FATAL}>FATAL - 严重错误</option>
            </select>
            <div className="field-help">
              <Info size={14} />
              <span>只有等于或高于此级别的日志才会被记录</span>
            </div>
          </div>
        </div>

        <div className="config-group">
          <h3>输出设置</h3>
          
          <div className="form-row">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={localConfig.enableConsole}
                onChange={(e) => handleConfigChange('enableConsole', e.target.checked)}
              />
              启用控制台输出
            </label>
          </div>
          
          <div className="form-row">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={localConfig.enableFile}
                onChange={(e) => handleConfigChange('enableFile', e.target.checked)}
              />
              启用文件输出
            </label>
          </div>
        </div>

        <div className="config-group">
          <h3>文件设置</h3>
          
          <div className="form-row">
            <label>日志目录:</label>
            <input
              type="text"
              value={localConfig.logDir}
              onChange={(e) => handleConfigChange('logDir', e.target.value)}
              className="form-input"
              placeholder="/path/to/logs"
            />
          </div>
          
          <div className="form-row">
            <label>文件名前缀:</label>
            <input
              type="text"
              value={localConfig.filePrefix}
              onChange={(e) => handleConfigChange('filePrefix', e.target.value)}
              className="form-input"
              placeholder="app"
            />
          </div>
          
          <div className="form-row">
            <label>最大文件大小 (MB):</label>
            <input
              type="number"
              value={Math.round(localConfig.maxFileSize / 1024 / 1024)}
              onChange={(e) => handleConfigChange('maxFileSize', Number(e.target.value) * 1024 * 1024)}
              className="form-input"
              min="1"
              max="1024"
            />
            {validation.errors.maxFileSize && (
              <div className="field-error">{validation.errors.maxFileSize}</div>
            )}
            {validation.warnings.maxFileSize && (
              <div className="field-warning">{validation.warnings.maxFileSize}</div>
            )}
          </div>
          
          <div className="form-row">
            <label>保留天数:</label>
            <input
              type="number"
              value={localConfig.retentionDays}
              onChange={(e) => handleConfigChange('retentionDays', Number(e.target.value))}
              className="form-input"
              min="1"
              max="365"
            />
            {validation.errors.retentionDays && (
              <div className="field-error">{validation.errors.retentionDays}</div>
            )}
            {validation.warnings.retentionDays && (
              <div className="field-warning">{validation.warnings.retentionDays}</div>
            )}
          </div>
          
          <div className="form-row">
            <label>轮转策略:</label>
            <select
              value={localConfig.rotation}
              onChange={(e) => handleConfigChange('rotation', e.target.value)}
              className="form-select"
            >
              <option value="hourly">每小时</option>
              <option value="daily">每天</option>
              <option value="never">从不</option>
            </select>
          </div>
        </div>
      </div>
    );
  };

  const renderRemoteConfig = () => {
    if (!localRemoteConfig) return null;
    
    return (
      <div className="config-section">
        <div className="config-group">
          <h3>远程上传设置</h3>
          
          <div className="form-row">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={localRemoteConfig.enabled}
                onChange={(e) => handleRemoteConfigChange('enabled', e.target.checked)}
              />
              启用远程日志上传
            </label>
            <div className="field-help">
              <Info size={14} />
              <span>将日志自动上传到远程服务器进行集中管理</span>
            </div>
          </div>
          
          {localRemoteConfig.enabled && (
            <>
              <div className="form-row">
                <label>上传地址:</label>
                <input
                  type="url"
                  value={localRemoteConfig.endpointUrl}
                  onChange={(e) => handleRemoteConfigChange('endpointUrl', e.target.value)}
                  className="form-input"
                  placeholder="https://api.example.com/logs"
                />
                {validation.errors.endpointUrl && (
                  <div className="field-error">{validation.errors.endpointUrl}</div>
                )}
              </div>
              
              <div className="form-row">
                <label>API 密钥:</label>
                <div className="password-input-wrapper">
                  <input
                    type={showApiKey ? 'text' : 'password'}
                    value={localRemoteConfig.apiKey || ''}
                    onChange={(e) => handleRemoteConfigChange('apiKey', e.target.value)}
                    className="form-input"
                    placeholder="可选，用于身份验证"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="password-toggle"
                  >
                    {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              
              <div className="form-row">
                <label>批次大小:</label>
                <input
                  type="number"
                  value={localRemoteConfig.batchSize}
                  onChange={(e) => handleRemoteConfigChange('batchSize', Number(e.target.value))}
                  className="form-input"
                  min="1"
                  max="1000"
                />
                {validation.errors.batchSize && (
                  <div className="field-error">{validation.errors.batchSize}</div>
                )}
                {validation.warnings.batchSize && (
                  <div className="field-warning">{validation.warnings.batchSize}</div>
                )}
              </div>
              
              <div className="form-row">
                <label>上传间隔 (秒):</label>
                <input
                  type="number"
                  value={localRemoteConfig.uploadIntervalSeconds}
                  onChange={(e) => handleRemoteConfigChange('uploadIntervalSeconds', Number(e.target.value))}
                  className="form-input"
                  min="10"
                  max="3600"
                />
                {validation.warnings.uploadIntervalSeconds && (
                  <div className="field-warning">{validation.warnings.uploadIntervalSeconds}</div>
                )}
              </div>
              
              <div className="form-row">
                <label>重试次数:</label>
                <input
                  type="number"
                  value={localRemoteConfig.retryAttempts}
                  onChange={(e) => handleRemoteConfigChange('retryAttempts', Number(e.target.value))}
                  className="form-input"
                  min="0"
                  max="10"
                />
              </div>
              
              <div className="form-row">
                <label>超时时间 (秒):</label>
                <input
                  type="number"
                  value={localRemoteConfig.timeoutSeconds}
                  onChange={(e) => handleRemoteConfigChange('timeoutSeconds', Number(e.target.value))}
                  className="form-input"
                  min="5"
                  max="300"
                />
              </div>
              
              <div className="form-row">
                <button
                  onClick={handleTestConnection}
                  disabled={testingConnection || !localRemoteConfig.endpointUrl}
                  className="btn btn-secondary"
                >
                  {testingConnection ? '测试中...' : '测试连接'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  };

  const renderAdvancedConfig = () => {
    if (!localConfig) return null;
    
    return (
      <div className="config-section">
        <div className="config-group">
          <h3>输出格式</h3>
          
          <div className="form-row">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={localConfig.prettyJson}
                onChange={(e) => handleConfigChange('prettyJson', e.target.checked)}
              />
              美化 JSON 输出
            </label>
            <div className="field-help">
              <Info size={14} />
              <span>增加可读性但会增大文件体积</span>
            </div>
          </div>
          
          <div className="form-row">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={localConfig.includeLocation}
                onChange={(e) => handleConfigChange('includeLocation', e.target.checked)}
              />
              包含位置信息 (文件名和行号)
            </label>
            <div className="field-help">
              <Info size={14} />
              <span>有助于调试但会增加日志体积</span>
            </div>
          </div>
        </div>

        <div className="config-group">
          <h3>性能设置</h3>
          
          <div className="form-row">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={localConfig.asyncWrite}
                onChange={(e) => handleConfigChange('asyncWrite', e.target.checked)}
              />
              异步写入
            </label>
            <div className="field-help">
              <Info size={14} />
              <span>提高性能但可能在程序异常退出时丢失部分日志</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderActions = () => (
    <div className="config-actions">
      <div className="validation-status">
        {Object.keys(validation.errors).length > 0 && (
          <div className="validation-errors">
            <AlertCircle size={16} />
            <span>配置存在 {Object.keys(validation.errors).length} 个错误</span>
          </div>
        )}
        {Object.keys(validation.warnings).length > 0 && (
          <div className="validation-warnings">
            <HelpCircle size={16} />
            <span>{Object.keys(validation.warnings).length} 个警告</span>
          </div>
        )}
        {validation.isValid && Object.keys(validation.warnings).length === 0 && (
          <div className="validation-success">
            <CheckCircle size={16} />
            <span>配置有效</span>
          </div>
        )}
      </div>
      
      <div className="action-buttons">
        <button
          onClick={handleReset}
          className="btn btn-secondary"
          disabled={isLoading}
        >
          <RotateCcw size={16} />
          重置
        </button>
        
        <button
          onClick={handleSave}
          disabled={!validation.isValid || isLoading || saveStatus === 'saving'}
          className={`btn btn-primary ${saveStatus === 'saved' ? 'success' : saveStatus === 'error' ? 'error' : ''}`}
        >
          <Save size={16} />
          {saveStatus === 'saving' && '保存中...'}
          {saveStatus === 'saved' && '已保存'}
          {saveStatus === 'error' && '保存失败'}
          {saveStatus === 'idle' && '保存配置'}
        </button>
      </div>
    </div>
  );

  // ================================
  // 主渲染
  // ================================

  if (isLoading) {
    return (
      <div className="log-config loading">
        <div className="loading-message">加载配置中...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="log-config error">
        <div className="error-message">
          <AlertCircle size={16} />
          <span>加载配置失败: {error}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`log-config ${isModal ? 'modal' : ''}`}>
      {renderHeader()}
      
      <div className="log-config-body">
        {renderTabs()}
        
        <div className="config-content">
          {activeTab === 'basic' && renderBasicConfig()}
          {activeTab === 'remote' && renderRemoteConfig()}
          {activeTab === 'advanced' && renderAdvancedConfig()}
        </div>
        
        {renderActions()}
      </div>
    </div>
  );
};

export default LogConfig;
