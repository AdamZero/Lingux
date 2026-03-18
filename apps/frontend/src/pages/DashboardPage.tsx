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
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={8}>
          <Card
            size="small"
            hoverable
            onClick={() => navigate("/translations?status=PENDING")}
            bodyStyle={{ padding: 16 }}
          >
            {statsLoading ? (
              <Skeleton active paragraph={{ rows: 1 }} />
            ) : (
              <Statistic
                title={<Text style={{ fontSize: 13 }}>待翻译</Text>}
                value={stats?.pending || 0}
                prefix={<ClockCircleOutlined style={{ fontSize: 16 }} />}
                valueStyle={{ color: "#cf1322", fontSize: 24 }}
              />
            )}
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card
            size="small"
            hoverable
            onClick={() => navigate("/reviews")}
            bodyStyle={{ padding: 16 }}
          >
            {statsLoading ? (
              <Skeleton active paragraph={{ rows: 1 }} />
            ) : (
              <Statistic
                title={<Text style={{ fontSize: 13 }}>审核中</Text>}
                value={stats?.reviewing || 0}
                prefix={<FileTextOutlined style={{ fontSize: 16 }} />}
                valueStyle={{ color: "#faad14", fontSize: 24 }}
              />
            )}
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card
            size="small"
            hoverable
            onClick={() => navigate("/translations?status=APPROVED")}
            bodyStyle={{ padding: 16 }}
          >
            {statsLoading ? (
              <Skeleton active paragraph={{ rows: 1 }} />
            ) : (
              <Statistic
                title={<Text style={{ fontSize: 13 }}>本月已完成</Text>}
                value={stats?.approved || 0}
                prefix={<CheckCircleOutlined style={{ fontSize: 16 }} />}
                valueStyle={{ color: "#3f8600", fontSize: 24 }}
              />
            )}
          </Card>
        </Col>
      </Row>

      {/* 快捷操作 */}
      <Card
        size="small"
        title="快捷操作"
        style={{ marginBottom: 16 }}
        bodyStyle={{ padding: 12 }}
      >
        <Space size="small">
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => navigate("/translations")}
          >
            新建翻译
          </Button>
          <Button icon={<ImportOutlined />} onClick={handleImportClick}>
            导入词条
          </Button>
          <Button
            icon={<RocketOutlined />}
            onClick={() => navigate("/releases")}
          >
            创建发布
          </Button>
        </Space>
      </Card>

      {/* 我的待办 */}
      <Card
        size="small"
        title="我的待办"
        extra={
          <Button
            type="link"
            size="small"
            onClick={() => navigate("/translations")}
          >
            查看全部
          </Button>
        }
        style={{ marginBottom: 16 }}
      >
        {tasksLoading ? (
          <Skeleton active paragraph={{ rows: 3 }} />
        ) : tasksData?.items && tasksData.items.length > 0 ? (
          <List
            size="small"
            dataSource={tasksData.items}
            renderItem={(task) => (
              <List.Item
                actions={[
                  <Button
                    key="action"
                    type="link"
                    size="small"
                    onClick={() => handleTaskClick(task.id)}
                  >
                    去处理
                  </Button>,
                ]}
                style={{ padding: "8px 0" }}
              >
                <List.Item.Meta
                  title={
                    <Space size={4}>
                      <Text strong style={{ fontSize: 13 }}>
                        {task.title}
                      </Text>
                      <Tag
                        color={getPriorityColor(task.priority)}
                        style={{ fontSize: 11, padding: "0 4px" }}
                      >
                        {getPriorityText(task.priority)}
                      </Tag>
                    </Space>
                  }
                  description={
                    <Space direction="vertical" size={0}>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {task.description}
                      </Text>
                      <Text type="secondary" style={{ fontSize: 11 }}>
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

      {/* 最近动态 */}
      <Card size="small" title="最近动态">
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
