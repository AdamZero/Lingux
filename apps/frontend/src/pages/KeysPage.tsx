import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Layout, 
  Menu, 
  Table, 
  Button, 
  Space, 
  Typography, 
  Empty, 
  Modal, 
  Form, 
  Input, 
  Select, 
  App as AntdApp,
  Tag,
  Drawer,
  Tooltip
} from 'antd';
import { 
  PlusOutlined, 
  FolderAddOutlined, 
  DeleteOutlined, 
  EditOutlined,
  GlobalOutlined,
} from '@ant-design/icons';
import apiClient from '@/api/client';

const { Sider, Content } = Layout;
const { Title, Text } = Typography;
const { Option } = Select;

interface Namespace {
  id: string;
  name: string;
  description?: string;
}

interface Translation {
  id: string;
  content: string;
  status: 'PENDING' | 'TRANSLATING' | 'REVIEWING' | 'APPROVED' | 'PUBLISHED';
  locale: {
    code: string;
    name: string;
  };
}

interface Key {
  id: string;
  name: string;
  description?: string;
  type: 'TEXT' | 'RICH_TEXT' | 'ASSET';
  translations: Translation[];
}

interface Project {
  id: string;
  locales: {
    id: string;
    code: string;
    name: string;
  }[];
}

const KeysPage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const { message } = AntdApp.useApp();
  const queryClient = useQueryClient();
  const [selectedNamespaceId, setSelectedNamespaceId] = useState<string | null>(null);
  
  // Modals state
  const [isNamespaceModalOpen, setIsNamespaceModalOpen] = useState(false);
  const [isKeyModalOpen, setIsKeyModalOpen] = useState(false);
  
  // Edit Translation Drawer State
  const [editingKey, setEditingKey] = useState<Key | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  
  const [namespaceForm] = Form.useForm();
  const [keyForm] = Form.useForm();
  const [translationForm] = Form.useForm();

  // Fetch Project (for locales)
  const { data: project } = useQuery<Project>({
    queryKey: ['project', projectId],
    queryFn: async () => {
      return await apiClient.get(`/projects/${projectId}`);
    },
    enabled: !!projectId,
  });

  // Fetch Namespaces
  const { data: namespaces = [], isLoading: isNamespacesLoading } = useQuery<Namespace[]>({
    queryKey: ['namespaces', projectId],
    queryFn: async () => {
      return await apiClient.get(`/projects/${projectId}/namespaces`);
    },
    enabled: !!projectId,
  });

  // Auto-select first namespace
  useEffect(() => {
    if (!selectedNamespaceId && namespaces.length > 0) {
      setSelectedNamespaceId(namespaces[0].id);
    }
  }, [namespaces, selectedNamespaceId]);

  // Fetch Keys
  const { data: keys = [], isLoading: isKeysLoading } = useQuery<Key[]>({
    queryKey: ['keys', projectId, selectedNamespaceId],
    queryFn: async () => {
      return await apiClient.get(
        `/projects/${projectId}/namespaces/${selectedNamespaceId}/keys`,
      );
    },
    enabled: !!projectId && !!selectedNamespaceId,
  });

  // Mutations
  const createNamespaceMutation = useMutation({
    mutationFn: (values: { name: string; description?: string }) => 
      apiClient.post(`/projects/${projectId}/namespaces`, values),
    onSuccess: () => {
      message.success('Namespace created');
      setIsNamespaceModalOpen(false);
      namespaceForm.resetFields();
      queryClient.invalidateQueries({ queryKey: ['namespaces', projectId] });
    },
  });

  const createKeyMutation = useMutation({
    mutationFn: (values: { name: string; description?: string; type: string }) => 
      apiClient.post(`/projects/${projectId}/namespaces/${selectedNamespaceId}/keys`, values),
    onSuccess: () => {
      message.success('Key created');
      setIsKeyModalOpen(false);
      keyForm.resetFields();
      queryClient.invalidateQueries({ queryKey: ['keys', projectId, selectedNamespaceId] });
    },
  });

  // Save Translations
  const saveTranslationsMutation = useMutation({
    mutationFn: (values: Record<string, string>) => {
      const promises = Object.entries(values).map(([localeCode, content]) => 
        apiClient.patch(`/projects/${projectId}/namespaces/${selectedNamespaceId}/keys/${editingKey?.id}/translations/${localeCode}`, {
          content,
          status: 'PENDING' // Reset to pending on edit
        })
      );
      return Promise.all(promises);
    },
    onSuccess: () => {
      message.success('Translations saved');
      setIsDrawerOpen(false);
      setEditingKey(null);
      queryClient.invalidateQueries({ queryKey: ['keys', projectId, selectedNamespaceId] });
    },
    onError: () => {
      message.error('Failed to save translations');
    }
  });

  const openEditDrawer = (key: Key) => {
    setEditingKey(key);
    // Pre-fill form
    const initialValues: Record<string, string> = {};
    key.translations.forEach(t => {
      initialValues[t.locale.code] = t.content;
    });
    translationForm.setFieldsValue(initialValues);
    setIsDrawerOpen(true);
  };

  const columns = [
    {
      title: 'Key Name',
      dataIndex: 'name',
      key: 'name',
      width: '20%',
      render: (text: string, record: Key) => (
        <div>
          <Text strong style={{ display: 'block' }}>{text}</Text>
          {record.description && <Text type="secondary" style={{ fontSize: 12 }}>{record.description}</Text>}
        </div>
      ),
    },
    {
      title: 'Translations Preview',
      key: 'translations',
      render: (_: unknown, record: Key) => (
        <Space wrap>
          {project?.locales.map(locale => {
            const translation = record.translations.find(t => t.locale.code === locale.code);
            const statusColor = {
              PENDING: 'default',
              TRANSLATING: 'processing',
              REVIEWING: 'warning',
              APPROVED: 'success',
              PUBLISHED: 'geekblue'
            }[translation?.status || 'PENDING'];

            return (
              <Tooltip key={locale.code} title={translation?.content || 'No translation'}>
                <Tag color={translation ? statusColor : 'error'}>
                  {locale.code}
                </Tag>
              </Tooltip>
            );
          })}
        </Space>
      ),
    },
    {
      title: 'Actions',
      key: 'action',
      width: 150,
      render: (_: unknown, record: Key) => (
        <Space>
          <Button 
            type="primary" 
            ghost 
            size="small" 
            icon={<EditOutlined />} 
            onClick={() => openEditDrawer(record)}
          >
            Translate
          </Button>
          <Button type="text" danger size="small" icon={<DeleteOutlined />} />
        </Space>
      ),
    },
  ];

  return (
    <Layout style={{ background: 'transparent', height: '100%' }}>
      <Sider width={250} style={{ background: 'transparent', borderRight: '1px solid #f0f0f0' }}>
        <div style={{ padding: '0 16px 16px 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <Text strong>Namespaces</Text>
            <Button 
              type="text" 
              size="small" 
              icon={<PlusOutlined />} 
              onClick={() => setIsNamespaceModalOpen(true)}
            />
          </div>
          <Menu
            mode="inline"
            selectedKeys={selectedNamespaceId ? [selectedNamespaceId] : []}
            style={{ borderRight: 0, background: 'transparent' }}
            items={namespaces.map((ns) => ({
              key: ns.id,
              label: ns.name,
              icon: <FolderAddOutlined />,
            }))}
            onClick={({ key }) => setSelectedNamespaceId(key)}
          />
          {namespaces.length === 0 && !isNamespacesLoading && (
            <Empty description="No Namespaces" image={Empty.PRESENTED_IMAGE_SIMPLE}>
              <Button type="primary" size="small" onClick={() => setIsNamespaceModalOpen(true)}>
                Create
              </Button>
            </Empty>
          )}
        </div>
      </Sider>
      
      <Content style={{ padding: '0 24px', minHeight: 280 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <Title level={4} style={{ margin: 0 }}>
            {namespaces.find(n => n.id === selectedNamespaceId)?.name || 'Keys'}
          </Title>
          <Button 
            type="primary" 
            icon={<PlusOutlined />} 
            disabled={!selectedNamespaceId}
            onClick={() => setIsKeyModalOpen(true)}
          >
            Create Key
          </Button>
        </div>

        {!selectedNamespaceId ? (
          <Empty description="Select a namespace to view keys" />
        ) : (
          <Table 
            columns={columns} 
            dataSource={keys} 
            rowKey="id" 
            loading={isKeysLoading} 
            pagination={{ pageSize: 10 }}
          />
        )}
      </Content>

      {/* Translation Drawer */}
      <Drawer
        title={`Translate: ${editingKey?.name}`}
        width={600}
        onClose={() => setIsDrawerOpen(false)}
        open={isDrawerOpen}
        extra={
          <Space>
            <Button onClick={() => setIsDrawerOpen(false)}>Cancel</Button>
            <Button type="primary" onClick={() => translationForm.submit()} loading={saveTranslationsMutation.isPending}>
              Save
            </Button>
          </Space>
        }
      >
        <Form
          form={translationForm}
          layout="vertical"
          onFinish={(values) => saveTranslationsMutation.mutate(values)}
        >
          {project?.locales.map(locale => (
            <Form.Item
              key={locale.code}
              name={locale.code}
              label={
                <Space>
                  <GlobalOutlined />
                  {locale.name} ({locale.code})
                </Space>
              }
            >
              <Input.TextArea rows={3} placeholder={`Enter translation for ${locale.name}...`} />
            </Form.Item>
          ))}
        </Form>
      </Drawer>

      {/* Create Namespace Modal */}
      <Modal
        title="Create Namespace"
        open={isNamespaceModalOpen}
        onOk={() => namespaceForm.submit()}
        onCancel={() => setIsNamespaceModalOpen(false)}
        confirmLoading={createNamespaceMutation.isPending}
      >
        <Form form={namespaceForm} layout="vertical" onFinish={(values) => createNamespaceMutation.mutate(values)}>
          <Form.Item name="name" label="Name" rules={[{ required: true }]}>
            <Input placeholder="e.g. common, auth, home" />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Create Key Modal */}
      <Modal
        title="Create Key"
        open={isKeyModalOpen}
        onOk={() => keyForm.submit()}
        onCancel={() => setIsKeyModalOpen(false)}
        confirmLoading={createKeyMutation.isPending}
      >
        <Form form={keyForm} layout="vertical" onFinish={(values) => createKeyMutation.mutate(values)} initialValues={{ type: 'TEXT' }}>
          <Form.Item name="name" label="Key Name" rules={[{ required: true }]}>
            <Input placeholder="e.g. button.submit" />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="type" label="Type">
            <Select>
              <Option value="TEXT">Text</Option>
              <Option value="RICH_TEXT">Rich Text</Option>
              <Option value="ASSET">Asset</Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </Layout>
  );
};

export default KeysPage;
