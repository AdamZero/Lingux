import React from "react";
import { Card, Space } from "antd";

interface SkeletonProps {
  rows?: number;
  avatar?: boolean;
  title?: boolean;
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  rows = 3,
  avatar = false,
  title = false,
  className = "",
}) => {
  return (
    <div className={`skeleton-container ${className}`}>
      <Space direction="vertical" style={{ width: "100%" }} size="middle">
        {title && (
          <div
            className="skeleton-shimmer"
            style={{
              height: 24,
              width: "40%",
              borderRadius: 4,
            }}
          />
        )}
        {avatar && (
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <div
              className="skeleton-shimmer"
              style={{
                width: 40,
                height: 40,
                borderRadius: "50%",
              }}
            />
            <div style={{ flex: 1 }}>
              <div
                className="skeleton-shimmer"
                style={{
                  height: 16,
                  width: "60%",
                  borderRadius: 4,
                  marginBottom: 8,
                }}
              />
              <div
                className="skeleton-shimmer"
                style={{
                  height: 12,
                  width: "40%",
                  borderRadius: 4,
                }}
              />
            </div>
          </div>
        )}
        {Array.from({ length: rows }).map((_, index) => (
          <div
            key={index}
            className="skeleton-shimmer"
            style={{
              height: 16,
              width: index === rows - 1 ? "60%" : "100%",
              borderRadius: 4,
              animationDelay: `${index * 0.1}s`,
            }}
          />
        ))}
      </Space>
    </div>
  );
};

interface CardSkeletonProps {
  count?: number;
  className?: string;
}

export const CardSkeleton: React.FC<CardSkeletonProps> = ({
  count = 1,
  className = "",
}) => {
  return (
    <div className={`card-skeleton-container ${className}`}>
      {Array.from({ length: count }).map((_, index) => (
        <Card
          key={index}
          className="card-interactive"
          style={{
            marginBottom: 16,
            opacity: 0,
            animation: `fadeIn 0.3s ease-out ${index * 0.1}s forwards`,
          }}
        >
          <div
            className="skeleton-shimmer"
            style={{
              height: 20,
              width: "70%",
              borderRadius: 4,
              marginBottom: 16,
            }}
          />
          <div
            className="skeleton-shimmer"
            style={{
              height: 16,
              width: "100%",
              borderRadius: 4,
              marginBottom: 8,
            }}
          />
          <div
            className="skeleton-shimmer"
            style={{
              height: 16,
              width: "80%",
              borderRadius: 4,
            }}
          />
        </Card>
      ))}
    </div>
  );
};

interface TableSkeletonProps {
  rows?: number;
  columns?: number;
  className?: string;
}

export const TableSkeleton: React.FC<TableSkeletonProps> = ({
  rows = 5,
  columns = 4,
  className = "",
}) => {
  return (
    <div className={`table-skeleton-container ${className}`}>
      {/* Header */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${columns}, 1fr)`,
          gap: 16,
          padding: "16px",
          backgroundColor: "var(--color-surface-hover)",
          borderRadius: "8px 8px 0 0",
          marginBottom: 1,
        }}
      >
        {Array.from({ length: columns }).map((_, index) => (
          <div
            key={`header-${index}`}
            className="skeleton-shimmer"
            style={{
              height: 16,
              width: "70%",
              borderRadius: 4,
            }}
          />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div
          key={`row-${rowIndex}`}
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${columns}, 1fr)`,
            gap: 16,
            padding: "16px",
            backgroundColor: "var(--color-surface)",
            borderBottom: "1px solid var(--color-border)",
            opacity: 0,
            animation: `fadeIn 0.3s ease-out ${rowIndex * 0.05}s forwards`,
          }}
        >
          {Array.from({ length: columns }).map((_, colIndex) => (
            <div
              key={`cell-${rowIndex}-${colIndex}`}
              className="skeleton-shimmer"
              style={{
                height: 16,
                width: colIndex === 0 ? "80%" : "60%",
                borderRadius: 4,
                animationDelay: `${(rowIndex * columns + colIndex) * 0.02}s`,
              }}
            />
          ))}
        </div>
      ))}
    </div>
  );
};

interface ListSkeletonProps {
  items?: number;
  className?: string;
}

export const ListSkeleton: React.FC<ListSkeletonProps> = ({
  items = 5,
  className = "",
}) => {
  return (
    <div className={`list-skeleton-container ${className}`}>
      {Array.from({ length: items }).map((_, index) => (
        <div
          key={index}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "12px 0",
            borderBottom: "1px solid var(--color-border)",
            opacity: 0,
            animation: `slideUp 0.3s ease-out ${index * 0.05}s forwards`,
          }}
        >
          <div
            className="skeleton-shimmer"
            style={{
              width: 40,
              height: 40,
              borderRadius: 8,
              flexShrink: 0,
            }}
          />
          <div style={{ flex: 1 }}>
            <div
              className="skeleton-shimmer"
              style={{
                height: 16,
                width: "60%",
                borderRadius: 4,
                marginBottom: 8,
              }}
            />
            <div
              className="skeleton-shimmer"
              style={{
                height: 12,
                width: "40%",
                borderRadius: 4,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
};

export default Skeleton;
