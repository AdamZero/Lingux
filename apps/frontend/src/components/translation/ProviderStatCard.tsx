import { Card, Progress, Typography, Tag } from 'antd';

interface ProviderStatCardProps {
  provider: {
    providerName: string;
    providerType: string;
    characterCount: number;
    jobCount: number;
    percentage: number;
  };
}

export const ProviderStatCard: React.FC<ProviderStatCardProps> = ({
  provider,
}) => {
  return (
    <Card>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
        }}
      >
        <Typography.Title level={5} style={{ margin: 0 }}>
          {provider.providerName}
        </Typography.Title>
        <Tag color="blue">{provider.providerType}</Tag>
      </div>

      <Progress
        percent={provider.percentage}
        format={() => `${provider.percentage}%`}
        strokeColor={{
          '0%': '#4F46E5',
          '100%': '#818CF8',
        }}
      />

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: 16,
          fontSize: 14,
        }}
      >
        <div>
          <Typography.Text type="secondary">字符数：</Typography.Text>
          <div style={{ fontWeight: 500 }}>
            {provider.characterCount.toLocaleString()}
          </div>
        </div>
        <div>
          <Typography.Text type="secondary">任务数：</Typography.Text>
          <div style={{ fontWeight: 500 }}>{provider.jobCount}</div>
        </div>
      </div>
    </Card>
  );
};
