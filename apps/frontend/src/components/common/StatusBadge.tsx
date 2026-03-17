import React from "react";
import { Tag } from "antd";

export type TranslationStatus =
  | "PENDING"
  | "TRANSLATING"
  | "REVIEWING"
  | "APPROVED"
  | "PUBLISHED";

interface StatusBadgeProps {
  status: TranslationStatus;
}

const statusConfig: Record<TranslationStatus, { color: string; text: string }> =
  {
    PENDING: { color: "default", text: "待翻译" },
    TRANSLATING: { color: "processing", text: "翻译中" },
    REVIEWING: { color: "warning", text: "审核中" },
    APPROVED: { color: "success", text: "已通过" },
    PUBLISHED: { color: "blue", text: "已发布" },
  };

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const config = statusConfig[status];
  return <Tag color={config.color}>{config.text}</Tag>;
};

export default StatusBadge;
