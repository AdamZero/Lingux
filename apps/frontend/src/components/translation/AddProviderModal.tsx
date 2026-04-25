import React, { useState } from "react";
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
} from "antd";
import {
  GlobalOutlined,
  ThunderboltOutlined,
  ApiOutlined,
  RobotOutlined,
  SettingOutlined,
} from "@ant-design/icons";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import apiClient from "@/api/client";

const { Text } = Typography;
const { Option } = Select;

interface AddProviderModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface ProviderFormData {
  name: string;
  type: string;
  baseUrl: string;
  apiKey: string;
  isEnabled: boolean;
  isDefault: boolean;
  rateLimitPerMin?: number;
  maxCharsPerReq?: number;
  maxTextsPerReq?: number;
  timeoutMs?: number;
  config?: Record<string, unknown>;
}

const providerOptions = [
  { value: "GOOGLE", label: "Google Translate", icon: <GlobalOutlined /> },
  { value: "DEEPL", label: "DeepL", icon: <ThunderboltOutlined /> },
  { value: "AZURE", label: "Azure Translator", icon: <ApiOutlined /> },
  { value: "OPENAI", label: "OpenAI", icon: <RobotOutlined /> },
  { value: "CUSTOM", label: "自定义 API", icon: <SettingOutlined /> },
];

const defaultUrls: Record<string, string> = {
  GOOGLE: "https://translation.googleapis.com/language/translate/v2",
  DEEPL: "https://api-free.deepl.com/v2",
  AZURE: "https://api.cognitive.microsofttranslator.com",
  OPENAI: "https://api.openai.com/v1",
  CUSTOM: "",
};

export const AddProviderModal: React.FC<AddProviderModalProps> = ({
  open,
  onClose,
  onSuccess,
}) => {
  const [form] = Form.useForm();
  const [providerType, setProviderType] = useState<string>("GOOGLE");
  const queryClient = useQueryClient();

  const createProviderMutation = useMutation({
    mutationFn: async (data: ProviderFormData) => {
      return apiClient.post("/translation-providers", data);
    },
    onSuccess: () => {
      message.success("翻译供应商添加成功");
      queryClient.invalidateQueries({ queryKey: ["translation-providers"] });
      form.resetFields();
      onSuccess();
    },
    onError: (error: Error) => {
      message.error(`添加失败: ${error.message}`);
    },
  });

  const handleTypeChange = (value: string) => {
    setProviderType(value);
    form.setFieldValue("baseUrl", defaultUrls[value] || "");
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      createProviderMutation.mutate(values);
    } catch (error) {
      // 表单验证失败
    }
  };

  const handleClose = () => {
    form.resetFields();
    onClose();
  };

  return (
    <Modal
      title="添加翻译供应商"
      open={open}
      onOk={handleSubmit}
      onCancel={handleClose}
      confirmLoading={createProviderMutation.isPending}
      width={600}
      okText="添加"
      cancelText="取消"
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={{
          type: "GOOGLE",
          baseUrl: defaultUrls.GOOGLE,
          isEnabled: true,
          isDefault: false,
          rateLimitPerMin: 60,
          maxCharsPerReq: 5000,
          maxTextsPerReq: 100,
          timeoutMs: 30000,
        }}
      >
        <Form.Item
          name="type"
          label="供应商类型"
          rules={[{ required: true, message: "请选择供应商类型" }]}
        >
          <Select placeholder="选择供应商类型" onChange={handleTypeChange}>
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
          label="API 密钥"
          rules={[{ required: true, message: "请输入 API 密钥" }]}
        >
          <Input.Password placeholder="输入您的 API 密钥" />
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

        <Text
          strong
          style={{ display: "block", marginTop: 16, marginBottom: 8 }}
        >
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
