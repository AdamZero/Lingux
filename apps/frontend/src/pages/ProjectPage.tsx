import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Table,
  Button,
  Space,
  Typography,
  Card,
  Modal,
  Form,
  Input,
  App as AntdApp,
  Select,
  Switch,
  Avatar,
  Tooltip,
} from "antd";
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";
import apiClient from "@/api/client";
import { useAppStore } from "@/store/useAppStore";

const { Title } = Typography;

// 用户角色常量
const USER_ROLE = {
  ADMIN: "ADMIN",
  EDITOR: "EDITOR",
  REVIEWER: "REVIEWER",
} as const;

interface User {
  id: string;
  username: string;
  name?: string;
  avatar?: string;
}

interface Project {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  baseLocale: string;
  locales: Locale[];
  autoTranslateEnabled?: boolean;
  owners: User[];
}

import { useNavigate } from "react-router-dom";

interface Locale {
  id: string;
  code: string;
  name: string;
}

const ProjectPage: React.FC = () => {
  const navigate = useNavigate();
  const { message } = AntdApp.useApp();
  const queryClient = useQueryClient();
  const { user } = useAppStore();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [form] = Form.useForm();

  const isAdmin = user?.role === USER_ROLE.ADMIN;

  const canManageProject = (project: Project) => {
    if (isAdmin) return true;
    return project.owners?.some((owner) => owner.id === user?.id);
  };

  const { data: allLocales = [], isLoading: isLocalesLoading } = useQuery<
    Locale[]
  >({
    queryKey: ["locales"],
    queryFn: async () => {
      return await apiClient.get("/locales");
    },
  });

  // Fetch projects
  const { data: projects = [], isLoading } = useQuery<Project[]>({
    queryKey: ["projects"],
    queryFn: async () => {
      try {
        return await apiClient.get("/projects");
      } catch (error) {
        console.error("Failed to fetch projects", error);
        return [];
      }
    },
  });

  // Create project mutation
  const createMutation = useMutation({
    mutationFn: (values: {
      name: string;
      description?: string;
      baseLocale: string;
      localeIds?: string[];
    }) => apiClient.post("/projects", values),
    onSuccess: () => {
      message.success("Project created successfully");
      setIsModalOpen(false);
      form.resetFields();
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { message?: string } } };
      message.error(err.response?.data?.message || "Failed to create project");
    },
  });

  const updateMutation = useMutation({
    mutationFn: (values: {
      name: string;
      description?: string;
      localeIds?: string[];
      autoTranslateEnabled?: boolean;
    }) => {
      if (!editingProject) {
        throw new Error("No project selected for update");
      }
      return apiClient.patch(`/projects/${editingProject.id}`, values);
    },
    onSuccess: () => {
      message.success("Project updated successfully");
      setIsModalOpen(false);
      setEditingProject(null);
      form.resetFields();
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { message?: string } } };
      message.error(err.response?.data?.message || "Failed to update project");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (projectId: string) =>
      apiClient.delete(`/projects/${projectId}`),
    onSuccess: () => {
      message.success("Project deleted successfully");
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { message?: string } } };
      message.error(err.response?.data?.message || "Failed to delete project");
    },
  });

  // 自动翻译开关 mutation
  const updateAutoTranslateMutation = useMutation({
    mutationFn: ({
      projectId,
      enabled,
    }: {
      projectId: string;
      enabled: boolean;
    }) =>
      apiClient.patch(`/projects/${projectId}`, {
        autoTranslateEnabled: enabled,
      }),
    onSuccess: (_, variables) => {
      message.success(variables.enabled ? "已启用自动翻译" : "已关闭自动翻译");
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { message?: string } } };
      message.error(err.response?.data?.message || "更新失败");
    },
  });

  const handleSubmit = (values: {
    name: string;
    description?: string;
    baseLocale?: string;
    localeIds?: string[];
  }) => {
    const baseLocale = values.baseLocale?.trim() || "zh-CN";
    const baseLocaleId = allLocales.find((l) => l.code === baseLocale)?.id;
    const localeIds = Array.from(
      new Set([
        ...(values.localeIds ?? []),
        ...(baseLocaleId ? [baseLocaleId] : []),
      ]),
    );

    if (editingProject) {
      updateMutation.mutate({
        name: values.name,
        description: values.description,
        localeIds,
      });
      return;
    }
    createMutation.mutate({
      name: values.name,
      description: values.description,
      baseLocale,
      localeIds,
    });
  };

  const openCreateModal = () => {
    setEditingProject(null);
    form.resetFields();
    const defaultBaseLocale = allLocales.some((l) => l.code === "zh-CN")
      ? "zh-CN"
      : (allLocales[0]?.code ?? "zh-CN");
    const defaultBaseLocaleId = allLocales.find(
      (l) => l.code === defaultBaseLocale,
    )?.id;

    form.setFieldsValue({
      baseLocale: defaultBaseLocale,
      localeIds: defaultBaseLocaleId ? [defaultBaseLocaleId] : [],
    });
    setIsModalOpen(true);
  };

  const openEditModal = (project: Project) => {
    setEditingProject(project);
    form.setFieldsValue({
      name: project.name,
      description: project.description,
      baseLocale: project.baseLocale,
      localeIds: project.locales.map((l) => l.id),
    });
    setIsModalOpen(true);
  };

  const columns = [
    {
      title: "Name",
      dataIndex: "name",
      key: "name",
      render: (text: string, record: Project) => (
        <a onClick={() => navigate(`/project/${record.id}/keys`)}>{text}</a>
      ),
    },
    {
      title: "Owner",
      key: "owners",
      render: (_: unknown, record: Project) => (
        <Avatar.Group maxCount={3} size="small">
          {record.owners?.map((owner) => (
            <Tooltip key={owner.id} title={owner.name || owner.username}>
              <Avatar src={owner.avatar}>
                {(owner.name || owner.username)?.charAt(0).toUpperCase()}
              </Avatar>
            </Tooltip>
          ))}
        </Avatar.Group>
      ),
    },
    {
      title: "Description",
      dataIndex: "description",
      key: "description",
      ellipsis: true,
      width: 200,
    },
    {
      title: "自动翻译",
      key: "autoTranslate",
      render: (_: unknown, record: Project) => (
        <Switch
          checked={record.autoTranslateEnabled}
          disabled={
            !canManageProject(record) || updateAutoTranslateMutation.isPending
          }
          loading={
            updateAutoTranslateMutation.variables?.projectId === record.id &&
            updateAutoTranslateMutation.isPending
          }
          onChange={(checked) => {
            updateAutoTranslateMutation.mutate({
              projectId: record.id,
              enabled: checked,
            });
          }}
          checkedChildren={<ThunderboltOutlined />}
          unCheckedChildren={<ThunderboltOutlined />}
        />
      ),
    },
    {
      title: "Created At",
      dataIndex: "createdAt",
      key: "createdAt",
      render: (date: string) => new Date(date).toLocaleString(),
      defaultSortOrder: "descend",
      sorter: (a: Project, b: Project) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    },
    {
      title: "Actions",
      key: "action",
      render: (_: unknown, record: Project) => (
        <Space size="middle">
          <Button
            type="text"
            icon={<EditOutlined />}
            onClick={() => openEditModal(record)}
          />
          <Button
            type="text"
            danger
            icon={<DeleteOutlined />}
            loading={deleteMutation.isPending}
            onClick={() => {
              Modal.confirm({
                title: "Delete Project",
                content: `Are you sure you want to delete "${record.name}"?`,
                okText: "Delete",
                okButtonProps: { danger: true },
                onOk: () => deleteMutation.mutate(record.id),
              });
            }}
          />
        </Space>
      ),
    },
  ];

  return (
    <Space
      direction="vertical"
      size="large"
      style={{ display: "flex", width: "100%" }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Title level={2} style={{ margin: 0 }}>
          Projects
        </Title>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={openCreateModal}
        >
          Create Project
        </Button>
      </div>

      <Card>
        <Table
          columns={columns}
          dataSource={projects}
          rowKey="id"
          loading={isLoading}
        />
      </Card>

      <Modal
        title={editingProject ? "Edit Project" : "Create New Project"}
        open={isModalOpen}
        onOk={() => form.submit()}
        onCancel={() => {
          setIsModalOpen(false);
          setEditingProject(null);
          form.resetFields();
        }}
        confirmLoading={
          editingProject ? updateMutation.isPending : createMutation.isPending
        }
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item
            name="name"
            label="Project Name"
            rules={[{ required: true, message: "Please input project name!" }]}
          >
            <Input placeholder="e.g. My Website" />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={3} placeholder="Project description..." />
          </Form.Item>
          <Form.Item
            name="baseLocale"
            label="Base Locale"
            rules={[{ required: true, message: "Please select base locale!" }]}
          >
            <Select
              showSearch
              optionFilterProp="label"
              loading={isLocalesLoading}
              disabled={!!editingProject}
              options={allLocales.map((l) => ({
                value: l.code,
                label: `${l.name} (${l.code})`,
              }))}
              placeholder="Select base locale"
            />
          </Form.Item>
          <Form.Item
            name="localeIds"
            label="Supported Locales"
            rules={[
              { required: true, message: "Please select at least one locale!" },
            ]}
          >
            <Select
              mode="multiple"
              showSearch
              optionFilterProp="label"
              loading={isLocalesLoading}
              options={allLocales.map((l) => ({
                value: l.id,
                label: `${l.name} (${l.code})`,
              }))}
              placeholder="Select supported locales"
            />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
};

export default ProjectPage;
