export type ReleaseScopeType = "all" | "namespaces" | "keys";

export type ReleaseScope =
  | { type: "all" }
  | { type: "namespaces"; namespaceIds: string[] }
  | { type: "keys"; keyIds: string[] };

export type ValidationErrorCode =
  | "MISSING_TRANSLATION"
  | "EMPTY_CONTENT"
  | "PLACEHOLDER_MISMATCH"
  | "ICU_INVALID";

export type ReleaseValidationError = {
  localeCode: string;
  keyId: string;
  namespaceId: string;
  keyName: string;
  namespaceName: string;
  reason: ValidationErrorCode;
};

export type PreviewReleasePayload = {
  baseReleaseId?: string;
  scope: ReleaseScope;
  localeCodes?: string[];
};

export type ReleaseSessionStatus =
  | "DRAFT"
  | "IN_REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "PUBLISHED"
  | "EXPIRED";

export type PreviewReleaseResponse = {
  sessionId: string;
  status: ReleaseSessionStatus;
  baseReleaseId: string | null;
  canPublish: boolean;
  errors: ReleaseValidationError[];
  baseJson: string;
  nextJson: string;
};

export type PublishReleasePayload = { sessionId: string };

export type CreateReleaseResponse = {
  releaseId: string;
  currentReleaseId: string;
};

export type ReleaseSession = {
  id: string;
  status: ReleaseSessionStatus;
  baseReleaseId: string | null;
  localeCodes?: string[];
  note?: string | null;
  reviewNote?: string | null;
  baseJson: string;
  nextJson: string;
  validationErrors?: ReleaseValidationError[] | null;
};

export type GetActiveReleaseSessionResponse = {
  currentReleaseId: string | null;
  session: ReleaseSession | null;
};

export type GetReleaseSessionResponse = {
  currentReleaseId: string | null;
  session: ReleaseSession;
};

export type RollbackReleasePayload = { toReleaseId?: string };

export type RollbackReleaseResponse = { currentReleaseId: string };

export type BaseReleaseMismatchError = {
  code: "BASE_RELEASE_MISMATCH";
  currentReleaseId: string;
  baseReleaseId: string;
};

export type ReleaseSessionLockedError = {
  code: "RELEASE_SESSION_LOCKED";
  sessionId: string;
  status: ReleaseSessionStatus;
};

export type ValidationFailedError = {
  code: "VALIDATION_FAILED";
  ok: false;
  errors: ReleaseValidationError[];
};
