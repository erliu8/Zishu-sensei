import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Switch,
  FormControlLabel,
  IconButton,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Tabs,
  Tab,
  Alert,
  Tooltip,
  CircularProgress,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Event as EventIcon,
  Webhook as WebhookIcon,
  Schedule as ScheduleIcon,
  PlayArrow as PlayIcon,
  ContentCopy as CopyIcon,
} from '@mui/icons-material';
import workflowService, {
  EventTrigger,
  EventType,
  WebhookConfig,
} from '../../services/workflowService';

interface WorkflowTriggersProps {
  workflowId: string;
}

interface WebhookTrigger {
  id: string;
  workflowId: string;
  config: WebhookConfig;
}

const WorkflowTriggers: React.FC<WorkflowTriggersProps> = ({ workflowId }) => {
  const [activeTab, setActiveTab] = useState(0);
  const [eventTriggers, setEventTriggers] = useState<EventTrigger[]>([]);
  const [webhookTriggers, setWebhookTriggers] = useState<WebhookTrigger[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Event Trigger Dialog
  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [newEventTrigger, setNewEventTrigger] = useState<{
    event_type: EventType;
    condition: string;
    enabled: boolean;
    description: string;
  }>({
    event_type: 'FileCreated',
    condition: '',
    enabled: true,
    description: '',
  });

  // Webhook Dialog
  const [webhookDialogOpen, setWebhookDialogOpen] = useState(false);
  const [newWebhookConfig, setNewWebhookConfig] = useState<WebhookConfig>({
    require_auth: true,
    timeout_seconds: 30,
  });

  // Manual Trigger Dialog
  const [manualTriggerDialog, setManualTriggerDialog] = useState(false);
  const [manualEventType, setManualEventType] = useState<EventType>('Custom');
  const [manualEventData, setManualEventData] = useState('{}');

  useEffect(() => {
    loadTriggers();
  }, [workflowId]);

  const loadTriggers = async () => {
    setLoading(true);
    setError(null);
    try {
      const events = await workflowService.eventTrigger.listTriggers(workflowId);
      setEventTriggers(events);

      const webhooks = await workflowService.webhookTrigger.listWebhooks(workflowId);
      setWebhookTriggers(
        webhooks.map(([id, wfId, config]) => ({
          id,
          workflowId: wfId,
          config,
        }))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载触发器失败');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateEventTrigger = async () => {
    try {
      await workflowService.eventTrigger.createTrigger({
        workflow_id: workflowId,
        ...newEventTrigger,
        condition: newEventTrigger.condition || undefined,
        description: newEventTrigger.description || undefined,
      });
      setSuccess('事件触发器创建成功');
      setEventDialogOpen(false);
      setNewEventTrigger({
        event_type: 'FileCreated',
        condition: '',
        enabled: true,
        description: '',
      });
      loadTriggers();
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建事件触发器失败');
    }
  };

  const handleCreateWebhook = async () => {
    try {
      const webhookId = await workflowService.webhookTrigger.createWebhook(
        workflowId,
        newWebhookConfig
      );
      setSuccess(`Webhook 创建成功! ID: ${webhookId}`);
      setWebhookDialogOpen(false);
      setNewWebhookConfig({
        require_auth: true,
        timeout_seconds: 30,
      });
      loadTriggers();
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建 Webhook 失败');
    }
  };

  const handleDeleteEventTrigger = async (triggerId: string) => {
    if (!confirm('确定要删除这个事件触发器吗？')) return;
    try {
      await workflowService.eventTrigger.removeTrigger(triggerId);
      setSuccess('事件触发器删除成功');
      loadTriggers();
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除事件触发器失败');
    }
  };

  const handleDeleteWebhook = async (webhookId: string) => {
    if (!confirm('确定要删除这个 Webhook 吗？')) return;
    try {
      await workflowService.webhookTrigger.removeWebhook(webhookId);
      setSuccess('Webhook 删除成功');
      loadTriggers();
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除 Webhook 失败');
    }
  };

  const handleManualTrigger = async () => {
    try {
      const eventData = JSON.parse(manualEventData);
      const executionIds = await workflowService.eventTrigger.triggerEvent(
        manualEventType,
        eventData
      );
      setSuccess(`成功触发 ${executionIds.length} 个工作流执行`);
      setManualTriggerDialog(false);
      setManualEventData('{}');
    } catch (err) {
      setError(err instanceof Error ? err.message : '手动触发失败');
    }
  };

  const copyWebhookUrl = (webhookId: string) => {
    const url = `http://localhost:3000/api/webhook/${webhookId}`;
    navigator.clipboard.writeText(url);
    setSuccess('Webhook URL 已复制到剪贴板');
  };

  const getEventTypeColor = (eventType: EventType): 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' => {
    const colorMap: Record<EventType, 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning'> = {
      FileCreated: 'success',
      FileModified: 'info',
      FileDeleted: 'error',
      SystemStartup: 'primary',
      SystemShutdown: 'error',
      TimeSchedule: 'secondary',
      UserLogin: 'primary',
      UserLogout: 'secondary',
      Custom: 'default',
    };
    return colorMap[eventType] || 'default';
  };

  const eventTypes: EventType[] = [
    'FileCreated',
    'FileModified',
    'FileDeleted',
    'SystemStartup',
    'SystemShutdown',
    'TimeSchedule',
    'UserLogin',
    'UserLogout',
    'Custom',
  ];

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" onClose={() => setSuccess(null)} sx={{ mb: 2 }}>
          {success}
        </Alert>
      )}

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
        <Tabs value={activeTab} onChange={(_: React.SyntheticEvent, v: number) => setActiveTab(v)}>
          <Tab icon={<EventIcon />} label="事件触发器" />
          <Tab icon={<WebhookIcon />} label="Webhook" />
          <Tab icon={<ScheduleIcon />} label="定时任务" />
        </Tabs>
      </Box>

      {activeTab === 0 && (
        <Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
            <Typography variant="h6">事件触发器</Typography>
            <Box>
              <Button
                variant="outlined"
                startIcon={<PlayIcon />}
                onClick={() => setManualTriggerDialog(true)}
                sx={{ mr: 1 }}
              >
                手动触发
              </Button>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => setEventDialogOpen(true)}
              >
                添加触发器
              </Button>
            </Box>
          </Box>

          <List>
            {eventTriggers.length === 0 ? (
              <Card>
                <CardContent>
                  <Typography color="text.secondary" align="center">
                    暂无事件触发器
                  </Typography>
                </CardContent>
              </Card>
            ) : (
              eventTriggers.map((trigger) => (
                <Card key={trigger.id} sx={{ mb: 1 }}>
                  <ListItem>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Chip
                            label={trigger.event_type}
                            color={getEventTypeColor(trigger.event_type)}
                            size="small"
                          />
                          {!trigger.enabled && (
                            <Chip label="已禁用" size="small" color="default" />
                          )}
                        </Box>
                      }
                      secondary={
                        <Box sx={{ mt: 1 }}>
                          {trigger.description && (
                            <Typography variant="body2" color="text.secondary">
                              {trigger.description}
                            </Typography>
                          )}
                          {trigger.condition && (
                            <Typography variant="caption" color="text.secondary">
                              条件: {trigger.condition}
                            </Typography>
                          )}
                        </Box>
                      }
                    />
                    <ListItemSecondaryAction>
                      <IconButton
                        edge="end"
                        onClick={() => handleDeleteEventTrigger(trigger.id)}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </ListItemSecondaryAction>
                  </ListItem>
                </Card>
              ))
            )}
          </List>
        </Box>
      )}

      {activeTab === 1 && (
        <Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
            <Typography variant="h6">Webhook 触发器</Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setWebhookDialogOpen(true)}
            >
              创建 Webhook
            </Button>
          </Box>

          <List>
            {webhookTriggers.length === 0 ? (
              <Card>
                <CardContent>
                  <Typography color="text.secondary" align="center">
                    暂无 Webhook 触发器
                  </Typography>
                </CardContent>
              </Card>
            ) : (
              webhookTriggers.map((webhook) => (
                <Card key={webhook.id} sx={{ mb: 1 }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                          Webhook ID: {webhook.id}
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 1, mt: 1, flexWrap: 'wrap' }}>
                          {webhook.config.require_auth && (
                            <Chip label="需要认证" size="small" color="primary" />
                          )}
                          <Chip
                            label={`超时: ${webhook.config.timeout_seconds}s`}
                            size="small"
                          />
                          {webhook.config.secret && (
                            <Chip label="已配置密钥" size="small" color="success" />
                          )}
                          {webhook.config.allowed_ips && webhook.config.allowed_ips.length > 0 && (
                            <Chip
                              label={`IP 白名单: ${webhook.config.allowed_ips.length} 个`}
                              size="small"
                              color="info"
                            />
                          )}
                        </Box>
                      </Box>
                      <Box>
                        <Tooltip title="复制 Webhook URL">
                          <IconButton onClick={() => copyWebhookUrl(webhook.id)}>
                            <CopyIcon />
                          </IconButton>
                        </Tooltip>
                        <IconButton onClick={() => handleDeleteWebhook(webhook.id)}>
                          <DeleteIcon />
                        </IconButton>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              ))
            )}
          </List>
        </Box>
      )}

      {activeTab === 2 && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              定时任务
            </Typography>
            <Typography color="text.secondary">
              定时任务功能请使用工作流调度器进行配置
            </Typography>
          </CardContent>
        </Card>
      )}

      {/* Event Trigger Dialog */}
      <Dialog
        open={eventDialogOpen}
        onClose={() => setEventDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>添加事件触发器</DialogTitle>
        <DialogContent>
          <FormControl fullWidth sx={{ mt: 2 }}>
            <InputLabel>事件类型</InputLabel>
            <Select
              value={newEventTrigger.event_type}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setNewEventTrigger({
                  ...newEventTrigger,
                  event_type: e.target.value as EventType,
                })
              }
              label="事件类型"
            >
              {eventTypes.map((type) => (
                <MenuItem key={type} value={type}>
                  {type}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            fullWidth
            label="描述"
            value={newEventTrigger.description}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setNewEventTrigger({ ...newEventTrigger, description: e.target.value })
            }
            sx={{ mt: 2 }}
            multiline
            rows={2}
          />

          <TextField
            fullWidth
            label="条件表达式 (可选)"
            value={newEventTrigger.condition}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setNewEventTrigger({ ...newEventTrigger, condition: e.target.value })
            }
            sx={{ mt: 2 }}
            placeholder="例如: event.path.endsWith('.txt')"
            helperText="使用 JavaScript 表达式来过滤事件"
          />

          <FormControlLabel
            control={
              <Switch
                checked={newEventTrigger.enabled}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setNewEventTrigger({ ...newEventTrigger, enabled: e.target.checked })
                }
              />
            }
            label="启用"
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEventDialogOpen(false)}>取消</Button>
          <Button onClick={handleCreateEventTrigger} variant="contained">
            创建
          </Button>
        </DialogActions>
      </Dialog>

      {/* Webhook Dialog */}
      <Dialog
        open={webhookDialogOpen}
        onClose={() => setWebhookDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>创建 Webhook 触发器</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="密钥 (可选)"
            value={newWebhookConfig.secret || ''}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setNewWebhookConfig({ ...newWebhookConfig, secret: e.target.value || undefined })
            }
            sx={{ mt: 2 }}
            type="password"
            helperText="用于验证 Webhook 请求的密钥"
          />

          <TextField
            fullWidth
            label="IP 白名单 (可选)"
            value={newWebhookConfig.allowed_ips?.join(', ') || ''}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setNewWebhookConfig({
                ...newWebhookConfig,
                allowed_ips: e.target.value
                  ? e.target.value.split(',').map((ip: string) => ip.trim())
                  : undefined,
              })
            }
            sx={{ mt: 2 }}
            placeholder="192.168.1.1, 192.168.1.2"
            helperText="逗号分隔多个 IP 地址"
          />

          <TextField
            fullWidth
            label="超时时间 (秒)"
            type="number"
            value={newWebhookConfig.timeout_seconds}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setNewWebhookConfig({
                ...newWebhookConfig,
                timeout_seconds: parseInt(e.target.value) || 30,
              })
            }
            sx={{ mt: 2 }}
          />

          <FormControlLabel
            control={
              <Switch
                checked={newWebhookConfig.require_auth}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setNewWebhookConfig({ ...newWebhookConfig, require_auth: e.target.checked })
                }
              />
            }
            label="需要认证"
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setWebhookDialogOpen(false)}>取消</Button>
          <Button onClick={handleCreateWebhook} variant="contained">
            创建
          </Button>
        </DialogActions>
      </Dialog>

      {/* Manual Trigger Dialog */}
      <Dialog
        open={manualTriggerDialog}
        onClose={() => setManualTriggerDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>手动触发事件</DialogTitle>
        <DialogContent>
          <FormControl fullWidth sx={{ mt: 2 }}>
            <InputLabel>事件类型</InputLabel>
            <Select
              value={manualEventType}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setManualEventType(e.target.value as EventType)}
              label="事件类型"
            >
              {eventTypes.map((type) => (
                <MenuItem key={type} value={type}>
                  {type}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            fullWidth
            label="事件数据 (JSON)"
            value={manualEventData}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setManualEventData(e.target.value)}
            sx={{ mt: 2 }}
            multiline
            rows={6}
            placeholder='{"key": "value"}'
            helperText="输入 JSON 格式的事件数据"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setManualTriggerDialog(false)}>取消</Button>
          <Button onClick={handleManualTrigger} variant="contained">
            触发
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default WorkflowTriggers;

