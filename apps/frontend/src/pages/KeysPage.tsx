import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Layout,
  Button,
  Space,
  Empty,
  Modal,
  Form,
  Input,
  Select,
  App as AntdApp,
} from "antd";
import {
  PlusOutlined,
  UploadOutlined,
  DownloadOutlined,
  InboxOutlined,
} from "@ant-design/icons";
import apiClient from "@/api/client";
import PublishDrawer from "@/components/release/PublishDrawer";
import { NamespaceSidebar } from "@/components/translation/NamespaceSidebar";
import { KeysTable } from "@/components/translation/KeysTable";
import { TranslationDrawer } from "@/components/translation/TranslationDrawer";
import { FilterBar } from "@/components/common/FilterBar";
import { PageHeader } from "@/components/common/PageHeader";
import type { TranslationStatus } from "@/components/common/StatusBadge";

const { Sider, Content } = Layout;
const { Option } = Select;

interface Namespace {
  id: string;
  name: string;
  description?: string;
}

interface Locale {
  id: string;
  code: string;
  name: string;
}

interface Translation {
  id: string;
  content: string;
  status: TranslationStatus;
  locale: Locale;
  reviewComment?: string;
}

interface Key {
  id: string;
  name: string;
  description?: string;
  type: "TEXT" | "RICH_TEXT" | "ASSET";
  translations: Translation[];
}

interface Project {
  id: string;
  baseLocale: string;
  currentReleaseId?: string | null;
  locales: Locale[];
}

const KeysPage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const { message } = AntdApp.useApp();
  const queryClient = useQueryClient();
  const [selectedNamespaceId, setSelectedNamespaceId] = useState<string | null>(
    null,
  );
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
  const [importFormat, setImportFormat] = useState<"json" | "yaml">("json");
  const [importMode, setImportMode] = useState<"fillMissing" | "overwrite">(
    "fillMissing",
  );
  const [importFile, setImportFile] = useState<File | null>(null);

  // Search and Filter State
  const [searchKeyword, setSearchKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState<TranslationStatus | null>(
    null,
  );

  const [namespaceForm] = Form.useForm();
  const [keyForm] = Form.useForm();
  const [importForm] = Form.useForm();

  const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null;

  // Fetch Project (for locales)
  const { data: project } = useQuery<Project>({
    queryKey: ["project", projectId],
    queryFn: async () => {
      return await apiClient.get(`/projects/${projectId}`);
    },
    enabled: !!projectId,
  });

  // Fetch Namespaces
  const { data: namespaces = [], isLoading: isNamespacesLoading } = useQuery<
    Namespace[]
  >({
    queryKey: ["namespaces", projectId],
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
    queryKey: [
      "keys",
      projectId,
      selectedNamespaceId,
      searchKeyword,
      statusFilter,
    ],
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
        { params },
      );
    },
    enabled: !!projectId && !!selectedNamespaceId,
  });

  // Mutations
  const createNamespaceMutation = useMutation({
    mutationFn: (values: { name: string; description?: string }) =>
      apiClient.post(`/projects/${projectId}/namespaces`, values),
    onSuccess: () => {
      message.success("命名空间创建成功");
      setIsNamespaceModalOpen(false);
      namespaceForm.resetFields();
      queryClient.invalidateQueries({ queryKey: ["namespaces", projectId] });
    },
  });

  const createKeyMutation = useMutation({
    mutationFn: (values: {
      name: string;
      description?: string;
      type: string;
      baseContent: string;
    }) =>
      apiClient.post(
        `/projects/${projectId}/namespaces/${selectedNamespaceId}/keys`,
        {
          name: values.name,
          description: values.description,
          type: values.type,
        },
      ),
    onSuccess: async (
      created: unknown,
      variables: {
        name: string;
        description?: string;
        type: string;
        baseContent: string;
      },
    ) => {
      message.success("词条创建成功");
      setIsKeyModalOpen(false);
      keyForm.resetFields();
      queryClient.invalidateQueries({
        queryKey: ["keys", projectId, selectedNamespaceId],
      });

      const createdKeyId =
        isRecord(created) && typeof created.id === "string"
          ? created.id
          : undefined;

      if (!createdKeyId) return;

      const baseContent = variables.baseContent.trim();
      const defaultLocaleCode =
        project?.baseLocale || project?.locales?.[0]?.code;
      if (!defaultLocaleCode) return;

      try {
        await apiClient.patch(
          `/projects/${projectId}/namespaces/${selectedNamespaceId}/keys/${createdKeyId}/translations/${defaultLocaleCode}`,
          { content: baseContent },
        );
        queryClient.invalidateQueries({
          queryKey: ["keys", projectId, selectedNamespaceId],
        });
      } catch {
        // ignore
      }
    },
    onError: (error: unknown) => {
      if (isRecord(error) && isRecord(error.response)) {
        const status = error.response.status;
        if (status === 409) {
          message.error("词条已存在");
        }
      }
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
      message.success("词条删除成功");
      await queryClient.invalidateQueries({
        queryKey: ["keys", projectId, selectedNamespaceId],
      });
    },
  });

  const fetchKeyById = async (keyId: string) => {
    return (await apiClient.get(
      `/projects/${projectId}/namespaces/${selectedNamespaceId}/keys/${keyId}`,
    )) as Key;
  };

  // Save Translations
  const saveTranslationsMutation = useMutation({
    mutationFn: (values: Record<string, string>) => {
      const promises = Object.entries(values).map(([localeCode, content]) =>
        apiClient.patch(
          `/projects/${projectId}/namespaces/${selectedNamespaceId}/keys/${editingKey?.id}/translations/${localeCode}`,
          {
            content,
            status: "PENDING",
          },
        ),
      );
      return Promise.all(promises);
    },
    onSuccess: () => {
      message.success("翻译保存成功");
      setIsDrawerOpen(false);
      setEditingKey(null);
      queryClient.invalidateQueries({
        queryKey: ["keys", projectId, selectedNamespaceId],
      });
    },
    onError: () => {
      message.error("保存失败");
    },
  });

  const handleSubmitReview = async (keyId: string, localeCode: string) => {
    try {
      await apiClient.post(
        `/projects/${projectId}/namespaces/${selectedNamespaceId}/keys/${keyId}/translations/${localeCode}/submit-review`,
      );
      message.success("已提交审核");
      queryClient.invalidateQueries({
        queryKey: ["keys", projectId, selectedNamespaceId],
      });
      if (editingKey?.id === keyId) {
        const updatedKey = await fetchKeyById(keyId);
        setEditingKey(updatedKey);
      }
    } catch {
      message.error("提交失败");
    }
  };

  const handleApprove = async (keyId: string, localeCode: string) => {
    try {
      await apiClient.post(
        `/projects/${projectId}/namespaces/${selectedNamespaceId}/keys/${keyId}/translations/${localeCode}/approve`,
      );
      message.success("已通过");
      queryClient.invalidateQueries({
        queryKey: ["keys", projectId, selectedNamespaceId],
      });
      if (editingKey?.id === keyId) {
        const updatedKey = await fetchKeyById(keyId);
        setEditingKey(updatedKey);
      }
    } catch {
      message.error("操作失败");
    }
  };

  const handleReject = async (keyId: string, localeCode: string) => {
    const reason = prompt("请输入驳回原因:");
    if (!reason) return;

    try {
      await apiClient.post(
        `/projects/${projectId}/namespaces/${selectedNamespaceId}/keys/${keyId}/translations/${localeCode}/reject`,
        { reason },
      );
      message.success("已驳回");
      queryClient.invalidateQueries({
        queryKey: ["keys", projectId, selectedNamespaceId],
      });
      if (editingKey?.id === keyId) {
        const updatedKey = await fetchKeyById(keyId);
        setEditingKey(updatedKey);
      }
    } catch {
      message.error("操作失败");
    }
  };

  const handlePublish = async (keyId: string, localeCode: string) => {
    try {
      await apiClient.post(
        `/projects/${projectId}/namespaces/${selectedNamespaceId}/keys/${keyId}/translations/${localeCode}/publish`,
      );
      message.success("已发布");
      queryClient.invalidateQueries({
        queryKey: ["keys", projectId, selectedNamespaceId],
      });
      if (editingKey?.id === keyId) {
        const updatedKey = await fetchKeyById(keyId);
        setEditingKey(updatedKey);
      }
    } catch {
      message.error("发布失败");
    }
  };

  const handleExport = async () => {
    try {
      const response = await apiClient.get(
        `/projects/${projectId}/namespaces/${selectedNamespaceId}/keys/export`,
        { params: { format: "json" } },
      );

      const blob = new Blob([response.content], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = response.fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      message.success("导出成功");
    } catch {
      message.error("导出失败");
    }
  };

  const handleImport = async () => {
    if (!importFile) {
      message.error("请选择文件");
      return;
    }

    try {
      const formData = new FormData();
      formData.append("file", importFile);
      formData.append("format", importFormat);
      formData.append("mode", importMode);

      const response = await apiClient.post(
        `/projects/${projectId}/namespaces/${selectedNamespaceId}/keys/import`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        },
      );

      message.success(
        `导入成功: ${response.createdKeys} 新建, ${response.updatedKeys} 更新`,
      );
      setIsImportModalOpen(false);
      setImportFile(null);
      importForm.resetFields();
      queryClient.invalidateQueries({
        queryKey: ["keys", projectId, selectedNamespaceId],
      });
    } catch {
      message.error("导入失败");
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setImportFile(e.target.files[0]);
    }
  };

  const openEditDrawer = (key: Key) => {
    setEditingKey(key);
    setIsDrawerOpen(true);
  };

  const handleDeleteKey = async (key: Key) => {
    setDeletingKeyId(key.id);
    await deleteKeyMutation.mutateAsync(key.id);
  };

  const selectedNamespace = namespaces.find(
    (n) => n.id === selectedNamespaceId,
  );

  return (
    <Layout style={{ background: "transparent", height: "100%" }}>
      <Sider
        width={250}
        style={{ background: "transparent", borderRight: "1px solid #f0f0f0" }}
      >
        <NamespaceSidebar
          namespaces={namespaces}
          selectedId={selectedNamespaceId}
          isLoading={isNamespacesLoading}
          onSelect={setSelectedNamespaceId}
          onCreate={() => setIsNamespaceModalOpen(true)}
        />
      </Sider>

      <Content style={{ padding: "0 24px", minHeight: 280 }}>
        <PageHeader
          title={selectedNamespace?.name || "词条管理"}
          description={selectedNamespace?.description}
          extra={
            <Space>
              <Button
                icon={<UploadOutlined />}
                disabled={!projectId || namespaces.length === 0}
                onClick={() => setIsPublishOpen(true)}
              >
                发布
              </Button>
              <Button
                icon={<DownloadOutlined />}
                disabled={!selectedNamespaceId}
                onClick={handleExport}
              >
                导出
              </Button>
              <Button
                icon={<InboxOutlined />}
                disabled={!selectedNamespaceId}
                onClick={() => setIsImportModalOpen(true)}
              >
                导入
              </Button>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                disabled={!selectedNamespaceId}
                onClick={() => setIsKeyModalOpen(true)}
              >
                新建词条
              </Button>
            </Space>
          }
        />

        <FilterBar
          searchValue={searchKeyword}
          statusValue={statusFilter}
          onSearch={setSearchKeyword}
          onStatusChange={setStatusFilter}
          searchPlaceholder="搜索词条..."
        />

        {!selectedNamespaceId ? (
          <Empty description="请选择命名空间" />
        ) : (
          <KeysTable
            keys={keys}
            locales={project?.locales || []}
            isLoading={isKeysLoading}
            deletingKeyId={deletingKeyId}
            onEdit={openEditDrawer}
            onDelete={handleDeleteKey}
          />
        )}
      </Content>

      {/* Translation Drawer */}
      <TranslationDrawer
        open={isDrawerOpen}
        editingKey={editingKey}
        locales={project?.locales || []}
        isSaving={saveTranslationsMutation.isPending}
        onClose={() => {
          setIsDrawerOpen(false);
          setEditingKey(null);
        }}
        onSave={(values) => saveTranslationsMutation.mutate(values)}
        onSubmitReview={handleSubmitReview}
        onApprove={handleApprove}
        onReject={handleReject}
        onPublish={handlePublish}
      />

      {/* Create Namespace Modal */}
      <Modal
        title="创建命名空间"
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
          <Form.Item
            name="name"
            label="名称"
            rules={[{ required: true, message: "请输入名称" }]}
          >
            <Input placeholder="例如: common, auth, home" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Create Key Modal */}
      <Modal
        title="新建词条"
        open={isKeyModalOpen}
        onOk={() => keyForm.submit()}
        onCancel={() => setIsKeyModalOpen(false)}
        confirmLoading={createKeyMutation.isPending}
      >
        <Form
          form={keyForm}
          layout="vertical"
          onFinish={(values) => createKeyMutation.mutate(values)}
          initialValues={{ type: "TEXT" }}
        >
          <Form.Item
            name="name"
            label="词条名称"
            rules={[{ required: true, message: "请输入词条名称" }]}
          >
            <Input placeholder="例如: button.submit" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="type" label="类型">
            <Select>
              <Option value="TEXT">文本</Option>
              <Option value="RICH_TEXT">富文本</Option>
              <Option value="ASSET">资源</Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="baseContent"
            label={`默认语言 (${project?.baseLocale || "基础语言"})`}
            rules={[{ required: true, message: "请输入默认语言内容" }]}
          >
            <Input.TextArea rows={3} placeholder="输入默认语言文本" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Import Modal */}
      <Modal
        title="导入翻译"
        open={isImportModalOpen}
        onOk={handleImport}
        onCancel={() => setIsImportModalOpen(false)}
      >
        <Form form={importForm} layout="vertical">
          <Form.Item label="文件">
            <input
              type="file"
              accept=".json,.yaml,.yml"
              onChange={handleFileChange}
            />
            {importFile && (
              <div style={{ marginTop: 8 }}>已选择: {importFile.name}</div>
            )}
          </Form.Item>
          <Form.Item label="格式">
            <Select
              value={importFormat}
              onChange={(value) => setImportFormat(value)}
            >
              <Option value="json">JSON</Option>
              <Option value="yaml">YAML</Option>
            </Select>
          </Form.Item>
          <Form.Item label="模式">
            <Select
              value={importMode}
              onChange={(value) => setImportMode(value)}
            >
              <Option value="fillMissing">仅填充缺失</Option>
              <Option value="overwrite">覆盖全部</Option>
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
              ? { type: "namespaces", namespaceIds: [selectedNamespaceId] }
              : { type: "all" }
          }
          scopeLabel={
            selectedNamespaceId
              ? `命名空间: ${selectedNamespace?.name ?? selectedNamespaceId}`
              : "全部"
          }
        />
      ) : null}
    </Layout>
  );
};

export default KeysPage;
