import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  App as AntdApp,
  Button,
  Card,
  Drawer,
  Select,
  Space,
  Table,
  Typography,
} from "antd";
import { useMutation } from "@tanstack/react-query";
import type { ColumnsType } from "antd/es/table";
import { createTwoFilesPatch } from "diff";
import { Diff, Hunk, parseDiff } from "react-diff-view";
import "react-diff-view/style/index.css";
import {
  getActiveReleaseSession,
  getReleaseSession,
  previewRelease,
} from "@/api/releases";
import type {
  BaseReleaseMismatchError,
  GetReleaseSessionResponse,
  PreviewReleaseResponse,
  PreviewReleasePayload,
  ReleaseSession,
  ReleaseSessionLockedError,
} from "@/types/release";

type LocaleOption = { code: string; name: string };

interface NamespaceOption {
  id: string;
  name: string;
}

type Props = {
  open: boolean;
  onClose: () => void;
  projectId: string;
  baseLocale?: string;
  locales: LocaleOption[];
  currentReleaseId?: string | null;
  scope: PreviewReleasePayload["scope"];
  scopeLabel: string;
  onEditKey?: (keyName: string) => void;
  namespaces?: NamespaceOption[];
  allowScopeChange?: boolean;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const extractApiError = (error: unknown) => {
  if (!isRecord(error)) {
    return {
      status: undefined as number | undefined,
      data: undefined as unknown,
    };
  }
  const response = error.response;
  if (!isRecord(response)) {
    return {
      status: undefined as number | undefined,
      data: undefined as unknown,
    };
  }
  const status =
    typeof response.status === "number" ? response.status : undefined;
  const data = response.data;
  return { status, data };
};

const PublishDrawer: React.FC<Props> = (props) => {
  const { message } = AntdApp.useApp();
  const [preview, setPreview] = useState<PreviewReleaseResponse | null>(null);
  const isInitializingRef = useRef(false);

  // Scope selection state (only for batch publish)
  const [selectedNamespaceIds, setSelectedNamespaceIds] = useState<string[]>(
    [],
  );

  // Initialize scope from props
  useEffect(() => {
    if (props.open) {
      if (props.scope.type === "namespaces") {
        setSelectedNamespaceIds(props.scope.namespaceIds);
      } else {
        setSelectedNamespaceIds([]);
      }
    }
  }, [props.open, props.scope]);

  const allLocaleCodes = useMemo(
    () => props.locales.map((l) => l.code),
    [props.locales],
  );

  // 合并同一个 key 的错误，按 key 分组，并根据当前 scope 过滤
  const groupedErrors = useMemo(() => {
    if (!preview) return [];

    const groupMap = new Map<
      string,
      {
        keyName: string;
        namespaceName: string;
        localeCodes: string[];
      }
    >();

    // Get the list of allowed namespace IDs based on current scope
    const allowedNamespaceIds = props.allowScopeChange
      ? selectedNamespaceIds
      : props.scope.type === "namespaces"
        ? props.scope.namespaceIds
        : null; // null means all namespaces (no filter)

    preview.errors.forEach((error) => {
      // Filter by namespace if in scoped mode
      if (
        allowedNamespaceIds !== null &&
        !allowedNamespaceIds.includes(error.namespaceId)
      ) {
        return;
      }

      const key = `${error.namespaceId}:${error.keyId}`;
      if (groupMap.has(key)) {
        groupMap.get(key)!.localeCodes.push(error.localeCode);
      } else {
        groupMap.set(key, {
          keyName: error.keyName,
          namespaceName: error.namespaceName,
          localeCodes: [error.localeCode],
        });
      }
    });

    return Array.from(groupMap.values());
  }, [preview, props.allowScopeChange, props.scope, selectedNamespaceIds]);

  const errorColumns: ColumnsType<{
    keyName: string;
    namespaceName: string;
    localeCodes: string[];
  }> = [
    {
      title: "Key",
      dataIndex: "keyName",
      key: "keyName",
      width: 200,
      render: (keyName: string) =>
        props.onEditKey ? (
          <Typography.Link
            onClick={() => props.onEditKey?.(keyName)}
            style={{ cursor: "pointer" }}
          >
            {keyName}
          </Typography.Link>
        ) : (
          keyName
        ),
    },
    {
      title: "Namespace",
      dataIndex: "namespaceName",
      key: "namespaceName",
      width: 120,
    },
    {
      title: "缺失语言",
      dataIndex: "localeCodes",
      key: "localeCodes",
      render: (localeCodes: string[]) => localeCodes.join(", "),
    },
  ];

  const toPreviewFromSession = (
    session: ReleaseSession,
  ): PreviewReleaseResponse => {
    const errors = Array.isArray(session.validationErrors)
      ? session.validationErrors
      : [];
    return {
      sessionId: session.id,
      status: session.status,
      baseReleaseId: session.baseReleaseId ?? null,
      canPublish: errors.length === 0,
      errors,
      baseJson: session.baseJson ?? "",
      nextJson: session.nextJson ?? "",
    };
  };

  const loadSession = async (sessionId: string) => {
    const result = (await getReleaseSession(
      props.projectId,
      sessionId,
    )) as GetReleaseSessionResponse;
    setPreview(toPreviewFromSession(result.session));
  };

  const previewMutation = useMutation({
    mutationFn: async (payload: PreviewReleasePayload) =>
      previewRelease(props.projectId, payload),
    onSuccess: (data) => {
      setPreview(data);
    },
    onError: (error: unknown) => {
      const { status, data } = extractApiError(error);
      if (
        status === 409 &&
        isRecord(data) &&
        data.code === "BASE_RELEASE_MISMATCH"
      ) {
        const d = data as unknown as BaseReleaseMismatchError;
        setPreview(null);
        message.error(
          `线上版本已变化，请重新预览（current=${d.currentReleaseId}）`,
        );
        return;
      }
      if (
        status === 409 &&
        isRecord(data) &&
        data.code === "RELEASE_SESSION_LOCKED"
      ) {
        const d = data as unknown as ReleaseSessionLockedError;
        message.warning(`已有进行中的发布会话（${d.status}），已切换到该会话`);
        void loadSession(d.sessionId);
        return;
      }
      message.error("预览失败");
    },
  });

  const diffText = useMemo(() => {
    if (!preview) {
      return null;
    }
    const oldText = preview.baseJson ?? "";
    const newText = preview.nextJson ?? "";
    const fileName = "release.json";
    const patch = createTwoFilesPatch(
      `a/${fileName}`,
      `b/${fileName}`,
      oldText,
      newText,
      "",
      "",
      { context: 3 },
    );
    const lines = patch
      .split("\n")
      .filter((l) => !l.startsWith("Index: ") && !l.startsWith("===="));
    return [`diff --git a/${fileName} b/${fileName}`, ...lines].join("\n");
  }, [preview]);

  const parsedFile = useMemo(() => {
    if (!diffText) {
      return null;
    }
    const files = parseDiff(diffText);
    return files[0] ?? null;
  }, [diffText]);

  const close = () => {
    setPreview(null);
    setSelectedNamespaceIds([]);
    props.onClose();
  };

  // Compute current scope based on selection
  const currentScope = useMemo<PreviewReleasePayload["scope"]>(() => {
    // In batch publish mode (allowScopeChange), always use namespaces scope
    // In single publish mode, use the scope from props
    if (props.allowScopeChange) {
      return { type: "namespaces", namespaceIds: selectedNamespaceIds };
    }
    return props.scope;
  }, [props.allowScopeChange, props.scope, selectedNamespaceIds]);

  // Compute scope label for display
  const currentScopeLabel = useMemo(() => {
    if (selectedNamespaceIds.length === 0) {
      return "未选择命名空间";
    }
    if (selectedNamespaceIds.length === 1 && props.namespaces) {
      const ns = props.namespaces.find((n) => n.id === selectedNamespaceIds[0]);
      return `命名空间: ${ns?.name ?? selectedNamespaceIds[0]}`;
    }
    return `命名空间: ${selectedNamespaceIds.length}个`;
  }, [selectedNamespaceIds, props.namespaces]);

  useEffect(() => {
    if (!props.open) {
      return;
    }
    isInitializingRef.current = true;
    void (async () => {
      try {
        const res = await getActiveReleaseSession(props.projectId);
        if (res.session) {
          setPreview(toPreviewFromSession(res.session));
          isInitializingRef.current = false;
          return;
        }

        isInitializingRef.current = false;
        previewMutation.mutate({
          scope: currentScope,
          localeCodes: allLocaleCodes,
        });
      } catch {
        isInitializingRef.current = false;
        return;
      }
    })();
  }, [
    allLocaleCodes,
    previewMutation,
    props.open,
    props.projectId,
    currentScope,
  ]);

  return (
    <Drawer
      title="Publish"
      width={860}
      open={props.open}
      onClose={close}
      destroyOnClose
      extra={
        <Space>
          <Button onClick={close}>关闭</Button>
          <Button
            type="primary"
            loading={previewMutation.isPending}
            disabled={!preview}
            onClick={() => {
              if (preview) {
                message.success("草稿已创建");
                close();
              }
            }}
          >
            确认创建
          </Button>
        </Space>
      }
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          height: "calc(100vh - 120px)",
          gap: 16,
        }}
      >
        {/* Scope Selection - Only show in batch publish mode */}
        {props.allowScopeChange &&
          props.namespaces &&
          props.namespaces.length > 0 && (
            <Card size="small" title="选择要发布的命名空间">
              <Select
                mode="multiple"
                placeholder="请选择命名空间"
                value={selectedNamespaceIds}
                onChange={(newIds) => {
                  // Check if "__ALL__" was selected
                  if (newIds.includes("__ALL__")) {
                    const allIds = props.namespaces!.map((n) => n.id);
                    setSelectedNamespaceIds(allIds);
                    previewMutation.mutate({
                      scope: { type: "namespaces", namespaceIds: allIds },
                      localeCodes: allLocaleCodes,
                    });
                  } else {
                    setSelectedNamespaceIds(newIds);
                    // Auto-trigger preview when selection changes
                    if (newIds.length > 0) {
                      previewMutation.mutate({
                        scope: { type: "namespaces", namespaceIds: newIds },
                        localeCodes: allLocaleCodes,
                      });
                    } else {
                      setPreview(null);
                    }
                  }
                }}
                options={[
                  { label: "全选", value: "__ALL__" },
                  ...props.namespaces.map((ns) => ({
                    label: ns.name,
                    value: ns.id,
                  })),
                ]}
                style={{ width: "100%" }}
                maxTagCount={3}
                allowClear
              />
            </Card>
          )}

        {/* Scope Label Display - Only show in single namespace publish mode */}
        {!props.allowScopeChange && (
          <Card size="small">
            <Typography.Text type="secondary">发布范围: </Typography.Text>
            <Typography.Text strong>{currentScopeLabel}</Typography.Text>
          </Card>
        )}

        {groupedErrors.length > 0 && !preview?.canPublish ? (
          <Card
            size="small"
            title={`Validation Errors (${groupedErrors.length})`}
            style={{ flex: 4, minHeight: 0, overflow: "hidden" }}
            styles={{ body: { height: "calc(100% - 40px)", overflow: "auto" } }}
          >
            <Table
              size="small"
              rowKey={(r) => `${r.namespaceName}:${r.keyName}`}
              columns={errorColumns}
              dataSource={groupedErrors}
              pagination={false}
            />
          </Card>
        ) : null}

        {parsedFile ? (
          <Card
            size="small"
            title="Diff (side-by-side)"
            style={{ flex: 6, minHeight: 0, overflow: "hidden" }}
            styles={{ body: { height: "calc(100% - 40px)", overflow: "auto" } }}
          >
            <Diff
              viewType="split"
              diffType={parsedFile.type}
              hunks={parsedFile.hunks}
            >
              {(hunks) =>
                hunks.map((hunk) => <Hunk key={hunk.content} hunk={hunk} />)
              }
            </Diff>
          </Card>
        ) : (
          <Typography.Text type="secondary">
            {previewMutation.isPending ? "正在加载预览..." : "暂无预览"}
          </Typography.Text>
        )}
      </div>
    </Drawer>
  );
};

export default PublishDrawer;
