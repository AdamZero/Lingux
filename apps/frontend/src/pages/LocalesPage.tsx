import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Table, 
  Button, 
  Space, 
  Typography, 
  Card, 
  Modal, 
  Select, 
  App as AntdApp,
  Tag 
} from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import apiClient from '@/api/client';

const { Title, Text } = Typography;
const { Option } = Select;

interface Locale {
  id: string;
  code: string;
  name: string;
}

interface Project {
  id: string;
  name: string;
  locales: Locale[];
}

const LocalesPage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const { message } = AntdApp.useApp();
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedLocaleId, setSelectedLocaleId] = useState<string | null>(null);

  // Fetch Project Details (to get enabled locales)
  const { data: project, isLoading: isProjectLoading } = useQuery<Project>({
    queryKey: ['project', projectId],
    queryFn: async () => {
      return await apiClient.get(`/projects/${projectId}`);
    },
    enabled: !!projectId,
  });

  // Fetch All System Locales
  const { data: allLocales = [], isLoading: isAllLocalesLoading } = useQuery<Locale[]>({
    queryKey: ['locales'],
    queryFn: async () => {
      return await apiClient.get('/locales');
    },
  });

  // Filter out locales that are already added to the project
  const availableLocales = allLocales.filter(
    (locale) => !project?.locales.some((pl) => pl.id === locale.id)
  );

  // Add Locale Mutation
  const addLocaleMutation = useMutation({
    mutationFn: (localeId: string) => 
      apiClient.post(`/projects/${projectId}/locales`, { localeId }),
    onSuccess: () => {
      message.success('Locale added to project');
      setIsModalOpen(false);
      setSelectedLocaleId(null);
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { message?: string } } };
      message.error(err.response?.data?.message || 'Failed to add locale');
    },
  });

  // Remove Locale Mutation
  const removeLocaleMutation = useMutation({
    mutationFn: (localeId: string) => 
      apiClient.delete(`/projects/${projectId}/locales/${localeId}`),
    onSuccess: () => {
      message.success('Locale removed from project');
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { message?: string } } };
      message.error(err.response?.data?.message || 'Failed to remove locale');
    },
  });

  const columns = [
    {
      title: 'Locale Code',
      dataIndex: 'code',
      key: 'code',
      render: (text: string) => <Tag color="blue">{text}</Tag>,
    },
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: 'Actions',
      key: 'action',
      render: (_: unknown, record: Locale) => (
        <Button 
          type="text" 
          danger 
          icon={<DeleteOutlined />} 
          onClick={() => {
            Modal.confirm({
              title: 'Remove Locale',
              content: `Are you sure you want to remove ${record.name} (${record.code}) from this project?`,
              onOk: () => removeLocaleMutation.mutate(record.id),
            });
          }}
        />
      ),
    },
  ];

  return (
    <Space direction="vertical" size="large" style={{ display: 'flex', width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Title level={4} style={{ margin: 0 }}>Project Locales</Title>
        <Button 
          type="primary" 
          icon={<PlusOutlined />} 
          onClick={() => setIsModalOpen(true)}
        >
          Add Locale
        </Button>
      </div>

      <Card loading={isProjectLoading}>
        <Table 
          columns={columns} 
          dataSource={project?.locales || []} 
          rowKey="id" 
          pagination={false}
        />
      </Card>

      <Modal
        title="Add Locale to Project"
        open={isModalOpen}
        onOk={() => {
          if (selectedLocaleId) {
            addLocaleMutation.mutate(selectedLocaleId);
          }
        }}
        onCancel={() => setIsModalOpen(false)}
        confirmLoading={addLocaleMutation.isPending}
        okButtonProps={{ disabled: !selectedLocaleId }}
      >
        <div style={{ marginBottom: 16 }}>
          <Text>Select a locale to enable for this project:</Text>
        </div>
        <Select
          style={{ width: '100%' }}
          placeholder="Select a locale"
          loading={isAllLocalesLoading}
          onChange={setSelectedLocaleId}
          value={selectedLocaleId}
          showSearch
          optionFilterProp="children"
        >
          {availableLocales.map((locale) => (
            <Option key={locale.id} value={locale.id}>
              {locale.name} ({locale.code})
            </Option>
          ))}
        </Select>
        {availableLocales.length === 0 && (
          <div style={{ marginTop: 8, color: '#999' }}>
            No more locales available.
          </div>
        )}
      </Modal>
    </Space>
  );
};

export default LocalesPage;
