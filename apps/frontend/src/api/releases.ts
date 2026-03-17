import apiClient from "@/api/client";
import type {
  CreateReleaseResponse,
  GetActiveReleaseSessionResponse,
  GetReleaseSessionResponse,
  PublishReleasePayload,
  PreviewReleasePayload,
  PreviewReleaseResponse,
} from "@/types/release";

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
  payload: PublishReleasePayload,
) => {
  return (await apiClient.post(
    `/projects/${projectId}/releases`,
    payload,
  )) as CreateReleaseResponse;
};

export const getActiveReleaseSession = async (projectId: string) => {
  return (await apiClient.get(
    `/projects/${projectId}/release-sessions/active`,
  )) as GetActiveReleaseSessionResponse;
};

export const getReleaseSession = async (
  projectId: string,
  sessionId: string,
) => {
  return (await apiClient.get(
    `/projects/${projectId}/release-sessions/${sessionId}`,
  )) as GetReleaseSessionResponse;
};

export const submitReleaseSession = async (
  projectId: string,
  sessionId: string,
  payload?: { note?: string },
) => {
  return (await apiClient.post(
    `/projects/${projectId}/release-sessions/${sessionId}/submit`,
    payload ?? {},
  )) as { session: unknown };
};

export const approveReleaseSession = async (
  projectId: string,
  sessionId: string,
  payload?: { note?: string },
) => {
  return (await apiClient.post(
    `/projects/${projectId}/release-sessions/${sessionId}/approve`,
    payload ?? {},
  )) as { session: unknown };
};

export const rejectReleaseSession = async (
  projectId: string,
  sessionId: string,
  payload: { reason: string },
) => {
  return (await apiClient.post(
    `/projects/${projectId}/release-sessions/${sessionId}/reject`,
    payload,
  )) as { session: unknown };
};

export const publishReleaseSession = async (
  projectId: string,
  sessionId: string,
) => {
  return (await apiClient.post(
    `/projects/${projectId}/release-sessions/${sessionId}/publish`,
    {},
  )) as CreateReleaseResponse;
};
