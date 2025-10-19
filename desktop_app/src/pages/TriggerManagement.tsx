import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  Grid,
  Card,
  CardContent,
  Button,
  Breadcrumbs,
  Link,
  Tab,
  Tabs,
  Alert,
} from '@mui/material';
import {
  Home as HomeIcon,
  Event as EventIcon,
  Webhook as WebhookIcon,
  Schedule as ScheduleIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import { useNavigate, useParams } from 'react-router-dom';
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (workflowId) {
      loadWorkflow();
    }
  }, [workflowId]);

  const loadWorkflow = async () => {
    if (!workflowId) return;
    
    setLoading(true);
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
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Breadcrumbs sx={{ mb: 2 }}>
        <Link
          underline="hover"
          sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}
          color="inherit"
          onClick={() => navigate('/')}
        >
          <HomeIcon sx={{ mr: 0.5 }} fontSize="small" />
          首页
        </Link>
        <Link
          underline="hover"
          sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}
          color="inherit"
          onClick={() => navigate('/workflows')}
        >
          工作流
        </Link>
        {workflow && (
          <Link
            underline="hover"
            sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}
            color="inherit"
            onClick={() => navigate(`/workflows/${workflow.id}`)}
          >
            {workflow.name}
          </Link>
        )}
        <Typography color="text.primary">触发器管理</Typography>
      </Breadcrumbs>

      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" gutterBottom>
          触发器管理
        </Typography>
        {workflow && (
          <Typography variant="body1" color="text.secondary">
            工作流: {workflow.name}
          </Typography>
        )}
      </Box>

      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* 统计卡片 */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <EventIcon color="primary" sx={{ fontSize: 40 }} />
                <Box>
                  <Typography variant="h4">0</Typography>
                  <Typography color="text.secondary">事件触发器</Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <WebhookIcon color="secondary" sx={{ fontSize: 40 }} />
                <Box>
                  <Typography variant="h4">0</Typography>
                  <Typography color="text.secondary">Webhook 触发器</Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <ScheduleIcon color="success" sx={{ fontSize: 40 }} />
                <Box>
                  <Typography variant="h4">0</Typography>
                  <Typography color="text.secondary">定时任务</Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* 主要内容区域 */}
      <Grid container spacing={3}>
        <Grid item xs={12} lg={8}>
          <Card>
            <CardContent>
              <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
                <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)}>
                  <Tab label="触发器配置" />
                  <Tab label="触发历史" />
                </Tabs>
              </Box>

              {activeTab === 0 && workflowId && (
                <WorkflowTriggers workflowId={workflowId} />
              )}

              {activeTab === 1 && workflowId && (
                <TriggerHistory workflowId={workflowId} />
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} lg={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                快速操作
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Button
                  variant="outlined"
                  startIcon={<AddIcon />}
                  fullWidth
                  onClick={() => {
                    // 触发打开事件触发器对话框的逻辑
                  }}
                >
                  添加事件触发器
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<AddIcon />}
                  fullWidth
                  onClick={() => {
                    // 触发打开 Webhook 对话框的逻辑
                  }}
                >
                  创建 Webhook
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<AddIcon />}
                  fullWidth
                  onClick={() => navigate(`/workflows/${workflowId}/schedule`)}
                >
                  配置定时任务
                </Button>
              </Box>
            </CardContent>
          </Card>

          <Card sx={{ mt: 2 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                触发器说明
              </Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                <strong>事件触发器:</strong> 当系统中发生特定事件时自动触发工作流执行。
              </Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                <strong>Webhook:</strong> 通过 HTTP 请求远程触发工作流执行。
              </Typography>
              <Typography variant="body2" color="text.secondary">
                <strong>定时任务:</strong> 按照 Cron 表达式定时执行工作流。
              </Typography>
            </CardContent>
          </Card>

          <Card sx={{ mt: 2 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                最佳实践
              </Typography>
              <Box component="ul" sx={{ pl: 2, m: 0 }}>
                <Typography component="li" variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  为触发器设置清晰的描述，便于后期维护
                </Typography>
                <Typography component="li" variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  使用条件表达式过滤不必要的触发
                </Typography>
                <Typography component="li" variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  为 Webhook 配置密钥和 IP 白名单增强安全性
                </Typography>
                <Typography component="li" variant="body2" color="text.secondary">
                  定期检查触发历史，及时发现和解决问题
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Container>
  );
};

export default TriggerManagement;

