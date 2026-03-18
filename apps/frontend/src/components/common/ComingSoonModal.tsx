import React from "react";
import { Modal, Typography, Tag, Space } from "antd";
import { ToolOutlined, ClockCircleOutlined } from "@ant-design/icons";

const { Title, Text } = Typography;

interface ComingSoonModalProps {
  open: boolean;
  title: string;
  description?: string;
  eta?: string;
  onClose: () => void;
}

export const ComingSoonModal: React.FC<ComingSoonModalProps> = ({
  open,
  title,
  description,
  eta,
  onClose,
}) => {
  return (
    <Modal
      open={open}
      onCancel={onClose}
      onOk={onClose}
      okText="知道了"
      cancelButtonProps={{ style: { display: "none" } }}
      centered
      className="coming-soon-modal"
      styles={{
        content: {
          borderRadius: "var(--radius-xl)",
          overflow: "hidden",
        },
      }}
    >
      <Space
        direction="vertical"
        align="center"
        style={{ width: "100%", padding: "20px 0" }}
        className="animate-scale-in"
      >
        <div
          className="animate-bounce"
          style={{
            width: 80,
            height: 80,
            borderRadius: "50%",
            background: "linear-gradient(135deg, #1890ff 0%, #36cfc9 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 8px 24px rgba(24, 144, 255, 0.3)",
          }}
        >
          <ToolOutlined style={{ fontSize: 36, color: "#fff" }} />
        </div>

        <div
          className="animate-slide-up"
          style={{
            textAlign: "center",
            animationDelay: "0.1s",
            animationFillMode: "both",
          }}
        >
          <Title level={4} style={{ margin: "16px 0 8px" }}>
            {title}
          </Title>
          {description && (
            <Text
              type="secondary"
              style={{ display: "block", marginBottom: 16 }}
            >
              {description}
            </Text>
          )}
        </div>

        {eta && (
          <div
            className="animate-slide-up"
            style={{
              animationDelay: "0.2s",
              animationFillMode: "both",
            }}
          >
            <Tag
              color="blue"
              icon={<ClockCircleOutlined />}
              style={{
                padding: "4px 12px",
                fontSize: 14,
              }}
            >
              预计 {eta} 上线
            </Tag>
          </div>
        )}
      </Space>
    </Modal>
  );
};

export default ComingSoonModal;
