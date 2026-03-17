import React from "react";
import { Table, Button, Space, Tag, Tooltip, Typography, Modal } from "antd";
import { EditOutlined, DeleteOutlined } from "@ant-design/icons";
import type { TranslationStatus } from "@/components/common/StatusBadge";

const { Text } = Typography;

interface Locale {
  code: string;
  name: string;
}

interface Translation {
  id: string;
  content: string;
  status: TranslationStatus;
  locale: Locale;
}

interface Key {
  id: string;
  name: string;
  description?: string;
  type: "TEXT" | "RICH_TEXT" | "ASSET";
  translations: Translation[];
}

interface KeysTableProps {
  keys: Key[];
  locales: Locale[];
  isLoading: boolean;
  deletingKeyId: string | null;
  onEdit: (key: Key) => void;
  onDelete: (key: Key) => void;
}

const statusColorMap: Record<TranslationStatus, string> = {
  PENDING: "default",
  TRANSLATING: "processing",
  REVIEWING: "warning",
  APPROVED: "success",
  PUBLISHED: "blue",
};

export const KeysTable: React.FC<KeysTableProps> = ({
  keys,
  locales,
  isLoading,
  deletingKeyId,
  onEdit,
  onDelete,
}) => {
  const columns = [
    {
      title: "词条名称",
      dataIndex: "name",
      key: "name",
      width: "20%",
      render: (text: string, record: Key) => (
        <div>
          <Text strong style={{ display: "block" }}>
            {text}
          </Text>
          {record.description && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              {record.description}
            </Text>
          )}
        </div>
      ),
    },
    {
      title: "翻译预览",
      key: "translations",
      render: (_: unknown, record: Key) => (
        <Space wrap>
          {locales.map((locale) => {
            const translation = record.translations.find(
              (t) => t.locale.code === locale.code,
            );
            const color = translation
              ? statusColorMap[translation.status]
              : "error";

            return (
              <Tooltip
                key={locale.code}
                title={translation?.content || "无翻译"}
              >
                <Tag color={color}>{locale.code}</Tag>
              </Tooltip>
            );
          })}
        </Space>
      ),
    },
    {
      title: "操作",
      key: "action",
      width: 150,
      render: (_: unknown, record: Key) => (
        <Space>
          <Button
            type="primary"
            ghost
            size="small"
            icon={<EditOutlined />}
            onClick={() => onEdit(record)}
          >
            翻译
          </Button>
          <Button
            type="text"
            danger
            size="small"
            icon={<DeleteOutlined />}
            loading={deletingKeyId === record.id}
            onClick={() => {
              Modal.confirm({
                title: "删除词条",
                content: `确定要删除 "${record.name}" 吗？`,
                okText: "删除",
                okButtonProps: { danger: true },
                onOk: () => onDelete(record),
              });
            }}
          />
        </Space>
      ),
    },
  ];

  return (
    <Table
      columns={columns}
      dataSource={keys}
      rowKey="id"
      loading={isLoading}
      pagination={{ pageSize: 10 }}
    />
  );
};

export default KeysTable;
