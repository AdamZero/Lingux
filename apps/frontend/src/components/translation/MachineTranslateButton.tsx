import React, { useState } from "react";
import { Button, Tooltip, Modal, Space, Typography, message } from "antd";
import { RobotOutlined, LoadingOutlined } from "@ant-design/icons";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  translate,
  getTranslationProviders,
  type TranslateResult,
} from "@/api/machine-translation";

const { Text } = Typography;

interface MachineTranslateButtonProps {
  sourceText: string;
  sourceLanguage?: string;
  targetLanguage: string;
  onTranslateSuccess: (translatedText: string) => void;
  disabled?: boolean;
  size?: "small" | "middle" | "large";
}

export const MachineTranslateButton: React.FC<MachineTranslateButtonProps> = ({
  sourceText,
  sourceLanguage,
  targetLanguage,
  onTranslateSuccess,
  disabled = false,
  size = "small",
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [translatedResult, setTranslatedResult] =
    useState<TranslateResult | null>(null);

  // 获取可用的翻译供应商
  const { data: providers } = useQuery({
    queryKey: ["translation-providers"],
    queryFn: getTranslationProviders,
  });

  const availableProvider = providers?.find((p) => p.isEnabled);

  const translateMutation = useMutation({
    mutationFn: translate,
    onSuccess: (data) => {
      setTranslatedResult({
        translatedText: data.translatedText,
        detectedSourceLanguage: data.detectedSourceLanguage,
        confidence: data.confidence,
      });
      setIsModalOpen(true);
    },
    onError: (error: Error) => {
      message.error(`翻译失败: ${error.message}`);
    },
  });

  const handleTranslate = () => {
    if (!sourceText.trim()) {
      message.warning("源文本为空，无法翻译");
      return;
    }

    if (!availableProvider) {
      message.error("没有可用的翻译供应商，请先配置");
      return;
    }

    translateMutation.mutate({
      text: sourceText,
      sourceLanguage,
      targetLanguage,
      format: "text",
    });
  };

  const handleAccept = () => {
    if (translatedResult) {
      onTranslateSuccess(translatedResult.translatedText);
      setIsModalOpen(false);
      setTranslatedResult(null);
      message.success("已应用机器翻译结果");
    }
  };

  const handleReject = () => {
    setIsModalOpen(false);
    setTranslatedResult(null);
  };

  const isLoading = translateMutation.isPending;

  return (
    <>
      <Tooltip title={!availableProvider ? "未配置翻译供应商" : "使用机器翻译"}>
        <Button
          type="dashed"
          icon={isLoading ? <LoadingOutlined /> : <RobotOutlined />}
          size={size}
          onClick={handleTranslate}
          disabled={disabled || !sourceText.trim() || !availableProvider}
          loading={isLoading}
        >
          {isLoading ? "翻译中..." : "AI 翻译"}
        </Button>
      </Tooltip>

      <Modal
        title={
          <Space>
            <RobotOutlined style={{ color: "#1890ff" }} />
            <span>机器翻译结果</span>
          </Space>
        }
        open={isModalOpen}
        onCancel={handleReject}
        footer={
          <Space>
            <Button onClick={handleReject}>取消</Button>
            <Button type="primary" onClick={handleAccept}>
              应用翻译
            </Button>
          </Space>
        }
        width={600}
      >
        <Space direction="vertical" style={{ width: "100%" }} size="large">
          <div>
            <Text type="secondary">
              源文本 ({sourceLanguage || "自动检测"}):
            </Text>
            <div
              style={{
                marginTop: 8,
                padding: 12,
                backgroundColor: "#f5f5f5",
                borderRadius: 6,
                maxHeight: 120,
                overflow: "auto",
              }}
            >
              <Text>{sourceText}</Text>
            </div>
          </div>

          <div>
            <Text type="secondary">翻译结果 ({targetLanguage}):</Text>
            <div
              style={{
                marginTop: 8,
                padding: 12,
                backgroundColor: "#e6f7ff",
                borderRadius: 6,
                border: "1px solid #91d5ff",
                maxHeight: 120,
                overflow: "auto",
              }}
            >
              <Text strong>{translatedResult?.translatedText}</Text>
            </div>
          </div>

          {translatedResult?.detectedSourceLanguage && (
            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>
                检测到的源语言: {translatedResult.detectedSourceLanguage}
                {translatedResult.confidence &&
                  ` (置信度: ${(translatedResult.confidence * 100).toFixed(1)}%)`}
              </Text>
            </div>
          )}
        </Space>
      </Modal>
    </>
  );
};
