import { useState } from 'react';
import { Card, Table, Tag, Space, Typography, Avatar, Button, Drawer } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { getTranslationJobs, getTranslationJobDetail } from '@/api/machine-translation';
import type { TranslationJobListItem } from '@/api/machine-translation';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/zh-cn';

dayjs.extend(relativeTime);
dayjs.locale('zh-cn');

const statusConfig: Record<string, { color: string; text: string }> = {
  PENDING: { color: 'default', text: '待处理' },
  PROCESSING: { color: 'processing', text: '处理中' },
  COMPLETED: { color: 'success', text: '已完成' },
  FAILED: { color: 'error', text: '失败' },
  PARTIAL: { color: 'warning', text: '部分失败' },
};

export const TranslationJobList: React.FC = () => {
  const [selectedJob, setSelectedJob] = useState<string | null>(null);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20 });

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['translation-jobs', pagination],
    queryFn: () =>
      getTranslationJobs({
        page: pagination.page,
        pageSize: pagination.pageSize,
      }),
  });

  const { data: jobDetail } = useQuery({
    queryKey: ['translation-job-detail', selectedJob],
    queryFn: () => selectedJob ? getTranslationJobDetail(selectedJob) : Promise.resolve(null),
    enabled: !!selectedJob,
  });

  const columns: ColumnsType<TranslationJobListItem> = [
    {
      title: '发起人',
      dataIndex: 'userName',
      key: 'userName',
      width: 150,
      render: (userName: string | null, record: TranslationJobListItem) => (
        <Space>
          {record.userAvatar && <Avatar src={record.userAvatar} size={24} />}
          <span>{userName || '-'}</span>
        </Space>
      ),
    },
    {
      title: '供应商',
      dataIndex: 'providerName',
      key: 'providerName',
      width: 120,
      render: (providerName: string, record: TranslationJobListItem) => (
        <Space>
          <span>{providerName}</span>
          <Tag color="blue">{record.providerType}</Tag>
        </Space>
      ),
    },
    {
      title: '项目',
      dataIndex: 'projectName',
      key: 'projectName',
      width: 120,
      render: (projectName: string | null) => projectName || '-',
    },
    {
      title: '词条数',
      key: 'keys',
      width: 100,
      render: (_: any, record: TranslationJobListItem) => (
        <Typography.Text>
          {record.translatedKeys} / {record.totalKeys}
        </Typography.Text>
      ),
    },
    {
      title: '字符数',
      dataIndex: 'characterCount',
      key: 'characterCount',
      width: 100,
      render: (characterCount: number) => characterCount.toLocaleString(),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => {
        const config = statusConfig[status] || { color: 'default', text: status };
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: '时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 150,
      render: (createdAt: string) => (
        <div>
          <div>{dayjs(createdAt).format('MM-DD HH:mm')}</div>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {dayjs(createdAt).fromNow()}
          </Typography.Text>
        </div>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_: any, record: TranslationJobListItem) => (
        <Button
          type="link"
          size="small"
          onClick={() => setSelectedJob(record.id)}
        >
          详情
        </Button>
      ),
    },
  ];

  return (
    <>
      <Card title="📋 翻译任务列表">
        <Table
          columns={columns}
          dataSource={data?.items}
          rowKey="id"
          loading={isLoading}
          pagination={{
            current: pagination.page,
            pageSize: pagination.pageSize,
            total: data?.total,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条`,
            onChange: (page, pageSize) => {
              setPagination({ page, pageSize });
            },
          }}
          onRow={(record) => ({
            onClick: () => setSelectedJob(record.id),
            style: { cursor: 'pointer' },
          })}
        />
      </Card>

      {/* 详情 Drawer */}
      <Drawer
        title="翻译任务详情"
        placement="right"
        width={800}
        open={!!selectedJob}
        onClose={() => setSelectedJob(null)}
      >
        {jobDetail && (
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            {/* 基本信息 */}
            <Card title="基本信息" size="small">
              <Space direction="vertical" size="small" style={{ width: '100%' }}>
                <div>
                  <Typography.Text type="secondary">发起人：</Typography.Text>
                  <Space>
                    {jobDetail.user?.avatar && (
                      <Avatar src={jobDetail.user.avatar} size={20} />
                    )}
                    <span>{jobDetail.user?.name || '-'}</span>
                  </Space>
                </div>
                <div>
                  <Typography.Text type="secondary">供应商：</Typography.Text>
                  <Tag color="blue">{jobDetail.provider.name}</Tag>
                  <Tag>{jobDetail.provider.type}</Tag>
                </div>
                <div>
                  <Typography.Text type="secondary">项目：</Typography.Text>
                  {jobDetail.project?.name || '-'}
                </div>
                <div>
                  <Typography.Text type="secondary">语言：</Typography.Text>
                  <span>{jobDetail.sourceLanguage}</span>
                  <Typography.Text type="secondary"> → </Typography.Text>
                  <Space>
                    {jobDetail.targetLanguages.map((lang) => (
                      <Tag key={lang}>{lang}</Tag>
                    ))}
                  </Space>
                </div>
                <div>
                  <Typography.Text type="secondary">状态：</Typography.Text>
                  <Tag color={statusConfig[jobDetail.status]?.color || 'default'}>
                    {statusConfig[jobDetail.status]?.text || jobDetail.status}
                  </Tag>
                </div>
                <div>
                  <Typography.Text type="secondary">字符数：</Typography.Text>
                  {jobDetail.characterCount.toLocaleString()}
                </div>
                <div>
                  <Typography.Text type="secondary">创建时间：</Typography.Text>
                  {dayjs(jobDetail.createdAt).format('YYYY-MM-DD HH:mm:ss')}
                </div>
                {jobDetail.completedAt && (
                  <div>
                    <Typography.Text type="secondary">完成时间：</Typography.Text>
                    {dayjs(jobDetail.completedAt).format('YYYY-MM-DD HH:mm:ss')}
                  </div>
                )}
              </Space>
            </Card>

            {/* 翻译明细 */}
            <Card title={`翻译结果（${jobDetail.items.length} 个词条）`} size="small">
              <Table
                dataSource={jobDetail.items}
                rowKey="id"
                pagination={false}
                scroll={{ y: 400 }}
                size="small"
                columns={[
                  {
                    title: '词条名称',
                    dataIndex: 'keyName',
                    key: 'keyName',
                    width: 200,
                    ellipsis: true,
                  },
                  {
                    title: '命名空间',
                    dataIndex: 'namespaceName',
                    key: 'namespaceName',
                    width: 120,
                    render: (namespaceName: string | null) => namespaceName || '-',
                  },
                  {
                    title: '原文',
                    dataIndex: 'sourceContent',
                    key: 'sourceContent',
                    ellipsis: true,
                  },
                  {
                    title: '翻译结果',
                    key: 'translations',
                    render: (_: any, record: typeof jobDetail.items[0]) => (
                      <Space direction="vertical" size="small" style={{ width: '100%' }}>
                        {record.translations.map((t) => (
                          <div key={t.targetLanguage} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Tag>{t.targetLanguage}</Tag>
                            <Tag
                              color={t.status === 'SUCCESS' ? 'success' : 'error'}
                              style={{ fontSize: 12 }}
                            >
                              {t.status}
                            </Tag>
                            <Typography.Text
                              type={t.status === 'SUCCESS' ? undefined : 'danger'}
                              style={{ flex: 1, fontSize: 13 }}
                            >
                              {t.translatedContent || t.errorMessage || '-'}
                            </Typography.Text>
                          </div>
                        ))}
                      </Space>
                    ),
                  },
                ]}
              />
            </Card>
          </Space>
        )}
      </Drawer>
    </>
  );
};
