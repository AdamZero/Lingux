import { useState, useMemo } from "react";
import {
  Card,
  Table,
  Tag,
  Space,
  Typography,
  Avatar,
  Button,
  Drawer,
  Input,
  Select,
  DatePicker,
  Row,
  Col,
} from "antd";
import { useQuery } from "@tanstack/react-query";
import {
  getTranslationJobs,
  getTranslationJobDetail,
} from "@/api/machine-translation";
import type {
  TranslationJobListItem,
  TranslationProvider,
} from "@/api/machine-translation";
import type { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import "dayjs/locale/zh-cn";
import {
  UserOutlined,
  ProjectOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";

dayjs.extend(relativeTime);
dayjs.locale("zh-cn");

const { RangePicker } = DatePicker;
const { Option } = Select;

const statusConfig: Record<string, { color: string; text: string }> = {
  PENDING: { color: "default", text: "待处理" },
  PROCESSING: { color: "processing", text: "处理中" },
  COMPLETED: { color: "success", text: "已完成" },
  FAILED: { color: "error", text: "失败" },
  PARTIAL: { color: "warning", text: "部分失败" },
};

interface TranslationJobListProps {
  providers: TranslationProvider[];
}

export const TranslationJobList: React.FC<TranslationJobListProps> = ({
  providers,
}) => {
  const [selectedJob, setSelectedJob] = useState<string | null>(null);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20 });

  // 筛选状态
  const [userSearch, setUserSearch] = useState<string>("");
  const [projectSearch, setProjectSearch] = useState<string>("");
  const [selectedProvider, setSelectedProvider] = useState<string | undefined>(
    undefined,
  );
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([
    dayjs().startOf("month"),
    dayjs().endOf("month"),
  ]);

  const { data, isLoading } = useQuery({
    queryKey: ["translation-jobs", pagination, selectedProvider, dateRange],
    queryFn: () =>
      getTranslationJobs({
        page: pagination.page,
        pageSize: pagination.pageSize,
        providerId: selectedProvider,
        startDate: dateRange[0].format("YYYY-MM-DD"),
        endDate: dateRange[1].format("YYYY-MM-DD"),
      }),
  });

  const { data: jobDetail } = useQuery({
    queryKey: ["translation-job-detail", selectedJob],
    queryFn: () =>
      selectedJob
        ? getTranslationJobDetail(selectedJob)
        : Promise.resolve(null),
    enabled: !!selectedJob,
  });

  // 客户端筛选：发起人、项目
  const filteredItems = useMemo(() => {
    if (!data?.items) return [];
    return data.items.filter((item) => {
      const matchUser =
        !userSearch ||
        (item.userName?.toLowerCase().includes(userSearch.toLowerCase()) ??
          false);
      const matchProject =
        !projectSearch ||
        (item.projectName
          ?.toLowerCase()
          .includes(projectSearch.toLowerCase()) ??
          false);
      return matchUser && matchProject;
    });
  }, [data?.items, userSearch, projectSearch]);

  const columns: ColumnsType<TranslationJobListItem> = [
    {
      title: "发起人",
      dataIndex: "userName",
      key: "userName",
      width: 150,
      render: (userName: string | null, record: TranslationJobListItem) => (
        <Space>
          {record.userAvatar && <Avatar src={record.userAvatar} size={24} />}
          <span>{userName || "-"}</span>
        </Space>
      ),
    },
    {
      title: "供应商",
      dataIndex: "providerName",
      key: "providerName",
      width: 120,
      render: (providerName: string, record: TranslationJobListItem) => (
        <Space>
          <span>{providerName}</span>
          <Tag color="blue">{record.providerType}</Tag>
        </Space>
      ),
    },
    {
      title: "项目",
      dataIndex: "projectName",
      key: "projectName",
      width: 120,
      render: (projectName: string | null) => projectName || "-",
    },
    {
      title: "词条数",
      key: "keys",
      width: 100,
      render: (_: unknown, record: TranslationJobListItem) => (
        <Typography.Text>
          {record.translatedKeys} / {record.totalKeys}
        </Typography.Text>
      ),
    },
    {
      title: "字符数",
      dataIndex: "characterCount",
      key: "characterCount",
      width: 100,
      render: (characterCount: number) => characterCount.toLocaleString(),
    },
    {
      title: "状态",
      dataIndex: "status",
      key: "status",
      width: 100,
      render: (status: string) => {
        const config = statusConfig[status] || {
          color: "default",
          text: status,
        };
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: "时间",
      dataIndex: "createdAt",
      key: "createdAt",
      width: 150,
      render: (createdAt: string) => (
        <div>
          <div>{dayjs(createdAt).format("MM-DD HH:mm")}</div>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {dayjs(createdAt).fromNow()}
          </Typography.Text>
        </div>
      ),
    },
    {
      title: "操作",
      key: "action",
      width: 100,
      render: (_: unknown, record: TranslationJobListItem) => (
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
      <Card
        title={
          <Space>
            <ThunderboltOutlined />
            <span>翻译任务列表</span>
          </Space>
        }
        style={{ marginBottom: 24 }}
      >
        {/* 筛选栏 */}
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col xs={24} sm={12} md={6}>
            <Input
              placeholder="搜索发起人"
              prefix={<UserOutlined />}
              value={userSearch}
              onChange={(e) => {
                setUserSearch(e.target.value);
                setPagination({ ...pagination, page: 1 });
              }}
              allowClear
            />
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Input
              placeholder="搜索项目"
              prefix={<ProjectOutlined />}
              value={projectSearch}
              onChange={(e) => {
                setProjectSearch(e.target.value);
                setPagination({ ...pagination, page: 1 });
              }}
              allowClear
            />
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Select
              placeholder="选择供应商"
              style={{ width: "100%" }}
              value={selectedProvider}
              onChange={(value) => {
                setSelectedProvider(value);
                setPagination({ ...pagination, page: 1 });
              }}
              allowClear
            >
              {providers.map((provider) => (
                <Option key={provider.id} value={provider.id}>
                  {provider.name}
                </Option>
              ))}
            </Select>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <RangePicker
              style={{ width: "100%" }}
              value={dateRange}
              onChange={(dates) => {
                if (dates && dates[0] && dates[1]) {
                  setDateRange([dates[0], dates[1]]);
                  setPagination({ ...pagination, page: 1 });
                }
              }}
              placeholder={["开始日期", "结束日期"]}
            />
          </Col>
        </Row>

        <Table
          columns={columns}
          dataSource={filteredItems}
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
            style: { cursor: "pointer" },
          })}
        />
      </Card>

      {/* 详情 Drawer */}
      <Drawer
        title="翻译任务详情"
        placement="right"
        width={900}
        open={!!selectedJob}
        onClose={() => setSelectedJob(null)}
      >
        {jobDetail && (
          <Space direction="vertical" size="large" style={{ width: "100%" }}>
            {/* 基本信息 - 两列布局 */}
            <Card title="基本信息" size="small">
              <Row gutter={[24, 12]}>
                <Col span={12}>
                  <Typography.Text type="secondary">发起人：</Typography.Text>
                  <Space style={{ marginLeft: 8 }}>
                    {jobDetail.user?.avatar && (
                      <Avatar src={jobDetail.user.avatar} size={20} />
                    )}
                    <span>{jobDetail.user?.name || "-"}</span>
                  </Space>
                </Col>
                <Col span={12}>
                  <Typography.Text type="secondary">供应商：</Typography.Text>
                  <Space style={{ marginLeft: 8 }}>
                    <Tag color="blue">{jobDetail.provider.name}</Tag>
                    <Tag>{jobDetail.provider.type}</Tag>
                  </Space>
                </Col>
                <Col span={12}>
                  <Typography.Text type="secondary">项目：</Typography.Text>
                  <span style={{ marginLeft: 8 }}>
                    {jobDetail.project?.name || "-"}
                  </span>
                </Col>
                <Col span={12}>
                  <Typography.Text type="secondary">语言：</Typography.Text>
                  <span style={{ marginLeft: 8 }}>
                    {jobDetail.sourceLanguage}
                    <Typography.Text type="secondary"> → </Typography.Text>
                    {jobDetail.targetLanguages.join(", ")}
                  </span>
                </Col>
                <Col span={12}>
                  <Typography.Text type="secondary">状态：</Typography.Text>
                  <Tag
                    style={{ marginLeft: 8 }}
                    color={statusConfig[jobDetail.status]?.color || "default"}
                  >
                    {statusConfig[jobDetail.status]?.text || jobDetail.status}
                  </Tag>
                </Col>
                <Col span={12}>
                  <Typography.Text type="secondary">成功比例：</Typography.Text>
                  <span style={{ marginLeft: 8 }}>
                    {(() => {
                      const successCount = jobDetail.items.reduce(
                        (sum, item) =>
                          sum +
                          item.translations.filter(
                            (t) => t.status === "SUCCESS",
                          ).length,
                        0,
                      );
                      const totalCount = jobDetail.items.reduce(
                        (sum, item) => sum + item.translations.length,
                        0,
                      );
                      return `${successCount}/${totalCount}`;
                    })()}
                  </span>
                </Col>
                <Col span={12}>
                  <Typography.Text type="secondary">字符数：</Typography.Text>
                  <span style={{ marginLeft: 8 }}>
                    {jobDetail.characterCount.toLocaleString()}
                  </span>
                </Col>
                <Col span={12}>
                  <Typography.Text type="secondary">词条数：</Typography.Text>
                  <span style={{ marginLeft: 8 }}>
                    {jobDetail.translatedKeys}/{jobDetail.totalKeys}
                  </span>
                </Col>
                <Col span={12}>
                  <Typography.Text type="secondary">创建时间：</Typography.Text>
                  <span style={{ marginLeft: 8 }}>
                    {dayjs(jobDetail.createdAt).format("YYYY-MM-DD HH:mm:ss")}
                  </span>
                </Col>
                {jobDetail.completedAt && (
                  <Col span={12}>
                    <Typography.Text type="secondary">
                      完成时间：
                    </Typography.Text>
                    <span style={{ marginLeft: 8 }}>
                      {dayjs(jobDetail.completedAt).format(
                        "YYYY-MM-DD HH:mm:ss",
                      )}
                    </span>
                  </Col>
                )}
              </Row>
            </Card>

            {/* 翻译明细 - 紧凑左侧，给结果留空间 */}
            <Card
              title={`翻译结果（${jobDetail.items.length} 个词条）`}
              size="small"
            >
              <Table
                dataSource={jobDetail.items}
                rowKey="id"
                pagination={false}
                scroll={{ y: 400 }}
                size="small"
                columns={[
                  {
                    title: "词条",
                    key: "key",
                    width: 120,
                    render: (
                      _: unknown,
                      record: (typeof jobDetail.items)[0],
                    ) => (
                      <div>
                        <div
                          style={{
                            fontWeight: 500,
                            fontSize: 13,
                            marginBottom: 2,
                          }}
                        >
                          {record.keyName}
                        </div>
                        {record.namespaceName && (
                          <Tag size="small" style={{ fontSize: 11 }}>
                            {record.namespaceName}
                          </Tag>
                        )}
                      </div>
                    ),
                  },
                  {
                    title: "原文",
                    dataIndex: "sourceContent",
                    key: "sourceContent",
                    width: 200,
                    ellipsis: true,
                  },
                  {
                    title: "翻译结果",
                    key: "translations",
                    render: (
                      _: unknown,
                      record: (typeof jobDetail.items)[0],
                    ) => (
                      <Space
                        direction="vertical"
                        size="small"
                        style={{ width: "100%" }}
                      >
                        {record.translations.map((t) => (
                          <div
                            key={t.targetLanguage}
                            style={{
                              display: "flex",
                              alignItems: "flex-start",
                              gap: 8,
                            }}
                          >
                            <Tag
                              size="small"
                              color={
                                t.status === "SUCCESS" ? "success" : "error"
                              }
                              style={{ fontSize: 11, flexShrink: 0 }}
                            >
                              {t.targetLanguage}
                            </Tag>
                            <Typography.Text
                              type={
                                t.status === "SUCCESS" ? undefined : "danger"
                              }
                              style={{
                                flex: 1,
                                fontSize: 13,
                                wordBreak: "break-all",
                              }}
                            >
                              {t.translatedContent || t.errorMessage || "-"}
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
