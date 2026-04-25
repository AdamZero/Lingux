import React, { useState, useEffect } from "react";
import {
  Modal,
  Form,
  Input,
  Select,
  Switch,
  InputNumber,
  Space,
  Typography,
  Alert,
  message,
  Divider,
} from "antd";
import {
  GlobalOutlined,
  ThunderboltOutlined,
  ApiOutlined,
  RobotOutlined,
  SettingOutlined,
  ExperimentOutlined,
  CloudOutlined,
} from "@ant-design/icons";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import apiClient from "@/api/client";
import type { TranslationProvider } from "@/api/machine-translation";

const { Text } = Typography;
const { Option } = Select;

interface ProviderModalProps {
  open: boolean;
  editingProvider?: TranslationProvider | null;
  onClose: () => void;
  onSuccess: (providerId?: string) => void;
}

interface ProviderFormData {
  name: string;
  type: string;
  baseUrl: string;
  apiKey?: string;
  isEnabled: boolean;
  isDefault: boolean;
  rateLimitPerMin?: number;
  maxCharsPerReq?: number;
  maxTextsPerReq?: number;
  timeoutMs?: number;
  config?: Record<string, unknown>;
}

const providerOptions = [
  { value: "MOCK", label: "Mock (测试模式)", icon: <ExperimentOutlined /> },
  { value: "BAIDU", label: "百度翻译", icon: <CloudOutlined /> },
  { value: "TENCENT", label: "腾讯翻译", icon: <CloudOutlined /> },
  { value: "GOOGLE", label: "Google Translate", icon: <GlobalOutlined /> },
  { value: "DEEPL", label: "DeepL", icon: <ThunderboltOutlined /> },
  { value: "AZURE", label: "Azure Translator", icon: <ApiOutlined /> },
  { value: "OPENAI", label: "OpenAI", icon: <RobotOutlined /> },
  { value: "CUSTOM", label: "自定义 API", icon: <SettingOutlined /> },
];

const defaultUrls: Record<string, string> = {
  MOCK: "http://localhost:3000/mock",
  BAIDU: "https://fanyi-api.baidu.com",
  TENCENT: "https://tmt.tencentcloudapi.com",
  GOOGLE: "https://translation.googleapis.com/language/translate/v2",
  DEEPL: "https://api-free.deepl.com/v2",
  AZURE: "https://api.cognitive.microsofttranslator.com",
  OPENAI: "https://api.openai.com/v1",
  CUSTOM: "",
};

export const ProviderModal: React.FC<ProviderModalProps> = ({
  open,
  editingProvider,
  onClose,
  onSuccess,
}) => {
  const [form] = Form.useForm();
  const [providerType, setProviderType] = useState<string>("GOOGLE");
  const isEditing = !!editingProvider;
  const queryClient = useQueryClient();

  // 编辑时加载数据
  useEffect(() => {
    if (open && editingProvider) {
      // 使用传入的供应商数据
      setProviderType(editingProvider.type);
      form.setFieldsValue({
        name: editingProvider.name,
        type: editingProvider.type,
        baseUrl: editingProvider.baseUrl,
        isEnabled: editingProvider.isEnabled,
        isDefault: editingProvider.isDefault,
        rateLimitPerMin: editingProvider.rateLimitPerMin,
        maxCharsPerReq: editingProvider.maxCharsPerReq,
        maxTextsPerReq: editingProvider.maxTextsPerReq,
        timeoutMs: editingProvider.timeoutMs,
      });
    } else if (open && !editingProvider) {
      // 新增时重置表单 - 确保完全清空
      setProviderType("GOOGLE");
      form.resetFields();
      // 使用 setTimeout 确保 resetFields 完成后再设置新值
      setTimeout(() => {
        form.setFieldsValue({
          type: "GOOGLE",
          baseUrl: defaultUrls.GOOGLE,
          apiKey: undefined, // 明确清空 apiKey
          isEnabled: true,
          isDefault: false,
          rateLimitPerMin: 60,
          maxCharsPerReq: 5000,
          maxTextsPerReq: 100,
          timeoutMs: 30000,
        });
      }, 0);
    }
  }, [open, editingProvider, form]);

  const createProviderMutation = useMutation({
    mutationFn: async (data: ProviderFormData) => {
      return apiClient.post("/translation-providers", data);
    },
    onSuccess: (data: { id?: string }) => {
      message.success("翻译供应商添加成功");
      queryClient.invalidateQueries({ queryKey: ["translation-providers"] });
      form.resetFields();
      onSuccess(data?.id);
    },
    onError: (error: Error) => {
      message.error(`添加失败: ${error.message}`);
    },
  });

  const updateProviderMutation = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: Partial<ProviderFormData>;
    }) => {
      return apiClient.put(`/translation-providers/${id}`, data);
    },
    onSuccess: () => {
      message.success("翻译供应商更新成功");
      queryClient.invalidateQueries({ queryKey: ["translation-providers"] });
      onSuccess(editingProvider?.id);
    },
    onError: (error: Error) => {
      message.error(`更新失败: ${error.message}`);
    },
  });

  const handleTypeChange = (value: string) => {
    setProviderType(value);
    if (!isEditing) {
      form.setFieldValue("baseUrl", defaultUrls[value] || "");
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();

      if (isEditing && editingProvider) {
        // 编辑模式：只发送修改的字段
        const updateData: Partial<ProviderFormData> = {
          name: values.name,
          baseUrl: values.baseUrl,
          isEnabled: values.isEnabled,
          isDefault: values.isDefault,
          rateLimitPerMin: values.rateLimitPerMin,
          maxCharsPerReq: values.maxCharsPerReq,
          maxTextsPerReq: values.maxTextsPerReq,
          timeoutMs: values.timeoutMs,
        };
        // 如果有输入 API 密钥才发送
        if (values.apiKey) {
          updateData.apiKey = values.apiKey;
        }
        updateProviderMutation.mutate({
          id: editingProvider.id,
          data: updateData,
        });
      } else {
        // 新增模式
        createProviderMutation.mutate(values);
      }
    } catch (error) {
      // 表单验证失败
    }
  };

  const handleClose = () => {
    form.resetFields();
    onClose();
  };

  const isLoading =
    createProviderMutation.isPending || updateProviderMutation.isPending;

  return (
    <Modal
      title={isEditing ? "编辑翻译供应商" : "添加翻译供应商"}
      open={open}
      onOk={handleSubmit}
      onCancel={handleClose}
      confirmLoading={isLoading}
      width={600}
      okText={isEditing ? "保存" : "添加"}
      cancelText="取消"
    >
      <Form form={form} layout="vertical">
        <Form.Item
          name="type"
          label="供应商类型"
          rules={[{ required: true, message: "请选择供应商类型" }]}
        >
          <Select
            placeholder="选择供应商类型"
            onChange={handleTypeChange}
            disabled={isEditing} // 编辑时不能修改类型
          >
            {providerOptions.map((option) => (
              <Option key={option.value} value={option.value}>
                <Space>
                  {option.icon}
                  {option.label}
                </Space>
              </Option>
            ))}
          </Select>
        </Form.Item>

        <Form.Item
          name="name"
          label="供应商名称"
          rules={[{ required: true, message: "请输入供应商名称" }]}
        >
          <Input placeholder="例如：Google Translate API" />
        </Form.Item>

        <Form.Item
          name="baseUrl"
          label="API 地址"
          rules={[{ required: true, message: "请输入 API 地址" }]}
        >
          <Input placeholder="https://api.example.com" />
        </Form.Item>

        <Form.Item
          name="apiKey"
          label={isEditing ? "API 密钥 (留空表示不修改)" : "API 密钥"}
          rules={
            isEditing ? [] : [{ required: true, message: "请输入 API 密钥" }]
          }
        >
          <Input.Password
            placeholder={isEditing ? "输入新密钥或留空" : "输入您的 API 密钥"}
          />
        </Form.Item>

        {providerType === "CUSTOM" && (
          <Alert
            message="自定义 API 需要符合标准接口格式"
            description="请参考文档配置自定义翻译 API 的接口格式"
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}

        <Form.Item label="选项" style={{ marginBottom: 0 }}>
          <Space size="large">
            <Form.Item
              name="isEnabled"
              valuePropName="checked"
              style={{ marginBottom: 0 }}
            >
              <Switch checkedChildren="启用" unCheckedChildren="禁用" />
            </Form.Item>
            <Form.Item
              name="isDefault"
              valuePropName="checked"
              style={{ marginBottom: 0 }}
            >
              <Switch checkedChildren="默认" unCheckedChildren="非默认" />
            </Form.Item>
          </Space>
        </Form.Item>

        <Divider style={{ margin: "16px 0" }} />

        <Text strong style={{ display: "block", marginBottom: 8 }}>
          高级设置
        </Text>

        <Space style={{ width: "100%" }} wrap>
          <Form.Item
            name="rateLimitPerMin"
            label="每分钟限制"
            style={{ width: 150 }}
          >
            <InputNumber min={1} max={1000} addonAfter="次" />
          </Form.Item>

          <Form.Item
            name="maxCharsPerReq"
            label="单次最大字符"
            style={{ width: 150 }}
          >
            <InputNumber min={100} max={50000} addonAfter="字符" />
          </Form.Item>

          <Form.Item
            name="maxTextsPerReq"
            label="单次最大文本数"
            style={{ width: 150 }}
          >
            <InputNumber min={1} max={1000} addonAfter="条" />
          </Form.Item>

          <Form.Item name="timeoutMs" label="超时时间" style={{ width: 150 }}>
            <InputNumber min={1000} max={120000} step={1000} addonAfter="ms" />
          </Form.Item>
        </Space>
      </Form>
    </Modal>
  );
};
