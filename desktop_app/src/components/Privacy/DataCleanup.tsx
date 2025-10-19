/**
 * 数据清理组件
 * 允许用户清理或删除个人数据
 */

import React, { useState } from 'react';
import {
  Card,
  Button,
  Checkbox,
  DatePicker,
  Space,
  Typography,
  message,
  Modal,
  Alert,
  Progress,
} from 'antd';
import { DeleteOutlined, WarningOutlined } from '@ant-design/icons';
import PrivacyService from '../../services/privacyService';
import type { CleanupOptions, CleanupResult } from '../../types/privacy';
import dayjs, { Dayjs } from 'dayjs';

const { Title, Text, Paragraph } = Typography;
const { RangePicker } = DatePicker;

export const DataCleanup: React.FC = () => {
  const [dataTypes, setDataTypes] = useState<string[]>([
    'learning_history',
    'practice_records',
  ]);
  const [dateRange, setDateRange] = useState<[Dayjs | null, Dayjs | null]>([
    null,
    null,
  ]);
  const [cleaning, setCleaning] = useState(false);

  const availableDataTypes = [
    {
      value: 'learning_history',
      label: '学习历史',
      description: '包括课程学习记录',
    },
    {
      value: 'practice_records',
      label: '练习记录',
      description: '包括练习题完成情况',
    },
    {
      value: 'test_results',
      label: '测试结果',
      description: '包括各类测试成绩',
    },
    {
      value: 'progress_data',
      label: '进度数据',
      description: '包括学习进度统计',
    },
    {
      value: 'cache_data',
      label: '缓存数据',
      description: '包括临时文件和缓存',
    },
  ];

  const handleCleanup = async () => {
    if (dataTypes.length === 0) {
      message.warning('请至少选择一种要清理的数据类型');
      return;
    }

    // 显示确认对话框
    Modal.confirm({
      title: '确认清理数据',
      icon: <WarningOutlined />,
      content: (
        <div>
          <Paragraph>即将清理以下数据：</Paragraph>
          <ul>
            {dataTypes.map((type) => {
              const dataType = availableDataTypes.find((t) => t.value === type);
              return <li key={type}>{dataType?.label}</li>;
            })}
          </ul>
          {dateRange[0] && dateRange[1] && (
            <Paragraph>
              日期范围: {dateRange[0].format('YYYY-MM-DD')} 至{' '}
              {dateRange[1].format('YYYY-MM-DD')}
            </Paragraph>
          )}
          <Alert
            message="此操作不可撤销"
            description="清理的数据将永久删除，无法恢复"
            type="warning"
            showIcon
          />
        </div>
      ),
      okText: '确认清理',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        await performCleanup();
      },
    });
  };

  const performCleanup = async () => {
    setCleaning(true);
    try {
      const options: CleanupOptions = {
        dataTypes,
        cleanAll: false,
        dateFrom: dateRange[0]?.toISOString(),
        dateTo: dateRange[1]?.toISOString(),
      };

      const result: CleanupResult =
        await PrivacyService.cleanupUserData(options);

      if (result.success) {
        Modal.success({
          title: '数据清理成功',
          content: (
            <div>
              <Paragraph>已清理 {result.recordsDeleted} 条记录</Paragraph>
              {result.spaceFreed && (
                <Paragraph>
                  释放空间:{' '}
                  {(result.spaceFreed / 1024 / 1024).toFixed(2)} MB
                </Paragraph>
              )}
            </div>
          ),
        });
      } else {
        message.error('数据清理失败: ' + result.error);
      }
    } catch (error) {
      message.error('数据清理失败: ' + error);
    } finally {
      setCleaning(false);
    }
  };

  const handleDeleteAll = async () => {
    Modal.confirm({
      title: '删除所有用户数据',
      icon: <WarningOutlined />,
      content: (
        <div>
          <Alert
            message="警告：此操作不可撤销"
            description="这将删除您在应用中的所有数据，包括学习历史、设置、进度等所有信息。删除后，应用将恢复到初始状态。"
            type="error"
            showIcon
            style={{ marginBottom: 16 }}
          />
          <Paragraph strong>
            请确保您已经导出了需要保留的数据。
          </Paragraph>
        </div>
      ),
      okText: '确认删除所有数据',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        setCleaning(true);
        try {
          const result: CleanupResult =
            await PrivacyService.deleteAllUserData();

          if (result.success) {
            Modal.success({
              title: '所有数据已删除',
              content: '应用将重新启动以应用更改',
              onOk: () => {
                // 重启应用
                window.location.reload();
              },
            });
          } else {
            message.error('删除失败: ' + result.error);
          }
        } catch (error) {
          message.error('删除失败: ' + error);
        } finally {
          setCleaning(false);
        }
      },
    });
  };

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '24px' }}>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {/* 标题 */}
        <div>
          <Title level={2}>
            <DeleteOutlined /> 数据清理
          </Title>
          <Paragraph type="secondary">
            清理不需要的数据，释放存储空间
          </Paragraph>
        </div>

        {/* 警告提示 */}
        <Alert
          message="注意"
          description="清理的数据将永久删除且无法恢复。建议在清理前先导出重要数据。"
          type="warning"
          showIcon
          icon={<WarningOutlined />}
        />

        {/* 数据类型选择 */}
        <Card title="选择要清理的数据类型" bordered={false}>
          <Space direction="vertical" style={{ width: '100%' }}>
            {availableDataTypes.map((type) => (
              <Checkbox
                key={type.value}
                checked={dataTypes.includes(type.value)}
                onChange={(e) => {
                  if (e.target.checked) {
                    setDataTypes([...dataTypes, type.value]);
                  } else {
                    setDataTypes(dataTypes.filter((t) => t !== type.value));
                  }
                }}
              >
                <div>
                  <Text strong>{type.label}</Text>
                  <br />
                  <Text type="secondary" style={{ fontSize: '12px' }}>
                    {type.description}
                  </Text>
                </div>
              </Checkbox>
            ))}
          </Space>
        </Card>

        {/* 日期范围 */}
        <Card title="日期范围（可选）" bordered={false}>
          <div>
            <Text type="secondary" style={{ fontSize: '12px' }}>
              仅清理指定日期范围内的数据，留空则清理所有
            </Text>
            <br />
            <RangePicker
              style={{ width: '100%', marginTop: '8px' }}
              value={dateRange}
              onChange={(dates) =>
                setDateRange(dates as [Dayjs | null, Dayjs | null])
              }
              format="YYYY-MM-DD"
            />
          </div>
        </Card>

        {/* 清理按钮 */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: 16,
          }}
        >
          <Button
            type="primary"
            danger
            size="large"
            icon={<DeleteOutlined />}
            loading={cleaning}
            onClick={handleCleanup}
          >
            清理选定数据
          </Button>
        </div>

        {/* 危险区域 */}
        <Card
          title={
            <span>
              <WarningOutlined style={{ color: '#ff4d4f' }} /> 危险区域
            </span>
          }
          bordered={false}
          style={{ borderColor: '#ff4d4f' }}
        >
          <Space direction="vertical" style={{ width: '100%' }}>
            <div>
              <Title level={5}>删除所有用户数据</Title>
              <Paragraph type="secondary">
                这将永久删除您在应用中的所有数据，包括学习历史、设置、进度等。此操作不可撤销。
              </Paragraph>
            </div>
            <Button
              danger
              icon={<DeleteOutlined />}
              loading={cleaning}
              onClick={handleDeleteAll}
            >
              删除所有数据
            </Button>
          </Space>
        </Card>

        {/* 说明 */}
        <Card bordered={false} style={{ backgroundColor: '#f0f2f5' }}>
          <Title level={5}>关于数据清理</Title>
          <Paragraph style={{ marginBottom: 0, fontSize: '12px' }}>
            • 清理数据可以释放存储空间
            <br />
            • 清理操作在本地执行，不涉及网络传输
            <br />
            • 部分数据清理后可能影响应用功能
            <br />• 建议定期清理不需要的缓存数据
          </Paragraph>
        </Card>
      </Space>
    </div>
  );
};

export default DataCleanup;

