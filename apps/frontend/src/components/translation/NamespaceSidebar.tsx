import React from "react";
import { Menu, Button, Empty, Typography, Skeleton } from "antd";
import { PlusOutlined, FolderOutlined } from "@ant-design/icons";

const { Text } = Typography;

interface Namespace {
  id: string;
  name: string;
  description?: string;
}

interface NamespaceSidebarProps {
  namespaces: Namespace[];
  selectedId: string | null;
  isLoading: boolean;
  onSelect: (id: string) => void;
  onCreate: () => void;
}

export const NamespaceSidebar: React.FC<NamespaceSidebarProps> = ({
  namespaces,
  selectedId,
  isLoading,
  onSelect,
  onCreate,
}) => {
  if (isLoading) {
    return (
      <div style={{ padding: "0 16px 16px 0" }}>
        <Skeleton active paragraph={{ rows: 5 }} />
      </div>
    );
  }

  return (
    <div style={{ padding: "0 16px 16px 0" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <Text strong>命名空间</Text>
        <Button
          type="text"
          size="small"
          icon={<PlusOutlined />}
          onClick={onCreate}
        />
      </div>

      <Menu
        mode="inline"
        selectedKeys={selectedId ? [selectedId] : []}
        style={{ borderRight: 0, background: "transparent" }}
        items={namespaces.map((ns) => ({
          key: ns.id,
          label: ns.name,
          icon: <FolderOutlined />,
        }))}
        onClick={({ key }) => onSelect(key)}
      />

      {namespaces.length === 0 && (
        <Empty description="暂无命名空间" image={Empty.PRESENTED_IMAGE_SIMPLE}>
          <Button type="primary" size="small" onClick={onCreate}>
            创建
          </Button>
        </Empty>
      )}
    </div>
  );
};

export default NamespaceSidebar;
