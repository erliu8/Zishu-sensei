/**
 * 同意对话框组件
 * 在首次使用时显示隐私政策和用户同意
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import PrivacyService from '../../services/privacyService';
import type { ConsentRecord } from '../../types/privacy';

interface ConsentDialogProps {
  onConsent: (consented: boolean) => void;
  canSkip?: boolean;
  className?: string;
}

export const ConsentDialog: React.FC<ConsentDialogProps> = ({
  onConsent,
  canSkip = false,
  className,
}) => {
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dataCollection, setDataCollection] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [crashReports, setCrashReports] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    checkConsent();
  }, []);

  const checkConsent = async () => {
    setLoading(true);
    try {
      const hasConsented = await PrivacyService.hasUserConsented();
      if (!hasConsented) {
        setVisible(true);
      }
    } catch (error) {
      console.error('检查同意状态失败:', error);
      setVisible(true);
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async () => {
    setSubmitting(true);
    try {
      const consentData: Omit<ConsentRecord, 'id' | 'timestamp'> = {
        dataCollection,
        analytics,
        crashReports,
        version: '1.0',
        ipAddress: null,
        userAgent: navigator.userAgent,
      };

      await PrivacyService.recordConsent(consentData);
      toast.success('感谢您的确认！');
      setVisible(false);
      onConsent(true);
    } catch (error) {
      toast.error('记录同意失败: ' + error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDecline = () => {
    if (!canSkip) {
      toast.error('您必须同意隐私政策才能使用本应用');
      return;
    }
    setVisible(false);
    onConsent(false);
  };

  if (loading) {
    return null;
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className={clsx(
            'fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4',
            className
          )}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col"
          >
            {/* 头部 */}
            <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-2xl font-bold mb-2">🔒 隐私政策与用户协议</h2>
              <p className="text-gray-500">
                欢迎使用 Zishu Sensei！在开始之前，请了解我们如何处理您的数据。
              </p>
            </div>

            {/* 内容 */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
              {/* 隐私政策摘要 */}
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold mb-2">📋 我们收集的信息</h3>
                  <ul className="list-disc list-inside space-y-1 text-sm text-gray-600 dark:text-gray-400">
                    <li>学习进度和练习记录（用于跟踪您的学习成果）</li>
                    <li>应用使用统计（用于改善用户体验）</li>
                    <li>设备信息和日志（用于问题诊断和修复）</li>
                  </ul>
                </div>

                <div>
                  <h3 className="font-semibold mb-2">🛡️ 数据保护承诺</h3>
                  <ul className="list-disc list-inside space-y-1 text-sm text-gray-600 dark:text-gray-400">
                    <li>所有数据存储在您的本地设备，不会上传到服务器</li>
                    <li>支持数据加密和匿名化处理</li>
                    <li>您可以随时导出或删除您的数据</li>
                    <li>我们不会将您的数据分享给第三方</li>
                  </ul>
                </div>

                <div>
                  <h3 className="font-semibold mb-2">⚙️ 您的选择</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                    请选择您希望启用的功能（可以随后在设置中更改）：
                  </p>

                  <div className="space-y-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                    <label className="flex items-start cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={dataCollection}
                        onChange={(e) => setDataCollection(e.target.checked)}
                        className="mt-1 w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                      />
                      <div className="ml-3 flex-1">
                        <div className="font-medium text-sm group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                          数据收集
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          记录学习数据以提供个性化建议和进度跟踪
                        </div>
                      </div>
                    </label>

                    <label className="flex items-start cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={analytics}
                        onChange={(e) => setAnalytics(e.target.checked)}
                        className="mt-1 w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                      />
                      <div className="ml-3 flex-1">
                        <div className="font-medium text-sm group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                          使用分析
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          收集匿名使用统计帮助我们改进应用
                        </div>
                      </div>
                    </label>

                    <label className="flex items-start cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={crashReports}
                        onChange={(e) => setCrashReports(e.target.checked)}
                        className="mt-1 w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                      />
                      <div className="ml-3 flex-1">
                        <div className="font-medium text-sm group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                          崩溃报告
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          自动发送崩溃信息帮助我们修复问题（推荐）
                        </div>
                      </div>
                    </label>
                  </div>
                </div>
              </div>

              {/* 法律文本 */}
              <div className="text-xs text-gray-500 space-y-2 pt-4 border-t border-gray-200 dark:border-gray-700">
                <p>
                  继续使用即表示您已阅读并同意我们的{' '}
                  <a
                    href="https://zishu.dev/privacy"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    隐私政策
                  </a>{' '}
                  和{' '}
                  <a
                    href="https://zishu.dev/terms"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    服务条款
                  </a>
                  。
                </p>
                <p>
                  您的隐私对我们至关重要。我们遵守 GDPR、CCPA
                  等国际隐私法规，并承诺保护您的个人数据安全。
                </p>
              </div>
            </div>

            {/* 底部按钮 */}
            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-900/50">
              {canSkip ? (
                <button
                  onClick={handleDecline}
                  className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
                >
                  稍后设置
                </button>
              ) : (
                <div className="text-xs text-gray-500">
                  * 必须同意才能继续使用
                </div>
              )}

              <button
                onClick={handleAccept}
                disabled={submitting}
                className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium shadow-sm"
              >
                {submitting ? '处理中...' : '同意并继续'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ConsentDialog;

