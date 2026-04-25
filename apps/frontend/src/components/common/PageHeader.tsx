import React from "react";
import { Typography, Space, Breadcrumb } from "antd";
import { Link } from "react-router-dom";

const { Title } = Typography;

interface BreadcrumbItem {
  label: string;
  path?: string;
}

interface PageHeaderProps {
  title: string;
  description?: string;
  extra?: React.ReactNode;
  breadcrumb?: BreadcrumbItem[];
  animated?: boolean;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  description,
  extra,
  breadcrumb,
  animated = true,
}) => {
  return (
    <div
      style={{ marginBottom: 12 }}
      className={animated ? "animate-slide-down" : undefined}
    >
      {breadcrumb && (
        <Breadcrumb
          style={{ marginBottom: 8 }}
          className={animated ? "animate-fade-in" : undefined}
        >
          {breadcrumb.map((item, index) => (
            <Breadcrumb.Item key={index}>
              {item.path ? (
                <Link
                  to={item.path}
                  className="link-interactive"
                  style={{ color: "var(--color-primary)", fontSize: 12 }}
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  style={{ color: "var(--color-text-secondary)", fontSize: 12 }}
                >
                  {item.label}
                </span>
              )}
            </Breadcrumb.Item>
          ))}
        </Breadcrumb>
      )}

      <Space
        align="start"
        style={{ justifyContent: "space-between", width: "100%" }}
      >
        <div
          className={animated ? "animate-slide-up" : undefined}
          style={{
            animationDelay: "0.05s",
            animationFillMode: "both",
          }}
        >
          <Title level={5} style={{ margin: 0, fontSize: 16 }}>
            {title}
          </Title>
          {description && (
            <Typography.Text
              type="secondary"
              style={{ fontSize: 12, display: "block", marginTop: 2 }}
            >
              {description}
            </Typography.Text>
          )}
        </div>
        {extra && (
          <div
            className={animated ? "animate-slide-up" : undefined}
            style={{
              animationDelay: "0.1s",
              animationFillMode: "both",
            }}
          >
            {extra}
          </div>
        )}
      </Space>
    </div>
  );
};

export default PageHeader;
