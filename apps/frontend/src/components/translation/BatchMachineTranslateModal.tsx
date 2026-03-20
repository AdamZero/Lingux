import React, { useState, useEffect, useRef } from "react";
import {
  Modal,
  Button,
  Space,
  Typography,
  Progress,
  List,
  Tag,
  Alert,
  Select,
  message,
} from "antd";
import { RobotOutlined, ThunderboltOutlined } from "@ant-design/icons";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  createTranslationJob,
  getTranslationJob,
  getTranslationProviders,
} from "@/api/machine-translation";

const { Text } = Typography;
const { Option } = Select;

interface Key {
  id: string;
  name: string;
  description?: string;
  translations: {
    id: string;
    content: string;
    locale: {
      code: string;
      name: string;
    };
  }[];
}

interface BatchMachineTranslateModalProps {
  open: boolean;
  keys: Key[];
  sourceLocale: string;
  targetLocales: string[];
  projectId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export const BatchMachineTranslateModal: React.FC<
  BatchMachineTranslateModalProps
> = ({
  open,
  keys,
  sourceLocale,
  targetLocales,
  projectId,
  onClose,
  onSuccess,
}) => {
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // 获取可用的翻译供应商
  const { data: providers } = useQuery({
    queryKey: ["translation-providers"],
    queryFn: getTranslationProviders,
    enabled: open,
  });

  const defaultProvider = providers?.find((p) => p.isDefault && p.isEnabled);
  const availableProviders = providers?.filter((p) => p.isEnabled) || [];

  // 清理轮询定时器
  const clearPollingInterval = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  // 组件卸载或模态框关闭时清理定时器
  useEffect(() => {
    return () => {
      clearPollingInterval();
    };
  }, []);

  useEffect(() => {
    if (!open) {
      clearPollingInterval();
    }
  }, [open]);

  // 创建翻译任务
  const createJobMutation = useMutation({
    mutationFn: createTranslationJob,
    onSuccess: (data) => {
      setCurrentJobId(data.jobId);
      startPolling(data.jobId);
    },
    onError: (error: Error) => {
      message.error(`创建翻译任务失败: ${error.message}`);
    },
  });

  // 开始轮询任务状态
  const startPolling = (jobId: string) => {
    // 先清理之前的轮询
    clearPollingInterval();

    intervalRef.current = setInterval(async () => {
      try {
        const job = await getTranslationJob(jobId);
        const total = job.texts.length;
        const completed = job.results?.length || 0;
        setProgress(Math.round((completed / total) * 100));

        if (job.status === "COMPLETED") {
          clearPollingInterval();
          message.success("批量翻译完成");
          onSuccess();
        } else if (job.status === "FAILED") {
          clearPollingInterval();
          message.error("批量翻译失败");
        }
      } catch (error) {
        clearPollingInterval();
        message.error("获取任务状态失败");
      }
    }, 2000);
  };

  const handleStart = () => {
    if (!selectedProvider && !defaultProvider) {
      message.error("请选择翻译供应商");
      return;
    }

    // 收集需要翻译的文本
    const textsToTranslate: string[] = [];
    keys.forEach((key) => {
      targetLocales.forEach(() => {
        const sourceTranslation = key.translations.find(
          (t) => t.locale.code === sourceLocale,
        );
        if (sourceTranslation?.content) {
          textsToTranslate.push(sourceTranslation.content);
        }
      });
    });

    if (textsToTranslate.length === 0) {
      message.warning("没有可翻译的内容");
      return;
    }

    createJobMutation.mutate({
      providerId: selectedProvider || defaultProvider?.id,
      texts: textsToTranslate,
      sourceLanguage: sourceLocale,
      targetLanguage: targetLocales[0], // 简化处理，实际应该支持多目标语言
      projectId,
    });
  };

  const handleClose = () => {
    setCurrentJobId(null);
    setProgress(0);
    setSelectedProvider(null);
    onClose();
  };

  const isProcessing = createJobMutation.isPending || currentJobId !== null;

  return (
    <Modal
      title={
        <Space>
          <RobotOutlined style={{ color: "#1890ff" }} />
          <span>批量机器翻译</span>
        </Space>
      }
      open={open}
      onCancel={handleClose}
      width={700}
      footer={
        <Space>
          <Button onClick={handleClose} disabled={isProcessing}>
            取消
          </Button>
          <Button
            type="primary"
            icon={<ThunderboltOutlined />}
            onClick={handleStart}
            loading={isProcessing}
            disabled={availableProviders.length === 0}
          >
            {isProcessing ? "翻译中..." : "开始翻译"}
          </Button>
        </Space>
      }
    >
      <Space direction="vertical" style={{ width: "100%" }} size="large">
        {/* 翻译供应商选择 */}
        <div>
          <Text strong>选择翻译供应商</Text>
          <Select
            style={{ width: "100%", marginTop: 8 }}
            placeholder="选择翻译供应商"
            value={selectedProvider || defaultProvider?.id}
            onChange={setSelectedProvider}
            disabled={isProcessing}
          >
            {availableProviders.map((provider) => (
              <Option key={provider.id} value={provider.id}>
                <Space>
                  {provider.name}
                  {provider.isDefault && <Tag color="blue">默认</Tag>}
                </Space>
              </Option>
            ))}
          </Select>
          {availableProviders.length === 0 && (
            <Alert
              message="没有可用的翻译供应商，请先配置"
              type="warning"
              showIcon
              style={{ marginTop: 8 }}
            />
          )}
        </div>

        {/* 翻译信息 */}
        <div>
          <Text strong>翻译信息</Text>
          <div
            style={{
              marginTop: 8,
              padding: 12,
              backgroundColor: "#f5f5f5",
              borderRadius: 6,
            }}
          >
            <Space direction="vertical" style={{ width: "100%" }}>
              <div>
                <Text type="secondary">源语言: </Text>
                <Tag color="blue">{sourceLocale}</Tag>
              </div>
              <div>
                <Text type="secondary">目标语言: </Text>
                {targetLocales.map((locale) => (
                  <Tag key={locale} color="green">
                    {locale}
                  </Tag>
                ))}
              </div>
              <div>
                <Text type="secondary">待翻译词条: </Text>
                <Text strong>{keys.length} 个</Text>
              </div>
              <div>
                <Text type="secondary">预计字符数: </Text>
                <Text strong>
                  {keys
                    .reduce((sum, key) => {
                      const translation = key.translations.find(
                        (t) => t.locale.code === sourceLocale,
                      );
                      return sum + (translation?.content?.length || 0);
                    }, 0)
                    .toLocaleString()}{" "}
                  字符
                </Text>
              </div>
            </Space>
          </div>
        </div>

        {/* 进度显示 */}
        {isProcessing && (
          <div>
            <Text strong>翻译进度</Text>
            <Progress
              percent={progress}
              status={progress === 100 ? "success" : "active"}
              strokeColor={{ "0%": "#108ee9", "100%": "#87d068" }}
              style={{ marginTop: 8 }}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>
              {progress < 100 ? "正在翻译中，请勿关闭窗口..." : "翻译完成！"}
            </Text>
          </div>
        )}

        {/* 待翻译词条列表 */}
        <div>
          <Text strong>待翻译词条</Text>
          <List
            size="small"
            style={{ marginTop: 8, maxHeight: 200, overflow: "auto" }}
            bordered
            dataSource={keys}
            renderItem={(key) => (
              <List.Item>
                <Space direction="vertical" style={{ width: "100%" }} size={0}>
                  <Text strong>{key.name}</Text>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {key.translations.find(
                      (t) => t.locale.code === sourceLocale,
                    )?.content || "无源文本"}
                  </Text>
                </Space>
              </List.Item>
            )}
          />
        </div>
      </Space>
    </Modal>
  );
};
