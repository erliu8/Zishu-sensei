/**
 * 格式化预览组件
 * 
 * 显示区域设置的格式化效果预览
 */

import React, { useEffect, useState } from 'react';
import { FormatPreviewProps, FormattedValue, SampleData } from '../../types/region';
import { useFormat } from '../../hooks/useRegion';
import './FormatPreview.css';

const DEFAULT_SAMPLE_DATA: SampleData = {
  datetime: Date.now() / 1000, // 当前时间戳
  number: 1234567.89,
  currency: 12345.67,
  temperature: 25.5,
  distance: 1500.75,
  weight: 2500.25,
  fileSize: 1024 * 1024 * 15.7, // 15.7 MB
  percentage: 0.785,
};

export const FormatPreview: React.FC<FormatPreviewProps> = ({
  preferences,
  sampleData = DEFAULT_SAMPLE_DATA,
  className = '',
}) => {
  // ================================
  // Hooks 和状态
  // ================================
  
  const {
    formatDateTime,
    formatDate,
    formatTime,
    formatNumber,
    formatCurrency,
    formatTemperature,
    formatDistance,
    formatWeight,
    formatFileSize,
    formatPercentage,
    formatting,
  } = useFormat();

  const [previewData, setPreviewData] = useState<{
    datetime?: FormattedValue;
    date?: FormattedValue;
    time?: FormattedValue;
    number?: FormattedValue;
    currency?: FormattedValue;
    temperature?: FormattedValue;
    distance?: FormattedValue;
    weight?: FormattedValue;
    fileSize?: FormattedValue;
    percentage?: FormattedValue;
  }>({});

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ================================
  // 格式化数据
  // ================================

  const updatePreviewData = async () => {
    if (!preferences) return;

    setLoading(true);
    setError(null);

    try {
      const results: typeof previewData = {};

      // 格式化日期时间相关
      if (sampleData.datetime) {
        results.datetime = await formatDateTime(sampleData.datetime);
        results.date = await formatDate(sampleData.datetime);
        results.time = await formatTime(sampleData.datetime);
      }

      // 格式化数字
      if (sampleData.number !== undefined) {
        results.number = await formatNumber(sampleData.number, 2);
      }

      // 格式化货币
      if (sampleData.currency !== undefined) {
        results.currency = await formatCurrency(sampleData.currency);
      }

      // 格式化温度
      if (sampleData.temperature !== undefined) {
        results.temperature = await formatTemperature(sampleData.temperature);
      }

      // 格式化距离
      if (sampleData.distance !== undefined) {
        results.distance = await formatDistance(sampleData.distance);
      }

      // 格式化重量
      if (sampleData.weight !== undefined) {
        results.weight = await formatWeight(sampleData.weight);
      }

      // 格式化文件大小
      if (sampleData.fileSize !== undefined) {
        results.fileSize = await formatFileSize(sampleData.fileSize);
      }

      // 格式化百分比
      if (sampleData.percentage !== undefined) {
        results.percentage = await formatPercentage(sampleData.percentage, 1);
      }

      setPreviewData(results);
    } catch (err) {
      setError(err instanceof Error ? err.message : '格式化失败');
    } finally {
      setLoading(false);
    }
  };

  // ================================
  // 效果钩子
  // ================================

  useEffect(() => {
    updatePreviewData();
  }, [preferences, sampleData]);

  // ================================
  // 渲染函数
  // ================================

  const renderPreviewItem = (
    label: string,
    value: FormattedValue | undefined,
    description?: string
  ) => (
    <div className="preview-item">
      <div className="preview-item-header">
        <span className="preview-label">{label}</span>
        {description && (
          <span className="preview-description">{description}</span>
        )}
      </div>
      <div className="preview-value">
        {value ? (
          <>
            <span className="formatted-value">{value.value}</span>
            {value.unit && (
              <span className="value-unit">({value.unit})</span>
            )}
          </>
        ) : (
          <span className="loading-text">加载中...</span>
        )}
      </div>
    </div>
  );

  const renderLocaleInfo = () => (
    <div className="preview-section">
      <h4>区域信息</h4>
      <div className="locale-info">
        <div className="info-row">
          <span className="info-label">区域代码:</span>
          <span className="info-value">{preferences.locale}</span>
        </div>
        <div className="info-row">
          <span className="info-label">时区:</span>
          <span className="info-value">{preferences.timezone}</span>
        </div>
        <div className="info-row">
          <span className="info-label">货币:</span>
          <span className="info-value">{preferences.currency}</span>
        </div>
        <div className="info-row">
          <span className="info-label">文字方向:</span>
          <span className="info-value">
            {preferences.rtl_support ? '从右到左' : '从左到右'}
          </span>
        </div>
      </div>
    </div>
  );

  const renderDateTimePreview = () => (
    <div className="preview-section">
      <h4>日期时间</h4>
      <div className="preview-items">
        {renderPreviewItem(
          '完整日期时间',
          previewData.datetime,
          '包含日期和时间的完整格式'
        )}
        {renderPreviewItem(
          '日期',
          previewData.date,
          '仅显示日期部分'
        )}
        {renderPreviewItem(
          '时间',
          previewData.time,
          '仅显示时间部分'
        )}
      </div>
    </div>
  );

  const renderNumberPreview = () => (
    <div className="preview-section">
      <h4>数字格式</h4>
      <div className="preview-items">
        {renderPreviewItem(
          '数字',
          previewData.number,
          '普通数字格式，包含千位分隔符'
        )}
        {renderPreviewItem(
          '货币',
          previewData.currency,
          '货币格式，包含货币符号'
        )}
        {renderPreviewItem(
          '百分比',
          previewData.percentage,
          '百分比格式'
        )}
      </div>
    </div>
  );

  const renderUnitPreview = () => (
    <div className="preview-section">
      <h4>单位格式</h4>
      <div className="preview-items">
        {renderPreviewItem(
          '温度',
          previewData.temperature,
          '温度显示格式'
        )}
        {renderPreviewItem(
          '距离',
          previewData.distance,
          '距离显示格式'
        )}
        {renderPreviewItem(
          '重量',
          previewData.weight,
          '重量显示格式'
        )}
        {renderPreviewItem(
          '文件大小',
          previewData.fileSize,
          '文件大小显示格式'
        )}
      </div>
    </div>
  );

  // ================================
  // 主渲染
  // ================================

  if (!preferences) {
    return (
      <div className={`format-preview ${className}`}>
        <div className="preview-empty">
          请先设置区域偏好
        </div>
      </div>
    );
  }

  return (
    <div className={`format-preview ${className}`}>
      {error && (
        <div className="preview-error">
          <span className="error-icon">⚠️</span>
          <span>预览失败: {error}</span>
          <button
            type="button"
            className="retry-button"
            onClick={updatePreviewData}
          >
            重试
          </button>
        </div>
      )}

      {loading || formatting ? (
        <div className="preview-loading">
          <div className="loading-spinner">
            <div className="spinner"></div>
          </div>
          <span>正在生成预览...</span>
        </div>
      ) : (
        <div className="preview-content">
          {renderLocaleInfo()}
          {renderDateTimePreview()}
          {renderNumberPreview()}
          {renderUnitPreview()}
        </div>
      )}

      <div className="preview-footer">
        <button
          type="button"
          className="refresh-preview-button"
          onClick={updatePreviewData}
          disabled={loading || formatting}
        >
          刷新预览
        </button>
        <span className="preview-note">
          预览数据基于当前设置生成，实际显示效果可能因系统而异
        </span>
      </div>
    </div>
  );
};

