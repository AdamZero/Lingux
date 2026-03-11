import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Table, Button, Space, Typography, Card, Modal, Form, Input, App as AntdApp } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import apiClient from '@/api/client';

const { Title } = Typography;

interface Project {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
}

import { useNavigate } from 'react-router-dom';

const ProjectPage: React.FC = () => {
  const navigate = useNavigate();
  const { message } = AntdApp.useApp();
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [form] = Form.useForm();

  // Fetch projects
  const { data: projects = [], isLoading } = useQuery<Project[]>({
    queryKey: ['projects'],
    queryFn: async () => {
      try {
        return await apiClient.get('/projects');
      } catch (error) {
        console.error('Failed to fetch projects', error);
        return [];
      }
    },
  });

  // Create project mutation
  const createMutation = useMutation({
    mutationFn: (values: { name: string; description?: string }) => 
      apiClient.post('/projects', values),
    onSuccess: () => {
      message.success('Project created successfully');
      setIsModalOpen(false);
      form.resetFields();
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { message?: string } } };
      message.error(err.response?.data?.message || 'Failed to create project');
    },
  });

  const updateMutation = useMutation({
    mutationFn: (values: { name: string; description?: string }) => {
      if (!editingProject) {
        throw new Error('No project selected for update');
      }
      return apiClient.patch(`/projects/${editingProject.id}`, values);
    },
    onSuccess: () => {
      message.success('Project updated successfully');
      setIsModalOpen(false);
      setEditingProject(null);
      form.resetFields();
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { message?: string } } };
      message.error(err.response?.data?.message || 'Failed to update project');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (projectId: string) => apiClient.delete(`/projects/${projectId}`),
    onSuccess: () => {
      message.success('Project deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { message?: string } } };
      message.error(err.response?.data?.message || 'Failed to delete project');
    },
  });

  const handleSubmit = (values: { name: string; description?: string }) => {
    if (editingProject) {
      updateMutation.mutate(values);
      return;
    }
    createMutation.mutate(values);
  };

  const openCreateModal = () => {
    setEditingProject(null);
    form.resetFields();
    setIsModalOpen(true);
  };

  const openEditModal = (project: Project) => {
    setEditingProject(project);
    form.setFieldsValue({
      name: project.name,
      description: project.description,
    });
    setIsModalOpen(true);
  };

  const columns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: Project) => (
        <a onClick={() => navigate(`/project/${record.id}/keys`)}>{text}</a>
      ),
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
    },
    {
      title: 'Created At',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: string) => new Date(date).toLocaleString(),
    },
    {
      title: 'Actions',
      key: 'action',
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
                title: 'Delete Project',
                content: `Are you sure you want to delete "${record.name}"?`,
                okText: 'Delete',
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
    <Space direction="vertical" size="large" style={{ display: 'flex', width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Title level={2} style={{ margin: 0 }}>Projects</Title>
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
        title={editingProject ? 'Edit Project' : 'Create New Project'}
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
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          <Form.Item
            name="name"
            label="Project Name"
            rules={[{ required: true, message: 'Please input project name!' }]}
          >
            <Input placeholder="e.g. My Website" />
          </Form.Item>
          <Form.Item
            name="description"
            label="Description"
          >
            <Input.TextArea rows={3} placeholder="Project description..." />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
};

export default ProjectPage;
