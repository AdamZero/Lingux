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
  UploadOutlined,
  DownloadOutlined,
  InboxOutlined,
} from '@ant-design/icons';
import apiClient from '@/api/client';
import PublishDrawer from '@/components/release/PublishDrawer';

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

interface LookupKeyCandidate {
  id: string;
  name: string;
  updatedAt: string;
  namespace: {
    id: string;
    name: string;
  };
  _count: {
    translations: number;
  };
}

interface Project {
  id: string;
  baseLocale: string;
  currentReleaseId?: string | null;
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
  const [deletingKeyId, setDeletingKeyId] = useState<string | null>(null);
  
  // Modals state
  const [isNamespaceModalOpen, setIsNamespaceModalOpen] = useState(false);
  const [isKeyModalOpen, setIsKeyModalOpen] = useState(false);
  const [isPublishOpen, setIsPublishOpen] = useState(false);
  
  // Edit Translation Drawer State
  const [editingKey, setEditingKey] = useState<Key | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  
  // Import/Export State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importFormat, setImportFormat] = useState<'json' | 'yaml'>('json');
  const [importMode, setImportMode] = useState<'fillMissing' | 'overwrite'>('fillMissing');
  const [importFile, setImportFile] = useState<File | null>(null);
  
  // Search and Filter State
  const [searchKeyword, setSearchKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  
  const [namespaceForm] = Form.useForm();
  const [keyForm] = Form.useForm();
  const [translationForm] = Form.useForm();
  const [importForm] = Form.useForm();

  const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null;

  const extractApiError = (error: unknown) => {
    if (!isRecord(error)) {
      return { status: undefined as number | undefined, data: undefined as unknown };
    }
    const response = error.response;
    if (!isRecord(response)) {
      return { status: undefined as number | undefined, data: undefined as unknown };
    }
    const status = typeof response.status === 'number' ? response.status : undefined;
    const data = response.data;
    return { status, data };
  };

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
    queryKey: ['keys', projectId, selectedNamespaceId, searchKeyword, statusFilter],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (searchKeyword) {
        params.search = searchKeyword;
      }
      if (statusFilter) {
        params.status = statusFilter;
      }
      return await apiClient.get(
        `/projects/${projectId}/namespaces/${selectedNamespaceId}/keys`,
        { params }
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
    onError: () => {
      return;
    },
  });

  const createKeyMutation = useMutation({
    mutationFn: (values: {
      name: string;
      description?: string;
      type: string;
      baseContent: string;
    }) =>
      apiClient.post(`/projects/${projectId}/namespaces/${selectedNamespaceId}/keys`, {
        name: values.name,
        description: values.description,
        type: values.type,
      }),
    onSuccess: async (created: unknown, variables: {
      name: string;
      description?: string;
      type: string;
      baseContent: string;
    }) => {
      message.success('Key created');
      setIsKeyModalOpen(false);
      keyForm.resetFields();
      queryClient.invalidateQueries({ queryKey: ['keys', projectId, selectedNamespaceId] });

      const createdKeyId =
        isRecord(created) && typeof created.id === 'string' ? created.id : undefined;
      const createdKeyName =
        isRecord(created) && typeof created.name === 'string' ? created.name : undefined;

      if (!createdKeyId || !createdKeyName) {
        return;
      }

      const baseContent = variables.baseContent.trim();
      const defaultLocaleCode = project?.baseLocale || project?.locales?.[0]?.code;
      if (!defaultLocaleCode) {
        return;
      }

      try {
        await apiClient.patch(
          `/projects/${projectId}/namespaces/${selectedNamespaceId}/keys/${createdKeyId}/translations/${defaultLocaleCode}`,
          { content: baseContent },
        );
        queryClient.invalidateQueries({
          queryKey: ['keys', projectId, selectedNamespaceId],
        });
      } catch {
        return;
      }

      try {
        const candidates = await lookupSameNameKeys(createdKeyName, createdKeyId);
        if (candidates.length === 0) {
          return;
        }

        const source = candidates[0];
        Modal.confirm({
          title: '发现同名词条',
          content: `在「${source.namespace.name}」中找到同名词条（${source._count.translations} 条翻译），是否一键复用？`,
          okText: '一键复用翻译',
          cancelText: '跳过',
          onOk: async () => {
            await copyTranslationsFromKey(createdKeyId, source.id);
            message.success('已复用翻译');
            queryClient.invalidateQueries({
              queryKey: ['keys', projectId, selectedNamespaceId],
            });
            const fullKey = await fetchKeyById(createdKeyId);
            openEditDrawer(fullKey);
          },
        });
      } catch {
        return;
      }
    },
    onError: (error: unknown) => {
      const { status, data } = extractApiError(error);
      if (status === 409) {
        const existingKey =
          isRecord(data) && isRecord(data.message) && isRecord(data.message.existingKey)
            ? (data.message.existingKey as Key)
            : isRecord(data) && isRecord(data.existingKey)
              ? (data.existingKey as Key)
              : null;

        if (existingKey) {
          setIsKeyModalOpen(false);
          keyForm.resetFields();

          Modal.confirm({
            title: 'Key 已存在',
            content: `已存在同名词条：${existingKey.name}`,
            okText: '打开并编辑翻译',
            cancelText: '取消',
            onOk: () => {
              openEditDrawer(existingKey);
            },
          });
          return;
        }
      }

      return;
    },
  });

  const deleteKeyMutation = useMutation({
    mutationFn: (keyId: string) =>
      apiClient.delete(
        `/projects/${projectId}/namespaces/${selectedNamespaceId}/keys/${keyId}`,
      ),
    onSuccess: async (_data, keyId) => {
      if (editingKey?.id === keyId) {
        setIsDrawerOpen(false);
        setEditingKey(null);
      }
      setDeletingKeyId(null);
      message.success('Key deleted');
      await queryClient.invalidateQueries({
        queryKey: ['keys', projectId, selectedNamespaceId],
      });
    },
    onError: () => {
      setDeletingKeyId(null);
      return;
    },
  });

  const fetchKeyById = async (keyId: string) => {
    return (await apiClient.get(
      `/projects/${projectId}/namespaces/${selectedNamespaceId}/keys/${keyId}`,
    )) as Key;
  };

  const lookupSameNameKeys = async (name: string, excludeKeyId?: string) => {
    return (await apiClient.get(
      `/projects/${projectId}/namespaces/${selectedNamespaceId}/keys/lookup`,
      {
        params: { name, excludeKeyId },
      },
    )) as LookupKeyCandidate[];
  };

  const copyTranslationsFromKey = async (
    targetKeyId: string,
    sourceKeyId: string,
  ) => {
    return await apiClient.post(
      `/projects/${projectId}/namespaces/${selectedNamespaceId}/keys/${targetKeyId}/copy-translations`,
      { sourceKeyId, mode: 'fillMissing' },
    );
  };

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

  const handleSubmitReview = async (keyId: string, localeCode: string) => {
    try {
      await apiClient.post(`/projects/${projectId}/namespaces/${selectedNamespaceId}/keys/${keyId}/translations/${localeCode}/submit-review`);
      message.success('Translation submitted for review');
      queryClient.invalidateQueries({ queryKey: ['keys', projectId, selectedNamespaceId] });
      // Refresh editing key
      if (editingKey?.id === keyId) {
        const updatedKey = await fetchKeyById(keyId);
        setEditingKey(updatedKey);
      }
    } catch (error) {
      message.error('Failed to submit for review');
    }
  };

  const handleApprove = async (keyId: string, localeCode: string) => {
    try {
      await apiClient.post(`/projects/${projectId}/namespaces/${selectedNamespaceId}/keys/${keyId}/translations/${localeCode}/approve`);
      message.success('Translation approved');
      queryClient.invalidateQueries({ queryKey: ['keys', projectId, selectedNamespaceId] });
      // Refresh editing key
      if (editingKey?.id === keyId) {
        const updatedKey = await fetchKeyById(keyId);
        setEditingKey(updatedKey);
      }
    } catch (error) {
      message.error('Failed to approve translation');
    }
  };

  const handleReject = async (keyId: string, localeCode: string) => {
    const reason = prompt('Please enter the reason for rejection:');
    if (!reason) return;
    
    try {
      await apiClient.post(`/projects/${projectId}/namespaces/${selectedNamespaceId}/keys/${keyId}/translations/${localeCode}/reject`, { reason });
      message.success('Translation rejected');
      queryClient.invalidateQueries({ queryKey: ['keys', projectId, selectedNamespaceId] });
      // Refresh editing key
      if (editingKey?.id === keyId) {
        const updatedKey = await fetchKeyById(keyId);
        setEditingKey(updatedKey);
      }
    } catch (error) {
      message.error('Failed to reject translation');
    }
  };

  const handlePublish = async (keyId: string, localeCode: string) => {
    try {
      await apiClient.post(`/projects/${projectId}/namespaces/${selectedNamespaceId}/keys/${keyId}/translations/${localeCode}/publish`);
      message.success('Translation published');
      queryClient.invalidateQueries({ queryKey: ['keys', projectId, selectedNamespaceId] });
      // Refresh editing key
      if (editingKey?.id === keyId) {
        const updatedKey = await fetchKeyById(keyId);
        setEditingKey(updatedKey);
      }
    } catch (error) {
      message.error('Failed to publish translation');
    }
  };

  const handleExport = async () => {
    try {
      const format = 'json'; // Default format
      const response = await apiClient.get(`/projects/${projectId}/namespaces/${selectedNamespaceId}/keys/export`, {
        params: { format },
      });
      
      // Create download link
      const blob = new Blob([response.content], { type: format === 'json' ? 'application/json' : 'application/yaml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = response.fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      message.success('Translations exported successfully');
    } catch (error) {
      message.error('Failed to export translations');
    }
  };

  const handleImport = async () => {
    if (!importFile) {
      message.error('Please select a file to import');
      return;
    }

    try {
      const formData = new FormData();
      formData.append('file', importFile);
      formData.append('format', importFormat);
      formData.append('mode', importMode);
      
      const response = await apiClient.post(`/projects/${projectId}/namespaces/${selectedNamespaceId}/keys/import`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      
      message.success(`Imported successfully: ${response.createdKeys} created, ${response.updatedKeys} updated, ${response.skippedKeys} skipped`);
      setIsImportModalOpen(false);
      setImportFile(null);
      importForm.resetFields();
      queryClient.invalidateQueries({ queryKey: ['keys', projectId, selectedNamespaceId] });
    } catch (error) {
      message.error('Failed to import translations');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setImportFile(e.target.files[0]);
    }
  };

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
          <Button
            type="text"
            danger
            size="small"
            icon={<DeleteOutlined />}
            loading={deleteKeyMutation.isPending && deletingKeyId === record.id}
            onClick={() => {
              Modal.confirm({
                title: 'Delete Key',
                content: `Are you sure you want to delete "${record.name}"?`,
                okText: 'Delete',
                okButtonProps: { danger: true },
                onOk: async () => {
                  setDeletingKeyId(record.id);
                  await deleteKeyMutation.mutateAsync(record.id);
                },
              });
            }}
          />
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
          <Space>
            <Button
              icon={<UploadOutlined />}
              disabled={!projectId || namespaces.length === 0}
              onClick={() => setIsPublishOpen(true)}
            >
              Publish
            </Button>
            <Button
              icon={<DownloadOutlined />}
              disabled={!selectedNamespaceId}
              onClick={handleExport}
            >
              Export
            </Button>
            <Button
              icon={<InboxOutlined />}
              disabled={!selectedNamespaceId}
              onClick={() => setIsImportModalOpen(true)}
            >
              Import
            </Button>
            <Button 
              type="primary" 
              icon={<PlusOutlined />} 
              disabled={!selectedNamespaceId}
              onClick={() => setIsKeyModalOpen(true)}
            >
              Create Key
            </Button>
          </Space>
        </div>

        {/* Search and Filter */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
          <Input.Search
            placeholder="Search keys..."
            style={{ width: 300 }}
            onSearch={(value) => handleSearch(value)}
            allowClear
          />
          <Select
            placeholder="Filter by status"
            style={{ width: 150 }}
            onChange={(value) => handleStatusFilter(value)}
            allowClear
          >
            <Option value="PENDING">Pending</Option>
            <Option value="TRANSLATING">Translating</Option>
            <Option value="REVIEWING">Reviewing</Option>
            <Option value="APPROVED">Approved</Option>
            <Option value="PUBLISHED">Published</Option>
          </Select>
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
          {project?.locales.map(locale => {
            const translation = editingKey?.translations.find(t => t.locale.code === locale.code);
            const statusColor = {
              PENDING: 'default',
              TRANSLATING: 'processing',
              REVIEWING: 'warning',
              APPROVED: 'success',
              PUBLISHED: 'geekblue'
            }[translation?.status || 'PENDING'];
            
            return (
              <Form.Item
                key={locale.code}
                name={locale.code}
                label={
                  <Space>
                    <GlobalOutlined />
                    {locale.name} ({locale.code})
                    <Tag color={statusColor}>{translation?.status || 'PENDING'}</Tag>
                  </Space>
                }
              >
                <Input.TextArea rows={3} placeholder={`Enter translation for ${locale.name}...`} />
                {translation?.reviewComment && (
                  <div style={{ marginTop: 8, color: '#ff4d4f' }}>
                    <Text type="danger">Review Comment: {translation.reviewComment}</Text>
                  </div>
                )}
                <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                  {translation && (
                    <>
                      {translation.status === 'PENDING' && (
                        <Button
                          size="small"
                          onClick={() => handleSubmitReview(editingKey.id, locale.code)}
                        >
                          Submit for Review
                        </Button>
                      )}
                      {translation.status === 'REVIEWING' && (
                        <>
                          <Button
                            size="small"
                            type="primary"
                            onClick={() => handleApprove(editingKey.id, locale.code)}
                          >
                            Approve
                          </Button>
                          <Button
                            size="small"
                            danger
                            onClick={() => handleReject(editingKey.id, locale.code)}
                          >
                            Reject
                          </Button>
                        </>
                      )}
                      {translation.status === 'APPROVED' && (
                        <Button
                          size="small"
                          type="primary"
                          onClick={() => handlePublish(editingKey.id, locale.code)}
                        >
                          Publish
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </Form.Item>
            );
          })}
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
        <Form
          form={namespaceForm}
          layout="vertical"
          onFinish={(values: { name: string; description?: string }) =>
            createNamespaceMutation.mutate(values)
          }
        >
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
        <Form
          form={keyForm}
          layout="vertical"
          onFinish={(values) => createKeyMutation.mutate(values)}
          initialValues={{ type: 'TEXT' }}
        >
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
          <Form.Item
            name="baseContent"
            label={`Default (${project?.baseLocale || 'base locale'})`}
            rules={[{ required: true, whitespace: true }]}
          >
            <Input.TextArea rows={3} placeholder="Input default locale text" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Import Modal */}
      <Modal
        title="Import Translations"
        open={isImportModalOpen}
        onOk={handleImport}
        onCancel={() => setIsImportModalOpen(false)}
      >
        <Form
          form={importForm}
          layout="vertical"
        >
          <Form.Item label="File">
            <input
              type="file"
              accept=".json,.yaml,.yml"
              onChange={handleFileChange}
            />
            {importFile && <div style={{ marginTop: 8 }}>Selected: {importFile.name}</div>}
          </Form.Item>
          <Form.Item label="Format">
            <Select
              value={importFormat}
              onChange={(value) => setImportFormat(value)}
            >
              <Option value="json">JSON</Option>
              <Option value="yaml">YAML</Option>
            </Select>
          </Form.Item>
          <Form.Item label="Mode">
            <Select
              value={importMode}
              onChange={(value) => setImportMode(value)}
            >
              <Option value="fillMissing">Fill Missing</Option>
              <Option value="overwrite">Overwrite</Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      {projectId && project?.locales?.length ? (
        <PublishDrawer
          open={isPublishOpen}
          onClose={() => setIsPublishOpen(false)}
          projectId={projectId}
          baseLocale={project.baseLocale}
          locales={project.locales.map((l) => ({ code: l.code, name: l.name }))}
          currentReleaseId={project.currentReleaseId ?? null}
          scope={
            selectedNamespaceId
              ? { type: 'namespaces', namespaceIds: [selectedNamespaceId] }
              : { type: 'all' }
          }
          scopeLabel={
            selectedNamespaceId
              ? `Namespace: ${namespaces.find((n) => n.id === selectedNamespaceId)?.name ?? selectedNamespaceId}`
              : 'All'
          }
        />
      ) : null}
    </Layout>
  );
};

export default KeysPage;
