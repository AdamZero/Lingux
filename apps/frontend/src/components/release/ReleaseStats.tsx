import React from "react";
import { Card, Statistic, Row, Col } from "antd";
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  FileTextOutlined,
} from "@ant-design/icons";

interface Release {
  id: string;
  status: "PUBLISHED" | "REVIEWING" | "DRAFT";
  [key: string]: unknown;
}

interface ReleaseStatsProps {
  releases: Release[];
}

const ReleaseStats: React.FC<ReleaseStatsProps> = ({ releases }) => {
  const publishedCount = releases.filter(
    (r) => r.status === "PUBLISHED",
  ).length;
  const reviewingCount = releases.filter(
    (r) => r.status === "REVIEWING",
  ).length;
  const draftCount = releases.filter((r) => r.status === "DRAFT").length;

  return (
    <Row gutter={16}>
      <Col span={8}>
        <Card>
          <Statistic
            title="已发布数量"
            value={publishedCount}
            valueStyle={{ color: "#10B981" }}
            prefix={<CheckCircleOutlined />}
          />
        </Card>
      </Col>
      <Col span={8}>
        <Card>
          <Statistic
            title="审核中数量"
            value={reviewingCount}
            valueStyle={{ color: "#F59E0B" }}
            prefix={<ClockCircleOutlined />}
          />
        </Card>
      </Col>
      <Col span={8}>
        <Card>
          <Statistic
            title="草稿数量"
            value={draftCount}
            valueStyle={{ color: "#3B82F6" }}
            prefix={<FileTextOutlined />}
          />
        </Card>
      </Col>
    </Row>
  );
};

export default ReleaseStats;
