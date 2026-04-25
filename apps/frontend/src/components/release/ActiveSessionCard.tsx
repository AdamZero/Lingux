import React from "react";
import { useNavigate } from "react-router-dom";
import { Button, Card, Descriptions, Space, Badge } from "antd";
import { UserOutlined, EyeOutlined } from "@ant-design/icons";
import type { ReleaseSession, ReleaseSessionStatus } from "@/types/release";

interface ActiveSessionCardProps {
  session: ReleaseSession;
  currentUserId?: string;
}

const statusMap: Record<
  ReleaseSessionStatus,
  {
    label: string;
    status: "default" | "processing" | "success" | "error" | "warning";
  }
> = {
  DRAFT: { label: "草稿", status: "default" },
  IN_REVIEW: { label: "审核中", status: "processing" },
  APPROVED: { label: "已通过", status: "success" },
  REJECTED: { label: "已驳回", status: "error" },
  PUBLISHED: { label: "已发布", status: "success" },
  EXPIRED: { label: "已过期", status: "warning" },
};

const ActiveSessionCard: React.FC<ActiveSessionCardProps> = ({
  session,
  currentUserId,
}) => {
  const navigate = useNavigate();
  const statusInfo = statusMap[session.status];

  // 判断是否是当前用户的草稿
  const isMyDraft = session.createdBy === currentUserId;
  // 是否是他人草稿（有创建者信息且不是当前用户）
  const isOtherDraft = session.createdBy && session.createdBy !== currentUserId;

  const handleViewDetail = () => {
    // 统一跳转到 /releases/:id，后端自动判断类型
    navigate(`/releases/${session.id}`);
  };

  return (
    <Card
      title={
        <Space>
          <span>当前发布会话</span>
          <Badge status={statusInfo.status} text={statusInfo.label} />
        </Space>
      }
      extra={
        <Button type="link" icon={<EyeOutlined />} onClick={handleViewDetail}>
          查看详情
        </Button>
      }
    >
      <Descriptions column={2} size="small">
        <Descriptions.Item label="会话 ID">{session.id}</Descriptions.Item>
        <Descriptions.Item label="基准版本">
          {session.baseReleaseId ?? "无"}
        </Descriptions.Item>
        {session.createdByUser && (
          <Descriptions.Item label="创建人">
            <Space>
              <UserOutlined />
              <span>
                {session.createdByUser.name}
                {isMyDraft && (
                  <Badge
                    count="我"
                    style={{
                      backgroundColor: "#10B981",
                      fontSize: "10px",
                      marginLeft: "8px",
                    }}
                  />
                )}
                {isOtherDraft && (
                  <Badge
                    count="他人"
                    style={{
                      backgroundColor: "#F59E0B",
                      fontSize: "10px",
                      marginLeft: "8px",
                    }}
                  />
                )}
              </span>
            </Space>
          </Descriptions.Item>
        )}
        {session.localeCodes && session.localeCodes.length > 0 && (
          <Descriptions.Item label="目标语言">
            {session.localeCodes.join(", ")}
          </Descriptions.Item>
        )}
        {session.note && (
          <Descriptions.Item label="备注">{session.note}</Descriptions.Item>
        )}
        {session.reviewNote && (
          <Descriptions.Item label="审核备注">
            {session.reviewNote}
          </Descriptions.Item>
        )}
      </Descriptions>
    </Card>
  );
};

export default ActiveSessionCard;
