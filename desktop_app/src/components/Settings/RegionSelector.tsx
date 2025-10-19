/**
 * 区域选择器组件
 * 
 * 提供区域语言选择功能
 */

import React, { useState, useEffect, useMemo } from 'react';
import { RegionSelectorProps, RegionConfig } from '../../types/region';
import { useRegionConfigs, useRegion } from '../../hooks/useRegion';
import './RegionSelector.css';

export const RegionSelector: React.FC<RegionSelectorProps> = ({
  value,
  onChange,
  disabled = false,
  placeholder = '请选择区域',
  showRecommended = false,
  className = '',
}) => {
  // ================================
  // Hooks 和状态
  // ================================
  
  const { configs, loading } = useRegionConfigs();
  const { getRecommendedRegions } = useRegion();
  
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [recommendedLocales, setRecommendedLocales] = useState<string[]>([]);

  // ================================
  // 计算属性
  // ================================

  const filteredConfigs = useMemo(() => {
    if (!searchTerm) return configs;
    
    const lowerSearchTerm = searchTerm.toLowerCase();
    return configs.filter(config => 
      config.name.toLowerCase().includes(lowerSearchTerm) ||
      config.native_name.toLowerCase().includes(lowerSearchTerm) ||
      config.locale.toLowerCase().includes(lowerSearchTerm) ||
      config.language_code.toLowerCase().includes(lowerSearchTerm) ||
      config.country_code.toLowerCase().includes(lowerSearchTerm)
    );
  }, [configs, searchTerm]);

  const groupedConfigs = useMemo(() => {
    const recommended = showRecommended ? 
      filteredConfigs.filter(config => recommendedLocales.includes(config.locale)) : [];
    const others = filteredConfigs.filter(config => 
      !recommendedLocales.includes(config.locale)
    );

    return { recommended, others };
  }, [filteredConfigs, recommendedLocales, showRecommended]);

  const selectedConfig = useMemo(() => {
    return configs.find(config => config.locale === value);
  }, [configs, value]);

  // ================================
  // 效果钩子
  // ================================

  useEffect(() => {
    if (showRecommended) {
      getRecommendedRegions(value).then(setRecommendedLocales);
    }
  }, [showRecommended, value, getRecommendedRegions]);

  // ================================
  // 事件处理
  // ================================

  const handleToggleOpen = () => {
    if (!disabled) {
      setIsOpen(!isOpen);
    }
  };

  const handleSelectConfig = (config: RegionConfig) => {
    onChange?.(config.locale);
    setIsOpen(false);
    setSearchTerm('');
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
      setSearchTerm('');
    } else if (e.key === 'Enter' && filteredConfigs.length === 1) {
      handleSelectConfig(filteredConfigs[0]);
    }
  };

  // ================================
  // 渲染函数
  // ================================

  const renderConfigItem = (config: RegionConfig, isRecommended = false) => (
    <div
      key={config.locale}
      className={`region-option ${isRecommended ? 'recommended' : ''}`}
      onClick={() => handleSelectConfig(config)}
    >
      <div className="region-option-main">
        <span className="region-name">{config.native_name}</span>
        <span className="region-code">({config.locale})</span>
        {isRecommended && (
          <span className="recommended-badge">推荐</span>
        )}
      </div>
      <div className="region-option-sub">
        <span className="region-english-name">{config.name}</span>
        <span className="region-details">
          {config.currency} • {config.timezone[0]}
        </span>
      </div>
    </div>
  );

  const renderDropdown = () => {
    if (!isOpen) return null;

    return (
      <div className="region-dropdown">
        <div className="region-search">
          <input
            type="text"
            placeholder="搜索区域..."
            value={searchTerm}
            onChange={handleSearchChange}
            onKeyDown={handleKeyDown}
            autoFocus
          />
        </div>
        
        <div className="region-options">
          {loading ? (
            <div className="region-loading">
              <span>加载中...</span>
            </div>
          ) : filteredConfigs.length === 0 ? (
            <div className="region-empty">
              <span>未找到匹配的区域</span>
            </div>
          ) : (
            <>
              {groupedConfigs.recommended.length > 0 && (
                <div className="region-group">
                  <div className="region-group-title">推荐区域</div>
                  {groupedConfigs.recommended.map(config => 
                    renderConfigItem(config, true)
                  )}
                </div>
              )}
              
              {groupedConfigs.others.length > 0 && (
                <div className="region-group">
                  {groupedConfigs.recommended.length > 0 && (
                    <div className="region-group-title">其他区域</div>
                  )}
                  {groupedConfigs.others.map(config => 
                    renderConfigItem(config, false)
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    );
  };

  // ================================
  // 主渲染
  // ================================

  return (
    <div className={`region-selector ${className} ${disabled ? 'disabled' : ''}`}>
      <div 
        className={`region-selector-trigger ${isOpen ? 'open' : ''}`}
        onClick={handleToggleOpen}
      >
        <div className="region-selector-content">
          {selectedConfig ? (
            <div className="selected-region">
              <span className="selected-region-name">
                {selectedConfig.native_name}
              </span>
              <span className="selected-region-code">
                ({selectedConfig.locale})
              </span>
            </div>
          ) : (
            <span className="region-placeholder">{placeholder}</span>
          )}
        </div>
        <div className="region-selector-arrow">
          <svg
            width="12"
            height="8"
            viewBox="0 0 12 8"
            className={isOpen ? 'rotated' : ''}
          >
            <path
              d="M1 1l5 5 5-5"
              stroke="currentColor"
              strokeWidth="2"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </div>
      
      {renderDropdown()}
      
      {isOpen && (
        <div 
          className="region-selector-backdrop"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
};

