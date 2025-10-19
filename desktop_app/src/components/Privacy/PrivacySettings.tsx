/**
 * 隐私设置组件
 * 允许用户管理隐私偏好设置
 */

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import PrivacyService from '../../services/privacyService';
import type { PrivacySettings as IPrivacySettings } from '../../types/privacy';

interface PrivacySettingsProps {
  onSettingsChange?: (settings: IPrivacySettings) => void;
  className?: string;
}

export const PrivacySettings: React.FC<PrivacySettingsProps> = ({
  onSettingsChange,
  className,
}) => {
  const [settings, setSettings] = useState<IPrivacySettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const data = await PrivacyService.getPrivacySettings();
      setSettings(data);
    } catch (error) {
      toast.error('加载隐私设置失败: ' + error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!settings) return;

    setSaveLoading(true);
    try {
      await PrivacyService.updatePrivacySettings(settings);
      toast.success('隐私设置已保存');
      onSettingsChange?.(settings);
    } catch (error) {
      toast.error('保存隐私设置失败: ' + error);
    } finally {
      setSaveLoading(false);
    }
  };

  const updateSetting = <K extends keyof IPrivacySettings>(
    key: K,
    value: IPrivacySettings[K]
  ) => {
    if (!settings) return;
    const updated = { ...settings, [key]: value };
    setSettings(updated);
  };

  if (loading || !settings) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">加载中...</div>
      </div>
    );
  }

  return (
    <div className={clsx('max-w-4xl mx-auto p-6 space-y-6', className)}>
      {/* 标题 */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h2 className="text-2xl font-bold mb-2">🔒 隐私设置</h2>
        <p className="text-gray-500">管理您的数据隐私和安全偏好设置</p>
      </motion.div>

      {/* 数据收集设置 */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 space-y-4"
      >
        <h3 className="text-lg font-semibold mb-4">数据收集</h3>

        <div className="flex items-center justify-between py-3 border-b border-gray-200 dark:border-gray-700">
          <div className="flex-1">
            <div className="font-medium">启用数据收集</div>
            <div className="text-sm text-gray-500">
              允许应用收集学习数据以改善体验
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={settings.dataCollectionEnabled}
              onChange={(e) =>
                updateSetting('dataCollectionEnabled', e.target.checked)
              }
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
          </label>
        </div>

        <div className="flex items-center justify-between py-3 border-b border-gray-200 dark:border-gray-700">
          <div className="flex-1">
            <div className="font-medium">启用分析</div>
            <div className="text-sm text-gray-500">
              收集匿名使用统计以改进应用
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={settings.analyticsEnabled}
              onChange={(e) =>
                updateSetting('analyticsEnabled', e.target.checked)
              }
              disabled={!settings.dataCollectionEnabled}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"></div>
          </label>
        </div>

        <div className="flex items-center justify-between py-3">
          <div className="flex-1">
            <div className="font-medium">启用崩溃报告</div>
            <div className="text-sm text-gray-500">
              自动发送崩溃报告以帮助修复问题
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={settings.crashReportsEnabled}
              onChange={(e) =>
                updateSetting('crashReportsEnabled', e.target.checked)
              }
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
          </label>
        </div>
      </motion.div>

      {/* 数据保留策略 */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 space-y-4"
      >
        <h3 className="text-lg font-semibold mb-4">数据保留</h3>

        <div className="flex items-center justify-between py-3">
          <div className="flex-1">
            <div className="font-medium">启用自动清理</div>
            <div className="text-sm text-gray-500">
              自动删除过期的学习数据
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={settings.retentionPolicy.enabled}
              onChange={(e) =>
                updateSetting('retentionPolicy', {
                  ...settings.retentionPolicy,
                  enabled: e.target.checked,
                })
              }
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
          </label>
        </div>

        {settings.retentionPolicy.enabled && (
          <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <label className="block">
              <span className="font-medium">保留天数</span>
              <p className="text-sm text-gray-500 mb-2">
                超过此天数的数据将被自动清理
              </p>
              <div className="flex items-center space-x-2">
                <input
                  type="number"
                  min="1"
                  max="3650"
                  value={settings.retentionPolicy.retentionDays}
                  onChange={(e) =>
                    updateSetting('retentionPolicy', {
                      ...settings.retentionPolicy,
                      retentionDays: parseInt(e.target.value) || 365,
                    })
                  }
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-800"
                />
                <span className="text-gray-500">天</span>
              </div>
            </label>
          </div>
        )}
      </motion.div>

      {/* 匿名化设置 */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 space-y-4"
      >
        <h3 className="text-lg font-semibold mb-4">数据匿名化</h3>

        <div className="flex items-center justify-between py-3">
          <div className="flex-1">
            <div className="font-medium">启用数据匿名化</div>
            <div className="text-sm text-gray-500">
              在导出或分析时自动匿名化敏感数据
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={settings.anonymizationConfig.enabled}
              onChange={(e) =>
                updateSetting('anonymizationConfig', {
                  ...settings.anonymizationConfig,
                  enabled: e.target.checked,
                })
              }
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
          </label>
        </div>

        {settings.anonymizationConfig.enabled && (
          <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <label className="block">
              <span className="font-medium">匿名化方法</span>
              <select
                value={settings.anonymizationConfig.method}
                onChange={(e) =>
                  updateSetting('anonymizationConfig', {
                    ...settings.anonymizationConfig,
                    method: e.target.value as 'hash' | 'mask' | 'remove',
                  })
                }
                className="mt-2 w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-800"
              >
                <option value="hash">哈希（不可逆）</option>
                <option value="mask">掩码（部分隐藏）</option>
                <option value="remove">移除（完全删除）</option>
              </select>
            </label>
          </div>
        )}
      </motion.div>

      {/* 警告信息 */}
      {(!settings.dataCollectionEnabled ||
        settings.retentionPolicy.enabled) && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4"
        >
          <div className="flex items-start">
            <span className="text-yellow-600 dark:text-yellow-400 mr-3">
              ⚠️
            </span>
            <div className="flex-1 text-sm text-yellow-800 dark:text-yellow-200">
              <div className="font-medium mb-1">注意</div>
              {!settings.dataCollectionEnabled && (
                <div>• 禁用数据收集可能会影响某些功能的体验</div>
              )}
              {settings.retentionPolicy.enabled && (
                <div>
                  • 启用自动清理将在{' '}
                  {settings.retentionPolicy.retentionDays} 天后自动删除数据
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}

      {/* 操作按钮 */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="flex justify-end space-x-3 pt-4"
      >
        <button
          onClick={loadSettings}
          className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          重置
        </button>
        <button
          onClick={handleSave}
          disabled={saveLoading}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saveLoading ? '保存中...' : '保存设置'}
        </button>
      </motion.div>

      {/* 最后更新时间 */}
      {settings.lastUpdated && (
        <div className="text-center text-sm text-gray-500">
          最后更新: {new Date(settings.lastUpdated).toLocaleString('zh-CN')}
        </div>
      )}
    </div>
  );
};

export default PrivacySettings;
