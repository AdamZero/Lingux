import React, { useState } from "react";
import { useParams } from "react-router-dom";
import {
  Badge,
  Button,
  Timeline,
  Spin,
  Result,
  Tag,
  Space,
  type BadgeProps,
  Modal,
  Form,
  Input,
  message,
} from "antd";
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  EditOutlined,
  SendOutlined,
  CheckOutlined,
  RocketOutlined,
  FileTextOutlined,
  CopyOutlined,
  DownloadOutlined,
  UndoOutlined,
} from "@ant-design/icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import apiClient from "@/api/client";
import type { ReleaseSessionStatus } from "@/types/release";
import { useAppStore } from "@/store/useAppStore";

const { CheckableTag } = Tag;

// 统一的数据类型
export interface ReleaseDetail {
  id: string;
  projectId: string;
  projectName?: string;
  basedOnReleaseId: string | null;
  version: number | null;
  note: string | null;
  status: ReleaseSessionStatus;
  scope: {
    type: "all" | "namespaces" | "keys";
    namespaceIds?: string[];
    keyIds?: string[];
  };
  createdAt: string;
  publishedAt?: string;
  localeCodes: string[];
  tags?: string[];
  type: "RELEASE" | "SESSION";
  baseJson?: string;
  nextJson?: string;
  validationErrors?: unknown[];
  createdByUser?: { id: string; name: string | null };
  session?: {
    id: string;
    status: ReleaseSessionStatus;
    submittedAt: string | null;
    reviewedAt: string | null;
    reviewNote: string | null;
    publishedAt: string | null;
    createdBy?: string;
    reviewedBy?: string;
    submittedBy?: string;
    publishedBy?: string;
  };
  // 当前用户权限
  canSubmit?: boolean;
  canApprove?: boolean;
  canCancel?: boolean;
  currentUserId?: string;
  // 项目 owners
  owners?: { id: string; name: string | null }[];
}

const statusMap: Record<
  ReleaseSessionStatus,
  { label: string; color: string; icon: React.ReactNode }
> = {
  DRAFT: { label: "草稿", color: "default", icon: <EditOutlined /> },
  IN_REVIEW: { label: "审核中", color: "processing", icon: <SendOutlined /> },
  APPROVED: { label: "已通过", color: "success", icon: <CheckOutlined /> },
  REJECTED: { label: "已驳回", color: "error", icon: <CloseCircleOutlined /> },
  PUBLISHED: { label: "已发布", color: "success", icon: <RocketOutlined /> },
  EXPIRED: { label: "已过期", color: "warning", icon: <FileTextOutlined /> },
};

const formatDateTime = (date: string | null | undefined): string => {
  if (!date) return "-";
  return dayjs(date).format("YYYY-MM-DD HH:mm:ss");
};

// 计算两个 JSON 对象的差异
interface DiffLine {
  type: "unchanged" | "added" | "removed";
  key: string;
  oldValue?: string;
  newValue?: string;
  path: string;
}

const computeDiff = (baseJson?: string, nextJson?: string): DiffLine[] => {
  if (!baseJson && !nextJson) return [];

  const base = baseJson ? JSON.parse(baseJson) : {};
  const next = nextJson ? JSON.parse(nextJson) : {};

  const lines: DiffLine[] = [];
  const allKeys = new Set([...Object.keys(base), ...Object.keys(next)]);

  allKeys.forEach((key) => {
    const oldVal = base[key];
    const newVal = next[key];

    if (!(key in base)) {
      lines.push({
        type: "added",
        key,
        newValue: JSON.stringify(newVal, null, 2),
        path: key,
      });
    } else if (!(key in next)) {
      lines.push({
        type: "removed",
        key,
        oldValue: JSON.stringify(oldVal, null, 2),
        path: key,
      });
    } else if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      lines.push({
        type: "removed",
        key,
        oldValue: JSON.stringify(oldVal, null, 2),
        path: key,
      });
      lines.push({
        type: "added",
        key,
        newValue: JSON.stringify(newVal, null, 2),
        path: key,
      });
    } else {
      lines.push({
        type: "unchanged",
        key,
        oldValue: JSON.stringify(oldVal, null, 2),
        path: key,
      });
    }
  });

  return lines;
};

// Diff 展示组件
const JsonDiff: React.FC<{
  baseJson?: string;
  nextJson?: string;
}> = ({ baseJson, nextJson }) => {
  const [showUnchanged, setShowUnchanged] = useState(false);
  const diffLines = computeDiff(baseJson, nextJson);

  const filteredLines = showUnchanged
    ? diffLines
    : diffLines.filter((line) => line.type !== "unchanged");

  const stats = {
    added: diffLines.filter((l) => l.type === "added").length / 2,
    removed: diffLines.filter((l) => l.type === "removed").length / 2,
    unchanged: diffLines.filter((l) => l.type === "unchanged").length,
  };

  return (
    <div>
      <div
        style={{
          marginBottom: 12,
          display: "flex",
          gap: 16,
          alignItems: "center",
        }}
      >
        <span style={{ color: "#10B981", fontSize: 13 }}>
          +{Math.floor(stats.added)} 新增
        </span>
        <span style={{ color: "#EF4444", fontSize: 13 }}>
          -{Math.floor(stats.removed)} 删除
        </span>
        <CheckableTag
          checked={showUnchanged}
          onChange={setShowUnchanged}
          style={{ marginLeft: "auto", fontSize: 12 }}
        >
          显示未变更
        </CheckableTag>
      </div>

      <div
        style={{
          background: "#1e1e1e",
          borderRadius: 6,
          overflow: "auto",
          maxHeight: 480,
          fontFamily: 'Consolas, Monaco, "Courier New", monospace',
          fontSize: 13,
          lineHeight: "1.6",
        }}
      >
        {filteredLines.length === 0 ? (
          <div style={{ padding: 24, textAlign: "center", color: "#666" }}>
            暂无变更内容
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <tbody>
              {filteredLines.map((line, index) => (
                <tr
                  key={index}
                  style={{
                    background:
                      line.type === "added"
                        ? "rgba(16, 185, 129, 0.1)"
                        : line.type === "removed"
                          ? "rgba(239, 68, 68, 0.1)"
                          : "transparent",
                  }}
                >
                  <td
                    style={{
                      width: 40,
                      textAlign: "center",
                      color:
                        line.type === "added"
                          ? "#10B981"
                          : line.type === "removed"
                            ? "#EF4444"
                            : "#666",
                      padding: "4px 8px",
                      borderRight: "1px solid #333",
                      userSelect: "none",
                    }}
                  >
                    {line.type === "added"
                      ? "+"
                      : line.type === "removed"
                        ? "-"
                        : " "}
                  </td>
                  <td
                    style={{
                      padding: "4px 12px",
                      color:
                        line.type === "added"
                          ? "#10B981"
                          : line.type === "removed"
                            ? "#EF4444"
                            : "#9ca3af",
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-all",
                    }}
                  >
                    <span style={{ color: "#60a5fa" }}>
                      &quot;{line.key}&quot;
                    </span>
                    <span style={{ color: "#9ca3af" }}>: </span>
                    <span>
                      {line.type === "removed" ? line.oldValue : line.newValue}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

const PublicReleasePage: React.FC = () => {
  const { releaseId } = useParams<{ releaseId: string }>();
  const [copied, setCopied] = useState(false);
  const queryClient = useQueryClient();
  const currentUser = useAppStore((state) => state.user);
  const currentUserId = currentUser?.id;

  const {
    data: release,
    isLoading,
    error,
  } = useQuery<ReleaseDetail>({
    queryKey: ["release", releaseId],
    queryFn: async () => {
      if (!releaseId) throw new Error("Release ID is required");
      return apiClient.get(`/releases/${releaseId}`);
    },
    enabled: !!releaseId,
  });

  const isSession = release?.type === "SESSION";

  // 提交审核
  const submitMutation = useMutation({
    mutationFn: async (note?: string) => {
      if (!release?.session?.id || !release?.projectId)
        throw new Error("Session ID and Project ID are required");
      return apiClient.post(
        `/projects/${release.projectId}/release-sessions/${release.session.id}/submit`,
        { note },
      );
    },
    onSuccess: () => {
      message.success("已提交审核");
      queryClient.invalidateQueries({ queryKey: ["release", releaseId] });
    },
    onError: (
      error: Error & { response?: { message?: string; code?: string } },
    ) => {
      const errorMsg = error.response?.message || error.message || "提交失败";
      message.error(errorMsg);
    },
  });

  // 撤回
  const cancelMutation = useMutation({
    mutationFn: async () => {
      if (!release?.session?.id || !release?.projectId)
        throw new Error("Session ID and Project ID are required");
      return apiClient.post(
        `/projects/${release.projectId}/release-sessions/${release.session.id}/cancel`,
      );
    },
    onSuccess: () => {
      message.success("已撤回");
      queryClient.invalidateQueries({ queryKey: ["release", releaseId] });
    },
    onError: (
      error: Error & { response?: { message?: string; code?: string } },
    ) => {
      const errorMsg = error.response?.message || error.message || "撤回失败";
      message.error(errorMsg);
    },
  });

  // 审批通过
  const approveMutation = useMutation({
    mutationFn: async (note?: string) => {
      if (!release?.session?.id || !release?.projectId)
        throw new Error("Session ID and Project ID are required");
      return apiClient.post(
        `/projects/${release.projectId}/release-sessions/${release.session.id}/approve`,
        { note },
      );
    },
    onSuccess: () => {
      message.success("已通过");
      queryClient.invalidateQueries({ queryKey: ["release", releaseId] });
    },
    onError: (
      error: Error & { response?: { message?: string; code?: string } },
    ) => {
      const errorMsg = error.response?.message || error.message || "审批失败";
      message.error(errorMsg);
    },
  });

  // 审批驳回
  const rejectMutation = useMutation({
    mutationFn: async (note?: string) => {
      if (!release?.session?.id || !release?.projectId)
        throw new Error("Session ID and Project ID are required");
      return apiClient.post(
        `/projects/${release.projectId}/release-sessions/${release.session.id}/reject`,
        { note },
      );
    },
    onSuccess: () => {
      message.success("已驳回");
      queryClient.invalidateQueries({ queryKey: ["release", releaseId] });
    },
    onError: (
      error: Error & { response?: { message?: string; code?: string } },
    ) => {
      const errorMsg = error.response?.message || error.message || "驳回失败";
      message.error(errorMsg);
    },
  });

  const handleShare = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleDownload = async (localeCode: string) => {
    if (!releaseId) return;
    try {
      const blob = await apiClient.getBlob(
        `/releases/${releaseId}/artifacts/${localeCode}`,
      );
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${localeCode}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Download failed:", error);
    }
  };

  // 提交审核
  const handleSubmit = () => {
    Modal.confirm({
      title: "提交审核",
      content: (
        <Form>
          <Form.Item label="备注（可选）">
            <Input.TextArea id="submit-note" rows={3} />
          </Form.Item>
        </Form>
      ),
      onOk: async () => {
        const note = (
          document.getElementById("submit-note") as HTMLTextAreaElement
        )?.value;
        submitMutation.mutate(note);
      },
    });
  };

  // 撤回
  const handleCancel = () => {
    Modal.confirm({
      title: "确认撤回",
      content: "撤回后发布单将回到草稿状态，是否继续？",
      onOk: () => cancelMutation.mutate(),
    });
  };

  // 审批通过
  const handleApprove = () => {
    Modal.confirm({
      title: "审批通过",
      content: (
        <Form>
          <Form.Item label="审批意见（可选）">
            <Input.TextArea id="approve-note" rows={3} />
          </Form.Item>
        </Form>
      ),
      onOk: async () => {
        const note = (
          document.getElementById("approve-note") as HTMLTextAreaElement
        )?.value;
        approveMutation.mutate(note);
      },
    });
  };

  // 审批驳回
  const handleReject = () => {
    Modal.confirm({
      title: "审批驳回",
      content: (
        <Form>
          <Form.Item
            label="驳回原因"
            required
            rules={[{ required: true, message: "请输入驳回原因" }]}
          >
            <Input.TextArea id="reject-note" rows={3} />
          </Form.Item>
        </Form>
      ),
      onOk: async () => {
        const note = (
          document.getElementById("reject-note") as HTMLTextAreaElement
        )?.value;
        if (!note) {
          message.error("请输入驳回原因");
          return Promise.reject();
        }
        rejectMutation.mutate(note);
      },
    });
  };

  // 判断是否是创建者
  const isCreator =
    currentUserId &&
    (release?.session?.createdBy === currentUserId ||
      release?.createdByUser?.id === currentUserId);

  // 判断权限
  const canSubmit = release?.canSubmit ?? isCreator ?? false;
  const canCancel = release?.canCancel ?? isCreator ?? false;
  const canApprove = release?.canApprove ?? false;

  // 构建时间线
  const buildTimelineItems = () => {
    if (!release) return [];
    const session = release.session;

    return [
      {
        dot: <EditOutlined style={{ color: "#4F46E5" }} />,
        children: (
          <div>
            <div style={{ fontWeight: 500 }}>创建</div>
            <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>
              {formatDateTime(release.createdAt)}
            </div>
            {release.createdByUser?.name && (
              <div style={{ fontSize: 11, color: "#999", marginTop: 2 }}>
                {release.createdByUser.name}
              </div>
            )}
          </div>
        ),
      },
      session?.submittedAt && {
        dot: <SendOutlined style={{ color: "#F59E0B" }} />,
        children: (
          <div>
            <div style={{ fontWeight: 500 }}>提交审核</div>
            <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>
              {formatDateTime(session.submittedAt)}
            </div>
            {session.submittedBy && (
              <div style={{ fontSize: 11, color: "#999", marginTop: 2 }}>
                {session.submittedBy}
              </div>
            )}
          </div>
        ),
      },
      session?.reviewedAt && {
        dot:
          release.status === "REJECTED" ? (
            <CloseCircleOutlined style={{ color: "#EF4444" }} />
          ) : (
            <CheckCircleOutlined style={{ color: "#10B981" }} />
          ),
        children: (
          <div>
            <div style={{ fontWeight: 500 }}>
              {release.status === "REJECTED" ? "审核驳回" : "审核通过"}
            </div>
            <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>
              {formatDateTime(session.reviewedAt)}
            </div>
            {session.reviewedBy && (
              <div style={{ fontSize: 11, color: "#999", marginTop: 2 }}>
                {session.reviewedBy}
              </div>
            )}
            {session.reviewNote && (
              <div
                style={{
                  marginTop: 8,
                  padding: 8,
                  background:
                    release.status === "REJECTED" ? "#fef2f2" : "#f0fdf4",
                  borderRadius: 4,
                  fontSize: 12,
                  color: release.status === "REJECTED" ? "#991b1b" : "#166534",
                }}
              >
                {session.reviewNote}
              </div>
            )}
          </div>
        ),
      },
      (session?.publishedAt || release.status === "PUBLISHED") && {
        dot: <RocketOutlined style={{ color: "#10B981" }} />,
        children: (
          <div>
            <div style={{ fontWeight: 500 }}>正式发布</div>
            <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>
              {formatDateTime(session?.publishedAt ?? release.publishedAt)}
            </div>
            {session?.publishedBy && (
              <div style={{ fontSize: 11, color: "#999", marginTop: 2 }}>
                {session.publishedBy}
              </div>
            )}
          </div>
        ),
      },
    ].filter(Boolean);
  };

  // 渲染操作按钮
  const renderActionButtons = () => {
    if (!release) return null;

    const buttons = [];

    // 草稿态
    if (release.status === "DRAFT") {
      if (canSubmit) {
        buttons.push(
          <Button
            key="submit"
            type="primary"
            icon={<SendOutlined />}
            onClick={handleSubmit}
            loading={submitMutation.isPending}
          >
            提交审核
          </Button>,
        );
      }
      if (canCancel) {
        buttons.push(
          <Button
            key="cancel"
            icon={<UndoOutlined />}
            onClick={handleCancel}
            loading={cancelMutation.isPending}
          >
            撤回
          </Button>,
        );
      }
    }

    // 待审批态
    if (release.status === "IN_REVIEW") {
      if (canCancel) {
        buttons.push(
          <Button
            key="cancel"
            icon={<UndoOutlined />}
            onClick={handleCancel}
            loading={cancelMutation.isPending}
          >
            撤回
          </Button>,
        );
      }
      if (canApprove) {
        buttons.push(
          <Button
            key="approve"
            type="primary"
            icon={<CheckOutlined />}
            onClick={handleApprove}
            loading={approveMutation.isPending}
          >
            通过
          </Button>,
          <Button
            key="reject"
            danger
            icon={<CloseCircleOutlined />}
            onClick={handleReject}
            loading={rejectMutation.isPending}
          >
            拒绝
          </Button>,
        );
      }
    }

    if (buttons.length === 0) return null;

    return (
      <div
        style={{
          background: "#fff",
          borderRadius: 8,
          padding: 24,
          display: "flex",
          gap: 12,
          justifyContent: "flex-end",
        }}
      >
        {buttons}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          background: "#f5f5f5",
        }}
      >
        <Spin size="large" />
      </div>
    );
  }

  if (error || !release) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          background: "#f5f5f5",
          padding: 24,
        }}
      >
        <Result status="404" title="发布不存在" subTitle="无法找到该发布详情" />
      </div>
    );
  }

  const statusInfo = statusMap[release.status];

  return (
    <div style={{ minHeight: "100vh", background: "#f5f5f5" }}>
      {/* 顶部标题栏 */}
      <div
        style={{
          background: "#fff",
          borderBottom: "1px solid #e5e7eb",
          padding: "16px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>发布单</h1>
          <Badge
            status={statusInfo.color as BadgeProps["status"]}
            text={
              <Space>
                {statusInfo.icon}
                {statusInfo.label}
              </Space>
            }
          />
          {release.createdByUser?.name && (
            <span style={{ fontSize: 13, color: "#666", marginLeft: 8 }}>
              发起人: {release.createdByUser.name}
            </span>
          )}
          {release.owners && release.owners.length > 0 && (
            <span style={{ fontSize: 13, color: "#666" }}>
              审批人:
              {release.owners.map((o) => o.name || "未知").join(", ")}
            </span>
          )}
        </div>
        <Space>
          {!isSession && release.localeCodes.length > 0 && (
            <Button
              icon={<DownloadOutlined />}
              onClick={() => handleDownload(release.localeCodes[0])}
            >
              下载产物
            </Button>
          )}
          <Button icon={<CopyOutlined />} onClick={handleShare}>
            {copied ? "已复制" : "复制链接"}
          </Button>
        </Space>
      </div>

      {/* 主内容区 */}
      <div style={{ padding: 24, maxWidth: 1400, margin: "0 auto" }}>
        <div style={{ display: "flex", gap: 24 }}>
          {/* 左栏：主要内容 */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* 变更内容 */}
            <div
              style={{
                background: "#fff",
                borderRadius: 8,
                padding: 24,
                marginBottom: 16,
              }}
            >
              <h3
                style={{ margin: "0 0 16px 0", fontSize: 15, fontWeight: 600 }}
              >
                变更内容
              </h3>
              <JsonDiff
                baseJson={release.baseJson}
                nextJson={release.nextJson}
              />
            </div>

            {/* 操作按钮 */}
            {renderActionButtons()}
          </div>

          {/* 右栏：时间线 */}
          <div style={{ width: 280, flexShrink: 0 }}>
            <div style={{ background: "#fff", borderRadius: 8, padding: 24 }}>
              <h3
                style={{ margin: "0 0 16px 0", fontSize: 15, fontWeight: 600 }}
              >
                处理进度
              </h3>
              <Timeline items={buildTimelineItems()} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PublicReleasePage;
