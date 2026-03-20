import React, { useState } from "react";
import {
  Drawer,
  Form,
  Input,
  Button,
  Space,
  Tag,
  Typography,
  Badge,
  message,
} from "antd";
import { GlobalOutlined, ThunderboltOutlined } from "@ant-design/icons";
import type { TranslationStatus } from "@/components/common/StatusBadge";
import { MachineTranslateButton } from "./MachineTranslateButton";
import {
  translateBatch,
  getTranslationProviders,
} from "@/api/machine-translation";

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
  baseLocale: string;
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
  baseLocale,
  isSaving,
  onClose,
  onSave,
}) => {
  const [form] = Form.useForm();
  const [isTranslating, setIsTranslating] = useState(false);

  // 重置表单并设置初始值
  React.useEffect(() => {
    if (open && editingKey) {
      // 先重置表单
      form.resetFields();
      // 设置新的初始值
      const initialValues: Record<string, string> = {};
      (editingKey.translations || []).forEach((t) => {
        initialValues[t.locale.code] = t.content;
      });
      // 使用 setTimeout 确保重置完成后再设置值
      setTimeout(() => {
        form.setFieldsValue(initialValues);
      }, 0);
    }
  }, [editingKey?.id, open, form]);

  if (!editingKey) return null;

  const getStatusProgress = () => {
    const translations = editingKey.translations || [];
    const total = translations.length;
    if (total === 0) return 0;
    const published = translations.filter(
      (t) => t.status === "PUBLISHED",
    ).length;
    const approved = translations.filter((t) => t.status === "APPROVED").length;
    return Math.round(((published + approved) / total) * 100);
  };

  const progress = getStatusProgress();

  // 获取缺失翻译的目标语言
  const getMissingTranslations = () => {
    const translations = editingKey?.translations || [];
    return locales.filter((locale) => {
      if (locale.code === baseLocale) return false;
      const translation = translations.find(
        (t) => t.locale.code === locale.code,
      );
      return !translation?.content;
    });
  };

  // 一键翻译缺失内容
  const handleTranslateMissing = async () => {
    const missingLocales = getMissingTranslations();
    if (missingLocales.length === 0) {
      message.info("没有需要翻译的缺失内容");
      return;
    }

    // 从表单获取最新的基准语言值（用户可能刚输入）
    const formValues = form.getFieldsValue();
    const sourceText = formValues[baseLocale];

    if (!sourceText) {
      message.warning("基准语言没有内容，无法翻译");
      return;
    }

    // 检查是否有可用的翻译供应商
    const providers = await getTranslationProviders();
    const availableProvider = providers?.find((p) => p.isEnabled);
    if (!availableProvider) {
      message.error("没有可用的翻译供应商，请先配置");
      return;
    }

    setIsTranslating(true);
    try {
      // 批量翻译到所有缺失的目标语言
      const targetLanguages = missingLocales.map((l) => l.code);

      for (const targetLang of targetLanguages) {
        const result = await translateBatch({
          texts: [sourceText],
          sourceLanguage: baseLocale,
          targetLanguage: targetLang,
          format: "text",
        });

        if (result.translations?.[0]?.translatedText) {
          form.setFieldValue(targetLang, result.translations[0].translatedText);
        }
      }

      message.success(`已翻译 ${targetLanguages.length} 个语言`);
    } catch (error) {
      message.error("翻译失败，请稍后重试");
    } finally {
      setIsTranslating(false);
    }
  };

  const missingLocales = getMissingTranslations();
  const hasMissingTranslations = missingLocales.length > 0;

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
          style={{ display: "flex", justifyContent: "space-between", gap: 8 }}
        >
          <Button
            type="dashed"
            icon={<ThunderboltOutlined />}
            onClick={handleTranslateMissing}
            loading={isTranslating}
            disabled={!hasMissingTranslations}
          >
            {isTranslating
              ? "翻译中..."
              : hasMissingTranslations
                ? `一键翻译缺失 (${missingLocales.length})`
                : "已全部翻译"}
          </Button>
          <Space>
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
          </Space>
        </div>
      }
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={(values) => {
          // 验证所有语言都有值
          const missingLocales = locales.filter(
            (locale) => !values[locale.code]?.trim()
          );
          if (missingLocales.length > 0) {
            message.error(
              `以下语言缺少翻译: ${missingLocales.map((l) => l.code).join(", ")}`
            );
            return;
          }
          onSave(values);
        }}
        className="animate-fade-in"
      >
        <Space direction="vertical" style={{ width: "100%" }} size="small">
          {locales.map((locale, index) => {
            const translations = editingKey?.translations || [];
            const translation = translations.find(
              (t) => t.locale.code === locale.code,
            );
            const status = translation?.status || "PENDING";
            const config = statusConfig[status];

            // 获取基准语言的翻译作为源文本
            const baseTranslation = translations.find(
              (t) => t.locale.code === baseLocale,
            );
            const sourceText = baseTranslation?.content || "";

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
                  <Form.Item
                    name={locale.code}
                    style={{ marginBottom: 0 }}
                    rules={[
                      {
                        required: true,
                        message: `请输入 ${locale.name} 的翻译`,
                      },
                    ]}
                  >
                    <Input
                      placeholder={`输入 ${locale.name} 的翻译...`}
                      className="input-interactive"
                      style={{
                        transition: "all var(--transition-fast)",
                      }}
                    />
                  </Form.Item>
                </div>
                {/* 为非基准语言显示机器翻译按钮 */}
                {locale.code !== baseLocale && (
                  <MachineTranslateButton
                    sourceText={sourceText}
                    sourceLanguage={baseLocale}
                    targetLanguage={locale.code}
                    onTranslateSuccess={(translatedText) => {
                      form.setFieldValue(locale.code, translatedText);
                    }}
                    size="small"
                  />
                )}
              </div>
            );
          })}
        </Space>
      </Form>
    </Drawer>
  );
};

export default TranslationDrawer;
