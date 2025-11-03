import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Tooltip,
  Paper,
  TextField,
  InputAdornment,
  TablePagination,
} from '@mui/material';
import {
  Search as SearchIcon,
  Visibility as VisibilityIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';

interface TriggerHistoryItem {
  id: string;
  triggerId: string;
  triggerType: 'event' | 'webhook' | 'schedule';
  workflowId: string;
  workflowName: string;
  executionId: string;
  timestamp: string;
  status: 'success' | 'failed' | 'running';
  eventData?: any;
  error?: string;
}

interface TriggerHistoryProps {
  workflowId?: string;
  triggerId?: string;
}

const TriggerHistory: React.FC<TriggerHistoryProps> = ({ workflowId, triggerId }) => {
  const [history, setHistory] = useState<TriggerHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  useEffect(() => {
    loadHistory();
  }, [workflowId, triggerId]);

  const loadHistory = async () => {
    setLoading(true);
    try {
      // 这里应该调用实际的 API 来获取触发器历史
      // 目前使用模拟数据
      const mockHistory: TriggerHistoryItem[] = [
        {
          id: '1',
          triggerId: 'trigger-1',
          triggerType: 'event',
          workflowId: 'wf-1',
          workflowName: '文件处理工作流',
          executionId: 'exec-1',
          timestamp: new Date().toISOString(),
          status: 'success',
          eventData: { file: '/path/to/file.txt', type: 'FileCreated' },
        },
        {
          id: '2',
          triggerId: 'trigger-2',
          triggerType: 'webhook',
          workflowId: 'wf-1',
          workflowName: '文件处理工作流',
          executionId: 'exec-2',
          timestamp: new Date(Date.now() - 3600000).toISOString(),
          status: 'failed',
          error: 'Workflow execution failed',
        },
      ];
      setHistory(mockHistory);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (
    status: string
  ): 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' => {
    switch (status) {
      case 'success':
        return 'success';
      case 'failed':
        return 'error';
      case 'running':
        return 'info';
      default:
        return 'default';
    }
  };

  const getTriggerTypeLabel = (type: string): string => {
    const labels: Record<string, string> = {
      event: '事件触发',
      webhook: 'Webhook',
      schedule: '定时任务',
    };
    return labels[type] || type;
  };

  const formatTimestamp = (timestamp: string): string => {
    try {
      return format(new Date(timestamp), 'yyyy-MM-dd HH:mm:ss', { locale: zhCN });
    } catch {
      return timestamp;
    }
  };

  const filteredHistory = history.filter(
    (item) =>
      item.workflowName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.executionId.includes(searchTerm)
  );

  const paginatedHistory = filteredHistory.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">触发器历史</Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <TextField
              size="small"
              placeholder="搜索..."
              value={searchTerm}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              }}
            />
            <Tooltip title="刷新">
              <IconButton onClick={loadHistory} disabled={loading}>
                <RefreshIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>时间</TableCell>
                <TableCell>触发类型</TableCell>
                <TableCell>工作流</TableCell>
                <TableCell>执行ID</TableCell>
                <TableCell>状态</TableCell>
                <TableCell align="right">操作</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {paginatedHistory.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center">
                    <Typography color="text.secondary">暂无触发历史</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                paginatedHistory.map((item) => (
                  <TableRow key={item.id} hover>
                    <TableCell>
                      <Typography variant="body2">
                        {formatTimestamp(item.timestamp)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={getTriggerTypeLabel(item.triggerType)}
                        size="small"
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{item.workflowName}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>
                        {item.executionId}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={item.status}
                        color={getStatusColor(item.status)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="查看详情">
                        <IconButton size="small">
                          <VisibilityIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>

        <TablePagination
          component="div"
          count={filteredHistory.length}
          page={page}
          onPageChange={(_: unknown, newPage: number) => setPage(newPage)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e: React.ChangeEvent<HTMLInputElement>) => {
            setRowsPerPage(parseInt(e.target.value, 10));
            setPage(0);
          }}
          labelRowsPerPage="每页行数:"
          labelDisplayedRows={({ from, to, count }: { from: number; to: number; count: number }) => `${from}-${to} 共 ${count}`}
        />
      </CardContent>
    </Card>
  );
};

export default TriggerHistory;

