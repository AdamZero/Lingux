import React from "react";
import {
  Drawer,
  Form,
  Input,
  Button,
  Space,
  Tag,
  Typography,
  Badge,
} from "antd";
import { GlobalOutlined } from "@ant-design/icons";
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
  reviewComment?: string;
}

interface Key {
  id: string;
  name: string;
  translations: Translation[];
}

interface TranslationDrawerProps {
  open: boolean;
  editingKey: Key | null;
  locales: Locale[];
  isSaving: boolean;
  onClose: () => void;
  onSave: (values: Record<string, string>) => void;
}

const statusConfig: Record<
  TranslationStatus,
  {
    color: string;
    text: string;
    badgeStatus: "default" | "processing" | "warning" | "success" | "error";
    icon: React.ReactNode;
  }
> = {
  PENDING: {
    color: "default",
    text: "待翻译",
    badgeStatus: "default",
    icon: <GlobalOutlined />,
  },
  TRANSLATING: {
    color: "processing",
    text: "翻译中",
    badgeStatus: "processing",
    icon: <GlobalOutlined />,
  },
  REVIEWING: {
    color: "warning",
    text: "审核中",
    badgeStatus: "warning",
    icon: <GlobalOutlined />,
  },
  APPROVED: {
    color: "success",
    text: "已通过",
    badgeStatus: "success",
    icon: <GlobalOutlined />,
  },
  PUBLISHED: {
    color: "blue",
    text: "已发布",
    badgeStatus: "success",
    icon: <GlobalOutlined />,
  },
};

export const TranslationDrawer: React.FC<TranslationDrawerProps> = ({
  open,
  editingKey,
  locales,
  isSaving,
  onClose,
  onSave,
}) => {
  const [form] = Form.useForm();

  React.useEffect(() => {
    if (editingKey && open) {
      const initialValues: Record<string, string> = {};
      editingKey.translations.forEach((t) => {
        initialValues[t.locale.code] = t.content;
      });
      form.setFieldsValue(initialValues);
    }
  }, [editingKey, open, form]);

  if (!editingKey) return null;

  const getStatusProgress = () => {
    const total = editingKey.translations.length;
    if (total === 0) return 0;
    const published = editingKey.translations.filter(
      (t) => t.status === "PUBLISHED",
    ).length;
    const approved = editingKey.translations.filter(
      (t) => t.status === "APPROVED",
    ).length;
    return Math.round(((published + approved) / total) * 100);
  };

  const progress = getStatusProgress();

  return (
    <Drawer
      title={
        <div className="animate-slide-down">
          <Space direction="vertical" style={{ width: "100%" }} size="small">
            <Text strong style={{ fontSize: 16 }}>
              翻译: {editingKey.name}
            </Text>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div
                style={{
                  flex: 1,
                  height: 4,
                  backgroundColor: "var(--color-border)",
                  borderRadius: 2,
                  overflow: "hidden",
                }}
              >
                <div
                  className="animate-slide-in-right"
                  style={{
                    width: `${progress}%`,
                    height: "100%",
                    backgroundColor:
                      progress === 100
                        ? "var(--color-success)"
                        : "var(--color-primary)",
                    borderRadius: 2,
                    transition: "width var(--transition-slow) var(--ease-out)",
                  }}
                />
              </div>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {progress}%
              </Text>
            </div>
          </Space>
        </div>
      }
      width={600}
      onClose={onClose}
      open={open}
      destroyOnClose={false}
      className="translation-drawer"
      styles={{
        body: {
          padding: "12px 16px",
        },
        header: {
          borderBottom: "1px solid var(--color-border)",
        },
        footer: {
          borderTop: "1px solid var(--color-border)",
        },
      }}
      footer={
        <div
          className="animate-slide-up"
          style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}
        >
          <Button onClick={onClose} className="btn-interactive">
            取消
          </Button>
          <Button
            type="primary"
            onClick={() => form.submit()}
            loading={isSaving}
            className="btn-interactive"
          >
            保存
          </Button>
        </div>
      }
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={onSave}
        className="animate-fade-in"
      >
        <Space direction="vertical" style={{ width: "100%" }} size="small">
          {locales.map((locale, index) => {
            const translation = editingKey.translations.find(
              (t) => t.locale.code === locale.code,
            );
            const status = translation?.status || "PENDING";
            const config = statusConfig[status];

            return (
              <div
                key={locale.code}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "8px 12px",
                  border: "1px solid var(--color-border)",
                  borderRadius: "var(--radius-md)",
                  backgroundColor: "var(--color-bg-container)",
                  opacity: 0,
                  animation: `slideUp 0.3s ease-out ${index * 0.05}s forwards`,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    minWidth: 120,
                    flexShrink: 0,
                  }}
                >
                  <Badge status={config.badgeStatus} />
                  <Text strong>{locale.code}</Text>
                  <Tag
                    size="small"
                    color={config.color}
                    style={{ fontSize: 11 }}
                  >
                    {config.text}
                  </Tag>
                </div>
                <div style={{ flex: 1 }}>
                  <Form.Item name={locale.code} style={{ marginBottom: 0 }}>
                    <Input
                      placeholder={`输入 ${locale.name} 的翻译...`}
                      className="input-interactive"
                      style={{
                        transition: "all var(--transition-fast)",
                      }}
                    />
                  </Form.Item>
                </div>
              </div>
            );
          })}
        </Space>
      </Form>
    </Drawer>
  );
};

export default TranslationDrawer;
