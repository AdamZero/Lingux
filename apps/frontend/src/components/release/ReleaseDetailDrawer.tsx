import React, { useState } from "react";
import type { BadgeProps } from "antd";
import {
  Drawer,
  Tabs,
  Descriptions,
  Badge,
  Timeline,
  Alert,
  Card,
  Button,
  Space,
  Typography,
  Tag,
  Tooltip,
  Modal,
  Form,
  Input,
  message,
} from "antd";
import {
  FileTextOutlined,
  HistoryOutlined,
  DownloadOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  EditOutlined,
  SendOutlined,
  CheckOutlined,
  RocketOutlined,
  ExportOutlined,
  DeleteOutlined,
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import dayjs from "dayjs";
import type { ReleaseSessionStatus } from "@/types/release";

const { TabPane } = Tabs;
const { Text } = Typography;

export interface Release {
  id: string;
  projectId: string;
  basedOnReleaseId: string | null;
  version: number;
  note: string | null;
  scope: {
    type: "all" | "namespaces" | "keys";
    namespaceIds?: string[];
    keyIds?: string[];
  };
  createdAt: string;
  localeCodes: string[];
  // 关联的发布会话信息
  session?: {
    id: string;
    status: ReleaseSessionStatus;
    submittedAt: string | null;
    reviewedAt: string | null;
    reviewNote: string | null;
    publishedAt: string | null;
    createdBy?: string;
  };
  createdBy?: string;
}

interface ReleaseDetailDrawerProps {
  release: Release | null;
  open: boolean;
  onClose: () => void;
  onDownload?: (localeCode: string) => void;
  // 审批操作回调
  onSubmit?: (sessionId: string, note?: string) => Promise<void>;
  onApprove?: (sessionId: string, note?: string) => Promise<void>;
  onReject?: (sessionId: string, reason: string) => Promise<void>;
  onPublish?: (sessionId: string) => Promise<void>;
  onCancel?: (sessionId: string) => Promise<void>;
  // 权限和状态
  canSubmit?: boolean;
  canApprove?: boolean;
  canPublish?: boolean;
  canCancel?: boolean;
  currentUserId?: string;
  // 加载状态
  loading?: boolean;
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

const getScopeLabel = (scope: Release["scope"]): string => {
  switch (scope.type) {
    case "all":
      return "全部词条";
    case "namespaces":
      return `命名空间 (${scope.namespaceIds?.length ?? 0}个)`;
    case "keys":
      return `指定词条 (${scope.keyIds?.length ?? 0}个)`;
    default:
      return "未知";
  }
};

export const ReleaseDetailDrawer: React.FC<ReleaseDetailDrawerProps> = ({
  release,
  open,
  onClose,
  onDownload,
  onSubmit,
  onApprove,
  onReject,
  onPublish,
  onCancel,
  canSubmit = false,
  canApprove = false,
  canPublish = false,
  canCancel = false,
  currentUserId,
  loading = false,
}) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("basic");

  if (!release) return null;

  const handleOpenInNewPage = () => {
    navigate(`/releases/${release.id}`);
  };

  const status = release.session?.status ?? "PUBLISHED";
  const statusInfo = statusMap[status];
  const sessionId = release.session?.id;

  // 判断是否是当前用户的草稿
  const isMyDraft =
    status === "DRAFT" &&
    (release.session?.createdBy === currentUserId ||
      release.createdBy === currentUserId);

  // 提交审核
  const handleSubmit = () => {
    if (!sessionId || !onSubmit) return;
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
        try {
          await onSubmit(sessionId, note);
          message.success("已提交审核");
        } catch {
          // error handled by parent
        }
      },
    });
  };

  // 审批通过
  const handleApprove = () => {
    if (!sessionId || !onApprove) return;
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
        try {
          await onApprove(sessionId, note);
          message.success("审批通过");
        } catch {
          // error handled by parent
        }
      },
    });
  };

  // 驳回
  const handleReject = () => {
    if (!sessionId || !onReject) return;
    Modal.confirm({
      title: "驳回发布",
      content: (
        <Form>
          <Form.Item label="驳回原因" required>
            <Input.TextArea id="reject-reason" rows={3} />
          </Form.Item>
        </Form>
      ),
      okButtonProps: { danger: true },
      onOk: async () => {
        const reason = (
          document.getElementById("reject-reason") as HTMLTextAreaElement
        )?.value;
        if (!reason?.trim()) {
          message.error("请输入驳回原因");
          return Promise.reject();
        }
        try {
          await onReject(sessionId, reason);
          message.success("已驳回");
        } catch {
          // error handled by parent
        }
      },
    });
  };

  // 发布
  const handlePublish = () => {
    if (!sessionId || !onPublish) return;
    Modal.confirm({
      title: "确认发布",
      content: "确定要发布吗？发布后内容将生效。",
      onOk: async () => {
        try {
          await onPublish(sessionId);
          message.success("发布成功");
        } catch {
          // error handled by parent
        }
      },
    });
  };

  // 撤销草稿
  const handleCancel = () => {
    if (!sessionId || !onCancel) return;
    Modal.confirm({
      title: "撤销草稿",
      content: "确定要撤销当前草稿吗？此操作不可恢复。",
      okText: "确定撤销",
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await onCancel(sessionId);
          message.success("草稿已撤销");
          onClose();
        } catch {
          // error handled by parent
        }
      },
    });
  };

  // 构建操作按钮
  const renderActionButtons = () => {
    const buttons = [];

    // 草稿状态：提交审核、撤销
    if (status === "DRAFT") {
      if (canSubmit && isMyDraft) {
        buttons.push(
          <Button
            key="submit"
            type="primary"
            icon={<SendOutlined />}
            onClick={handleSubmit}
            loading={loading}
          >
            提交审核
          </Button>,
        );
      }
      if (canCancel && isMyDraft) {
        buttons.push(
          <Button
            key="cancel"
            danger
            icon={<DeleteOutlined />}
            onClick={handleCancel}
            loading={loading}
          >
            撤销草稿
          </Button>,
        );
      }
    }

    // 审核中状态：通过、驳回
    if (status === "IN_REVIEW") {
      if (canApprove) {
        buttons.push(
          <Button
            key="approve"
            type="primary"
            icon={<CheckOutlined />}
            onClick={handleApprove}
            loading={loading}
          >
            通过
          </Button>,
        );
        buttons.push(
          <Button
            key="reject"
            danger
            icon={<CloseCircleOutlined />}
            onClick={handleReject}
            loading={loading}
          >
            驳回
          </Button>,
        );
      }
    }

    // 已通过状态：发布
    if (status === "APPROVED") {
      if (canPublish) {
        buttons.push(
          <Button
            key="publish"
            type="primary"
            icon={<RocketOutlined />}
            onClick={handlePublish}
            loading={loading}
          >
            发布
          </Button>,
        );
      }
    }

    return buttons;
  };

  // 构建审批历史时间线
  const buildTimelineItems = () => {
    const items = [];
    const session = release.session;

    // 创建
    items.push({
      color: "blue",
      children: (
        <div>
          <Text strong>创建发布</Text>
          <div>
            <Text type="secondary">{formatDateTime(release.createdAt)}</Text>
          </div>
          {release.note && (
            <div style={{ marginTop: 8 }}>
              <Text type="secondary">备注: {release.note}</Text>
            </div>
          )}
        </div>
      ),
    });

    // 提交审核
    if (session?.submittedAt) {
      items.push({
        color: "gold",
        children: (
          <div>
            <Text strong>提交审核</Text>
            <div>
              <Text type="secondary">
                {formatDateTime(session.submittedAt)}
              </Text>
            </div>
          </div>
        ),
      });
    }

    // 审批结果
    if (session?.reviewedAt) {
      const isApproved = status === "APPROVED" || status === "PUBLISHED";
      items.push({
        color: isApproved ? "green" : "red",
        dot: isApproved ? (
          <CheckCircleOutlined style={{ color: "#52c41a" }} />
        ) : (
          <CloseCircleOutlined style={{ color: "#ff4d4f" }} />
        ),
        children: (
          <div>
            <Text strong>{isApproved ? "审核通过" : "审核驳回"}</Text>
            <div>
              <Text type="secondary">{formatDateTime(session.reviewedAt)}</Text>
            </div>
            {session.reviewNote && (
              <Alert
                message={session.reviewNote}
                type={isApproved ? "success" : "error"}
                showIcon
                style={{ marginTop: 8 }}
              />
            )}
          </div>
        ),
      });
    }

    // 发布
    if (session?.publishedAt || status === "PUBLISHED") {
      items.push({
        color: "green",
        dot: <RocketOutlined style={{ color: "#52c41a" }} />,
        children: (
          <div>
            <Text strong>正式发布</Text>
            <div>
              <Text type="secondary">
                {formatDateTime(session?.publishedAt ?? release.createdAt)}
              </Text>
            </div>
            <div style={{ marginTop: 8 }}>
              <Tag color="success">版本 v{release.version}</Tag>
            </div>
          </div>
        ),
      });
    }

    return items;
  };

  const actionButtons = renderActionButtons();

  return (
    <Drawer
      title={`发布详情 - v${release.version}`}
      width={600}
      open={open}
      onClose={onClose}
      destroyOnClose
      extra={
        <Space>
          {actionButtons.length > 0 && <Space>{actionButtons}</Space>}
          <Tooltip title="在新页面打开">
            <Button
              type="text"
              icon={<ExportOutlined />}
              onClick={handleOpenInNewPage}
            >
              打开
            </Button>
          </Tooltip>
        </Space>
      }
    >
      <Tabs activeKey={activeTab} onChange={setActiveTab}>
        <TabPane
          tab={
            <span>
              <FileTextOutlined />
              基本信息
            </span>
          }
          key="basic"
        >
          <Descriptions
            column={1}
            bordered
            size="small"
            labelStyle={{ width: 120, backgroundColor: "#fafafa" }}
          >
            <Descriptions.Item label="版本号">
              <Text strong>v{release.version}</Text>
            </Descriptions.Item>

            <Descriptions.Item label="状态">
              <Badge
                status={statusInfo.color as BadgeProps["status"]}
                text={
                  <Space>
                    {statusInfo.icon}
                    {statusInfo.label}
                  </Space>
                }
              />
            </Descriptions.Item>

            <Descriptions.Item label="发布时间">
              {formatDateTime(release.createdAt)}
            </Descriptions.Item>

            <Descriptions.Item label="发布范围">
              {getScopeLabel(release.scope)}
            </Descriptions.Item>

            <Descriptions.Item label="语言数量">
              {release.localeCodes.length} 种语言
            </Descriptions.Item>

            <Descriptions.Item label="语言列表">
              <Space size={[0, 8]} wrap>
                {release.localeCodes.map((code) => (
                  <Tag key={code} size="small">
                    {code}
                  </Tag>
                ))}
              </Space>
            </Descriptions.Item>

            {release.note && (
              <Descriptions.Item label="发布备注">
                <Text style={{ whiteSpace: "pre-wrap" }}>{release.note}</Text>
              </Descriptions.Item>
            )}

            {release.session?.reviewNote && (
              <Descriptions.Item label="审批意见">
                <Alert
                  message={release.session.reviewNote}
                  type={
                    release.session.status === "REJECTED" ? "error" : "success"
                  }
                  showIcon
                />
              </Descriptions.Item>
            )}

            {release.basedOnReleaseId && (
              <Descriptions.Item label="基于版本">
                <Tag>基于: {release.basedOnReleaseId.slice(0, 8)}...</Tag>
              </Descriptions.Item>
            )}
          </Descriptions>
        </TabPane>

        <TabPane
          tab={
            <span>
              <HistoryOutlined />
              审批历史
            </span>
          }
          key="history"
        >
          <Card size="small" bordered={false}>
            <Timeline items={buildTimelineItems()} mode="left" />
          </Card>
        </TabPane>

        <TabPane
          tab={
            <span>
              <DownloadOutlined />
              产物下载
            </span>
          }
          key="artifacts"
        >
          <Space direction="vertical" style={{ width: "100%" }} size="middle">
            {release.localeCodes.length === 0 ? (
              <Alert
                message="暂无产物"
                description="该发布版本没有可用的语言产物"
                type="info"
                showIcon
              />
            ) : (
              release.localeCodes.map((localeCode) => (
                <Card
                  key={localeCode}
                  size="small"
                  title={
                    <Space>
                      <FileTextOutlined />
                      <Text strong>{localeCode}</Text>
                    </Space>
                  }
                  extra={
                    onDownload && (
                      <Button
                        type="primary"
                        size="small"
                        icon={<DownloadOutlined />}
                        onClick={() => onDownload(localeCode)}
                      >
                        下载
                      </Button>
                    )
                  }
                >
                  <Space
                    direction="vertical"
                    size="small"
                    style={{ width: "100%" }}
                  >
                    <Text type="secondary">文件名: {localeCode}.json</Text>
                    <Text type="secondary">格式: JSON</Text>
                  </Space>
                </Card>
              ))
            )}
          </Space>
        </TabPane>
      </Tabs>
    </Drawer>
  );
};

export default ReleaseDetailDrawer;
