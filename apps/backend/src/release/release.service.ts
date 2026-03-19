import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import {
  CreateReleaseDto,
  ListReleasesQueryDto,
} from './dto/create-release.dto';

type ReleaseScope =
  | { type: 'all' }
  | { type: 'namespaces'; namespaceIds: string[] }
  | { type: 'keys'; keyIds: string[] };

type ArtifactDict = Record<string, Record<string, string>>;

type DiffValue = { from: string; to: string };
type DiffJson = {
  added: ArtifactDict;
  updated: Record<string, Record<string, DiffValue>>;
  deleted: ArtifactDict;
};

type ValidationErrorCode =
  | 'MISSING_TRANSLATION'
  | 'EMPTY_CONTENT'
  | 'PLACEHOLDER_MISMATCH'
  | 'ICU_INVALID';

type ValidationError = {
  localeCode: string;
  keyId: string;
  namespaceId: string;
  keyName: string;
  namespaceName: string;
  reason: ValidationErrorCode;
};

@Injectable()
export class ReleaseService {
  constructor(private readonly prisma: PrismaService) {}

  private systemUserId: string | null = null;

  // ==================== 权限检查 ====================

  async isProjectOwner(projectId: string, userId: string): Promise<boolean> {
    const owner = await this.prisma.projectOwner.findUnique({
      where: { projectId_userId: { projectId, userId } },
    });
    return !!owner;
  }

  async canApproveRelease(projectId: string, userId: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    if (user?.role === 'ADMIN') return true;
    return await this.isProjectOwner(projectId, userId);
  }

  async canPublishWithoutApproval(
    projectId: string,
    userId: string,
  ): Promise<boolean> {
    const owners = await this.prisma.projectOwner.findMany({
      where: { projectId },
    });
    // 必须有且只有一个 Owner，且该 Owner 是当前用户
    return owners.length === 1 && owners[0]?.userId === userId;
  }

  async isApprovalEnabled(projectId: string): Promise<boolean> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { approvalEnabled: true },
    });
    return project?.approvalEnabled ?? false;
  }

  private isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private sortJson(value: unknown): unknown {
    if (Array.isArray(value)) {
      return value.map((v) => this.sortJson(v));
    }
    if (!this.isPlainObject(value)) {
      return value;
    }
    const keys = Object.keys(value).sort((a, b) => a.localeCompare(b));
    const out: Record<string, unknown> = {};
    for (const key of keys) {
      out[key] = this.sortJson(value[key]);
    }
    return out;
  }

  private stringifyJson(value: unknown) {
    return JSON.stringify(this.sortJson(value), null, 2);
  }

  private stringifyArtifact(value: ArtifactDict) {
    return this.stringifyJson(value);
  }

  private toKeyLocaleArtifacts(params: {
    artifactsByLocale: Record<string, ArtifactDict>;
    localeCodes: string[];
  }) {
    const out: Record<string, Record<string, Record<string, string>>> = {};

    for (const localeCode of params.localeCodes) {
      const dict = params.artifactsByLocale[localeCode] ?? {};

      for (const [ns, kv] of Object.entries(dict)) {
        if (!out[ns]) {
          out[ns] = {};
        }

        for (const [key, value] of Object.entries(kv)) {
          if (!out[ns][key]) {
            out[ns][key] = {};
          }
          out[ns][key][localeCode] = value;
        }
      }
    }

    return out;
  }

  private normalizeStringArray(values: unknown, fieldName: string) {
    if (!Array.isArray(values)) {
      return [];
    }
    const normalized = values.map((v) =>
      typeof v === 'string' ? v.trim() : '',
    );
    if (normalized.some((v) => !v)) {
      throw new BadRequestException(`${fieldName} must be an array of strings`);
    }
    return Array.from(new Set(normalized));
  }

  private parseScope(scope: CreateReleaseDto['scope']): ReleaseScope {
    const type = scope?.type;
    if (type !== 'all' && type !== 'namespaces' && type !== 'keys') {
      throw new BadRequestException(
        'scope.type must be all, namespaces, or keys',
      );
    }

    if (type === 'all') {
      return { type: 'all' };
    }

    if (type === 'namespaces') {
      const namespaceIds = this.normalizeStringArray(
        scope.namespaceIds,
        'scope.namespaceIds',
      );
      if (namespaceIds.length === 0) {
        throw new BadRequestException('scope.namespaceIds is required');
      }
      if (scope.keyIds?.length) {
        throw new BadRequestException(
          'scope.keyIds must be empty when type=namespaces',
        );
      }
      return { type: 'namespaces', namespaceIds };
    }

    const keyIds = this.normalizeStringArray(scope.keyIds, 'scope.keyIds');
    if (keyIds.length === 0) {
      throw new BadRequestException('scope.keyIds is required');
    }
    if (scope.namespaceIds?.length) {
      throw new BadRequestException(
        'scope.namespaceIds must be empty when type=keys',
      );
    }
    return { type: 'keys', keyIds };
  }

  private isBracesBalanced(text: string) {
    let depth = 0;
    for (const ch of text) {
      if (ch === '{') {
        depth += 1;
      } else if (ch === '}') {
        depth -= 1;
        if (depth < 0) {
          return false;
        }
      }
    }
    return depth === 0;
  }

  private extractPlaceholders(text: string) {
    const placeholders = new Set<string>();
    const regex = /\{([a-zA-Z_][\w.]*)\}/g;
    for (const match of text.matchAll(regex)) {
      placeholders.add(match[1]);
    }
    return placeholders;
  }

  private async getSystemUserId() {
    if (this.systemUserId) {
      return this.systemUserId;
    }

    const existing = await this.prisma.user.findUnique({
      where: { username: 'system' },
      select: { id: true },
    });
    if (existing) {
      this.systemUserId = existing.id;
      return existing.id;
    }

    const created = await this.prisma.user.create({
      data: { username: 'system', role: 'ADMIN' },
      select: { id: true },
    });
    this.systemUserId = created.id;
    return created.id;
  }

  private async createAuditLog(params: {
    action: string;
    targetId: string;
    projectId: string;
    payload?: Prisma.InputJsonValue;
  }) {
    const systemUserId = await this.getSystemUserId();
    await this.prisma.auditLog.create({
      data: {
        action: params.action,
        targetType: 'Release',
        targetId: params.targetId,
        scopeType: 'PROJECT',
        projectId: params.projectId,
        actorType: 'SYSTEM',
        actorId: systemUserId,
        userId: systemUserId,
        payload: params.payload,
        version: 1,
      },
    });
  }

  private flattenArtifact(artifact: ArtifactDict) {
    const flat = new Map<string, string>();
    for (const [ns, kv] of Object.entries(artifact)) {
      for (const [key, value] of Object.entries(kv ?? {})) {
        flat.set(`${ns}.${key}`, value);
      }
    }
    return flat;
  }

  private computeDiffSummary(params: {
    base: Record<string, ArtifactDict>;
    next: Record<string, ArtifactDict>;
    localeCodes: string[];
  }) {
    let added = 0;
    let updated = 0;
    let deleted = 0;

    for (const localeCode of params.localeCodes) {
      const baseFlat = this.flattenArtifact(params.base[localeCode] ?? {});
      const nextFlat = this.flattenArtifact(params.next[localeCode] ?? {});
      const keys = new Set([...baseFlat.keys(), ...nextFlat.keys()]);
      for (const k of keys) {
        const a = baseFlat.get(k);
        const b = nextFlat.get(k);
        if (a === undefined && b !== undefined) {
          added += 1;
          continue;
        }
        if (a !== undefined && b === undefined) {
          deleted += 1;
          continue;
        }
        if (a !== undefined && b !== undefined && a !== b) {
          updated += 1;
        }
      }
    }

    return {
      baseReleaseId: null as string | null,
      changed: added + updated + deleted,
      added,
      updated,
      deleted,
      locales: params.localeCodes,
    };
  }

  private computeDiffJson(params: {
    base: Record<string, ArtifactDict>;
    next: Record<string, ArtifactDict>;
    localeCodes: string[];
  }) {
    const diffByLocale: Record<string, DiffJson> = {};

    for (const localeCode of params.localeCodes) {
      const baseDict = params.base[localeCode] ?? {};
      const nextDict = params.next[localeCode] ?? {};

      const added: ArtifactDict = {};
      const deleted: ArtifactDict = {};
      const updated: Record<string, Record<string, DiffValue>> = {};

      const namespaces = new Set([
        ...Object.keys(baseDict),
        ...Object.keys(nextDict),
      ]);

      for (const ns of namespaces) {
        const baseNs = baseDict[ns] ?? {};
        const nextNs = nextDict[ns] ?? {};
        const keys = new Set([...Object.keys(baseNs), ...Object.keys(nextNs)]);

        for (const key of keys) {
          const a = baseNs[key];
          const b = nextNs[key];

          if (a === undefined && b !== undefined) {
            if (!added[ns]) {
              added[ns] = {};
            }
            added[ns][key] = b;
            continue;
          }

          if (a !== undefined && b === undefined) {
            if (!deleted[ns]) {
              deleted[ns] = {};
            }
            deleted[ns][key] = a;
            continue;
          }

          if (a !== undefined && b !== undefined && a !== b) {
            if (!updated[ns]) {
              updated[ns] = {};
            }
            updated[ns][key] = { from: a, to: b };
          }
        }
      }

      diffByLocale[localeCode] = { added, updated, deleted };
    }

    return diffByLocale;
  }

  private async getProjectContext(projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        baseLocale: true,
        currentReleaseId: true,
        ProjectLocale: {
          where: { enabled: true },
          include: { Locale: { select: { code: true } } },
        },
      },
    });
    if (!project) {
      throw new NotFoundException(`Project with ID ${projectId} not found`);
    }

    const enabledLocaleCodes = project.ProjectLocale.map(
      (pl) => pl.Locale.code,
    );
    const baseLocale = project.baseLocale || 'zh-CN';
    const enabledSet = new Set(enabledLocaleCodes);
    if (baseLocale) {
      enabledSet.add(baseLocale);
    }

    return {
      projectId: project.id,
      baseLocale,
      currentReleaseId: project.currentReleaseId,
      enabledLocaleCodes: Array.from(enabledSet),
    };
  }

  private resolveLocaleCodes(params: {
    requested?: string[];
    enabled: string[];
  }): string[] {
    if (!params.requested) {
      return params.enabled;
    }
    const normalized = params.requested.map((c) =>
      typeof c === 'string' ? c.trim() : '',
    );
    if (normalized.some((c) => !c)) {
      throw new BadRequestException('localeCodes must be an array of strings');
    }
    const unique = Array.from(new Set(normalized));
    const enabledSet = new Set(params.enabled);
    const invalid = unique.filter((c) => !enabledSet.has(c));
    if (invalid.length) {
      throw new BadRequestException(
        `localeCodes contains disabled locales: ${invalid.join(', ')}`,
      );
    }
    return unique;
  }

  private async getNamespaceNames(projectId: string, namespaceIds: string[]) {
    const namespaces = await this.prisma.namespace.findMany({
      where: { id: { in: namespaceIds }, projectId },
      select: { id: true, name: true },
    });
    const found = new Set(namespaces.map((n) => n.id));
    const missing = namespaceIds.filter((id) => !found.has(id));
    if (missing.length) {
      throw new NotFoundException(
        `Namespaces not found: ${missing.join(', ')}`,
      );
    }
    return namespaces.map((n) => n.name);
  }

  private async loadBaseArtifacts(params: {
    baseReleaseId: string | null;
    localeCodes: string[];
  }) {
    if (!params.baseReleaseId) {
      return Object.fromEntries(
        params.localeCodes.map((c) => [c, {}]),
      ) as Record<string, ArtifactDict>;
    }

    const artifacts = await this.prisma.releaseArtifact.findMany({
      where: {
        releaseId: params.baseReleaseId,
        localeCode: { in: params.localeCodes },
      },
      select: {
        localeCode: true,
        data: true,
      },
    });

    const base: Record<string, ArtifactDict> = Object.fromEntries(
      params.localeCodes.map((c) => [c, {}]),
    );
    for (const a of artifacts) {
      base[a.localeCode] = (a.data as ArtifactDict) ?? {};
    }
    return base;
  }

  private async fetchKeyPayload(params: {
    projectId: string;
    baseLocale: string;
    localeCodesForPublish: string[];
    localeCodesForValidation: string[];
    scope: ReleaseScope;
  }) {
    const localeCodesForFetch = Array.from(
      new Set([...params.localeCodesForValidation, params.baseLocale]),
    );

    const whereKey: Prisma.KeyWhereInput =
      params.scope.type === 'all'
        ? { Namespace: { projectId: params.projectId } }
        : params.scope.type === 'namespaces'
          ? {
              namespaceId: { in: params.scope.namespaceIds },
              Namespace: { projectId: params.projectId },
            }
          : {
              id: { in: params.scope.keyIds },
              Namespace: { projectId: params.projectId },
            };

    const keys = await this.prisma.key.findMany({
      where: whereKey,
      include: {
        Namespace: { select: { id: true, name: true } },
        Translation: {
          where: {
            Locale: {
              code: { in: localeCodesForFetch },
            },
          },
          include: {
            Locale: { select: { code: true } },
          },
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    if (params.scope.type === 'keys') {
      const found = new Set(keys.map((k) => k.id));
      const missing = params.scope.keyIds.filter((id) => !found.has(id));
      if (missing.length) {
        throw new NotFoundException(`Keys not found: ${missing.join(', ')}`);
      }
    }

    return keys;
  }

  private validateAndBuildArtifacts(params: {
    keys: Awaited<ReturnType<ReleaseService['fetchKeyPayload']>>;
    projectId: string;
    baseLocale: string;
    localeCodes: string[];
  }) {
    const errors: ValidationError[] = [];
    const perLocale: Record<string, ArtifactDict> = Object.fromEntries(
      params.localeCodes.map((c) => [c, {}]),
    );

    for (const key of params.keys) {
      const namespaceName = key.Namespace.name;
      const baseTranslation = key.Translation.find(
        (t) => t.Locale.code === params.baseLocale,
      );
      const baseContent = baseTranslation?.content ?? '';

      for (const localeCode of params.localeCodes) {
        const t = key.Translation.find((tr) => tr.Locale.code === localeCode);
        const content = t?.content ?? '';

        if (!t) {
          errors.push({
            localeCode,
            keyId: key.id,
            namespaceId: key.Namespace.id,
            keyName: key.name,
            namespaceName,
            reason: 'MISSING_TRANSLATION',
          });
          continue;
        }

        if (!content.trim()) {
          errors.push({
            localeCode,
            keyId: key.id,
            namespaceId: key.Namespace.id,
            keyName: key.name,
            namespaceName,
            reason: 'EMPTY_CONTENT',
          });
          continue;
        }

        if (!this.isBracesBalanced(content)) {
          errors.push({
            localeCode,
            keyId: key.id,
            namespaceId: key.Namespace.id,
            keyName: key.name,
            namespaceName,
            reason: 'ICU_INVALID',
          });
          continue;
        }

        if (localeCode !== params.baseLocale && baseContent.trim()) {
          const source = this.extractPlaceholders(baseContent);
          const target = this.extractPlaceholders(content);
          const same =
            source.size === target.size &&
            Array.from(source.values()).every((p) => target.has(p));
          if (!same) {
            errors.push({
              localeCode,
              keyId: key.id,
              namespaceId: key.Namespace.id,
              keyName: key.name,
              namespaceName,
              reason: 'PLACEHOLDER_MISMATCH',
            });
            continue;
          }
        }

        const localeDict = perLocale[localeCode] ?? {};
        if (!localeDict[namespaceName]) {
          localeDict[namespaceName] = {};
        }
        localeDict[namespaceName][key.name] = content;
        perLocale[localeCode] = localeDict;
      }
    }

    return { errors, artifacts: perLocale };
  }

  private applyNamespacePatch(params: {
    base: Record<string, ArtifactDict>;
    patch: Record<string, ArtifactDict>;
    namespaceNames: string[];
    localeCodes: string[];
  }) {
    const next: Record<string, ArtifactDict> = {};
    for (const localeCode of params.localeCodes) {
      const baseDict = params.base[localeCode] ?? {};
      const cloned = JSON.parse(JSON.stringify(baseDict)) as ArtifactDict;
      const patchDict = params.patch[localeCode] ?? {};
      for (const ns of params.namespaceNames) {
        cloned[ns] = patchDict[ns] ?? {};
      }
      next[localeCode] = cloned;
    }
    return next;
  }

  private applyKeyPatch(params: {
    base: Record<string, ArtifactDict>;
    patch: Record<string, ArtifactDict>;
    localeCodes: string[];
  }) {
    const next: Record<string, ArtifactDict> = {};
    for (const localeCode of params.localeCodes) {
      const baseDict = params.base[localeCode] ?? {};
      const cloned = JSON.parse(JSON.stringify(baseDict)) as ArtifactDict;
      const patchDict = params.patch[localeCode] ?? {};
      for (const [ns, kv] of Object.entries(patchDict)) {
        if (!cloned[ns]) {
          cloned[ns] = {};
        }
        for (const [k, v] of Object.entries(kv)) {
          cloned[ns][k] = v;
        }
      }
      next[localeCode] = cloned;
    }
    return next;
  }

  private async computeArtifacts(params: {
    projectId: string;
    baseLocale: string;
    scope: ReleaseScope;
    localeCodes: string[];
    baseArtifacts: Record<string, ArtifactDict>;
  }) {
    const keys = await this.fetchKeyPayload({
      projectId: params.projectId,
      baseLocale: params.baseLocale,
      localeCodesForPublish: params.localeCodes,
      localeCodesForValidation: params.localeCodes,
      scope: params.scope,
    });

    const built = this.validateAndBuildArtifacts({
      keys,
      projectId: params.projectId,
      baseLocale: params.baseLocale,
      localeCodes: params.localeCodes,
    });

    const errors = built.errors;

    if (params.scope.type === 'all') {
      return { artifacts: built.artifacts, errors };
    }

    if (params.scope.type === 'namespaces') {
      const namespaceNames = await this.getNamespaceNames(
        params.projectId,
        params.scope.namespaceIds,
      );
      return {
        artifacts: this.applyNamespacePatch({
          base: params.baseArtifacts,
          patch: built.artifacts,
          namespaceNames,
          localeCodes: params.localeCodes,
        }),
        errors,
      };
    }

    return {
      artifacts: this.applyKeyPatch({
        base: params.baseArtifacts,
        patch: built.artifacts,
        localeCodes: params.localeCodes,
      }),
      errors,
    };
  }

  async getActiveReleaseSession(projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { currentReleaseId: true },
    });
    if (!project) {
      throw new NotFoundException(`Project with ID ${projectId} not found`);
    }

    const session = await this.prisma.releaseSession.findFirst({
      where: {
        projectId,
        status: {
          in: ['DRAFT', 'IN_REVIEW', 'APPROVED'],
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return { currentReleaseId: project.currentReleaseId, session };
  }

  async getReleaseSession(projectId: string, sessionId: string) {
    const normalized = typeof sessionId === 'string' ? sessionId.trim() : '';
    if (!normalized) {
      throw new BadRequestException('sessionId is required');
    }

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { currentReleaseId: true },
    });
    if (!project) {
      throw new NotFoundException(`Project with ID ${projectId} not found`);
    }

    const session = await this.prisma.releaseSession.findFirst({
      where: { id: normalized, projectId },
    });
    if (!session) {
      throw new NotFoundException(
        `ReleaseSession with ID ${normalized} not found`,
      );
    }

    return { currentReleaseId: project.currentReleaseId, session };
  }

  async submitReleaseSession(
    projectId: string,
    sessionId: string,
    note?: string,
  ) {
    const normalized = typeof sessionId === 'string' ? sessionId.trim() : '';
    if (!normalized) {
      throw new BadRequestException('sessionId is required');
    }

    const session = await this.prisma.releaseSession.findFirst({
      where: { id: normalized, projectId },
    });
    if (!session) {
      throw new NotFoundException(
        `ReleaseSession with ID ${normalized} not found`,
      );
    }

    if (session.status !== 'DRAFT') {
      throw new BadRequestException(
        `ReleaseSession cannot be submitted from ${session.status}`,
      );
    }

    const errorsValue = session.validationErrors as unknown;
    const errors = Array.isArray(errorsValue) ? errorsValue : [];
    if (errors.length) {
      throw new UnprocessableEntityException({
        code: 'VALIDATION_FAILED',
        ok: false,
        errors,
      });
    }

    const updated = await this.prisma.releaseSession.update({
      where: { id: normalized },
      data: {
        status: 'IN_REVIEW',
        submittedAt: new Date(),
        note: note?.trim() ? note.trim() : session.note,
      },
    });

    return { session: updated };
  }

  async approveReleaseSession(
    projectId: string,
    sessionId: string,
    userId: string,
    note?: string,
  ) {
    const normalized = typeof sessionId === 'string' ? sessionId.trim() : '';
    if (!normalized) {
      throw new BadRequestException('sessionId is required');
    }

    // 检查权限
    const canApprove = await this.canApproveRelease(projectId, userId);
    if (!canApprove) {
      throw new BadRequestException(
        'Only project owners or admins can approve releases',
      );
    }

    const session = await this.prisma.releaseSession.findFirst({
      where: { id: normalized, projectId },
    });
    if (!session) {
      throw new NotFoundException(
        `ReleaseSession with ID ${normalized} not found`,
      );
    }

    if (session.status !== 'IN_REVIEW') {
      throw new BadRequestException(
        `ReleaseSession cannot be approved from ${session.status}`,
      );
    }

    const updated = await this.prisma.releaseSession.update({
      where: { id: normalized },
      data: {
        status: 'APPROVED',
        reviewedAt: new Date(),
        reviewNote: note?.trim() ? note.trim() : null,
      },
    });

    return { session: updated };
  }

  async rejectReleaseSession(
    projectId: string,
    sessionId: string,
    userId: string,
    reason: string,
  ) {
    const normalized = typeof sessionId === 'string' ? sessionId.trim() : '';
    if (!normalized) {
      throw new BadRequestException('sessionId is required');
    }
    const normalizedReason = typeof reason === 'string' ? reason.trim() : '';
    if (!normalizedReason) {
      throw new BadRequestException('reason is required');
    }

    // 检查权限
    const canApprove = await this.canApproveRelease(projectId, userId);
    if (!canApprove) {
      throw new BadRequestException(
        'Only project owners or admins can reject releases',
      );
    }

    const session = await this.prisma.releaseSession.findFirst({
      where: { id: normalized, projectId },
    });
    if (!session) {
      throw new NotFoundException(
        `ReleaseSession with ID ${normalized} not found`,
      );
    }

    if (session.status !== 'IN_REVIEW') {
      throw new BadRequestException(
        `ReleaseSession cannot be rejected from ${session.status}`,
      );
    }

    const updated = await this.prisma.releaseSession.update({
      where: { id: normalized },
      data: {
        status: 'REJECTED',
        reviewedAt: new Date(),
        reviewNote: normalizedReason,
      },
    });

    return { session: updated };
  }

  async publishReleaseSession(
    projectId: string,
    sessionId: string,
    userId: string,
  ) {
    const normalized = typeof sessionId === 'string' ? sessionId.trim() : '';
    if (!normalized) {
      throw new BadRequestException('sessionId is required');
    }

    const ctx = await this.getProjectContext(projectId);
    const session = await this.prisma.releaseSession.findFirst({
      where: { id: normalized, projectId },
    });
    if (!session) {
      throw new NotFoundException(
        `ReleaseSession with ID ${normalized} not found`,
      );
    }

    // 检查发布权限
    const approvalEnabled = await this.isApprovalEnabled(projectId);

    if (approvalEnabled) {
      // 启用了审批流程
      if (session.status === 'DRAFT') {
        // 检查是否是单 Owner，如果是则自动批准
        const canAutoApprove = await this.canPublishWithoutApproval(
          projectId,
          userId,
        );
        if (!canAutoApprove) {
          throw new BadRequestException(
            'Release session must be approved before publishing',
          );
        }
        // 单 Owner 自动批准
        await this.prisma.releaseSession.update({
          where: { id: normalized },
          data: { status: 'APPROVED', reviewedAt: new Date() },
        });
      } else if (session.status !== 'APPROVED') {
        throw new BadRequestException(
          'Release session must be approved before publishing',
        );
      }
    } else {
      // 未启用审批，直接发布
      if (session.status !== 'DRAFT' && session.status !== 'APPROVED') {
        throw new BadRequestException(
          `Cannot publish from ${session.status} status`,
        );
      }
    }

    const baseReleaseId = session.baseReleaseId ?? null;
    if (ctx.currentReleaseId && baseReleaseId !== ctx.currentReleaseId) {
      throw new ConflictException({
        code: 'BASE_RELEASE_MISMATCH',
        currentReleaseId: ctx.currentReleaseId,
        baseReleaseId,
      });
    }

    const nextArtifactsValue = session.nextArtifacts as unknown;
    if (!this.isPlainObject(nextArtifactsValue)) {
      throw new BadRequestException('Invalid session artifacts');
    }

    const localeCodes = Array.isArray(session.localeCodes)
      ? session.localeCodes
      : [];
    const nextArtifacts = nextArtifactsValue as Record<string, ArtifactDict>;

    const created = await this.prisma.$transaction(async (tx) => {
      const last = await tx.release.findFirst({
        where: { projectId },
        orderBy: { version: 'desc' },
        select: { version: true },
      });
      const version = (last?.version ?? 0) + 1;

      const release = await tx.release.create({
        data: {
          projectId,
          basedOnReleaseId: baseReleaseId,
          version,
          note: session.note,
          scope: (session.scope ?? {}) as Prisma.InputJsonValue,
        },
      });

      await tx.releaseArtifact.createMany({
        data: localeCodes.map((localeCode) => ({
          releaseId: release.id,
          localeCode,
          data: nextArtifacts[localeCode] ?? {},
        })),
      });

      await tx.project.update({
        where: { id: projectId },
        data: { currentReleaseId: release.id },
      });

      await tx.releaseSession.update({
        where: { id: normalized },
        data: {
          status: 'PUBLISHED',
          publishedReleaseId: release.id,
          publishedAt: new Date(),
        },
      });

      return release;
    });

    await this.createAuditLog({
      action: 'RELEASE_PUBLISH',
      targetId: created.id,
      projectId,
      payload: {
        sessionId: normalized,
        baseReleaseId,
        localeCodes,
      },
    });

    return { releaseId: created.id, currentReleaseId: created.id };
  }

  private isSameScope(
    a: ReleaseScope,
    b: { type: string; namespaceIds?: string[]; keyIds?: string[] },
  ): boolean {
    if (a.type !== b.type) return false;

    if (a.type === 'namespaces' && b.type === 'namespaces') {
      const aIds = new Set(a.namespaceIds);
      const bIds = new Set(b.namespaceIds ?? []);
      if (aIds.size !== bIds.size) return false;
      return Array.from(aIds).every((id) => bIds.has(id));
    }

    if (a.type === 'keys' && b.type === 'keys') {
      const aIds = new Set(a.keyIds);
      const bIds = new Set(b.keyIds ?? []);
      if (aIds.size !== bIds.size) return false;
      return Array.from(aIds).every((id) => bIds.has(id));
    }

    return a.type === 'all' && b.type === 'all';
  }

  async previewRelease(projectId: string, dto: CreateReleaseDto) {
    const ctx = await this.getProjectContext(projectId);
    const scope = this.parseScope(dto.scope);

    const localeCodes = this.resolveLocaleCodes({
      requested: dto.localeCodes,
      enabled: ctx.enabledLocaleCodes,
    });

    const baseReleaseId =
      typeof dto.baseReleaseId === 'string' && dto.baseReleaseId.trim()
        ? dto.baseReleaseId.trim()
        : ctx.currentReleaseId;

    if (ctx.currentReleaseId && baseReleaseId !== ctx.currentReleaseId) {
      throw new ConflictException({
        code: 'BASE_RELEASE_MISMATCH',
        currentReleaseId: ctx.currentReleaseId,
        baseReleaseId,
      });
    }

    const baseArtifacts = await this.loadBaseArtifacts({
      baseReleaseId: baseReleaseId ?? null,
      localeCodes,
    });

    const built = await this.computeArtifacts({
      projectId,
      baseLocale: ctx.baseLocale,
      scope,
      localeCodes,
      baseArtifacts,
    });

    const base = this.toKeyLocaleArtifacts({
      artifactsByLocale: baseArtifacts,
      localeCodes,
    });
    const next = this.toKeyLocaleArtifacts({
      artifactsByLocale: built.artifacts,
      localeCodes,
    });

    const active = await this.prisma.releaseSession.findFirst({
      where: {
        projectId,
        status: {
          in: ['DRAFT', 'IN_REVIEW', 'APPROVED'],
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // 检查 scope 是否匹配，如果不匹配则视为没有 active session
    const scopeMatches =
      active &&
      this.isSameScope(
        scope,
        (active.scope as {
          type: string;
          namespaceIds?: string[];
          keyIds?: string[];
        }) ?? { type: 'all' },
      );

    if (active && active.status !== 'DRAFT' && scopeMatches) {
      throw new ConflictException({
        code: 'RELEASE_SESSION_LOCKED',
        sessionId: active.id,
        status: active.status,
      });
    }

    const data = {
      status: 'DRAFT',
      baseReleaseId: baseReleaseId ?? null,
      scope: {
        type: scope.type,
        ...(scope.type === 'namespaces'
          ? { namespaceIds: scope.namespaceIds }
          : {}),
        ...(scope.type === 'keys' ? { keyIds: scope.keyIds } : {}),
        localeCodes,
      },
      localeCodes,
      note: dto.note?.trim() ? dto.note.trim() : null,
      validationErrors: built.errors as unknown as Prisma.InputJsonValue,
      nextArtifacts: built.artifacts as unknown as Prisma.InputJsonValue,
      baseJson: this.stringifyJson(base),
      nextJson: this.stringifyJson(next),
    } as const;

    // 只有 scope 匹配时才更新现有 session，否则创建新 session
    const session =
      active && scopeMatches
        ? await this.prisma.releaseSession.update({
            where: { id: active.id },
            data,
          })
        : await this.prisma.releaseSession.create({
            data: { projectId, ...data },
          });

    return {
      sessionId: session.id,
      status: session.status,
      baseReleaseId: baseReleaseId ?? null,
      canPublish: built.errors.length === 0,
      errors: built.errors,
      baseJson: data.baseJson,
      nextJson: data.nextJson,
    };
  }

  async listReleases(projectId: string, query: ListReleasesQueryDto) {
    const limitRaw = query.limit?.trim();
    const limit = limitRaw ? Number(limitRaw) : 50;
    if (!Number.isFinite(limit) || limit <= 0 || limit > 100) {
      throw new BadRequestException('limit must be a number between 1 and 100');
    }

    const where: Prisma.ReleaseWhereInput = { projectId };
    const beforeDate =
      query.before && query.before.trim() ? new Date(query.before) : null;
    if (beforeDate && Number.isNaN(beforeDate.getTime())) {
      throw new BadRequestException('before must be a valid ISO date string');
    }
    if (beforeDate) {
      if (query.beforeId && query.beforeId.trim()) {
        where.OR = [
          { createdAt: { lt: beforeDate } },
          { createdAt: beforeDate, id: { lt: query.beforeId.trim() } },
        ];
      } else {
        where.createdAt = { lt: beforeDate };
      }
    }

    const items = await this.prisma.release.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit,
    });

    const last = items.at(-1);
    return {
      items,
      nextCursor: last
        ? { before: last.createdAt.toISOString(), beforeId: last.id }
        : null,
    };
  }

  async getRelease(projectId: string, releaseId: string) {
    const release = await this.prisma.release.findFirst({
      where: { id: releaseId, projectId },
    });
    if (!release) {
      throw new NotFoundException(`Release with ID ${releaseId} not found`);
    }
    const locales = await this.prisma.releaseArtifact.findMany({
      where: { releaseId },
      select: { localeCode: true },
      orderBy: { localeCode: 'asc' },
    });
    return { ...release, localeCodes: locales.map((l) => l.localeCode) };
  }

  async rollback(projectId: string, releaseId: string, toReleaseId?: string) {
    const targetReleaseId = toReleaseId?.trim()
      ? toReleaseId.trim()
      : releaseId;
    const target = await this.prisma.release.findFirst({
      where: { id: targetReleaseId, projectId },
      select: { id: true },
    });
    if (!target) {
      throw new NotFoundException(
        `Release with ID ${targetReleaseId} not found`,
      );
    }

    await this.prisma.project.update({
      where: { id: projectId },
      data: { currentReleaseId: targetReleaseId },
    });

    await this.createAuditLog({
      action: 'RELEASE_ROLLBACK',
      targetId: targetReleaseId,
      projectId,
      payload: { toReleaseId: targetReleaseId },
    });

    return { currentReleaseId: targetReleaseId };
  }

  async getArtifact(projectId: string, releaseId: string, localeCode: string) {
    const release = await this.prisma.release.findFirst({
      where: { id: releaseId, projectId },
      select: { id: true },
    });
    if (!release) {
      throw new NotFoundException(`Release with ID ${releaseId} not found`);
    }

    const artifact = await this.prisma.releaseArtifact.findUnique({
      where: {
        releaseId_localeCode: { releaseId, localeCode },
      },
      select: { data: true },
    });
    if (!artifact) {
      throw new NotFoundException(
        `Artifact not found for locale ${localeCode} in release ${releaseId}`,
      );
    }

    return (artifact.data as ArtifactDict) ?? {};
  }

  async getLatestArtifact(projectId: string, localeCode: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { currentReleaseId: true },
    });
    if (!project) {
      throw new NotFoundException(`Project with ID ${projectId} not found`);
    }
    if (!project.currentReleaseId) {
      throw new NotFoundException('No release has been published yet');
    }
    return this.getArtifact(projectId, project.currentReleaseId, localeCode);
  }
}
