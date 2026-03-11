import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Table, Button, Space, Typography, Card } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import apiClient from '@/api/client';

const { Title } = Typography;

interface Project {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
}

const ProjectPage: React.FC = () => {
  const { data: projects, isLoading } = useQuery<Project[]>({
    queryKey: ['projects'],
    queryFn: () => apiClient.get('/project'),
  });

  const columns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (text: string) => <a>{text}</a>,
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
    <Space direction="vertical" size="large" style={{ display: 'flex' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Title level={2} style={{ margin: 0 }}>Projects</Title>
        <Button type="primary" icon={<PlusOutlined />}>
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
    </Space>
  );
};

export default ProjectPage;
