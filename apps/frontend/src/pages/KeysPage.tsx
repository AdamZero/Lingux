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
  Checkbox,
  List,
  Row,
  Col,
  Divider,
} from "antd";
import {
  PlusOutlined,
  UploadOutlined,
  DownloadOutlined,
  InboxOutlined,
} from "@ant-design/icons";
import { NamespaceTranslateButton } from "@/components/translation/NamespaceTranslateButton";
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

  const [isNamespaceModalOpen, setIsNamespaceModalOpen] = useState(false);
  const [isKeyModalOpen, setIsKeyModalOpen] = useState(false);
  const [isPublishOpen, setIsPublishOpen] = useState(false);

  const [editingKey, setEditingKey] = useState<Key | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importFormat, setImportFormat] = useState<"json" | "yaml">("json");
  const [importMode, setImportMode] = useState<"fillMissing" | "overwrite">(
    "fillMissing",
  );
  const [importFile, setImportFile] = useState<File | null>(null);

  const [isBatchExportModalOpen, setIsBatchExportModalOpen] = useState(false);
  const [selectedExportIds, setSelectedExportIds] = useState<string[]>([]);
  const [batchExportFormat, setBatchExportFormat] = useState<
    "json" | "yaml" | "xlsx"
  >("json");

  // Batch publish state
  const [isBatchPublishMode, setIsBatchPublishMode] = useState(false);

  const [isImportPreviewModalOpen, setIsImportPreviewModalOpen] =
    useState(false);
  const [importPreviewData, setImportPreviewData] = useState<{
    namespaces: { name: string; keyCount: number; exists: boolean }[];
    totalNamespaces: number;
    totalKeys: number;
  } | null>(null);
  const [selectedImportNamespaces, setSelectedImportNamespaces] = useState<
    string[]
  >([]);
  const [pendingImportFile, setPendingImportFile] = useState<File | null>(null);

  const [searchKeyword, setSearchKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState<TranslationStatus | null>(
    null,
  );

  const [namespaceForm] = Form.useForm();
  const [keyForm] = Form.useForm();
  const [importForm] = Form.useForm();
  const [batchKeys, setBatchKeys] = useState<
    Array<{
      name: string;
      description?: string;
      type?: string;
      baseContent?: string;
    }>
  >([{ name: "", description: "", type: "TEXT", baseContent: "" }]);

  const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null;

  const { data: project } = useQuery<Project>({
    queryKey: ["project", projectId],
    queryFn: async () => {
      return await apiClient.get(`/projects/${projectId}`);
    },
    enabled: !!projectId,
  });

  const { data: namespaces = [], isLoading: isNamespacesLoading } = useQuery<
    Namespace[]
  >({
    queryKey: ["namespaces", projectId],
    queryFn: async () => {
      return await apiClient.get(`/projects/${projectId}/namespaces`);
    },
    enabled: !!projectId,
  });

  useEffect(() => {
    if (!selectedNamespaceId && namespaces.length > 0) {
      setSelectedNamespaceId(namespaces[0].id);
    }
  }, [namespaces, selectedNamespaceId]);

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

  useMutation({
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

  const createBatchKeyMutation = useMutation({
    mutationFn: (values: {
      keys: Array<{ name: string; description?: string; type?: string }>;
    }) =>
      apiClient.post(
        `/projects/${projectId}/namespaces/${selectedNamespaceId}/keys/batch`,
        values,
      ),
    onSuccess: async () => {
      message.success("词条批量创建成功");
      setIsKeyModalOpen(false);
      setIsBatchMode(false);
      setBatchKeys([{ name: "", description: "", type: "TEXT" }]);
      // 刷新数据（不等待，失败不影响主流程）
      Promise.all([
        queryClient.refetchQueries({
          queryKey: ["keys", projectId, selectedNamespaceId],
        }),
        queryClient.refetchQueries({
          queryKey: ["namespaces", projectId],
        }),
      ]).catch((err) => {
        console.error("Failed to refetch:", err);
      });
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { message?: string } } };
      message.error(err.response?.data?.message || "批量创建失败");
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

  const saveTranslationsMutation = useMutation({
    mutationFn: async (values: Record<string, string>) => {
      // 过滤掉空值，只保存有内容的翻译
      const translations = Object.entries(values)
        .filter(([, content]) => content && content.trim())
        .map(([localeCode, content]) => ({
          localeCode,
          content: content.trim(),
        }));

      if (translations.length === 0) {
        throw new Error("没有可保存的翻译内容");
      }

      // 使用批量更新接口，状态自动设为 APPROVED
      return apiClient.post(
        `/projects/${projectId}/namespaces/${selectedNamespaceId}/keys/${editingKey?.id}/translations/batch`,
        { translations },
      );
    },
    onSuccess: async () => {
      message.success("翻译保存成功");
      // 等待数据刷新完成后再关闭抽屉
      await queryClient.invalidateQueries({
        queryKey: ["keys", projectId, selectedNamespaceId],
      });
      setIsDrawerOpen(false);
      setEditingKey(null);
    },
    onError: (error: Error) => {
      message.error(error.message || "保存失败");
    },
  });

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

  const handleBatchExport = async () => {
    if (selectedExportIds.length === 0) {
      message.error("请至少选择一个命名空间");
      return;
    }

    try {
      // For Excel format, request as blob
      if (batchExportFormat === "xlsx") {
        const response = await apiClient.get(
          `/projects/${projectId}/namespaces/export`,
          {
            params: {
              namespaceIds: selectedExportIds.join(","),
              format: batchExportFormat,
            },
            responseType: "blob",
          },
        );

        const blob = new Blob([response], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `translations-${new Date().toISOString().slice(0, 19).replace(/:/g, "")}.xlsx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        message.success("批量导出成功");
        setIsBatchExportModalOpen(false);
        setSelectedExportIds([]);
        return;
      }

      const response = await apiClient.get(
        `/projects/${projectId}/namespaces/export`,
        {
          params: {
            namespaceIds: selectedExportIds.join(","),
            format: batchExportFormat,
          },
        },
      );

      const blob = new Blob([response.content], {
        type:
          batchExportFormat === "json"
            ? "application/json"
            : "application/yaml",
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = response.fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      message.success("批量导出成功");
      setIsBatchExportModalOpen(false);
      setSelectedExportIds([]);
    } catch {
      message.error("批量导出失败");
    }
  };

  const openBatchExportModal = () => {
    setSelectedExportIds(namespaces.map((n) => n.id));
    setIsBatchExportModalOpen(true);
  };

  const openBatchPublish = () => {
    setIsBatchPublishMode(true);
    setIsPublishOpen(true);
  };

  const handlePublishClose = () => {
    setIsPublishOpen(false);
    setIsBatchPublishMode(false);
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

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImportFile(file);

      // Detect format from file extension
      const fileName = file.name.toLowerCase();
      let detectedFormat: "json" | "yaml" = "json";
      if (fileName.endsWith(".yaml") || fileName.endsWith(".yml")) {
        detectedFormat = "yaml";
      }
      setImportFormat(detectedFormat);

      // Preview import for multi-namespace detection
      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("format", detectedFormat);

        const preview = await apiClient.post(
          `/projects/${projectId}/import-preview`,
          formData,
          {
            headers: {
              "Content-Type": "multipart/form-data",
            },
          },
        );

        // If multiple namespaces detected, show preview modal
        if (preview.namespaces.length > 1) {
          setImportPreviewData(preview);
          setSelectedImportNamespaces(
            preview.namespaces.map((n: { name: string }) => n.name),
          );
          setPendingImportFile(file);
          setIsImportPreviewModalOpen(true);
        }
      } catch {
        // Preview failed, continue with normal import flow
      }
    }
  };

  const handleMultiNamespaceImport = async () => {
    if (!pendingImportFile || selectedImportNamespaces.length === 0) {
      message.error("请选择要导入的命名空间");
      return;
    }

    try {
      const formData = new FormData();
      formData.append("file", pendingImportFile);
      formData.append("format", importFormat);
      formData.append("mode", importMode);
      formData.append("namespaceNames", selectedImportNamespaces.join(","));

      const response = await apiClient.post(
        `/projects/${projectId}/import`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        },
      );

      message.success(
        `导入成功: ${response.createdNamespaces} 个命名空间新建, ${response.createdKeys} 个词条新建`,
      );
      setIsImportPreviewModalOpen(false);
      setIsImportModalOpen(false);
      setPendingImportFile(null);
      setImportPreviewData(null);
      setSelectedImportNamespaces([]);
      setImportFile(null);
      importForm.resetFields();
      queryClient.invalidateQueries({
        queryKey: ["namespaces", projectId],
      });
      queryClient.invalidateQueries({
        queryKey: ["keys", projectId],
      });
    } catch {
      message.error("导入失败");
    }
  };

  const openEditDrawer = (key: Key) => {
    setEditingKey(key);
    setIsDrawerOpen(true);
  };

  const handleEditKeyByName = (keyName: string) => {
    // 在所有命名空间中查找 key
    const foundKey = keys.find((k) => k.name === keyName);
    if (foundKey) {
      openEditDrawer(foundKey);
    } else {
      message.error(`未找到词条: ${keyName}`);
    }
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
        width={220}
        style={{
          background: "transparent",
          borderRight: "1px solid var(--color-border)",
          marginRight: 16,
        }}
      >
        <NamespaceSidebar
          namespaces={namespaces}
          selectedId={selectedNamespaceId}
          isLoading={isNamespacesLoading}
          onSelect={setSelectedNamespaceId}
          onCreate={() => setIsNamespaceModalOpen(true)}
          onBatchExport={openBatchExportModal}
          onBatchPublish={openBatchPublish}
        />
      </Sider>

      <Content style={{ padding: 0, minHeight: 280 }}>
        <PageHeader
          title={selectedNamespace?.name || "词条管理"}
          description={selectedNamespace?.description}
          extra={
            <Space size="small">
              <Button
                size="small"
                icon={<UploadOutlined />}
                disabled={!projectId || namespaces.length === 0}
                onClick={() => {
                  setIsBatchPublishMode(false);
                  setIsPublishOpen(true);
                }}
              >
                发布
              </Button>
              <Button
                size="small"
                icon={<DownloadOutlined />}
                disabled={!selectedNamespaceId}
                onClick={handleExport}
              >
                导出
              </Button>
              <Button
                size="small"
                icon={<InboxOutlined />}
                disabled={!selectedNamespaceId}
                onClick={() => setIsImportModalOpen(true)}
              >
                导入
              </Button>
              <Button
                type="primary"
                size="small"
                icon={<PlusOutlined />}
                disabled={!selectedNamespaceId}
                onClick={() => setIsKeyModalOpen(true)}
              >
                新建词条
              </Button>
              {selectedNamespace && (
                <NamespaceTranslateButton
                  projectId={projectId}
                  namespaceId={selectedNamespace.id}
                  namespaceName={selectedNamespace.name}
                  onSuccess={() => {
                    queryClient.invalidateQueries({
                      queryKey: ["keys", projectId, selectedNamespaceId],
                    });
                  }}
                />
              )}
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

      <TranslationDrawer
        open={isDrawerOpen}
        editingKey={editingKey}
        locales={project?.locales || []}
        baseLocale={project?.baseLocale || "zh-CN"}
        isSaving={saveTranslationsMutation.isPending}
        onClose={() => {
          setIsDrawerOpen(false);
          setEditingKey(null);
        }}
        onSave={(values) => saveTranslationsMutation.mutate(values)}
      />

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

      <Modal
        title="新建词条"
        open={isKeyModalOpen}
        onOk={() => {
          // 检查是否有空词条
          const hasEmptyName = batchKeys.some((k) => !k.name.trim());
          if (hasEmptyName) {
            message.error("请填写所有词条的名称，或删除空词条");
            return;
          }

          // 检查默认语言内容是否为空
          const hasEmptyBaseContent = batchKeys.some(
            (k) => !k.baseContent?.trim(),
          );
          if (hasEmptyBaseContent) {
            message.error("请填写所有词条的默认语言内容，或删除空词条");
            return;
          }

          const validKeys = batchKeys.filter(
            (k) => k.name.trim() && k.baseContent?.trim(),
          );
          if (validKeys.length === 0) {
            message.warning("请至少填写一个词条");
            return;
          }
          createBatchKeyMutation.mutate({ keys: validKeys });
        }}
        onCancel={() => {
          setIsKeyModalOpen(false);
          setBatchKeys([
            { name: "", description: "", type: "TEXT", baseContent: "" },
          ]);
          keyForm.resetFields();
        }}
        confirmLoading={createBatchKeyMutation.isPending}
        width={900}
      >
        <div style={{ maxHeight: "550px", overflowY: "auto", paddingRight: 8 }}>
          {batchKeys.map((key, index) => (
            <div key={index}>
              {index > 0 && <Divider style={{ margin: "12px 0" }} />}

              <div style={{ position: "relative", marginBottom: 8 }}>
                {/* 右上角删除按钮 */}
                {batchKeys.length > 1 && (
                  <Button
                    danger
                    type="link"
                    size="small"
                    style={{
                      position: "absolute",
                      right: 0,
                      top: 0,
                      zIndex: 1,
                    }}
                    onClick={() => {
                      if (batchKeys.length === 1) {
                        message.warning("至少保留一个词条");
                        return;
                      }
                      setBatchKeys(batchKeys.filter((_, i) => i !== index));
                    }}
                  >
                    删除
                  </Button>
                )}

                {/* 两行布局 */}
                <Space
                  direction="vertical"
                  size="small"
                  style={{ width: "100%" }}
                >
                  {/* 第一行：名称 + 描述 + 类型 */}
                  <Row gutter={8}>
                    <Col span={8}>
                      <Input
                        size="small"
                        placeholder="词条名称 *"
                        value={key.name}
                        onChange={(e) => {
                          const newKeys = [...batchKeys];
                          newKeys[index].name = e.target.value;
                          setBatchKeys(newKeys);
                        }}
                        status={key.name.trim() ? undefined : "error"}
                      />
                    </Col>
                    <Col span={8}>
                      <Input
                        size="small"
                        placeholder="描述"
                        value={key.description}
                        onChange={(e) => {
                          const newKeys = [...batchKeys];
                          newKeys[index].description = e.target.value;
                          setBatchKeys(newKeys);
                        }}
                      />
                    </Col>
                    <Col span={8}>
                      <Select
                        size="small"
                        value={key.type}
                        onChange={(value) => {
                          const newKeys = [...batchKeys];
                          newKeys[index].type = value;
                          setBatchKeys(newKeys);
                        }}
                        style={{ width: "100%" }}
                      >
                        <Option value="TEXT">文本</Option>
                        <Option value="RICH_TEXT">富文本</Option>
                        <Option value="ASSET">资源</Option>
                      </Select>
                    </Col>
                  </Row>

                  {/* 第二行：默认语言内容 */}
                  <Row>
                    <Col span={24}>
                      <Input
                        size="small"
                        placeholder={`默认语言内容 (${project?.baseLocale || "基础语言"}) *`}
                        value={key.baseContent}
                        onChange={(e) => {
                          const newKeys = [...batchKeys];
                          newKeys[index].baseContent = e.target.value;
                          setBatchKeys(newKeys);
                        }}
                        status={key.baseContent?.trim() ? undefined : "error"}
                      />
                    </Col>
                  </Row>
                </Space>
              </div>
            </div>
          ))}
        </div>

        <Divider style={{ margin: "12px 0" }} />

        <Button
          onClick={() =>
            setBatchKeys([
              ...batchKeys,
              { name: "", description: "", type: "TEXT", baseContent: "" },
            ])
          }
          icon={<PlusOutlined />}
          block
          size="small"
        >
          添加词条
        </Button>
      </Modal>

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
          onClose={handlePublishClose}
          projectId={projectId}
          baseLocale={project.baseLocale}
          locales={project.locales.map((l) => ({ code: l.code, name: l.name }))}
          currentReleaseId={project.currentReleaseId ?? null}
          scope={
            isBatchPublishMode
              ? { type: "namespaces", namespaceIds: [] }
              : selectedNamespaceId
                ? { type: "namespaces", namespaceIds: [selectedNamespaceId] }
                : { type: "all" }
          }
          scopeLabel={
            isBatchPublishMode
              ? "请选择命名空间"
              : selectedNamespaceId
                ? `命名空间: ${selectedNamespace?.name ?? selectedNamespaceId}`
                : "全部"
          }
          onEditKey={handleEditKeyByName}
          namespaces={namespaces.map((n) => ({ id: n.id, name: n.name }))}
          allowScopeChange={isBatchPublishMode}
        />
      ) : null}

      <Modal
        title="批量导出"
        open={isBatchExportModalOpen}
        onOk={handleBatchExport}
        onCancel={() => {
          setIsBatchExportModalOpen(false);
          setSelectedExportIds([]);
        }}
        okText="导出"
        cancelText="取消"
        okButtonProps={{ disabled: selectedExportIds.length === 0 }}
      >
        <div style={{ marginBottom: 16 }}>
          <div style={{ marginBottom: 8 }}>
            <Checkbox
              checked={selectedExportIds.length === namespaces.length}
              indeterminate={
                selectedExportIds.length > 0 &&
                selectedExportIds.length < namespaces.length
              }
              onChange={(e) => {
                if (e.target.checked) {
                  setSelectedExportIds(namespaces.map((n) => n.id));
                } else {
                  setSelectedExportIds([]);
                }
              }}
            >
              全选
            </Checkbox>
          </div>
          <List
            size="small"
            bordered
            dataSource={namespaces}
            renderItem={(ns) => (
              <List.Item>
                <Checkbox
                  checked={selectedExportIds.includes(ns.id)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedExportIds([...selectedExportIds, ns.id]);
                    } else {
                      setSelectedExportIds(
                        selectedExportIds.filter((id) => id !== ns.id),
                      );
                    }
                  }}
                >
                  {ns.name}
                </Checkbox>
              </List.Item>
            )}
            style={{ maxHeight: 300, overflow: "auto" }}
          />
        </div>
        <div>
          <span>导出格式: </span>
          <Select
            value={batchExportFormat}
            onChange={(value) => setBatchExportFormat(value)}
            style={{ width: 120 }}
          >
            <Option value="json">JSON</Option>
            <Option value="yaml">YAML</Option>
            <Option value="xlsx">Excel</Option>
          </Select>
        </div>
      </Modal>

      <Modal
        title="导入预览"
        open={isImportPreviewModalOpen}
        onOk={handleMultiNamespaceImport}
        onCancel={() => {
          setIsImportPreviewModalOpen(false);
          setImportPreviewData(null);
          setSelectedImportNamespaces([]);
          setPendingImportFile(null);
        }}
        okText="导入"
        cancelText="取消"
        okButtonProps={{ disabled: selectedImportNamespaces.length === 0 }}
      >
        {importPreviewData && (
          <div>
            <div style={{ marginBottom: 16 }}>
              <div>
                共 {importPreviewData.totalNamespaces} 个命名空间,{" "}
                {importPreviewData.totalKeys} 个词条
              </div>
            </div>
            <div style={{ marginBottom: 8 }}>
              <Checkbox
                checked={
                  selectedImportNamespaces.length ===
                  importPreviewData.namespaces.length
                }
                indeterminate={
                  selectedImportNamespaces.length > 0 &&
                  selectedImportNamespaces.length <
                    importPreviewData.namespaces.length
                }
                onChange={(e) => {
                  if (e.target.checked) {
                    setSelectedImportNamespaces(
                      importPreviewData.namespaces.map((n) => n.name),
                    );
                  } else {
                    setSelectedImportNamespaces([]);
                  }
                }}
              >
                全选
              </Checkbox>
            </div>
            <List
              size="small"
              bordered
              dataSource={importPreviewData.namespaces}
              renderItem={(ns) => (
                <List.Item>
                  <Checkbox
                    checked={selectedImportNamespaces.includes(ns.name)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedImportNamespaces([
                          ...selectedImportNamespaces,
                          ns.name,
                        ]);
                      } else {
                        setSelectedImportNamespaces(
                          selectedImportNamespaces.filter(
                            (name) => name !== ns.name,
                          ),
                        );
                      }
                    }}
                  >
                    {ns.name} ({ns.keyCount} keys)
                  </Checkbox>
                </List.Item>
              )}
              style={{ maxHeight: 300, overflow: "auto" }}
            />
          </div>
        )}
      </Modal>
    </Layout>
  );
};

export default KeysPage;
