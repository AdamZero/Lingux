import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Card,
  Row,
  Col,
  Statistic,
  Button,
  List,
  Typography,
  Tag,
  Skeleton,
  Space,
} from "antd";
import {
  PlusOutlined,
  ImportOutlined,
  RocketOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  FileTextOutlined,
} from "@ant-design/icons";
import { useAppStore } from "@/store/useAppStore";
import { useWorkspaceStats } from "@/hooks/useWorkspaceStats";
import { useWorkspaceTasks } from "@/hooks/useWorkspaceTasks";
import { usePermission } from "@/hooks/usePermission";
import { PageHeader } from "@/components/common/PageHeader";
import { ComingSoonModal } from "@/components/common/ComingSoonModal";
import { EmptyState } from "@/components/common/EmptyState";

const { Text } = Typography;

const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAppStore();
  const { features } = usePermission();
  const [importModalOpen, setImportModalOpen] = useState(false);

  // TODO: 从上下文或路由获取当前项目ID
  const currentProjectId = "temp-project-id";

  const { data: stats, isLoading: statsLoading } =
    useWorkspaceStats(currentProjectId);
  const { data: tasksData, isLoading: tasksLoading } = useWorkspaceTasks({
    projectId: currentProjectId,
    limit: 5,
  });

  const handleTaskClick = (taskId: string) => {
    navigate(`/translations?task=${taskId}`);
  };

  const handleImportClick = () => {
    if (!features?.import) {
      setImportModalOpen(true);
      return;
    }
    navigate("/imports");
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "HIGH":
        return "red";
      case "MEDIUM":
        return "orange";
      case "LOW":
        return "green";
      default:
        return "default";
    }
  };

  const getPriorityText = (priority: string) => {
    switch (priority) {
      case "HIGH":
        return "高";
      case "MEDIUM":
        return "中";
      case "LOW":
        return "低";
      default:
        return priority;
    }
  };

  return (
    <div>
      <PageHeader
        title={`欢迎回来，${user?.username || "用户"}`}
        description="这里是您的工作台，可以快速查看待办事项和项目动态"
      />

      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={8}>
          <Card
            hoverable
            onClick={() => navigate("/translations?status=PENDING")}
          >
            {statsLoading ? (
              <Skeleton active paragraph={{ rows: 1 }} />
            ) : (
              <Statistic
                title="待翻译"
                value={stats?.pending || 0}
                prefix={<ClockCircleOutlined />}
                valueStyle={{ color: "#cf1322" }}
              />
            )}
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card hoverable onClick={() => navigate("/reviews")}>
            {statsLoading ? (
              <Skeleton active paragraph={{ rows: 1 }} />
            ) : (
              <Statistic
                title="审核中"
                value={stats?.reviewing || 0}
                prefix={<FileTextOutlined />}
                valueStyle={{ color: "#faad14" }}
              />
            )}
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card
            hoverable
            onClick={() => navigate("/translations?status=APPROVED")}
          >
            {statsLoading ? (
              <Skeleton active paragraph={{ rows: 1 }} />
            ) : (
              <Statistic
                title="本月已完成"
                value={stats?.approved || 0}
                prefix={<CheckCircleOutlined />}
                valueStyle={{ color: "#3f8600" }}
              />
            )}
          </Card>
        </Col>
      </Row>

      {/* 快捷操作 */}
      <Card title="快捷操作" style={{ marginBottom: 24 }}>
        <Space size="middle">
          <Button
            type="primary"
            icon={<PlusOutlined />}
            size="large"
            onClick={() => navigate("/translations")}
          >
            新建翻译
          </Button>
          <Button
            icon={<ImportOutlined />}
            size="large"
            onClick={handleImportClick}
          >
            导入词条
          </Button>
          <Button
            icon={<RocketOutlined />}
            size="large"
            onClick={() => navigate("/releases")}
          >
            创建发布
          </Button>
        </Space>
      </Card>

      {/* 我的待办 */}
      <Card
        title="我的待办"
        extra={
          <Button type="link" onClick={() => navigate("/translations")}>
            查看全部
          </Button>
        }
        style={{ marginBottom: 24 }}
      >
        {tasksLoading ? (
          <Skeleton active paragraph={{ rows: 3 }} />
        ) : tasksData?.items && tasksData.items.length > 0 ? (
          <List
            dataSource={tasksData.items}
            renderItem={(task) => (
              <List.Item
                actions={[
                  <Button
                    key="action"
                    type="link"
                    onClick={() => handleTaskClick(task.id)}
                  >
                    去处理
                  </Button>,
                ]}
              >
                <List.Item.Meta
                  title={
                    <Space>
                      <Text strong>{task.title}</Text>
                      <Tag color={getPriorityColor(task.priority)}>
                        {getPriorityText(task.priority)}优先级
                      </Tag>
                    </Space>
                  }
                  description={
                    <Space direction="vertical" size={0}>
                      <Text type="secondary">{task.description}</Text>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {task.key.namespace} / {task.key.name}
                      </Text>
                    </Space>
                  }
                />
              </List.Item>
            )}
          />
        ) : (
          <EmptyState type="no-data" description="暂无待办任务，太棒了！" />
        )}
      </Card>

      {/* 最近动态 - 预留 */}
      <Card title="最近动态">
        <EmptyState
          type="construction"
          title="功能开发中"
          description="动态功能即将上线，敬请期待"
        />
      </Card>

      {/* ComingSoon Modal */}
      <ComingSoonModal
        open={importModalOpen}
        title="导入功能"
        description="词条导入功能即将上线，支持 JSON/YAML/Excel 格式"
        eta="2026-04-01"
        onClose={() => setImportModalOpen(false)}
      />
    </div>
  );
};

export default DashboardPage;
