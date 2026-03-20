import React, { useState } from "react";
import { Button, Modal, Progress, Typography, message } from "antd";
import { TranslationOutlined } from "@ant-design/icons";
import { useMutation } from "@tanstack/react-query";
import { translateNamespace } from "@/api/namespace";

const { Text } = Typography;

interface NamespaceTranslateButtonProps {
  projectId: string;
  namespaceId: string;
  namespaceName: string;
  onSuccess?: () => void;
}

export const NamespaceTranslateButton: React.FC<
  NamespaceTranslateButtonProps
> = ({ projectId, namespaceId, namespaceName, onSuccess }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const translateMutation = useMutation({
    mutationFn: () => {
      return translateNamespace(projectId, namespaceId);
    },
    onSuccess: (data) => {
      if (data.failedKeys === 0) {
        message.success(
          `翻译完成！成功翻译 ${data.translatedKeys} 个缺失的词条`,
        );
      } else if (data.translatedKeys === 0) {
        message.info("没有需要翻译的词条");
      } else {
        message.warning(
          `翻译完成：成功 ${data.translatedKeys} 个，失败 ${data.failedKeys} 个`,
        );
      }
      setIsModalOpen(false);
      onSuccess?.();
    },
    onError: (error: Error) => {
      message.error(`翻译失败：${error.message}`);
    },
  });

  return (
    <>
      <Button
        type="primary"
        icon={<TranslationOutlined />}
        onClick={() => setIsModalOpen(true)}
      >
        一键翻译
      </Button>

      <Modal
        title={`一键翻译：${namespaceName}`}
        open={isModalOpen}
        onCancel={() => !translateMutation.isPending && setIsModalOpen(false)}
        onOk={() => translateMutation.mutate()}
        confirmLoading={translateMutation.isPending}
        okText="开始翻译"
        cancelText="取消"
        closable={!translateMutation.isPending}
        maskClosable={!translateMutation.isPending}
      >
        <div style={{ padding: "16px 0" }}>
          <Text>
            将自动翻译所有缺失的词条：
          </Text>
          <ul style={{ marginTop: 8, paddingLeft: 20 }}>
            <li>自动检测项目基准语言作为源语言</li>
            <li>自动翻译到所有启用的目标语言</li>
            <li>只翻译缺失的词条，已有翻译不会被覆盖</li>
            <li>使用系统默认的翻译供应商</li>
          </ul>

          {translateMutation.isPending && (
            <div style={{ marginTop: 16 }}>
              <Text>正在翻译中，请稍候...</Text>
              <Progress percent={100} status="active" />
            </div>
          )}
        </div>
      </Modal>
    </>
  );
};
