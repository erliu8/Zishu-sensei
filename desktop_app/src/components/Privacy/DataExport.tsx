/**
 * 数据导出组件
 * 允许用户导出和清理学习数据
 */

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import PrivacyService from '../../services/privacyService';
import type { ExportFormat, ExportOptions } from '../../types/privacy';

interface DataExportProps {
  className?: string;
}

export const DataExport: React.FC<DataExportProps> = ({ className }) => {
  const [exportFormat, setExportFormat] = useState<ExportFormat>('json');
  const [anonymize, setAnonymize] = useState(true);
  const [includeProgress, setIncludeProgress] = useState(true);
  const [includePreferences, setIncludePreferences] = useState(true);
  const [includeHistory, setIncludeHistory] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [cleaning, setCleaning] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      const options: ExportOptions = {
        format: exportFormat,
        anonymize,
        includeProgress,
        includePreferences,
        includeHistory,
      };

      const result = await PrivacyService.exportData(options);
      
      // 创建下载链接
      const blob = new Blob([result.data], {
        type: exportFormat === 'json' ? 'application/json' : 'text/csv',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = result.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success(`数据已导出到 ${result.filename}`);
    } catch (error) {
      toast.error('导出数据失败: ' + error);
    } finally {
      setExporting(false);
    }
  };

  const handleCleanup = async () => {
    if (!confirm('确定要清理所有学习数据吗？此操作无法撤销。')) {
      return;
    }

    setCleaning(true);
    try {
      const result = await PrivacyService.cleanupData();
      toast.success(
        `已清理 ${result.sessionsDeleted} 个会话和 ${result.recordsDeleted} 条记录，释放 ${(result.spaceFreed / 1024 / 1024).toFixed(2)} MB 空间`
      );
    } catch (error) {
      toast.error('清理数据失败: ' + error);
    } finally {
      setCleaning(false);
    }
  };

  return (
    <div className={clsx('max-w-4xl mx-auto p-6 space-y-6', className)}>
      {/* 标题 */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h2 className="text-2xl font-bold mb-2">📦 数据管理</h2>
        <p className="text-gray-500">导出、备份或清理您的学习数据</p>
      </motion.div>

      {/* 导出设置 */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 space-y-4"
      >
        <h3 className="text-lg font-semibold mb-4">数据导出</h3>

        {/* 导出格式 */}
        <div>
          <label className="block font-medium mb-2">导出格式</label>
          <div className="grid grid-cols-3 gap-3">
            {(['json', 'csv', 'pdf'] as ExportFormat[]).map((format) => (
              <button
                key={format}
                onClick={() => setExportFormat(format)}
                className={clsx(
                  'px-4 py-3 rounded-lg border-2 transition-all',
                  exportFormat === format
                    ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                    : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                )}
              >
                <div className="font-medium uppercase">{format}</div>
                <div className="text-xs text-gray-500 mt-1">
                  {format === 'json' && '结构化数据'}
                  {format === 'csv' && '电子表格'}
                  {format === 'pdf' && 'PDF文档'}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* 导出选项 */}
        <div className="space-y-3 pt-4">
          <div className="flex items-center justify-between py-2">
            <div>
              <div className="font-medium">匿名化数据</div>
              <div className="text-sm text-gray-500">移除个人身份信息</div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={anonymize}
                onChange={(e) => setAnonymize(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
            </label>
          </div>

          <div className="flex items-center justify-between py-2">
            <div>
              <div className="font-medium">包含学习进度</div>
              <div className="text-sm text-gray-500">导出学习进度数据</div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={includeProgress}
                onChange={(e) => setIncludeProgress(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
            </label>
          </div>

          <div className="flex items-center justify-between py-2">
            <div>
              <div className="font-medium">包含偏好设置</div>
              <div className="text-sm text-gray-500">导出用户偏好配置</div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={includePreferences}
                onChange={(e) => setIncludePreferences(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
            </label>
          </div>

          <div className="flex items-center justify-between py-2">
            <div>
              <div className="font-medium">包含学习历史</div>
              <div className="text-sm text-gray-500">导出历史会话记录</div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={includeHistory}
                onChange={(e) => setIncludeHistory(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
            </label>
          </div>
        </div>

        <button
          onClick={handleExport}
          disabled={exporting}
          className="w-full mt-4 px-4 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
        >
          {exporting ? '导出中...' : '导出数据'}
        </button>
      </motion.div>

      {/* 数据清理 */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 space-y-4"
      >
        <h3 className="text-lg font-semibold mb-4 text-red-600 dark:text-red-400">
          危险操作
        </h3>

        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-start">
            <span className="text-red-600 dark:text-red-400 mr-3 text-xl">
              ⚠️
            </span>
            <div className="flex-1">
              <div className="font-medium text-red-800 dark:text-red-200 mb-2">
                清理所有数据
              </div>
              <p className="text-sm text-red-700 dark:text-red-300 mb-4">
                此操作将永久删除所有学习数据、会话历史和进度记录。此操作无法撤销，请谨慎操作。
              </p>
              <button
                onClick={handleCleanup}
                disabled={cleaning}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
              >
                {cleaning ? '清理中...' : '清理所有数据'}
              </button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* 信息提示 */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4"
      >
        <div className="flex items-start">
          <span className="text-blue-600 dark:text-blue-400 mr-3">ℹ️</span>
          <div className="flex-1 text-sm text-blue-800 dark:text-blue-200">
            <div className="font-medium mb-1">数据导出说明</div>
            <ul className="list-disc list-inside space-y-1">
              <li>导出的数据可用于备份或迁移到其他设备</li>
              <li>启用匿名化后将移除所有个人身份信息</li>
              <li>PDF 格式适合打印和分享，但不支持重新导入</li>
              <li>JSON 格式保留完整结构，适合程序处理</li>
            </ul>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default DataExport;

