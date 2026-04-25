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
  animated?: boolean;
  showDot?: boolean;
}

const statusConfig: Record<
  TranslationStatus,
  {
    color: string;
    text: string;
    dotColor: string;
    pulse?: boolean;
  }
> = {
  PENDING: {
    color: "default",
    text: "待翻译",
    dotColor: "#d9d9d9",
    pulse: false,
  },
  TRANSLATING: {
    color: "processing",
    text: "翻译中",
    dotColor: "#1890ff",
    pulse: true,
  },
  REVIEWING: {
    color: "warning",
    text: "审核中",
    dotColor: "#faad14",
    pulse: true,
  },
  APPROVED: {
    color: "success",
    text: "已通过",
    dotColor: "#52c41a",
    pulse: false,
  },
  PUBLISHED: {
    color: "blue",
    text: "已发布",
    dotColor: "#1677ff",
    pulse: false,
  },
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  animated = true,
  showDot = false,
}) => {
  const config = statusConfig[status];

  if (showDot) {
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            backgroundColor: config.dotColor,
            animation:
              animated && config.pulse
                ? "pulse 2s ease-in-out infinite"
                : undefined,
          }}
        />
        <span style={{ color: "var(--color-text-secondary)" }}>
          {config.text}
        </span>
      </span>
    );
  }

  return (
    <Tag
      color={config.color}
      className={animated ? "tag-interactive" : undefined}
      style={{
        transition: "all var(--transition-fast)",
        animation: animated ? "fadeIn 0.3s ease-out" : undefined,
      }}
    >
      {config.text}
    </Tag>
  );
};

// Status dot with pulse animation for active states
interface StatusDotProps {
  status: TranslationStatus;
  size?: "small" | "medium" | "large";
}

export const StatusDot: React.FC<StatusDotProps> = ({
  status,
  size = "medium",
}) => {
  const config = statusConfig[status];

  const sizeMap = {
    small: 6,
    medium: 8,
    large: 12,
  };

  const pixelSize = sizeMap[size];

  return (
    <span
      style={{
        display: "inline-block",
        width: pixelSize,
        height: pixelSize,
        borderRadius: "50%",
        backgroundColor: config.dotColor,
        animation: config.pulse ? "pulse 2s ease-in-out infinite" : undefined,
        transition: "transform var(--transition-fast)",
      }}
      className="status-dot"
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "scale(1.2)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "scale(1)";
      }}
    />
  );
};

// Status progress indicator
interface StatusProgressProps {
  current: TranslationStatus;
  showLabel?: boolean;
}

const statusOrder: TranslationStatus[] = [
  "PENDING",
  "TRANSLATING",
  "REVIEWING",
  "APPROVED",
  "PUBLISHED",
];

export const StatusProgress: React.FC<StatusProgressProps> = ({
  current,
  showLabel = true,
}) => {
  const currentIndex = statusOrder.indexOf(current);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
      {statusOrder.map((status, index) => {
        const isActive = index <= currentIndex;
        const isCurrent = index === currentIndex;
        const config = statusConfig[status];

        return (
          <React.Fragment key={status}>
            <div
              style={{
                width: isCurrent ? 12 : 8,
                height: isCurrent ? 12 : 8,
                borderRadius: "50%",
                backgroundColor: isActive
                  ? config.dotColor
                  : "var(--color-border-dark)",
                transition: "all var(--transition-fast)",
                animation:
                  isCurrent && config.pulse
                    ? "pulse 2s ease-in-out infinite"
                    : undefined,
                cursor: "pointer",
              }}
              title={config.text}
            />
            {index < statusOrder.length - 1 && (
              <div
                style={{
                  width: 16,
                  height: 2,
                  backgroundColor:
                    index < currentIndex
                      ? "var(--color-success)"
                      : "var(--color-border-dark)",
                  transition: "background-color var(--transition-fast)",
                }}
              />
            )}
          </React.Fragment>
        );
      })}
      {showLabel && (
        <span
          style={{
            marginLeft: 8,
            fontSize: 12,
            color: "var(--color-text-secondary)",
          }}
        >
          {statusConfig[current].text}
        </span>
      )}
    </div>
  );
};

export default StatusBadge;
