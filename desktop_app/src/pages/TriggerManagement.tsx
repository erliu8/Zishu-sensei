import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Home, Calendar, Webhook, Clock, Plus } from 'lucide-react';
import clsx from 'clsx';
import WorkflowTriggers from '../components/workflow/WorkflowTriggers';
import TriggerHistory from '../components/workflow/TriggerHistory';
import workflowService from '../services/workflowService';

interface WorkflowInfo {
  id: string;
  name: string;
  description?: string;
}

const TriggerManagement: React.FC = () => {
  const navigate = useNavigate();
  const { workflowId } = useParams<{ workflowId: string }>();
  const [workflow, setWorkflow] = useState<WorkflowInfo | null>(null);
  const [activeTab, setActiveTab] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (workflowId) {
      loadWorkflow();
    }
  }, [workflowId]);

  const loadWorkflow = async () => {
    if (!workflowId) return;
    
    setError(null);
    try {
      const wf = await workflowService.workflow.getWorkflow(workflowId);
      setWorkflow({
        id: wf.id,
        name: wf.name,
        description: wf.description,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载工作流失败');
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* 面包屑导航 */}
      <nav className="flex items-center space-x-2 mb-6 text-sm">
        <button
          onClick={() => navigate('/')}
          className="flex items-center text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
        >
          <Home className="w-4 h-4 mr-1" />
          首页
        </button>
        <span className="text-gray-400">/</span>
        <button
          onClick={() => navigate('/workflows')}
          className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
        >
          工作流
        </button>
        {workflow && (
          <>
            <span className="text-gray-400">/</span>
            <button
              onClick={() => navigate(`/workflows/${workflow.id}`)}
              className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
            >
              {workflow.name}
            </button>
          </>
        )}
        <span className="text-gray-400">/</span>
        <span className="text-gray-900 dark:text-gray-100">触发器管理</span>
      </nav>

      {/* 页面标题 */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          触发器管理
        </h1>
        {workflow && (
          <p className="text-gray-600 dark:text-gray-400">
            工作流: {workflow.name}
          </p>
        )}
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start justify-between">
          <p className="text-red-800 dark:text-red-300">{error}</p>
          <button
            onClick={() => setError(null)}
            className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200"
          >
            ✕
          </button>
        </div>
      )}

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center gap-4">
            <Calendar className="w-10 h-10 text-blue-500" />
            <div>
              <div className="text-3xl font-bold text-gray-900 dark:text-white">0</div>
              <div className="text-gray-600 dark:text-gray-400">事件触发器</div>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center gap-4">
            <Webhook className="w-10 h-10 text-purple-500" />
            <div>
              <div className="text-3xl font-bold text-gray-900 dark:text-white">0</div>
              <div className="text-gray-600 dark:text-gray-400">Webhook 触发器</div>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center gap-4">
            <Clock className="w-10 h-10 text-green-500" />
            <div>
              <div className="text-3xl font-bold text-gray-900 dark:text-white">0</div>
              <div className="text-gray-600 dark:text-gray-400">定时任务</div>
            </div>
          </div>
        </div>
      </div>

      {/* 主要内容区域 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
            {/* 标签页 */}
            <div className="border-b border-gray-200 dark:border-gray-700">
              <nav className="flex -mb-px">
                <button
                  onClick={() => setActiveTab(0)}
                  className={clsx(
                    'px-6 py-4 text-sm font-medium border-b-2 transition-colors',
                    activeTab === 0
                      ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300'
                  )}
                >
                  触发器配置
                </button>
                <button
                  onClick={() => setActiveTab(1)}
                  className={clsx(
                    'px-6 py-4 text-sm font-medium border-b-2 transition-colors',
                    activeTab === 1
                      ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300'
                  )}
                >
                  触发历史
                </button>
              </nav>
            </div>

            <div className="p-6">
              {activeTab === 0 && workflowId && (
                <WorkflowTriggers workflowId={workflowId} />
              )}

              {activeTab === 1 && workflowId && (
                <TriggerHistory workflowId={workflowId} />
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {/* 快速操作 */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              快速操作
            </h2>
            <div className="flex flex-col gap-3">
              <button
                className="flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                onClick={() => {
                  // 触发打开事件触发器对话框的逻辑
                }}
              >
                <Plus className="w-4 h-4" />
                添加事件触发器
              </button>
              <button
                className="flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                onClick={() => {
                  // 触发打开 Webhook 对话框的逻辑
                }}
              >
                <Plus className="w-4 h-4" />
                创建 Webhook
              </button>
              <button
                className="flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                onClick={() => navigate(`/workflows/${workflowId}/schedule`)}
              >
                <Plus className="w-4 h-4" />
                配置定时任务
              </button>
            </div>
          </div>

          {/* 触发器说明 */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              触发器说明
            </h2>
            <div className="space-y-3">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                <strong className="text-gray-900 dark:text-white">事件触发器:</strong>{' '}
                当系统中发生特定事件时自动触发工作流执行。
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                <strong className="text-gray-900 dark:text-white">Webhook:</strong>{' '}
                通过 HTTP 请求远程触发工作流执行。
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                <strong className="text-gray-900 dark:text-white">定时任务:</strong>{' '}
                按照 Cron 表达式定时执行工作流。
              </p>
            </div>
          </div>

          {/* 最佳实践 */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              最佳实践
            </h2>
            <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400 list-disc list-inside">
              <li>为触发器设置清晰的描述，便于后期维护</li>
              <li>使用条件表达式过滤不必要的触发</li>
              <li>为 Webhook 配置密钥和 IP 白名单增强安全性</li>
              <li>定期检查触发历史，及时发现和解决问题</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TriggerManagement;

