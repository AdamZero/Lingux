import React, { useState } from "react";
import {
  Card,
  Table,
  Tag,
  Switch,
  Button,
  Space,
  Typography,
  Badge,
  Tooltip,
  Statistic,
  Row,
  Col,
  Select,
  Empty,
  Skeleton,
  message,
  Modal,
} from "antd";
import {
  RobotOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ThunderboltOutlined,
  GlobalOutlined,
  ApiOutlined,
  DollarOutlined,
  ReloadOutlined,
  SettingOutlined,
  PlusOutlined,
  EditOutlined,
  ExperimentOutlined,
  CloudOutlined,
} from "@ant-design/icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getTranslationProviders,
  getCostStatistics,
  checkProviderHealth,
  deleteTranslationProvider,
  updateTranslationProvider,
  setDefaultTranslationProvider,
} from "@/api/machine-translation";
import type { TranslationProvider } from "@/api/machine-translation";
import { ProviderModal } from "@/components/translation/ProviderModal";
import { MonthlyStatsSection } from "@/components/translation/MonthlyStatsSection";
import { TranslationJobList } from "@/components/translation/TranslationJobList";

const { Title, Text } = Typography;
const { Option } = Select;

const providerIcons: Record<string, React.ReactNode> = {
  MOCK: <ExperimentOutlined />,
  BAIDU: <CloudOutlined />,
  TENCENT: <CloudOutlined />,
  GOOGLE: <GlobalOutlined />,
  DEEPL: <ThunderboltOutlined />,
  AZURE: <ApiOutlined />,
  OPENAI: <RobotOutlined />,
  CUSTOM: <SettingOutlined />,
};

const providerNames: Record<string, string> = {
  MOCK: "Mock (测试模式)",
  BAIDU: "百度翻译",
  TENCENT: "腾讯翻译",
  GOOGLE: "Google Translate",
  DEEPL: "DeepL",
  AZURE: "Azure Translator",
  OPENAI: "OpenAI",
  CUSTOM: "自定义 API",
};

const MachineTranslationSettingsPage: React.FC = () => {
  const [billingPeriod, setBillingPeriod] = useState<string>(
    new Date().toISOString().slice(0, 7),
  );
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProvider, setEditingProvider] =
    useState<TranslationProvider | null>(null);
  const [providerHealthStatus, setProviderHealthStatus] = useState<
    Record<string, "healthy" | "unhealthy" | "checking">
  >({});
  const queryClient = useQueryClient();

  // 获取翻译供应商列表
  const {
    data: providers,
    isLoading: providersLoading,
    refetch: refetchProviders,
  } = useQuery({
    queryKey: ["translation-providers"],
    queryFn: getTranslationProviders,
  });

  // 获取成本统计
  const { data: costStats, isLoading: costLoading } = useQuery({
    queryKey: ["translation-costs", billingPeriod],
    queryFn: () =>
      getCostStatistics({
        billingPeriod,
      }),
  });

  // 删除供应商
  const deleteProviderMutation = useMutation({
    mutationFn: deleteTranslationProvider,
    onSuccess: () => {
      message.success("供应商删除成功");
      queryClient.invalidateQueries({ queryKey: ["translation-providers"] });
    },
    onError: (error: Error) => {
      message.error(`删除失败: ${error.message}`);
    },
  });

  // 更新供应商状态（启用/禁用）
  const updateProviderMutation = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: Partial<TranslationProvider>;
    }) => updateTranslationProvider(id, data),
    onSuccess: () => {
      message.success("供应商状态更新成功");
      queryClient.invalidateQueries({ queryKey: ["translation-providers"] });
    },
    onError: (error: Error) => {
      message.error(`更新失败: ${error.message}`);
    },
  });

  // 设置默认供应商
  const setDefaultProviderMutation = useMutation({
    mutationFn: setDefaultTranslationProvider,
    onSuccess: () => {
      message.success("默认供应商设置成功");
      queryClient.invalidateQueries({ queryKey: ["translation-providers"] });
    },
    onError: (error: Error) => {
      message.error(`设置失败: ${error.message}`);
    },
  });

  // 检查供应商健康状态
  const handleCheckHealth = async (providerId: string) => {
    setProviderHealthStatus((prev) => ({ ...prev, [providerId]: "checking" }));
    try {
      const result = await checkProviderHealth(providerId);
      setProviderHealthStatus((prev) => ({
        ...prev,
        [providerId]: result.status,
      }));
      if (result.status === "healthy") {
        message.success("供应商服务正常");
      } else {
        message.warning("供应商服务异常");
      }
    } catch (error) {
      setProviderHealthStatus((prev) => ({
        ...prev,
        [providerId]: "unhealthy",
      }));
      message.error("健康检查失败");
    }
  };

  // 处理删除
  const handleDelete = (providerId: string, providerName: string) => {
    Modal.confirm({
      title: "确认删除",
      content: `确定要删除供应商 "${providerName}" 吗？此操作不可恢复。`,
      okText: "删除",
      okType: "danger",
      cancelText: "取消",
      onOk: () => deleteProviderMutation.mutate(providerId),
    });
  };

  const columns = [
    {
      title: "供应商",
      dataIndex: "name",
      key: "name",
      render: (_: string, record: TranslationProvider) => (
        <Space>
          <span style={{ fontSize: 20 }}>
            {providerIcons[record.type] || <ApiOutlined />}
          </span>
          <div>
            <Space size={4}>
              <Text strong style={{ fontSize: 14 }}>
                {record.name}
              </Text>
              {record.isDefault && (
                <Tag color="blue" style={{ fontSize: 11, padding: "0 4px" }}>
                  默认
                </Tag>
              )}
            </Space>
            <br />
            <Text type="secondary" style={{ fontSize: 12 }}>
              {providerNames[record.type] || record.type}
            </Text>
          </div>
        </Space>
      ),
    },
    {
      title: "状态",
      key: "status",
      width: 120,
      render: (_: unknown, record: TranslationProvider) => {
        const health = providerHealthStatus[record.id];

        // 未启用时只显示禁用状态
        if (!record.isEnabled) {
          return (
            <Space direction="vertical" size={0}>
              <Badge status="default" text="已禁用" />
            </Space>
          );
        }

        // 已启用时显示启用状态和健康状态
        return (
          <Space direction="vertical" size={2}>
            <Badge status="success" text="已启用" />
            {health === "checking" && (
              <Badge status="processing" text="检查中..." />
            )}
            {health === "healthy" && (
              <span style={{ fontSize: 12, color: "#52c41a" }}>✓ 服务正常</span>
            )}
            {health === "unhealthy" && (
              <span style={{ fontSize: 12, color: "#ff4d4f" }}>✗ 服务异常</span>
            )}
            {!health && (
              <span style={{ fontSize: 12, color: "#999" }}>未检查</span>
            )}
          </Space>
        );
      },
    },
    {
      title: "操作",
      key: "action",
      width: 200,
      render: (_: unknown, record: TranslationProvider) => (
        <Space size="small">
          {/* 编辑按钮 */}
          <Tooltip title="编辑">
            <Button
              type="text"
              size="small"
              icon={<EditOutlined />}
              onClick={() => {
                setEditingProvider(record);
                setIsModalOpen(true);
              }}
            />
          </Tooltip>

          {/* 启用/禁用开关 */}
          <Tooltip title={record.isEnabled ? "禁用" : "启用"}>
            <Switch
              size="small"
              checked={record.isEnabled}
              onChange={(checked) => {
                updateProviderMutation.mutate({
                  id: record.id,
                  data: { isEnabled: checked },
                });
              }}
              loading={updateProviderMutation.isPending}
            />
          </Tooltip>

          {/* 设为默认按钮 - 只在非默认且已启用时显示 */}
          {!record.isDefault && record.isEnabled && (
            <Tooltip title="设为默认">
              <Button
                type="text"
                size="small"
                icon={<CheckCircleOutlined />}
                loading={setDefaultProviderMutation.isPending}
                onClick={() => setDefaultProviderMutation.mutate(record.id)}
              />
            </Tooltip>
          )}

          {/* 健康检查按钮 */}
          <Tooltip title="健康检查">
            <Button
              type="text"
              size="small"
              icon={<ReloadOutlined />}
              onClick={() => handleCheckHealth(record.id)}
              loading={providerHealthStatus[record.id] === "checking"}
            />
          </Tooltip>

          {/* 删除按钮 */}
          <Tooltip title="删除">
            <Button
              type="text"
              danger
              size="small"
              icon={<CloseCircleOutlined />}
              onClick={() => handleDelete(record.id, record.name)}
              loading={deleteProviderMutation.isPending}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  // 计算总成本
  const totalCost =
    costStats?.reduce((sum, stat) => sum + stat.totalCost, 0) || 0;
  const totalCharacters =
    costStats?.reduce((sum, stat) => sum + stat.totalCharacters, 0) || 0;
  const totalJobs =
    costStats?.reduce((sum, stat) => sum + stat.jobCount, 0) || 0;

  return (
    <div style={{ padding: 24 }}>
      <Title level={2}>
        <RobotOutlined style={{ marginRight: 12 }} />
        机器翻译设置
      </Title>

      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="本月总字符数"
              value={totalCharacters}
              prefix={<GlobalOutlined />}
              valueStyle={{ color: "#1890ff" }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="本月总成本"
              value={totalCost}
              prefix={<DollarOutlined />}
              suffix="USD"
              precision={4}
              valueStyle={{ color: "#52c41a" }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="本月翻译任务"
              value={totalJobs}
              prefix={<ThunderboltOutlined />}
              valueStyle={{ color: "#722ed1" }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="已启用供应商"
              value={providers?.filter((p) => p.isEnabled).length || 0}
              prefix={<CheckCircleOutlined />}
              suffix={`/ ${providers?.length || 0}`}
              valueStyle={{ color: "#fa8c16" }}
            />
          </Card>
        </Col>
      </Row>

      {/* 月度统计 */}
      <MonthlyStatsSection />

      {/* 翻译任务列表 */}
      <TranslationJobList />

      {/* 供应商列表 */}
      <Card
        title={
          <Space>
            <ApiOutlined />
            <span>翻译供应商</span>
          </Space>
        }
        extra={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              setEditingProvider(null);
              setIsModalOpen(true);
            }}
          >
            添加供应商
          </Button>
        }
        style={{ marginBottom: 24 }}
      >
        {providersLoading ? (
          <Skeleton active />
        ) : (
          <Table
            dataSource={providers?.sort((a, b) => {
              // 默认供应商置顶，然后按创建时间倒序
              if (a.isDefault && !b.isDefault) return -1;
              if (!a.isDefault && b.isDefault) return 1;
              return 0;
            })}
            columns={columns}
            rowKey="id"
            pagination={false}
            locale={{
              emptyText: (
                <Empty
                  description="暂无翻译供应商"
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                />
              ),
            }}
          />
        )}
      </Card>

      {/* 成本统计 */}
      <Card
        title={
          <Space>
            <DollarOutlined />
            <span>成本统计</span>
          </Space>
        }
        extra={
          <Select
            value={billingPeriod}
            onChange={setBillingPeriod}
            style={{ width: 150 }}
          >
            <Option value={new Date().toISOString().slice(0, 7)}>本月</Option>
            <Option
              value={new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
                .toISOString()
                .slice(0, 7)}
            >
              上月
            </Option>
          </Select>
        }
      >
        {costLoading ? (
          <Skeleton active />
        ) : costStats && costStats.length > 0 ? (
          <Table
            dataSource={costStats}
            columns={[
              {
                title: "供应商",
                dataIndex: "providerName",
                key: "providerName",
              },
              {
                title: "计费周期",
                dataIndex: "billingPeriod",
                key: "billingPeriod",
              },
              {
                title: "字符数",
                dataIndex: "totalCharacters",
                key: "totalCharacters",
                render: (value: number) => value.toLocaleString(),
              },
              {
                title: "成本 (USD)",
                dataIndex: "totalCost",
                key: "totalCost",
                render: (value: number) => `$${value.toFixed(6)}`,
              },
              {
                title: "任务数",
                dataIndex: "jobCount",
                key: "jobCount",
              },
            ]}
            rowKey={(record) => `${record.providerId}-${record.billingPeriod}`}
            pagination={false}
          />
        ) : (
          <Empty description="暂无成本数据" />
        )}
      </Card>

      {/* 添加/编辑供应商弹窗 */}
      <ProviderModal
        key={editingProvider?.id || "new"}
        open={isModalOpen}
        editingProvider={editingProvider}
        onClose={() => {
          setIsModalOpen(false);
          setEditingProvider(null);
        }}
        onSuccess={(providerId) => {
          setIsModalOpen(false);
          setEditingProvider(null);
          refetchProviders();
          // 新增或编辑成功后自动进行健康检查
          if (providerId) {
            setTimeout(() => {
              handleCheckHealth(providerId);
            }, 500);
          }
        }}
      />
    </div>
  );
};

export default MachineTranslationSettingsPage;
