import apiClient from '@/api/client';
import type {
  CreateReleasePayload,
  CreateReleaseResponse,
  PreviewReleasePayload,
  PreviewReleaseResponse,
} from '@/types/release';

export const previewRelease = async (
  projectId: string,
  payload: PreviewReleasePayload,
) => {
  return (await apiClient.post(
    `/projects/${projectId}/releases/preview`,
    payload,
  )) as PreviewReleaseResponse;
};

export const createRelease = async (
  projectId: string,
  payload: CreateReleasePayload,
) => {
  return (await apiClient.post(
    `/projects/${projectId}/releases`,
    payload,
  )) as CreateReleaseResponse;
};
