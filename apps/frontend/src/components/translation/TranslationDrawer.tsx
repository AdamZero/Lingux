import React from "react";
import { Drawer, Form, Input, Button, Space, Tag, Typography } from "antd";
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
  onSubmitReview: (keyId: string, localeCode: string) => void;
  onApprove: (keyId: string, localeCode: string) => void;
  onReject: (keyId: string, localeCode: string) => void;
  onPublish: (keyId: string, localeCode: string) => void;
}

const statusConfig: Record<TranslationStatus, { color: string; text: string }> =
  {
    PENDING: { color: "default", text: "待翻译" },
    TRANSLATING: { color: "processing", text: "翻译中" },
    REVIEWING: { color: "warning", text: "审核中" },
    APPROVED: { color: "success", text: "已通过" },
    PUBLISHED: { color: "blue", text: "已发布" },
  };

export const TranslationDrawer: React.FC<TranslationDrawerProps> = ({
  open,
  editingKey,
  locales,
  isSaving,
  onClose,
  onSave,
  onSubmitReview,
  onApprove,
  onReject,
  onPublish,
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

  return (
    <Drawer
      title={`翻译: ${editingKey.name}`}
      width={600}
      onClose={onClose}
      open={open}
      extra={
        <Space>
          <Button onClick={onClose}>取消</Button>
          <Button
            type="primary"
            onClick={() => form.submit()}
            loading={isSaving}
          >
            保存
          </Button>
        </Space>
      }
    >
      <Form form={form} layout="vertical" onFinish={onSave}>
        {locales.map((locale) => {
          const translation = editingKey.translations.find(
            (t) => t.locale.code === locale.code,
          );
          const status = translation?.status || "PENDING";
          const config = statusConfig[status];

          return (
            <Form.Item
              key={locale.code}
              name={locale.code}
              label={
                <Space>
                  <GlobalOutlined />
                  {locale.name} ({locale.code})
                  <Tag color={config.color}>{config.text}</Tag>
                </Space>
              }
            >
              <Input.TextArea
                rows={3}
                placeholder={`输入 ${locale.name} 的翻译...`}
              />
              {translation?.reviewComment && (
                <div style={{ marginTop: 8 }}>
                  <Text type="danger">
                    审核意见: {translation.reviewComment}
                  </Text>
                </div>
              )}
              <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
                {translation && (
                  <>
                    {translation.status === "PENDING" && (
                      <Button
                        size="small"
                        onClick={() =>
                          onSubmitReview(editingKey.id, locale.code)
                        }
                      >
                        提交审核
                      </Button>
                    )}
                    {translation.status === "REVIEWING" && (
                      <>
                        <Button
                          size="small"
                          type="primary"
                          onClick={() => onApprove(editingKey.id, locale.code)}
                        >
                          通过
                        </Button>
                        <Button
                          size="small"
                          danger
                          onClick={() => onReject(editingKey.id, locale.code)}
                        >
                          驳回
                        </Button>
                      </>
                    )}
                    {translation.status === "APPROVED" && (
                      <Button
                        size="small"
                        type="primary"
                        onClick={() => onPublish(editingKey.id, locale.code)}
                      >
                        发布
                      </Button>
                    )}
                  </>
                )}
              </div>
            </Form.Item>
          );
        })}
      </Form>
    </Drawer>
  );
};

export default TranslationDrawer;
