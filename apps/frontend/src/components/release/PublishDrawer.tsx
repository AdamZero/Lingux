import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  App as AntdApp,
  Button,
  Card,
  Drawer,
  Input,
  Modal,
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
  approveReleaseSession,
  getActiveReleaseSession,
  getReleaseSession,
  publishReleaseSession,
  rejectReleaseSession,
  submitReleaseSession,
  previewRelease,
} from "@/api/releases";
import type {
  BaseReleaseMismatchError,
  GetReleaseSessionResponse,
  PreviewReleaseResponse,
  PreviewReleasePayload,
  ReleaseSession,
  ReleaseSessionLockedError,
  ValidationFailedError,
} from "@/types/release";

type LocaleOption = { code: string; name: string };

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

  const allLocaleCodes = useMemo(
    () => props.locales.map((l) => l.code),
    [props.locales],
  );

  // 合并同一个 key 的错误，按 key 分组
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

    preview.errors.forEach((error) => {
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
  }, [preview]);

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

  const submitMutation = useMutation({
    mutationFn: async (sessionId: string) =>
      submitReleaseSession(props.projectId, sessionId),
    onSuccess: async () => {
      if (!preview) {
        return;
      }
      await loadSession(preview.sessionId);
      message.success("已提交审核");
    },
    onError: (error: unknown) => {
      const { status, data } = extractApiError(error);
      if (
        status === 422 &&
        isRecord(data) &&
        data.code === "VALIDATION_FAILED" &&
        Array.isArray(data.errors)
      ) {
        const d = data as unknown as ValidationFailedError;
        setPreview((prev) =>
          prev
            ? {
                ...prev,
                canPublish: false,
                errors: d.errors,
              }
            : prev,
        );
        message.error("校验失败，请先修复翻译后再提交审核");
        return;
      }
      message.error("提交失败");
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (sessionId: string) =>
      approveReleaseSession(props.projectId, sessionId),
    onSuccess: async () => {
      if (!preview) {
        return;
      }
      await loadSession(preview.sessionId);
      message.success("已审核通过");
    },
    onError: () => {
      message.error("审核失败");
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (params: { sessionId: string; reason: string }) =>
      rejectReleaseSession(props.projectId, params.sessionId, {
        reason: params.reason,
      }),
    onSuccess: async () => {
      if (!preview) {
        return;
      }
      await loadSession(preview.sessionId);
      message.success("已驳回");
    },
    onError: () => {
      message.error("驳回失败");
    },
  });

  const publishMutation = useMutation({
    mutationFn: async (sessionId: string) =>
      publishReleaseSession(props.projectId, sessionId),
    onSuccess: (res) => {
      message.success(`发布成功：${res.releaseId}`);
      setPreview(null);
      form.resetFields();
      props.onClose();
    },
    onError: (error: unknown) => {
      const { status, data } = extractApiError(error);
      if (
        status === 422 &&
        isRecord(data) &&
        data.code === "VALIDATION_FAILED" &&
        Array.isArray(data.errors)
      ) {
        const d = data as unknown as ValidationFailedError;
        setPreview((prev) =>
          prev
            ? {
                ...prev,
                canPublish: false,
                errors: d.errors,
              }
            : prev,
        );
        message.error("校验失败，请先修复翻译后再发布");
        return;
      }
      message.error("发布失败");
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
    props.onClose();
  };

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
          scope: props.scope,
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
    props.scope,
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
          <Button
            disabled={
              !preview || preview.status !== "DRAFT" || !preview.canPublish
            }
            loading={submitMutation.isPending}
            onClick={() => {
              if (!preview) {
                return;
              }
              submitMutation.mutate(preview.sessionId);
            }}
          >
            Submit
          </Button>
          <Button
            disabled={!preview || preview.status !== "IN_REVIEW"}
            loading={approveMutation.isPending}
            onClick={() => {
              if (!preview) {
                return;
              }
              approveMutation.mutate(preview.sessionId);
            }}
          >
            Approve
          </Button>
          <Button
            danger
            disabled={!preview || preview.status !== "IN_REVIEW"}
            loading={rejectMutation.isPending}
            onClick={() => {
              if (!preview) {
                return;
              }
              let reason = "";
              Modal.confirm({
                title: "驳回原因",
                content: (
                  <Input.TextArea
                    autoSize={{ minRows: 3, maxRows: 8 }}
                    onChange={(e) => {
                      reason = e.target.value;
                    }}
                  />
                ),
                okText: "Reject",
                cancelText: "Cancel",
                onOk: async () => {
                  if (!reason.trim()) {
                    message.error("请输入原因");
                    throw new Error("reason required");
                  }
                  await rejectMutation.mutateAsync({
                    sessionId: preview.sessionId,
                    reason: reason.trim(),
                  });
                },
              });
            }}
          >
            Reject
          </Button>
          <Button
            type="primary"
            disabled={
              !preview || preview.status !== "APPROVED" || !preview.canPublish
            }
            loading={publishMutation.isPending}
            onClick={() => {
              if (!preview) {
                return;
              }
              publishMutation.mutate(preview.sessionId);
            }}
          >
            Publish
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
