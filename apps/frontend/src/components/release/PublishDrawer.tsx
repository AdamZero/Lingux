import React, { useMemo, useState } from 'react';
import {
  App as AntdApp,
  Button,
  Card,
  Descriptions,
  Drawer,
  Form,
  Select,
  Space,
  Table,
  Typography,
} from 'antd';
import { useMutation } from '@tanstack/react-query';
import type { ColumnsType } from 'antd/es/table';
import { createTwoFilesPatch } from 'diff';
import { Diff, Hunk, parseDiff } from 'react-diff-view';
import 'react-diff-view/style/index.css';
import { createRelease, previewRelease } from '@/api/releases';
import type {
  BaseReleaseMismatchError,
  CreateReleasePayload,
  PreviewReleaseResponse,
  ReleaseValidationError,
  ValidationFailedError,
} from '@/types/release';

type LocaleOption = { code: string; name: string };

type Props = {
  open: boolean;
  onClose: () => void;
  projectId: string;
  baseLocale?: string;
  locales: LocaleOption[];
  currentReleaseId?: string | null;
  scope: CreateReleasePayload['scope'];
  scopeLabel: string;
};

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

const reasonText: Record<ReleaseValidationError['reason'], string> = {
  MISSING_TRANSLATION: '缺少翻译',
  EMPTY_CONTENT: '内容为空',
  PLACEHOLDER_MISMATCH: '占位符不一致',
  ICU_INVALID: '花括号不平衡',
};

const PublishDrawer: React.FC<Props> = (props) => {
  const { message } = AntdApp.useApp();
  const [form] = Form.useForm<{ localeCodes: string[] }>();

  const [preview, setPreview] = useState<PreviewReleaseResponse | null>(null);
  const [lastPayload, setLastPayload] = useState<CreateReleasePayload | null>(null);

  const allLocaleCodes = useMemo(() => props.locales.map((l) => l.code), [props.locales]);
  const defaultLocaleCodes = useMemo(() => {
    if (!props.baseLocale) {
      return allLocaleCodes;
    }
    const set = new Set(allLocaleCodes);
    set.add(props.baseLocale);
    return Array.from(set);
  }, [allLocaleCodes, props.baseLocale]);

  const errorColumns: ColumnsType<ReleaseValidationError> = [
    { title: 'Locale', dataIndex: 'localeCode', key: 'localeCode', width: 110 },
    { title: 'Namespace', dataIndex: 'namespaceName', key: 'namespaceName', width: 140 },
    { title: 'Key', dataIndex: 'keyName', key: 'keyName', width: 220 },
    {
      title: 'Reason',
      dataIndex: 'reason',
      key: 'reason',
      render: (value: ReleaseValidationError['reason']) => reasonText[value] ?? value,
    },
  ];

  const previewMutation = useMutation({
    mutationFn: async (payload: CreateReleasePayload) => previewRelease(props.projectId, payload),
    onSuccess: (data, variables) => {
      setPreview(data);
      setLastPayload(variables);
      message.success('预览成功');
    },
    onError: (error: unknown) => {
      const { status, data } = extractApiError(error);
      if (status === 409 && isRecord(data) && data.code === 'BASE_RELEASE_MISMATCH') {
        const d = data as unknown as BaseReleaseMismatchError;
        setPreview(null);
        setLastPayload(null);
        message.error(`线上版本已变化，请重新预览（current=${d.currentReleaseId}）`);
        return;
      }
      message.error('预览失败');
    },
  });

  const publishMutation = useMutation({
    mutationFn: async (payload: CreateReleasePayload) => createRelease(props.projectId, payload),
    onSuccess: (res) => {
      message.success(`发布成功：${res.releaseId}`);
      setPreview(null);
      setLastPayload(null);
      form.resetFields();
      props.onClose();
    },
    onError: (error: unknown) => {
      const { status, data } = extractApiError(error);
      if (
        status === 422 &&
        isRecord(data) &&
        data.code === 'VALIDATION_FAILED' &&
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
        message.error('校验失败，请先修复翻译后再发布');
        return;
      }
      message.error('发布失败');
    },
  });

  const diffText = useMemo(() => {
    if (!preview) {
      return null;
    }
    const oldText = preview.baseJson ?? '';
    const newText = preview.nextJson ?? '';
    const fileName = 'release.json';
    const patch = createTwoFilesPatch(
      `a/${fileName}`,
      `b/${fileName}`,
      oldText,
      newText,
      '',
      '',
      { context: 3 },
    );
    const lines = patch
      .split('\n')
      .filter((l) => !l.startsWith('Index: ') && !l.startsWith('===='));
    return [`diff --git a/${fileName} b/${fileName}`, ...lines].join('\n');
  }, [preview]);

  const parsedFile = useMemo(() => {
    if (!diffText) {
      return null;
    }
    const files = parseDiff(diffText);
    return files[0] ?? null;
  }, [diffText]);

  const submitPreview = async () => {
    const values = await form.validateFields();
    const payload: CreateReleasePayload = {
      scope: props.scope,
      localeCodes: values.localeCodes,
    };
    setPreview(null);
    setLastPayload(null);
    previewMutation.mutate(payload);
  };

  const close = () => {
    setPreview(null);
    setLastPayload(null);
    form.resetFields();
    props.onClose();
  };

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
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        <Card>
          <Descriptions size="small" column={1}>
            <Descriptions.Item label="Scope">{props.scopeLabel}</Descriptions.Item>
            <Descriptions.Item label="Current Release">
              <Typography.Text code>{props.currentReleaseId || '-'}</Typography.Text>
            </Descriptions.Item>
            <Descriptions.Item label="Base Release">
              <Typography.Text code>{preview?.baseReleaseId ?? '-'}</Typography.Text>
            </Descriptions.Item>
            <Descriptions.Item label="Can Publish">
              {preview ? (
                <Typography.Text type={preview.canPublish ? 'success' : 'danger'}>
                  {preview.canPublish ? 'YES' : 'NO'}
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
              rules={[{ required: true, message: '请选择至少一个 locale' }]}
            >
              <Select
                mode="multiple"
                showSearch
                optionFilterProp="label"
                options={props.locales.map((l) => ({
                  value: l.code,
                  label: `${l.name} (${l.code})`,
                }))}
              />
            </Form.Item>
          </Form>

          <Space wrap>
            <Button onClick={submitPreview} loading={previewMutation.isPending}>
              Preview
            </Button>
            <Button
              type="primary"
              disabled={!preview?.canPublish || !lastPayload}
              loading={publishMutation.isPending}
              onClick={() => {
                if (!lastPayload) {
                  return;
                }
                publishMutation.mutate(lastPayload);
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
                rowKey={(r) => `${r.localeCode}:${r.namespaceId}:${r.keyId}:${r.reason}`}
                columns={errorColumns}
                dataSource={preview.errors}
                pagination={{ pageSize: 8 }}
              />
            </Card>
          ) : null}

          {parsedFile ? (
            <Card size="small" style={{ marginTop: 16 }} title="Diff (side-by-side)">
              <Diff viewType="split" diffType={parsedFile.type} hunks={parsedFile.hunks}>
                {(hunks) => hunks.map((hunk) => <Hunk key={hunk.content} hunk={hunk} />)}
              </Diff>
            </Card>
          ) : (
            <Typography.Text type="secondary">请先点击 Preview</Typography.Text>
          )}
        </Card>
      </Space>
    </Drawer>
  );
};

export default PublishDrawer;
