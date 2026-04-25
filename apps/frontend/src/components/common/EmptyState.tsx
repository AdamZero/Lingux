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
  animated?: boolean;
}

const emptyConfig: Record<
  EmptyType,
  {
    icon: React.ReactNode;
    defaultTitle: string;
    defaultDescription: string;
    animation: string;
  }
> = {
  "no-data": {
    icon: <InboxOutlined style={{ fontSize: 64 }} />,
    defaultTitle: "暂无数据",
    defaultDescription: "还没有任何数据，开始创建吧",
    animation: "animate-bounce",
  },
  "no-permission": {
    icon: <LockOutlined style={{ fontSize: 64 }} />,
    defaultTitle: "无权限访问",
    defaultDescription: "您没有权限查看此页面",
    animation: "animate-pulse",
  },
  "no-network": {
    icon: <WifiOutlined style={{ fontSize: 64 }} />,
    defaultTitle: "网络异常",
    defaultDescription: "请检查网络连接后重试",
    animation: "animate-pulse",
  },
  "no-result": {
    icon: <SearchOutlined style={{ fontSize: 64 }} />,
    defaultTitle: "搜索无结果",
    defaultDescription: "没有找到匹配的内容，请调整搜索条件",
    animation: "animate-bounce",
  },
  construction: {
    icon: <ToolOutlined style={{ fontSize: 64 }} />,
    defaultTitle: "功能开发中",
    defaultDescription: "该功能正在开发中，敬请期待",
    animation: "animate-bounce",
  },
};

const getIconColor = (type: EmptyType, isDark: boolean): string => {
  const colors: Record<EmptyType, { light: string; dark: string }> = {
    "no-data": { light: "#d9d9d9", dark: "#4B5563" },
    "no-permission": { light: "#ff4d4f", dark: "#ff7875" },
    "no-network": { light: "#faad14", dark: "#ffc53d" },
    "no-result": { light: "#d9d9d9", dark: "#4B5563" },
    construction: { light: "#1890ff", dark: "#40a9ff" },
  };
  return isDark ? colors[type].dark : colors[type].light;
};

export const EmptyState: React.FC<EmptyStateProps> = ({
  type,
  title,
  description,
  action,
  animated = true,
}) => {
  const config = emptyConfig[type];
  const [isDark, setIsDark] = React.useState(false);

  React.useEffect(() => {
    const checkTheme = () => {
      const theme = document.documentElement.getAttribute("data-theme");
      setIsDark(theme === "dark");
    };
    checkTheme();

    const observer = new MutationObserver(checkTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });

    return () => observer.disconnect();
  }, []);

  const iconColor = getIconColor(type, isDark);

  const iconWithStyle = React.cloneElement(config.icon as React.ReactElement, {
    style: {
      fontSize: 64,
      color: iconColor,
      transition: "color var(--transition-normal)",
    },
    className: animated ? config.animation : undefined,
  });

  return (
    <div
      className="animate-scale-in"
      style={{
        padding: "40px 20px",
        textAlign: "center",
      }}
    >
      <Empty
        image={iconWithStyle}
        description={
          <div
            className={animated ? "animate-slide-up" : undefined}
            style={{ animationDelay: "0.1s", animationFillMode: "both" }}
          >
            <Text
              strong
              style={{
                fontSize: 16,
                display: "block",
                marginBottom: 8,
                color: "var(--color-text-primary)",
              }}
            >
              {title || config.defaultTitle}
            </Text>
            <Text
              type="secondary"
              style={{
                display: "block",
                marginBottom: action ? 16 : 0,
              }}
            >
              {description || config.defaultDescription}
            </Text>
            {action && (
              <div
                className={animated ? "animate-slide-up" : undefined}
                style={{
                  marginTop: 16,
                  animationDelay: "0.2s",
                  animationFillMode: "both",
                }}
              >
                {action}
              </div>
            )}
          </div>
        }
      />
    </div>
  );
};

export default EmptyState;
