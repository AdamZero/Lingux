import { Card, Row, Col, Divider, Typography, Skeleton, Empty } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { getMonthlyStats } from '@/api/machine-translation';
import { StatCard } from './StatCard';
import { ProviderStatCard } from './ProviderStatCard';
import {
  FieldStringOutlined,
  TaskOutlined,
  AppstoreOutlined,
} from '@ant-design/icons';

export const MonthlyStatsSection: React.FC = () => {
  const { data: stats, isLoading, refetch } = useQuery({
    queryKey: ['translation-monthly-stats'],
    queryFn: () => getMonthlyStats(),
    refetchInterval: 300000, // 5 分钟刷新一次
  });

  if (isLoading) {
    return <Skeleton active />;
  }

  if (!stats || stats.providers.length === 0) {
    return (
      <Card title="📊 本月翻译统计">
        <Empty description="本月暂无翻译数据" />
      </Card>
    );
  }

  return (
    <Card
      title="📊 本月翻译统计"
      extra={
        <Typography.Text type="secondary" onClick={() => refetch()} style={{ cursor: 'pointer' }}>
          刷新
        </Typography.Text>
      }
    >
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={8}>
          <StatCard
            title="总字符数"
            value={stats.totalCharacters.toLocaleString()}
            icon={<FieldStringOutlined />}
          />
        </Col>
        <Col xs={24} sm={8}>
          <StatCard
            title="总任务数"
            value={stats.totalJobs}
            icon={<TaskOutlined />}
          />
        </Col>
        <Col xs={24} sm={8}>
          <StatCard
            title="活跃供应商"
            value={stats.providers.length}
            icon={<AppstoreOutlined />}
          />
        </Col>
      </Row>

      <Divider />

      <Typography.Title level={5} style={{ marginBottom: 16 }}>
        按供应商统计
      </Typography.Title>
      <Row gutter={[16, 16]}>
        {stats.providers.map((provider) => (
          <Col xs={24} sm={12} lg={8} key={provider.providerId}>
            <ProviderStatCard provider={provider} />
          </Col>
        ))}
      </Row>
    </Card>
  );
};
