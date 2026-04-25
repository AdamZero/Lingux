import { Card, Typography } from "antd";
import { ReactNode } from "react";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: ReactNode;
}

export const StatCard: React.FC<StatCardProps> = ({ title, value, icon }) => {
  return (
    <Card>
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <div style={{ fontSize: 24, color: "#4F46E5" }}>{icon}</div>
        <div>
          <Typography.Text type="secondary" style={{ fontSize: 14 }}>
            {title}
          </Typography.Text>
          <div style={{ fontSize: 24, fontWeight: "bold", marginTop: 4 }}>
            {value}
          </div>
        </div>
      </div>
    </Card>
  );
};
