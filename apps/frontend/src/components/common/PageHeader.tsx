import React from "react";
import { Typography, Space } from "antd";

const { Title } = Typography;

interface PageHeaderProps {
  title: string;
  description?: string;
  extra?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  description,
  extra,
}) => {
  return (
    <div style={{ marginBottom: 24 }}>
      <Space
        align="center"
        style={{ justifyContent: "space-between", width: "100%" }}
      >
        <div>
          <Title level={4} style={{ margin: 0 }}>
            {title}
          </Title>
          {description && (
            <Typography.Text type="secondary" style={{ fontSize: 14 }}>
              {description}
            </Typography.Text>
          )}
        </div>
        {extra && <div>{extra}</div>}
      </Space>
    </div>
  );
};

export default PageHeader;
