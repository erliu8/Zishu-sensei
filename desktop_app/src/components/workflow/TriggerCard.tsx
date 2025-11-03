import React from 'react';
import { 
  Calendar as EventIcon,
  Webhook as WebhookIcon,
  Clock as ScheduleIcon,
  Trash2 as DeleteIcon,
  Play as PlayIcon,
} from 'lucide-react';
import { EventTrigger, EventType } from '../../services/workflowService';

// 简单的Card组件替代
const Card: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div className={`bg-white rounded-lg shadow-md border border-gray-200 ${className}`}>
    {children}
  </div>
);

const CardContent: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div className={`p-4 ${className}`}>
    {children}
  </div>
);

const Typography: React.FC<{ 
  children: React.ReactNode; 
  variant?: 'h6' | 'body1' | 'body2' | 'caption';
  className?: string;
  color?: string;
  gutterBottom?: boolean;
  sx?: any;
}> = ({ children, variant = 'body1', className = '', color, gutterBottom, sx }) => {
  const variantClasses = {
    h6: 'text-lg font-semibold text-gray-900',
    body1: 'text-base text-gray-700',
    body2: 'text-sm text-gray-600',
    caption: 'text-xs text-gray-500',
  };
  
  const colorClass = color === 'text.secondary' ? 'text-gray-500' : '';
  const gutterClass = gutterBottom ? 'mb-2' : '';
  
  const sxStyles = sx ? {
    marginTop: sx.mt ? `${sx.mt * 4}px` : undefined,
    display: sx.display,
    color: sx.color
  } : {};
  
  return (
    <div 
      className={`${variantClasses[variant]} ${colorClass} ${gutterClass} ${className}`}
      style={sxStyles}
    >
      {children}
    </div>
  );
};

const Box: React.FC<{ 
  children: React.ReactNode; 
  className?: string; 
  sx?: any; 
}> = ({ children, className = '', sx }) => {
  // Convert sx styles to className or inline styles
  const sxStyles = sx ? {
    display: sx.display,
    alignItems: sx.alignItems,
    justifyContent: sx.justifyContent,
    gap: sx.gap ? `${sx.gap * 4}px` : undefined,
    marginBottom: sx.mb ? `${sx.mb * 4}px` : undefined,
    marginTop: sx.mt ? `${sx.mt * 4}px` : undefined,
    flex: sx.flex,
    color: sx.color
  } : {};
  
  return (
    <div className={className} style={sxStyles}>
      {children}
    </div>
  );
};

const Chip: React.FC<{ 
  label: string; 
  size?: 'small' | 'medium';
  color?: 'primary' | 'secondary' | 'default' | 'success' | 'warning' | 'error' | 'info';
  className?: string;
}> = ({ label, size = 'medium', color = 'default', className = '' }) => {
  const sizeClasses = {
    small: 'px-2 py-1 text-xs',
    medium: 'px-3 py-1 text-sm',
  };
  
  const colorClasses = {
    primary: 'bg-blue-100 text-blue-800',
    secondary: 'bg-gray-100 text-gray-800',
    default: 'bg-gray-100 text-gray-700',
    success: 'bg-green-100 text-green-800',
    warning: 'bg-yellow-100 text-yellow-800',
    error: 'bg-red-100 text-red-800',
    info: 'bg-blue-100 text-blue-800',
  };
  
  return (
    <span className={`inline-flex items-center rounded-full font-medium ${sizeClasses[size]} ${colorClasses[color]} ${className}`}>
      {label}
    </span>
  );
};

const IconButton: React.FC<{ 
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  size?: 'small' | 'medium' | 'large';
}> = ({ children, onClick, className = '', size = 'medium' }) => {
  const sizeClasses = {
    small: 'p-1',
    medium: 'p-2',
    large: 'p-3',
  };
  
  return (
    <button 
      onClick={onClick}
      className={`inline-flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors ${sizeClasses[size]} ${className}`}
    >
      {children}
    </button>
  );
};

const Tooltip: React.FC<{ 
  title: string;
  children: React.ReactNode;
}> = ({ title, children }) => (
  <div className="relative group">
    {children}
    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 text-xs text-white bg-black rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
      {title}
    </div>
  </div>
);

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
    <Card className="mb-1">
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

