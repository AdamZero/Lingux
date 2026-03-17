import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  App as AntdApp,
  Button,
  Card,
  Descriptions,
  Drawer,
  Form,
  Input,
  Modal,
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
  ReleaseValidationError,
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

const reasonText: Record<ReleaseValidationError["reason"], string> = {
  MISSING_TRANSLATION: "缺少翻译",
  EMPTY_CONTENT: "内容为空",
  PLACEHOLDER_MISMATCH: "占位符不一致",
  ICU_INVALID: "花括号不平衡",
};

const PublishDrawer: React.FC<Props> = (props) => {
  const { message } = AntdApp.useApp();
  const [form] = Form.useForm<{ localeCodes: string[] }>();

  const [preview, setPreview] = useState<PreviewReleaseResponse | null>(null);
  const isInitializingRef = useRef(false);
  const autoPreviewTimerRef = useRef<number | null>(null);
  const lastAutoPreviewKeyRef = useRef<string | null>(null);
  const watchedLocaleCodes = Form.useWatch("localeCodes", form);

  const allLocaleCodes = useMemo(
    () => props.locales.map((l) => l.code),
    [props.locales],
  );
  const defaultLocaleCodes = useMemo(() => {
    if (!props.baseLocale) {
      return allLocaleCodes;
    }
    const set = new Set(allLocaleCodes);
    set.add(props.baseLocale);
    return Array.from(set);
  }, [allLocaleCodes, props.baseLocale]);

  const errorColumns: ColumnsType<ReleaseValidationError> = [
    { title: "Locale", dataIndex: "localeCode", key: "localeCode", width: 110 },
    {
      title: "Namespace",
      dataIndex: "namespaceName",
      key: "namespaceName",
      width: 140,
    },
    { title: "Key", dataIndex: "keyName", key: "keyName", width: 220 },
    {
      title: "Reason",
      dataIndex: "reason",
      key: "reason",
      render: (value: ReleaseValidationError["reason"]) =>
        reasonText[value] ?? value,
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
    if (
      Array.isArray(result.session.localeCodes) &&
      result.session.localeCodes.length
    ) {
      form.setFieldsValue({ localeCodes: result.session.localeCodes });
    }
  };

  const previewMutation = useMutation({
    mutationFn: async (payload: PreviewReleasePayload) =>
      previewRelease(props.projectId, payload),
    onSuccess: (data, variables) => {
      setPreview(data);
      if (Array.isArray(variables.localeCodes)) {
        form.setFieldsValue({ localeCodes: variables.localeCodes });
      }
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

  const submitPreview = async () => {
    if (preview && preview.status !== "DRAFT") {
      message.error("当前会话已提交或已审核，不能重新预览");
      return;
    }
    const values = await form.validateFields();
    const payload: PreviewReleasePayload = {
      scope: props.scope,
      localeCodes: values.localeCodes,
    };
    setPreview(null);
    previewMutation.mutate(payload);
  };

  const close = () => {
    setPreview(null);
    form.resetFields();
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
          if (
            Array.isArray(res.session.localeCodes) &&
            res.session.localeCodes.length
          ) {
            form.setFieldsValue({ localeCodes: res.session.localeCodes });
          }
          isInitializingRef.current = false;
          return;
        }

        form.setFieldsValue({ localeCodes: defaultLocaleCodes });
        isInitializingRef.current = false;
        previewMutation.mutate({
          scope: props.scope,
          localeCodes: defaultLocaleCodes,
        });
      } catch {
        isInitializingRef.current = false;
        return;
      }
    })();
  }, [
    defaultLocaleCodes,
    form,
    previewMutation,
    props.open,
    props.projectId,
    props.scope,
  ]);

  useEffect(() => {
    if (!props.open) {
      return;
    }
    const localeCodes = watchedLocaleCodes as string[] | undefined;
    const canAutoPreview =
      !isInitializingRef.current && (!preview || preview.status === "DRAFT");
    if (
      !canAutoPreview ||
      !Array.isArray(localeCodes) ||
      localeCodes.length === 0
    ) {
      return;
    }
    if (previewMutation.isPending) {
      return;
    }

    const normalized = Array.from(new Set(localeCodes)).sort();
    const autoPreviewKey = JSON.stringify({
      scope: props.scope,
      localeCodes: normalized,
    });
    if (lastAutoPreviewKeyRef.current === autoPreviewKey) {
      return;
    }
    lastAutoPreviewKeyRef.current = autoPreviewKey;

    if (autoPreviewTimerRef.current) {
      window.clearTimeout(autoPreviewTimerRef.current);
    }

    autoPreviewTimerRef.current = window.setTimeout(() => {
      previewMutation.mutate({
        scope: props.scope,
        localeCodes: normalized,
      });
    }, 400);

    return () => {
      if (autoPreviewTimerRef.current) {
        window.clearTimeout(autoPreviewTimerRef.current);
        autoPreviewTimerRef.current = null;
      }
    };
  }, [preview, previewMutation, props.open, props.scope, watchedLocaleCodes]);

  return (
    <Drawer
      title="Publish"
      width={860}
      open={props.open}
      onClose={close}
      destroyOnClose
      extra={
        <Space>
          <Button onClick={close}>Close</Button>
        </Space>
      }
    >
      <Space direction="vertical" style={{ width: "100%" }} size="large">
        <Card>
          <Descriptions size="small" column={1}>
            <Descriptions.Item label="Scope">
              {props.scopeLabel}
            </Descriptions.Item>
            <Descriptions.Item label="Current Release">
              <Typography.Text code>
                {props.currentReleaseId || "-"}
              </Typography.Text>
            </Descriptions.Item>
            <Descriptions.Item label="Session">
              <Space>
                <Typography.Text code>
                  {preview?.sessionId ?? "-"}
                </Typography.Text>
                <Typography.Text type="secondary">
                  {preview?.status ?? "-"}
                </Typography.Text>
              </Space>
            </Descriptions.Item>
            <Descriptions.Item label="Base Release">
              <Typography.Text code>
                {preview?.baseReleaseId ?? "-"}
              </Typography.Text>
            </Descriptions.Item>
            <Descriptions.Item label="Can Publish">
              {preview ? (
                <Typography.Text
                  type={preview.canPublish ? "success" : "danger"}
                >
                  {preview.canPublish ? "YES" : "NO"}
                </Typography.Text>
              ) : (
                <Typography.Text type="secondary">-</Typography.Text>
              )}
            </Descriptions.Item>
          </Descriptions>
        </Card>

        <Card title="Preview" size="small">
          <Form
            form={form}
            layout="vertical"
            initialValues={{
              localeCodes: defaultLocaleCodes,
            }}
          >
            <Form.Item
              name="localeCodes"
              label="Locales"
              rules={[{ required: true, message: "请选择至少一个 locale" }]}
            >
              <Select
                mode="multiple"
                showSearch
                optionFilterProp="label"
                disabled={!!preview && preview.status !== "DRAFT"}
                options={props.locales.map((l) => ({
                  value: l.code,
                  label: `${l.name} (${l.code})`,
                }))}
              />
            </Form.Item>
          </Form>

          <Space wrap>
            <Button onClick={submitPreview} loading={previewMutation.isPending}>
              Refresh Preview
            </Button>
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

          {preview && preview.errors.length > 0 ? (
            <Card
              size="small"
              style={{ marginTop: 16 }}
              title={`Validation Errors (${preview.errors.length})`}
            >
              <Table
                size="small"
                rowKey={(r) =>
                  `${r.localeCode}:${r.namespaceId}:${r.keyId}:${r.reason}`
                }
                columns={errorColumns}
                dataSource={preview.errors}
                pagination={{ pageSize: 8 }}
              />
            </Card>
          ) : null}

          {parsedFile ? (
            <Card
              size="small"
              style={{ marginTop: 16 }}
              title="Diff (side-by-side)"
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
        </Card>
      </Space>
    </Drawer>
  );
};

export default PublishDrawer;
