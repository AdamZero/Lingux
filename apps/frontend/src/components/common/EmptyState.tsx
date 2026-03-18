import React from "react";
import { Empty, Typography } from "antd";
import {
  InboxOutlined,
  LockOutlined,
  WifiOutlined,
  SearchOutlined,
  ToolOutlined,
} from "@ant-design/icons";

const { Text } = Typography;

export type EmptyType =
  | "no-data"
  | "no-permission"
  | "no-network"
  | "no-result"
  | "construction";

interface EmptyStateProps {
  type: EmptyType;
  title?: string;
  description?: string;
  action?: React.ReactNode;
}

const emptyConfig: Record<
  EmptyType,
  { icon: React.ReactNode; defaultTitle: string; defaultDescription: string }
> = {
  "no-data": {
    icon: <InboxOutlined style={{ fontSize: 64, color: "#d9d9d9" }} />,
    defaultTitle: "暂无数据",
    defaultDescription: "还没有任何数据，开始创建吧",
  },
  "no-permission": {
    icon: <LockOutlined style={{ fontSize: 64, color: "#ff4d4f" }} />,
    defaultTitle: "无权限访问",
    defaultDescription: "您没有权限查看此页面",
  },
  "no-network": {
    icon: <WifiOutlined style={{ fontSize: 64, color: "#faad14" }} />,
    defaultTitle: "网络异常",
    defaultDescription: "请检查网络连接后重试",
  },
  "no-result": {
    icon: <SearchOutlined style={{ fontSize: 64, color: "#d9d9d9" }} />,
    defaultTitle: "搜索无结果",
    defaultDescription: "没有找到匹配的内容，请调整搜索条件",
  },
  construction: {
    icon: <ToolOutlined style={{ fontSize: 64, color: "#1890ff" }} />,
    defaultTitle: "功能开发中",
    defaultDescription: "该功能正在开发中，敬请期待",
  },
};

export const EmptyState: React.FC<EmptyStateProps> = ({
  type,
  title,
  description,
  action,
}) => {
  const config = emptyConfig[type];

  return (
    <Empty
      image={config.icon}
      description={
        <div>
          <Text
            strong
            style={{ fontSize: 16, display: "block", marginBottom: 8 }}
          >
            {title || config.defaultTitle}
          </Text>
          <Text type="secondary">
            {description || config.defaultDescription}
          </Text>
          {action && <div style={{ marginTop: 16 }}>{action}</div>}
        </div>
      }
    />
  );
};

export default EmptyState;
