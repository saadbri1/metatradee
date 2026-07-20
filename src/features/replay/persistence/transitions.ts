import { canonicalInstant } from '@/features/market-data/cache/canonical';
import { isValidIdempotencyKey } from '@/features/api/http';
import type {
  ReplayCheckpoint,
  ReplayLeaseDescriptor,
  ReplaySessionResumePayload,
} from './schemas';
import { replayCheckpointSchema, replayLeaseDescriptorSchema } from './schemas';

export type TransitionErrorCode =
  | 'IDEMPOTENCY_CONFLICT'
  | 'STALE_VERSION'
  | 'TERMINAL_SESSION'
  | 'LEASE_CONFLICT'
  | 'LEASE_REQUIRED'
  | 'INVALID_TRANSITION';

export interface TransitionReceipt {
  sessionId: string;
  version: number;
  lifecycleStatus: 'active' | 'completed' | 'abandoned';
  checkpoint: ReplayCheckpoint;
  lease: ReplayLeaseDescriptor | null;
}

export interface IdempotencyRecord {
  key: string;
  requestDigest: string;
  receipt: TransitionReceipt;
  recordedAt: string;
}

export interface MutationContext {
  expectedVersion: number;
  idempotencyKey: string;
  requestDigest: string;
  now: string;
  priorIdempotency?: IdempotencyRecord | null;
}

export type TransitionResult =
  | {
      ok: true;
      replayed: boolean;
      session: ReplaySessionResumePayload | null;
      receipt: TransitionReceipt;
      idempotencyRecord: IdempotencyRecord;
    }
  | { ok: false; code: TransitionErrorCode };

function validDigest(value: string): boolean {
  return /^[a-f0-9]{64}$/.test(value);
}

function prepare(
  session: ReplaySessionResumePayload,
  context: MutationContext,
): TransitionResult | string {
  if (!isValidIdempotencyKey(context.idempotencyKey) || !validDigest(context.requestDigest)) {
    return 'INVALID_TRANSITION';
  }
  if (context.priorIdempotency) {
    if (context.priorIdempotency.key !== context.idempotencyKey) return 'INVALID_TRANSITION';
    return context.priorIdempotency.requestDigest === context.requestDigest
      ? {
          ok: true,
          replayed: true,
          session: null,
          receipt: context.priorIdempotency.receipt,
          idempotencyRecord: context.priorIdempotency,
        }
      : 'IDEMPOTENCY_CONFLICT';
  }
  if (session.session.lifecycleStatus !== 'active') return 'TERMINAL_SESSION';
  if (session.session.version !== context.expectedVersion) return 'STALE_VERSION';
  try {
    const now = canonicalInstant(context.now, 'now');
    if (Date.parse(now) < Date.parse(session.session.updatedAt)) return 'INVALID_TRANSITION';
  } catch {
    return 'INVALID_TRANSITION';
  }
  return '';
}

function failure(code: string): TransitionResult {
  return { ok: false, code: code as TransitionErrorCode };
}

function receipt(session: ReplaySessionResumePayload): TransitionReceipt {
  return Object.freeze({
    sessionId: session.session.sessionId,
    version: session.session.version,
    lifecycleStatus: session.session.lifecycleStatus,
    checkpoint: session.checkpoint,
    lease: session.lease,
  });
}

function finish(
  previous: ReplaySessionResumePayload,
  context: MutationContext,
  patch: Partial<Pick<ReplaySessionResumePayload, 'checkpoint' | 'lease'>> & {
    lifecycleStatus?: 'active' | 'completed' | 'abandoned';
  },
): TransitionResult {
  const next: ReplaySessionResumePayload = Object.freeze({
    ...previous,
    checkpoint: patch.checkpoint ?? previous.checkpoint,
    lease: patch.lease === undefined ? previous.lease : patch.lease,
    session: Object.freeze({
      ...previous.session,
      lifecycleStatus: patch.lifecycleStatus ?? previous.session.lifecycleStatus,
      version: previous.session.version + 1,
      updatedAt: canonicalInstant(context.now, 'now'),
    }),
  });
  const nextReceipt = receipt(next);
  const record: IdempotencyRecord = Object.freeze({
    key: context.idempotencyKey,
    requestDigest: context.requestDigest,
    receipt: nextReceipt,
    recordedAt: canonicalInstant(context.now, 'now'),
  });
  return {
    ok: true,
    replayed: false,
    session: next,
    receipt: nextReceipt,
    idempotencyRecord: record,
  };
}

function authorize(
  session: ReplaySessionResumePayload,
  context: MutationContext,
): TransitionResult | null {
  const result = prepare(session, context);
  if (typeof result !== 'string') return result;
  return result ? failure(result) : null;
}

function activeLease(lease: ReplayLeaseDescriptor | null, now: string): boolean {
  return lease !== null && Date.parse(lease.expiresAt) > Date.parse(now);
}

function ownsLease(
  lease: ReplayLeaseDescriptor | null,
  clientId: string,
  tokenHash: string,
  now: string,
): boolean {
  return activeLease(lease, now) && lease?.clientId === clientId && lease.tokenHash === tokenHash;
}

export function claimLease(
  session: ReplaySessionResumePayload,
  context: MutationContext,
  lease: ReplayLeaseDescriptor,
): TransitionResult {
  const denied = authorize(session, context);
  if (denied) return denied;
  const parsedLease = replayLeaseDescriptorSchema.safeParse(lease);
  if (!parsedLease.success || Date.parse(parsedLease.data.expiresAt) <= Date.parse(context.now)) {
    return failure('INVALID_TRANSITION');
  }
  if (
    activeLease(session.lease, context.now) &&
    !ownsLease(session.lease, lease.clientId, lease.tokenHash, context.now)
  ) {
    return failure('LEASE_CONFLICT');
  }
  return finish(session, context, { lease: Object.freeze({ ...parsedLease.data }) });
}

export function renewLease(
  session: ReplaySessionResumePayload,
  context: MutationContext,
  lease: ReplayLeaseDescriptor,
): TransitionResult {
  const denied = authorize(session, context);
  if (denied) return denied;
  const parsedLease = replayLeaseDescriptorSchema.safeParse(lease);
  if (!parsedLease.success) return failure('INVALID_TRANSITION');
  if (!ownsLease(session.lease, parsedLease.data.clientId, parsedLease.data.tokenHash, context.now))
    return failure('LEASE_REQUIRED');
  if (Date.parse(parsedLease.data.expiresAt) <= Date.parse(context.now))
    return failure('INVALID_TRANSITION');
  return finish(session, context, { lease: Object.freeze({ ...parsedLease.data }) });
}

export function releaseLease(
  session: ReplaySessionResumePayload,
  context: MutationContext,
  clientId: string,
  tokenHash: string,
): TransitionResult {
  const denied = authorize(session, context);
  if (denied) return denied;
  if (!ownsLease(session.lease, clientId, tokenHash, context.now)) return failure('LEASE_REQUIRED');
  return finish(session, context, { lease: null });
}

function validCheckpoint(
  session: ReplaySessionResumePayload,
  checkpoint: ReplayCheckpoint,
): boolean {
  const finalCursor = session.session.candleCount - 1;
  return (
    checkpoint.state !== 'completed' &&
    checkpoint.cursorIndex >= 0 &&
    checkpoint.cursorIndex < finalCursor &&
    (checkpoint.state !== 'ready' || checkpoint.cursorIndex === 0)
  );
}

export function checkpointReplay(
  session: ReplaySessionResumePayload,
  context: MutationContext,
  checkpoint: ReplayCheckpoint,
  clientId: string,
  tokenHash: string,
): TransitionResult {
  const denied = authorize(session, context);
  if (denied) return denied;
  if (!ownsLease(session.lease, clientId, tokenHash, context.now)) return failure('LEASE_REQUIRED');
  const parsedCheckpoint = replayCheckpointSchema.safeParse(checkpoint);
  if (!parsedCheckpoint.success || !validCheckpoint(session, parsedCheckpoint.data))
    return failure('INVALID_TRANSITION');
  return finish(session, context, { checkpoint: Object.freeze({ ...parsedCheckpoint.data }) });
}

export function completeReplay(
  session: ReplaySessionResumePayload,
  context: MutationContext,
  checkpoint: ReplayCheckpoint,
  clientId: string,
  tokenHash: string,
): TransitionResult {
  const denied = authorize(session, context);
  if (denied) return denied;
  if (!ownsLease(session.lease, clientId, tokenHash, context.now)) return failure('LEASE_REQUIRED');
  const parsedCheckpoint = replayCheckpointSchema.safeParse(checkpoint);
  if (
    !parsedCheckpoint.success ||
    parsedCheckpoint.data.state !== 'completed' ||
    parsedCheckpoint.data.cursorIndex !== session.session.candleCount - 1
  ) {
    return failure('INVALID_TRANSITION');
  }
  return finish(session, context, {
    checkpoint: Object.freeze({ ...parsedCheckpoint.data }),
    lease: null,
    lifecycleStatus: 'completed',
  });
}

export function abandonReplay(
  session: ReplaySessionResumePayload,
  context: MutationContext,
): TransitionResult {
  const denied = authorize(session, context);
  if (denied) return denied;
  return finish(session, context, { lease: null, lifecycleStatus: 'abandoned' });
}
