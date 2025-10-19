/**
 * 区域设置组件
 * 
 * 提供完整的区域适配设置界面
 */

import React, { useState, useEffect } from 'react';
import { 
  RegionPreferences, 
  RegionConfig, 
  SystemRegionInfo,
  TemperatureUnit,
  DistanceUnit,
  WeightUnit,
  SUPPORTED_LOCALES,
  SUPPORTED_CURRENCIES,
  SUPPORTED_TIMEZONES
} from '../../types/region';
import { useRegion, useRegionConfigs, useRegionPreferencesForm } from '../../hooks/useRegion';
import { RegionSelector } from './RegionSelector';
import { FormatPreview } from './FormatPreview';
import './RegionSettings.css';

interface RegionSettingsProps {
  /** 是否为模态对话框模式 */
  modal?: boolean;
  /** 关闭回调 */
  onClose?: () => void;
  /** 保存完成回调 */
  onSaved?: (preferences: RegionPreferences) => void;
}

export const RegionSettings: React.FC<RegionSettingsProps> = ({
  modal = false,
  onClose,
  onSaved,
}) => {
  // ================================
  // Hooks 和状态
  // ================================
  
  const {
    preferences,
    systemRegion,
    availableRegions,
    loading: regionLoading,
    error: regionError,
    saveUserPreferences,
    detectSystemRegion,
    clearError,
  } = useRegion();

  const { configs, loading: configsLoading } = useRegionConfigs();
  
  const {
    preferences: formPreferences,
    errors: formErrors,
    updatePreference,
    validateForm,
    resetForm,
    isValid,
    isDirty,
  } = useRegionPreferencesForm(preferences || undefined);

  const [activeTab, setActiveTab] = useState<'basic' | 'format' | 'units' | 'preview'>('basic');
  const [saving, setSaving] = useState(false);
  const [showSystemDetection, setShowSystemDetection] = useState(false);

  // ================================
  // 处理函数
  // ================================

  const handleSave = async () => {
    if (!validateForm()) {
      return;
    }

    setSaving(true);
    try {
      await saveUserPreferences(formPreferences);
      onSaved?.(formPreferences);
      if (modal) {
        onClose?.();
      }
    } catch (error) {
      console.error('保存区域设置失败:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    resetForm();
    onClose?.();
  };

  const handleDetectSystem = async () => {
    try {
      await detectSystemRegion();
      setShowSystemDetection(true);
    } catch (error) {
      console.error('检测系统区域失败:', error);
    }
  };

  const handleApplySystemRegion = (systemInfo: SystemRegionInfo) => {
    updatePreference('locale', systemInfo.locale);
    updatePreference('timezone', systemInfo.timezone);
    updatePreference('currency', systemInfo.currency);
    setShowSystemDetection(false);
  };

  // ================================
  // 渲染函数
  // ================================

  const renderBasicSettings = () => (
    <div className="region-settings-section">
      <h3>基本设置</h3>
      
      <div className="form-group">
        <label>区域语言</label>
        <RegionSelector
          value={formPreferences.locale}
          onChange={(locale) => updatePreference('locale', locale)}
          placeholder="选择区域语言"
          showRecommended
        />
        <div className="form-help">
          选择您的区域语言，这将影响整个应用的显示格式
        </div>
      </div>

      <div className="form-group">
        <label>时区</label>
        <select
          value={formPreferences.timezone}
          onChange={(e) => updatePreference('timezone', e.target.value)}
          className="form-select"
        >
          {SUPPORTED_TIMEZONES.map(tz => (
            <option key={tz} value={tz}>{tz}</option>
          ))}
        </select>
      </div>

      <div className="form-group">
        <label>货币</label>
        <select
          value={formPreferences.currency}
          onChange={(e) => updatePreference('currency', e.target.value)}
          className="form-select"
        >
          {SUPPORTED_CURRENCIES.map(currency => (
            <option key={currency} value={currency}>{currency}</option>
          ))}
        </select>
      </div>

      <div className="form-group">
        <label>每周第一天</label>
        <select
          value={formPreferences.first_day_of_week}
          onChange={(e) => updatePreference('first_day_of_week', parseInt(e.target.value))}
          className="form-select"
        >
          <option value={0}>星期日</option>
          <option value={1}>星期一</option>
        </select>
      </div>

      <div className="form-group">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={formPreferences.rtl_support}
            onChange={(e) => updatePreference('rtl_support', e.target.checked)}
          />
          从右到左文字支持
        </label>
      </div>

      {systemRegion && (
        <div className="system-detection">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleDetectSystem}
          >
            检测系统设置
          </button>
          {showSystemDetection && (
            <div className="system-detection-result">
              <h4>检测到的系统设置</h4>
              <p>区域: {systemRegion.locale}</p>
              <p>时区: {systemRegion.timezone}</p>
              <p>货币: {systemRegion.currency}</p>
              <p>置信度: {(systemRegion.confidence * 100).toFixed(1)}%</p>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => handleApplySystemRegion(systemRegion)}
              >
                应用系统设置
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );

  const renderFormatSettings = () => (
    <div className="region-settings-section">
      <h3>格式设置</h3>
      
      <div className="form-group">
        <label>日期格式</label>
        <select
          value={formPreferences.date_format}
          onChange={(e) => updatePreference('date_format', e.target.value)}
          className="form-select"
        >
          <option value="YYYY-MM-DD">YYYY-MM-DD (2025-10-19)</option>
          <option value="MM/DD/YYYY">MM/DD/YYYY (10/19/2025)</option>
          <option value="DD/MM/YYYY">DD/MM/YYYY (19/10/2025)</option>
          <option value="YYYY年MM月DD日">YYYY年MM月DD日 (2025年10月19日)</option>
          <option value="DD.MM.YYYY">DD.MM.YYYY (19.10.2025)</option>
        </select>
      </div>

      <div className="form-group">
        <label>时间格式</label>
        <select
          value={formPreferences.time_format}
          onChange={(e) => updatePreference('time_format', e.target.value)}
          className="form-select"
        >
          <option value="24h">24小时制 (14:30)</option>
          <option value="12h">12小时制 (2:30 PM)</option>
        </select>
      </div>

      <div className="form-group">
        <label>数字格式</label>
        <select
          value={formPreferences.number_format}
          onChange={(e) => updatePreference('number_format', e.target.value)}
          className="form-select"
        >
          <option value="1,234.56">1,234.56 (英语格式)</option>
          <option value="1.234,56">1.234,56 (德语格式)</option>
          <option value="1 234,56">1 234,56 (法语格式)</option>
          <option value="1234.56">1234.56 (简化格式)</option>
        </select>
      </div>
    </div>
  );

  const renderUnitSettings = () => (
    <div className="region-settings-section">
      <h3>单位设置</h3>
      
      <div className="form-group">
        <label>温度单位</label>
        <select
          value={formPreferences.temperature_unit}
          onChange={(e) => updatePreference('temperature_unit', e.target.value)}
          className="form-select"
        >
          <option value="celsius">摄氏度 (°C)</option>
          <option value="fahrenheit">华氏度 (°F)</option>
          <option value="kelvin">开尔文 (K)</option>
        </select>
      </div>

      <div className="form-group">
        <label>距离单位</label>
        <select
          value={formPreferences.distance_unit}
          onChange={(e) => updatePreference('distance_unit', e.target.value)}
          className="form-select"
        >
          <option value="metric">公制 (km, m, cm)</option>
          <option value="imperial">英制 (mile, ft, in)</option>
          <option value="mixed">混合 (自动选择)</option>
        </select>
      </div>

      <div className="form-group">
        <label>重量单位</label>
        <select
          value={formPreferences.weight_unit}
          onChange={(e) => updatePreference('weight_unit', e.target.value)}
          className="form-select"
        >
          <option value="metric">公制 (kg, g)</option>
          <option value="imperial">英制 (lb, oz)</option>
          <option value="mixed">混合 (自动选择)</option>
        </select>
      </div>
    </div>
  );

  const renderPreview = () => (
    <div className="region-settings-section">
      <h3>预览效果</h3>
      <FormatPreview preferences={formPreferences} />
    </div>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case 'basic':
        return renderBasicSettings();
      case 'format':
        return renderFormatSettings();
      case 'units':
        return renderUnitSettings();
      case 'preview':
        return renderPreview();
      default:
        return null;
    }
  };

  // ================================
  // 主渲染
  // ================================

  return (
    <div className={`region-settings ${modal ? 'region-settings-modal' : ''}`}>
      <div className="region-settings-header">
        <h2>区域设置</h2>
        {modal && (
          <button
            type="button"
            className="close-button"
            onClick={onClose}
            aria-label="关闭"
          >
            ×
          </button>
        )}
      </div>

      {regionError && (
        <div className="error-message">
          {regionError}
          <button
            type="button"
            className="error-close"
            onClick={clearError}
          >
            ×
          </button>
        </div>
      )}

      {formErrors.length > 0 && (
        <div className="error-message">
          {formErrors.map((error, index) => (
            <div key={index}>{error}</div>
          ))}
        </div>
      )}

      <div className="region-settings-tabs">
        <button
          type="button"
          className={`tab ${activeTab === 'basic' ? 'active' : ''}`}
          onClick={() => setActiveTab('basic')}
        >
          基本设置
        </button>
        <button
          type="button"
          className={`tab ${activeTab === 'format' ? 'active' : ''}`}
          onClick={() => setActiveTab('format')}
        >
          格式设置
        </button>
        <button
          type="button"
          className={`tab ${activeTab === 'units' ? 'active' : ''}`}
          onClick={() => setActiveTab('units')}
        >
          单位设置
        </button>
        <button
          type="button"
          className={`tab ${activeTab === 'preview' ? 'active' : ''}`}
          onClick={() => setActiveTab('preview')}
        >
          预览效果
        </button>
      </div>

      <div className="region-settings-content">
        {regionLoading || configsLoading ? (
          <div className="loading-spinner">
            <div className="spinner"></div>
            <span>加载中...</span>
          </div>
        ) : (
          renderTabContent()
        )}
      </div>

      <div className="region-settings-footer">
        <div className="footer-left">
          <span className="settings-info">
            {isDirty ? '有未保存的更改' : '所有更改已保存'}
          </span>
        </div>
        <div className="footer-right">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleCancel}
            disabled={saving}
          >
            取消
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleSave}
            disabled={!isValid || saving || !isDirty}
          >
            {saving ? '保存中...' : '保存设置'}
          </button>
        </div>
      </div>
    </div>
  );
};

