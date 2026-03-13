export type ReleaseScopeType = 'all' | 'namespaces' | 'keys';

export type ReleaseScope =
  | { type: 'all' }
  | { type: 'namespaces'; namespaceIds: string[] }
  | { type: 'keys'; keyIds: string[] };

export type ValidationErrorCode =
  | 'MISSING_TRANSLATION'
  | 'EMPTY_CONTENT'
  | 'PLACEHOLDER_MISMATCH'
  | 'ICU_INVALID';

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

export type PreviewReleaseResponse = {
  baseReleaseId: string | null;
  canPublish: boolean;
  errors: ReleaseValidationError[];
  baseJson: string;
  nextJson: string;
};

export type CreateReleasePayload = PreviewReleasePayload;

export type CreateReleaseResponse = {
  releaseId: string;
  currentReleaseId: string;
};

export type RollbackReleasePayload = { toReleaseId?: string };

export type RollbackReleaseResponse = { currentReleaseId: string };

export type BaseReleaseMismatchError = {
  code: 'BASE_RELEASE_MISMATCH';
  currentReleaseId: string;
  baseReleaseId: string;
};

export type ValidationFailedError = {
  code: 'VALIDATION_FAILED';
  ok: false;
  errors: ReleaseValidationError[];
};
