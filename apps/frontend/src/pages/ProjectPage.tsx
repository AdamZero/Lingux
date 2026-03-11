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
  const [form] = Form.useForm();

  // Fetch projects
  const { data: projects, isLoading } = useQuery<Project[]>({
    queryKey: ['projects'],
    queryFn: async () => {
      try {
        const response = await apiClient.get('/project');
        return response.data;
      } catch (error) {
        console.error('Failed to fetch projects', error);
        return [];
      }
    },
  });

  // Create project mutation
  const createMutation = useMutation({
    mutationFn: (values: { name: string; description?: string }) => 
      apiClient.post('/project', values),
    onSuccess: () => {
      message.success('Project created successfully');
      setIsModalOpen(false);
      form.resetFields();
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
    onError: (error: any) => {
      message.error(error.response?.data?.message || 'Failed to create project');
    },
  });

  const handleCreate = (values: { name: string; description?: string }) => {
    createMutation.mutate(values);
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
      render: () => (
        <Space size="middle">
          <Button type="text" icon={<EditOutlined />} />
          <Button type="text" danger icon={<DeleteOutlined />} />
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
          onClick={() => setIsModalOpen(true)}
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
        title="Create New Project"
        open={isModalOpen}
        onOk={() => form.submit()}
        onCancel={() => setIsModalOpen(false)}
        confirmLoading={createMutation.isPending}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleCreate}
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
