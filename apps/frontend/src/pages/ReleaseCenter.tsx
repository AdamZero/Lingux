import React, { useState, useMemo } from "react";
import {
  Card,
  Table,
  Button,
  Space,
  Tag,
  Tooltip,
  Select,
  App as AntdApp,
  Modal,
  Row,
  Col,
  Statistic,
} from "antd";
import {
  PlusOutlined,
  RollbackOutlined,
  EyeOutlined,
  DownloadOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  FileTextOutlined,
} from "@ant-design/icons";
import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import apiClient from "@/api/client";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";

import { useAppStore } from "@/store/useAppStore";
import { usePermission } from "@/hooks/usePermission";
import {
  useReleases,
  type Release,
} from "@/components/release/hooks/useReleases";
import ActiveSessionCard from "@/components/release/ActiveSessionCard";
import ReleaseDetailDrawer from "@/components/release/ReleaseDetailDrawer";
import PublishDrawer from "@/components/release/PublishDrawer";

const { Option } = Select;

export interface Project {
  id: string;
  name: string;
  baseLocale: string;
  locales: { id: string; code: string; name: string }[];
  currentReleaseId?: string | null;
}

const statusConfig: Record<string, { color: string; text: string }> = {
  DRAFT: { color: "default", text: "草稿" },
  IN_REVIEW: { color: "orange", text: "审核中" },
  APPROVED: { color: "cyan", text: "已审批" },
  REJECTED: { color: "red", text: "已驳回" },
  PUBLISHED: { color: "success", text: "已发布" },
  ROLLED_BACK: { color: "purple", text: "已回滚" },
};

// 全局统计卡片
const GlobalStats: React.FC<{ releases: Release[] }> = ({ releases }) => {
  const stats = useMemo(() => {
    const publishedCount = releases.filter(
      (r) => r.status === "PUBLISHED",
    ).length;
    const reviewingCount = releases.filter(
      (r) => r.status === "IN_REVIEW",
    ).length;
    const draftCount = releases.filter((r) => r.status === "DRAFT").length;
    const totalProjects = new Set(releases.map((r) => r.projectId)).size;

    return {
      publishedCount,
      reviewingCount,
      draftCount,
      totalProjects,
      totalReleases: releases.length,
    };
  }, [releases]);

  return (
    <Row gutter={16} style={{ marginBottom: 16 }}>
      <Col span={4}>
        <Card>
          <Statistic
            title="总发布数"
            value={stats.totalReleases}
            valueStyle={{ color: "#3B82F6" }}
          />
        </Card>
      </Col>
      <Col span={4}>
        <Card>
          <Statistic
            title="涉及项目"
            value={stats.totalProjects}
            valueStyle={{ color: "#8B5CF6" }}
          />
        </Card>
      </Col>
      <Col span={4}>
        <Card>
          <Statistic
            title="已发布"
            value={stats.publishedCount}
            valueStyle={{ color: "#10B981" }}
            prefix={<CheckCircleOutlined />}
          />
        </Card>
      </Col>
      <Col span={4}>
        <Card>
          <Statistic
            title="审核中"
            value={stats.reviewingCount}
            valueStyle={{ color: "#F59E0B" }}
            prefix={<ClockCircleOutlined />}
          />
        </Card>
      </Col>
      <Col span={4}>
        <Card>
          <Statistic
            title="草稿"
            value={stats.draftCount}
            valueStyle={{ color: "#6B7280" }}
            prefix={<FileTextOutlined />}
          />
        </Card>
      </Col>
      <Col span={4}>
        <Card>
          <Statistic
            title="待处理"
            value={stats.reviewingCount + stats.draftCount}
            valueStyle={{ color: "#EF4444" }}
          />
        </Card>
      </Col>
    </Row>
  );
};

const ReleaseCenter: React.FC = () => {
  const { notification } = AntdApp.useApp();
  const { canPublish, canApprove } = usePermission();
  const currentUser = useAppStore((state) => state.user);
  const currentUserId = currentUser?.id;

  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    null,
  );
  const [isPublishDrawerOpen, setIsPublishDrawerOpen] = useState(false);
  const [isDetailDrawerOpen, setIsDetailDrawerOpen] = useState(false);
  const [selectedRelease, setSelectedRelease] = useState<Release | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ["projects"],
    queryFn: async () => apiClient.get("/projects"),
  });

  const { data: currentProject } = useQuery<Project>({
    queryKey: ["project", selectedProjectId],
    queryFn: async () => {
      if (!selectedProjectId) return null;
      return apiClient.get(`/projects/${selectedProjectId}`);
    },
    enabled: !!selectedProjectId,
  });

  // 获取所有项目的发布（全局视角）
  const {
    releases: allReleases,
    isLoading,
    activeSession,
    currentReleaseId,
    submitMutation,
    approveMutation,
    rejectMutation,
    publishMutation,
    rollbackMutation,
    downloadArtifact,
    cancelDraft,
    isCanceling,
  } = useReleases(selectedProjectId);

  // 根据项目筛选
  const filteredReleases = useMemo(() => {
    let result = allReleases;
    if (statusFilter) {
      result = result.filter((r) => r.status === statusFilter);
    }
    return result;
  }, [allReleases, statusFilter]);

  const handleRollback = (release: Release) => {
    Modal.confirm({
      title: "回滚发布",
      content: `确定要回滚到版本 ${release.version} 吗？`,
      okText: "确定回滚",
      okButtonProps: { danger: true },
      onOk: () => {
        rollbackMutation.mutate(
          { releaseId: release.id },
          {
            onSuccess: () => notification.success({ message: "回滚成功" }),
            onError: (error: unknown) => {
              const err = error as {
                response?: { data?: { message?: string } };
              };
              notification.error({
                message: err.response?.data?.message || "回滚失败",
              });
            },
          },
        );
      },
    });
  };

  const columns = [
    {
      title: "项目",
      key: "project",
      width: 150,
      render: (_: unknown, r: Release) => {
        const project = projects.find((p) => p.id === r.projectId);
        return <Tag>{project?.name || r.projectId}</Tag>;
      },
    },
    {
      title: "版本",
      dataIndex: "version",
      key: "version",
      width: 80,
      render: (v: number) => <strong>v{v}</strong>,
    },
    {
      title: "状态",
      dataIndex: "status",
      key: "status",
      width: 100,
      render: (s: string) => (
        <Tag color={statusConfig[s]?.color}>{statusConfig[s]?.text || s}</Tag>
      ),
    },
    {
      title: "标签",
      key: "tags",
      width: 150,
      render: (_: unknown, r: Release) => (
        <Space wrap>
          {r.tags?.map((t) => (
            <Tag key={t}>{t}</Tag>
          ))}
        </Space>
      ),
    },
    {
      title: "语言",
      key: "locales",
      width: 150,
      render: (_: unknown, r: Release) => (
        <Space wrap>
          {r.localeCodes?.map((c) => (
            <Tag key={c} size="small">
              {c}
            </Tag>
          ))}
        </Space>
      ),
    },
    {
      title: "发布时间",
      dataIndex: "publishedAt",
      key: "publishedAt",
      width: 180,
      render: (d: string) => (d ? dayjs(d).format("YYYY-MM-DD HH:mm") : "-"),
    },
    {
      title: "操作",
      key: "action",
      width: 200,
      render: (_: unknown, r: Release) => (
        <Space>
          <Tooltip title="查看详情">
            <Button
              type="text"
              icon={<EyeOutlined />}
              onClick={() => {
                setSelectedRelease(r);
                setIsDetailDrawerOpen(true);
              }}
            />
          </Tooltip>
          <Tooltip title="下载产物">
            <Button
              type="text"
              icon={<DownloadOutlined />}
              onClick={() =>
                r.localeCodes?.forEach((c) => downloadArtifact(r.id, c))
              }
            />
          </Tooltip>
          {r.status === "PUBLISHED" && currentReleaseId !== r.id && (
            <Tooltip title="回滚">
              <Button
                type="text"
                danger
                icon={<RollbackOutlined />}
                onClick={() => handleRollback(r)}
              />
            </Tooltip>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="发布中心"
        description="管理翻译内容的发布、审批和回滚"
        extra={
          <Space>
            <Select
              placeholder="筛选项目（可选）"
              style={{ width: 200 }}
              value={selectedProjectId}
              onChange={setSelectedProjectId}
              allowClear
              options={projects.map((p) => ({ label: p.name, value: p.id }))}
            />
            {canPublish && (
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => {
                  if (!selectedProjectId) {
                    message.error("请先选择一个项目");
                    return;
                  }
                  setIsPublishDrawerOpen(true);
                }}
              >
                创建发布
              </Button>
            )}
          </Space>
        }
      />

      {/* 全局统计卡片 */}
      <GlobalStats releases={allReleases} />

      {/* 当前活跃会话 */}
      {activeSession && (
        <ActiveSessionCard
          session={activeSession}
          currentUserId={currentUserId}
        />
      )}

      {/* 发布列表 */}
      <Card>
        <Space style={{ marginBottom: 16 }}>
          <Select
            placeholder="按状态筛选"
            style={{ width: 150 }}
            value={statusFilter}
            onChange={(v) => setStatusFilter(v || null)}
            allowClear
          >
            <Option value="DRAFT">草稿</Option>
            <Option value="IN_REVIEW">审核中</Option>
            <Option value="APPROVED">已审批</Option>
            <Option value="PUBLISHED">已发布</Option>
            <Option value="REJECTED">已驳回</Option>
          </Select>
        </Space>
        <Table
          columns={columns}
          dataSource={filteredReleases}
          rowKey="id"
          loading={isLoading}
          locale={{
            emptyText: <EmptyState type="no-data" description="暂无发布记录" />,
          }}
        />
      </Card>

      <PublishDrawer
        open={isPublishDrawerOpen}
        onClose={() => setIsPublishDrawerOpen(false)}
        projectId={selectedProjectId || ""}
        locales={
          currentProject?.locales.map((l) => ({
            code: l.code,
            name: l.name,
          })) || []
        }
        currentReleaseId={currentProject?.currentReleaseId}
        scope={{ type: "all" }}
        scopeLabel="全部词条"
        allowScopeChange={false}
      />

      <ReleaseDetailDrawer
        release={selectedRelease}
        open={isDetailDrawerOpen}
        onClose={() => {
          setIsDetailDrawerOpen(false);
          setSelectedRelease(null);
        }}
        onDownload={(localeCode) =>
          selectedRelease && downloadArtifact(selectedRelease.id, localeCode)
        }
        onSubmit={async (sessionId, note) => {
          await submitMutation.mutateAsync({ sessionId, note });
        }}
        onApprove={async (sessionId, note) => {
          await approveMutation.mutateAsync({ sessionId, note });
        }}
        onReject={async (sessionId, reason) => {
          await rejectMutation.mutateAsync({ sessionId, reason });
        }}
        onPublish={async (sessionId) => {
          await publishMutation.mutateAsync(sessionId);
        }}
        onCancel={async (sessionId) => {
          await cancelDraft(sessionId);
        }}
        canSubmit={canPublish}
        canApprove={canApprove}
        canPublish={canPublish}
        canCancel={true}
        currentUserId={currentUserId}
        loading={
          submitMutation.isPending ||
          approveMutation.isPending ||
          rejectMutation.isPending ||
          publishMutation.isPending ||
          isCanceling
        }
      />
    </div>
  );
};

export default ReleaseCenter;
