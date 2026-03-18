import React, { useState } from "react";
import {
  Card,
  Table,
  Button,
  Space,
  Tag,
  Modal,
  Form,
  Input,
  Select,
  App as AntdApp,
  Tooltip,
  Typography,
  Badge,
  Statistic,
  Row,
  Col,
} from "antd";
import {
  PlusOutlined,
  RocketOutlined,
  RollbackOutlined,
  EyeOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  SyncOutlined,
} from "@ant-design/icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import apiClient from "@/api/client";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { usePermission } from "@/hooks/usePermission";

const { Text } = Typography;
const { Option } = Select;

type ReleaseStatus =
  | "DRAFT"
  | "PENDING_APPROVAL"
  | "APPROVED"
  | "PUBLISHING"
  | "PUBLISHED"
  | "FAILED"
  | "ROLLED_BACK";

interface Release {
  id: string;
  name: string;
  description?: string;
  status: ReleaseStatus;
  version: string;
  localeCodes: string[];
  publishedAt?: string;
  createdAt: string;
  createdBy: {
    id: string;
    username: string;
  };
  statistics: {
    totalKeys: number;
    approvedKeys: number;
    publishedKeys: number;
  };
}

const statusConfig: Record<
  ReleaseStatus,
  {
    color: string;
    text: string;
    status: "default" | "processing" | "success" | "error" | "warning";
  }
> = {
  DRAFT: { color: "default", text: "草稿", status: "default" },
  PENDING_APPROVAL: { color: "orange", text: "待审批", status: "warning" },
  APPROVED: { color: "cyan", text: "已审批", status: "processing" },
  PUBLISHING: { color: "processing", text: "发布中", status: "processing" },
  PUBLISHED: { color: "success", text: "已发布", status: "success" },
  FAILED: { color: "error", text: "失败", status: "error" },
  ROLLED_BACK: { color: "purple", text: "已回滚", status: "default" },
};

const ReleaseCenter: React.FC = () => {
  const { message } = AntdApp.useApp();
  const queryClient = useQueryClient();
  const { canPublish } = usePermission();

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<ReleaseStatus | null>(null);

  const [createForm] = Form.useForm();

  const { data: releases = [], isLoading } = useQuery<Release[]>({
    queryKey: ["releases", statusFilter],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (statusFilter) {
        params.status = statusFilter;
      }
      return await apiClient.get("/releases", { params });
    },
  });

  const createReleaseMutation = useMutation({
    mutationFn: (values: {
      name: string;
      description?: string;
      version: string;
      localeCodes: string[];
      scope: { type: "all" | "namespaces"; namespaceIds?: string[] };
    }) => apiClient.post("/releases", values),
    onSuccess: () => {
      message.success("发布创建成功");
      setIsCreateModalOpen(false);
      createForm.resetFields();
      queryClient.invalidateQueries({ queryKey: ["releases"] });
    },
    onError: () => {
      message.error("创建失败");
    },
  });

  const publishReleaseMutation = useMutation({
    mutationFn: (releaseId: string) =>
      apiClient.post(`/releases/${releaseId}/publish`),
    onSuccess: () => {
      message.success("发布已提交");
      queryClient.invalidateQueries({ queryKey: ["releases"] });
    },
    onError: () => {
      message.error("操作失败");
    },
  });

  const approveReleaseMutation = useMutation({
    mutationFn: (releaseId: string) =>
      apiClient.post(`/releases/${releaseId}/approve`),
    onSuccess: () => {
      message.success("审批通过");
      queryClient.invalidateQueries({ queryKey: ["releases"] });
    },
    onError: () => {
      message.error("操作失败");
    },
  });

  const rollbackReleaseMutation = useMutation({
    mutationFn: (releaseId: string) =>
      apiClient.post(`/releases/${releaseId}/rollback`),
    onSuccess: () => {
      message.success("回滚成功");
      queryClient.invalidateQueries({ queryKey: ["releases"] });
    },
    onError: () => {
      message.error("回滚失败");
    },
  });

  const handleCreate = () => {
    createForm.validateFields().then((values) => {
      createReleaseMutation.mutate(values);
    });
  };

  const handlePublish = (release: Release) => {
    Modal.confirm({
      title: "确认发布",
      content: `确定要发布 "${release.name}" 吗？`,
      onOk: () => publishReleaseMutation.mutate(release.id),
    });
  };

  const handleApprove = (release: Release) => {
    Modal.confirm({
      title: "审批通过",
      content: `确定要批准 "${release.name}" 吗？`,
      onOk: () => approveReleaseMutation.mutate(release.id),
    });
  };

  const handleRollback = (release: Release) => {
    Modal.confirm({
      title: "回滚发布",
      content: `确定要回滚 "${release.name}" 吗？这将撤销本次发布的所有内容。`,
      okText: "确定回滚",
      okButtonProps: { danger: true },
      onOk: () => rollbackReleaseMutation.mutate(release.id),
    });
  };

  const columns = [
    {
      title: "发布名称",
      dataIndex: "name",
      key: "name",
      render: (text: string, record: Release) => (
        <div>
          <Text strong>{text}</Text>
          <div>
            <Text type="secondary" style={{ fontSize: 12 }}>
              v{record.version}
            </Text>
          </div>
        </div>
      ),
    },
    {
      title: "状态",
      dataIndex: "status",
      key: "status",
      render: (status: ReleaseStatus) => {
        const config = statusConfig[status];
        return <Badge status={config.status} text={config.text} />;
      },
    },
    {
      title: "语言",
      key: "locales",
      render: (_: unknown, record: Release) => (
        <Space wrap>
          {record.localeCodes.map((code) => (
            <Tag key={code}>{code}</Tag>
          ))}
        </Space>
      ),
    },
    {
      title: "进度",
      key: "progress",
      render: (_: unknown, record: Release) => (
        <Statistic
          value={record.statistics.publishedKeys}
          suffix={`/ ${record.statistics.totalKeys}`}
          valueStyle={{ fontSize: 14 }}
        />
      ),
    },
    {
      title: "创建者",
      dataIndex: ["createdBy", "username"],
      key: "createdBy",
    },
    {
      title: "创建时间",
      dataIndex: "createdAt",
      key: "createdAt",
      render: (date: string) => dayjs(date).format("YYYY-MM-DD HH:mm"),
    },
    {
      title: "操作",
      key: "action",
      render: (_: unknown, record: Release) => (
        <Space>
          <Tooltip title="查看详情">
            <Button
              type="text"
              icon={<EyeOutlined />}
              onClick={() => {
                setSelectedRelease(record);
                setIsDetailDrawerOpen(true);
              }}
            />
          </Tooltip>
          {record.status === "DRAFT" && (
            <Tooltip title="提交发布">
              <Button
                type="text"
                icon={<SyncOutlined />}
                onClick={() => handlePublish(record)}
              />
            </Tooltip>
          )}
          {record.status === "PENDING_APPROVAL" && canPublish && (
            <Tooltip title="审批">
              <Button
                type="text"
                icon={<CheckCircleOutlined />}
                onClick={() => handleApprove(record)}
              />
            </Tooltip>
          )}
          {record.status === "APPROVED" && canPublish && (
            <Tooltip title="发布">
              <Button
                type="text"
                icon={<RocketOutlined />}
                onClick={() => handlePublish(record)}
              />
            </Tooltip>
          )}
          {record.status === "PUBLISHED" && canPublish && (
            <Tooltip title="回滚">
              <Button
                type="text"
                danger
                icon={<RollbackOutlined />}
                onClick={() => handleRollback(record)}
              />
            </Tooltip>
          )}
        </Space>
      ),
    },
  ];

  const publishedCount = releases.filter(
    (r) => r.status === "PUBLISHED",
  ).length;
  const publishingCount = releases.filter(
    (r) => r.status === "PUBLISHING",
  ).length;
  const pendingCount = releases.filter(
    (r) => r.status === "PENDING_APPROVAL",
  ).length;

  return (
    <div>
      <PageHeader
        title="发布中心"
        description="管理翻译内容的发布和回滚"
        extra={
          canPublish && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setIsCreateModalOpen(true)}
            >
              创建发布
            </Button>
          )
        }
      />

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="已发布"
              value={publishedCount}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: "#3f8600" }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="发布中"
              value={publishingCount}
              prefix={<SyncOutlined spin />}
              valueStyle={{ color: "#1890ff" }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="待审批"
              value={pendingCount}
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: "#faad14" }}
            />
          </Card>
        </Col>
      </Row>

      <Card>
        <Space style={{ marginBottom: 16 }}>
          <Select
            placeholder="按状态筛选"
            style={{ width: 150 }}
            value={statusFilter}
            onChange={(value) => setStatusFilter(value || null)}
            allowClear
          >
            <Option value="DRAFT">草稿</Option>
            <Option value="PENDING_APPROVAL">待审批</Option>
            <Option value="APPROVED">已审批</Option>
            <Option value="PUBLISHING">发布中</Option>
            <Option value="PUBLISHED">已发布</Option>
            <Option value="FAILED">失败</Option>
            <Option value="ROLLED_BACK">已回滚</Option>
          </Select>
        </Space>

        <Table
          columns={columns}
          dataSource={releases}
          rowKey="id"
          loading={isLoading}
          locale={{
            emptyText: <EmptyState type="no-data" description="暂无发布记录" />,
          }}
        />
      </Card>

      <Modal
        title="创建发布"
        open={isCreateModalOpen}
        onOk={handleCreate}
        onCancel={() => setIsCreateModalOpen(false)}
        confirmLoading={createReleaseMutation.isPending}
        width={600}
      >
        <Form form={createForm} layout="vertical">
          <Form.Item
            name="name"
            label="发布名称"
            rules={[{ required: true, message: "请输入发布名称" }]}
          >
            <Input placeholder="例如: 2026-03 版本更新" />
          </Form.Item>
          <Form.Item
            name="version"
            label="版本号"
            rules={[{ required: true, message: "请输入版本号" }]}
          >
            <Input placeholder="例如: 1.0.0" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item
            name="localeCodes"
            label="目标语言"
            rules={[{ required: true, message: "请选择目标语言" }]}
          >
            <Select mode="multiple" placeholder="选择语言">
              <Option value="en">英语 (en)</Option>
              <Option value="zh-CN">简体中文 (zh-CN)</Option>
              <Option value="ja">日语 (ja)</Option>
              <Option value="ko">韩语 (ko)</Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ReleaseCenter;
