import type {
  PersistedReplaySessionMetadata,
  ReplayLeaseDescriptor,
  ReplaySessionResumePayload,
} from './schemas';
import type { IdempotencyRecord } from './transitions';

export interface ReplaySessionRepository {
  create(payload: ReplaySessionResumePayload): Promise<ReplaySessionResumePayload>;
  findById(sessionId: string, userId: string): Promise<ReplaySessionResumePayload | null>;
  listByOwner(userId: string): Promise<readonly PersistedReplaySessionMetadata[]>;
  saveIfVersion(payload: ReplaySessionResumePayload, expectedVersion: number): Promise<boolean>;
}

export interface IdempotencyRepository {
  find(key: string, userId: string): Promise<IdempotencyRecord | null>;
  save(record: IdempotencyRecord, userId: string): Promise<IdempotencyRecord>;
}

export interface LeaseRepository {
  find(sessionId: string): Promise<ReplayLeaseDescriptor | null>;
}
