import React from "react";
import { Modal, Typography, Tag, Space } from "antd";
import { ToolOutlined } from "@ant-design/icons";

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
    >
      <Space
        direction="vertical"
        align="center"
        style={{ width: "100%", padding: "20px 0" }}
      >
        <ToolOutlined style={{ fontSize: 48, color: "#1890ff" }} />
        <Title level={4} style={{ margin: 0 }}>
          {title}
        </Title>
        {description && <Text type="secondary">{description}</Text>}
        {eta && <Tag color="blue">预计 {eta} 上线</Tag>}
      </Space>
    </Modal>
  );
};

export default ComingSoonModal;
