import React, { useState, useEffect, useRef } from "react";
import { Button, Modal, Progress, Typography, message } from "antd";
import { TranslationOutlined } from "@ant-design/icons";
import { useMutation } from "@tanstack/react-query";
import { translateNamespace } from "@/api/namespace";
import { getTranslationJobDetail } from "@/api/machine-translation";

const { Text } = Typography;

interface NamespaceTranslateButtonProps {
  projectId: string;
  namespaceId: string;
  namespaceName?: string;
  onSuccess?: () => void;
}

export const NamespaceTranslateButton: React.FC<
  NamespaceTranslateButtonProps
> = ({ projectId, namespaceId, onSuccess }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // 清理轮询定时器
  const clearPollingInterval = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  // 组件卸载时清理定时器
  useEffect(() => {
    return () => {
      clearPollingInterval();
    };
  }, []);

  useEffect(() => {
    if (!isModalOpen) {
      clearPollingInterval();
    }
  }, [isModalOpen]);

  // 开始轮询任务状态
  const startPolling = (jobId: string) => {
    clearPollingInterval();

    intervalRef.current = setInterval(async () => {
      try {
        const job = await getTranslationJobDetail(jobId);
        const percent =
          job.totalKeys > 0
            ? Math.round((job.translatedKeys / job.totalKeys) * 100)
            : 0;
        setProgress(percent);

        if (job.status === "COMPLETED") {
          clearPollingInterval();
          const successCount = job.items.reduce(
            (sum, item) =>
              sum +
              item.translations.filter((t) => t.status === "SUCCESS").length,
            0,
          );
          const failedCount = job.items.reduce(
            (sum, item) =>
              sum +
              item.translations.filter((t) => t.status === "FAILED").length,
            0,
          );

          if (failedCount === 0) {
            message.success(`翻译完成！成功翻译 ${successCount} 个词条`);
          } else if (successCount === 0) {
            message.error("翻译失败，请检查翻译供应商配置");
          } else {
            message.warning(
              `翻译完成：成功 ${successCount} 个，失败 ${failedCount} 个`,
            );
          }
          setIsModalOpen(false);
          setCurrentJobId(null);
          setProgress(0);
          onSuccess?.();
        } else if (job.status === "FAILED") {
          clearPollingInterval();
          message.error(`翻译失败：${job.error || "未知错误"}`);
          setCurrentJobId(null);
          setProgress(0);
        }
      } catch (error) {
        clearPollingInterval();
        message.error("获取任务状态失败");
        setCurrentJobId(null);
        setProgress(0);
      }
    }, 2000);
  };

  const translateMutation = useMutation({
    mutationFn: () => {
      return translateNamespace(projectId, namespaceId);
    },
    onSuccess: (data) => {
      setCurrentJobId(data.jobId);
      startPolling(data.jobId);
    },
    onError: (error: Error) => {
      message.error(`翻译失败：${error.message}`);
    },
  });

  const handleClose = () => {
    if (translateMutation.isPending || currentJobId) {
      return; // 翻译中不允许关闭
    }
    setIsModalOpen(false);
  };

  const isProcessing = translateMutation.isPending || currentJobId !== null;

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
        open={isModalOpen}
        onCancel={handleClose}
        onOk={() => translateMutation.mutate()}
        confirmLoading={translateMutation.isPending}
        okText={isProcessing ? "翻译中..." : "开始翻译"}
        cancelText="取消"
        closable={!isProcessing}
        maskClosable={!isProcessing}
        okButtonProps={{ disabled: isProcessing }}
        styles={{ body: { padding: 0 } }}
      >
        <div style={{ padding: "16px 0" }}>
          <Text>将自动翻译所有缺失的词条：</Text>
          <ul style={{ marginTop: 8, paddingLeft: 20 }}>
            <li>自动检测项目基准语言作为源语言</li>
            <li>自动翻译到所有启用的目标语言</li>
            <li>只翻译缺失的词条，已有翻译不会被覆盖</li>
            <li>使用系统默认的翻译供应商</li>
          </ul>

          {isProcessing && (
            <div style={{ marginTop: 16 }}>
              <Text>正在翻译中，请稍候...</Text>
              <Progress percent={progress} status="active" />
            </div>
          )}
        </div>
      </Modal>
    </>
  );
};
