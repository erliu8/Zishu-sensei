import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Chip,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Event as EventIcon,
  Webhook as WebhookIcon,
  Schedule as ScheduleIcon,
  Delete as DeleteIcon,
  PlayArrow as PlayIcon,
} from '@mui/icons-material';
import { EventTrigger, EventType } from '../../services/workflowService';

interface TriggerCardProps {
  trigger: EventTrigger | WebhookTrigger | ScheduleTrigger;
  type: 'event' | 'webhook' | 'schedule';
  onDelete?: () => void;
  onTrigger?: () => void;
}

interface WebhookTrigger {
  id: string;
  workflowId: string;
  url: string;
  requireAuth: boolean;
}

interface ScheduleTrigger {
  id: string;
  workflowId: string;
  cron: string;
  enabled: boolean;
}

const TriggerCard: React.FC<TriggerCardProps> = ({ trigger, type, onDelete, onTrigger }) => {
  const getIcon = () => {
    switch (type) {
      case 'event':
        return <EventIcon />;
      case 'webhook':
        return <WebhookIcon />;
      case 'schedule':
        return <ScheduleIcon />;
    }
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

  const renderContent = () => {
    if (type === 'event') {
      const eventTrigger = trigger as EventTrigger;
      return (
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <Chip
              label={eventTrigger.event_type}
              color={getEventTypeColor(eventTrigger.event_type)}
              size="small"
            />
            {!eventTrigger.enabled && (
              <Chip label="已禁用" size="small" color="default" />
            )}
          </Box>
          {eventTrigger.description && (
            <Typography variant="body2" color="text.secondary">
              {eventTrigger.description}
            </Typography>
          )}
          {eventTrigger.condition && (
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
              条件: {eventTrigger.condition}
            </Typography>
          )}
        </Box>
      );
    }

    if (type === 'webhook') {
      const webhookTrigger = trigger as WebhookTrigger;
      return (
        <Box>
          <Typography variant="caption" color="text.secondary" gutterBottom>
            Webhook ID: {webhookTrigger.id}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
            {webhookTrigger.requireAuth && (
              <Chip label="需要认证" size="small" color="primary" />
            )}
          </Box>
        </Box>
      );
    }

    if (type === 'schedule') {
      const scheduleTrigger = trigger as ScheduleTrigger;
      return (
        <Box>
          <Typography variant="body2" gutterBottom>
            Cron: <code>{scheduleTrigger.cron}</code>
          </Typography>
          <Chip
            label={scheduleTrigger.enabled ? '已启用' : '已禁用'}
            size="small"
            color={scheduleTrigger.enabled ? 'success' : 'default'}
          />
        </Box>
      );
    }
  };

  return (
    <Card sx={{ mb: 1 }}>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
          <Box sx={{ display: 'flex', alignItems: 'start', gap: 1, flex: 1 }}>
            <Box sx={{ color: 'primary.main', mt: 0.5 }}>{getIcon()}</Box>
            <Box sx={{ flex: 1 }}>{renderContent()}</Box>
          </Box>
          <Box>
            {onTrigger && (
              <Tooltip title="手动触发">
                <IconButton size="small" onClick={onTrigger}>
                  <PlayIcon />
                </IconButton>
              </Tooltip>
            )}
            {onDelete && (
              <IconButton size="small" onClick={onDelete}>
                <DeleteIcon />
              </IconButton>
            )}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
};

export default TriggerCard;

