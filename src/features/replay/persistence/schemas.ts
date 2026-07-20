import { z } from 'zod';
import { REPLAY_SPEEDS } from '../engine';
import { SOURCE_SCHEMAS } from '@/features/market-data/cache/types';
import { TIMEFRAMES } from '@/features/market-data/databento/aggregate';
import { TIMEFRAME_SOURCE } from '@/features/market-data/databento/aggregate';

const canonicalString = z
  .string()
  .min(1)
  .refine((value) => value.trim() === value, 'Must be canonical.');
const instant = z.string().datetime({ offset: true });
const digest = z.string().regex(/^[a-f0-9]{64}$/);
const positiveVersion = z.number().int().safe().positive();

export const replayCheckpointSchema = z
  .object({
    cursorIndex: z.number().int().nonnegative(),
    cursorTime: z.number().int().positive(),
    speed: z.enum(REPLAY_SPEEDS),
    state: z.enum(['ready', 'paused', 'completed']),
    checkpointedAt: instant,
  })
  .strict();

export const replayLeaseDescriptorSchema = z
  .object({
    clientId: canonicalString,
    tokenHash: digest,
    expiresAt: instant,
  })
  .strict();

export const replaySessionSourcePinsSchema = z
  .object({
    revisionIds: z
      .array(canonicalString)
      .min(1)
      .superRefine((values, context) => {
        if (new Set(values).size !== values.length)
          context.addIssue({ code: 'custom', message: 'Revision IDs must be unique.' });
      }),
  })
  .strict();

const persistedReplaySessionMetadataBaseSchema = z
  .object({
    sessionId: z.string().uuid(),
    userId: z.string().uuid(),
    provider: canonicalString,
    dataset: canonicalString,
    symbol: canonicalString,
    timeframe: z.enum(TIMEFRAMES),
    sourceSchema: z.enum(SOURCE_SCHEMAS),
    rangeStart: instant,
    rangeEnd: instant,
    replayEngineVersion: positiveVersion,
    normalizationVersion: positiveVersion,
    candleDigest: digest,
    candleCount: z.number().int().min(2),
    lifecycleStatus: z.enum(['active', 'completed', 'abandoned']),
    version: z.number().int().safe().nonnegative(),
    retentionExpiresAt: instant,
    createdAt: instant,
    updatedAt: instant,
  })
  .strict();

export const persistedReplaySessionMetadataSchema =
  persistedReplaySessionMetadataBaseSchema.superRefine((value, context) => {
    if (Date.parse(value.rangeStart) >= Date.parse(value.rangeEnd)) {
      context.addIssue({ code: 'custom', path: ['rangeEnd'], message: 'Range must be non-empty.' });
    }
    if (Date.parse(value.createdAt) > Date.parse(value.updatedAt)) {
      context.addIssue({
        code: 'custom',
        path: ['updatedAt'],
        message: 'updatedAt precedes createdAt.',
      });
    }
    if (TIMEFRAME_SOURCE[value.timeframe].schema !== value.sourceSchema) {
      context.addIssue({
        code: 'custom',
        path: ['sourceSchema'],
        message: 'Source schema does not match timeframe.',
      });
    }
    if (Date.parse(value.retentionExpiresAt) <= Date.parse(value.createdAt)) {
      context.addIssue({
        code: 'custom',
        path: ['retentionExpiresAt'],
        message: 'Retention must follow creation.',
      });
    }
  });

export const replaySessionCreateRequestSchema = persistedReplaySessionMetadataBaseSchema
  .omit({ sessionId: true, lifecycleStatus: true, version: true, createdAt: true, updatedAt: true })
  .extend({
    checkpoint: replayCheckpointSchema,
    sourcePins: replaySessionSourcePinsSchema,
  })
  .strict()
  .superRefine((value, context) => {
    if (Date.parse(value.rangeStart) >= Date.parse(value.rangeEnd)) {
      context.addIssue({ code: 'custom', path: ['rangeEnd'], message: 'Range must be non-empty.' });
    }
    if (TIMEFRAME_SOURCE[value.timeframe].schema !== value.sourceSchema) {
      context.addIssue({
        code: 'custom',
        path: ['sourceSchema'],
        message: 'Source schema does not match timeframe.',
      });
    }
    if (value.checkpoint.state !== 'ready' || value.checkpoint.cursorIndex !== 0) {
      context.addIssue({
        code: 'custom',
        path: ['checkpoint'],
        message: 'A new replay session must begin ready at cursor zero.',
      });
    }
  });

export const replaySessionResumePayloadSchema = z
  .object({
    session: persistedReplaySessionMetadataSchema,
    checkpoint: replayCheckpointSchema,
    lease: replayLeaseDescriptorSchema.nullable(),
    sourcePins: replaySessionSourcePinsSchema,
  })
  .strict();

export type ReplayCheckpoint = z.infer<typeof replayCheckpointSchema>;
export type ReplayLeaseDescriptor = z.infer<typeof replayLeaseDescriptorSchema>;
export type ReplaySessionSourcePins = z.infer<typeof replaySessionSourcePinsSchema>;
export type PersistedReplaySessionMetadata = z.infer<typeof persistedReplaySessionMetadataSchema>;
export type ReplaySessionCreateRequest = z.infer<typeof replaySessionCreateRequestSchema>;
export type ReplaySessionResumePayload = z.infer<typeof replaySessionResumePayloadSchema>;
