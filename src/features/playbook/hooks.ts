'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createStrategyAction,
  updateStrategyAction,
  changeStrategyStatusAction,
  setStrategyPinnedAction,
  deleteStrategyAction,
  duplicateStrategyAction,
  assignTradeToStrategyAction,
  restoreStrategyVersionAction,
  getStrategyPerformanceAction,
  getPlaybookWorkspaceAction,
} from './server/actions';
import type { StrategyCreateInput, StrategyUpdateInput } from './schemas';
import type { ActionResult, StrategyStatus } from './types';
import type { PlaybookWorkspaceData } from './server/queries';

/** Cached strategy performance; shares 'analytics' key so trade changes invalidate it. */
export function useStrategyPerformance(strategyId: string) {
  return useQuery({
    queryKey: ['analytics', 'strategy-performance', strategyId],
    queryFn: () => getStrategyPerformanceAction(strategyId),
    staleTime: 60_000,
  });
}

/**
 * The whole Playbook list with real per-playbook metrics.
 *
 * `initialData` is the server-rendered payload, so the first paint is already
 * populated (no spinner on navigation) while mutations still refetch through
 * the same key.
 */
export function usePlaybookWorkspace(initialData?: PlaybookWorkspaceData) {
  return useQuery({
    queryKey: ['strategies', 'workspace'],
    queryFn: () => getPlaybookWorkspaceAction(),
    staleTime: 30_000,
    ...(initialData ? { initialData } : {}),
  });
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ['strategies'] });
    qc.invalidateQueries({ queryKey: ['analytics'] });
    qc.invalidateQueries({ queryKey: ['trades'] });
  };
}

/**
 * Mutations surface failure by THROWING, so react-query treats a server
 * `{ok:false}` as an error: optimistic state rolls back and the UI can show the
 * real reason instead of a success toast over a failed write.
 */
function unwrap<T>(result: ActionResult<T>): ActionResult<T> {
  if (!result.ok) throw new Error(result.error ?? 'Something went wrong. Please try again.');
  return result;
}

export function useCreateStrategy() {
  const invalidate = useInvalidate();
  return useMutation<ActionResult<{ id: string }>, Error, StrategyCreateInput>({
    mutationFn: (input) => createStrategyAction(input),
    onSuccess: (r) => r.ok && invalidate(),
  });
}

export function useUpdateStrategy() {
  const invalidate = useInvalidate();
  return useMutation<ActionResult, Error, { id: string; input: StrategyUpdateInput }>({
    mutationFn: ({ id, input }) => updateStrategyAction(id, input),
    onSuccess: (r) => r.ok && invalidate(),
  });
}

export function useStrategyStatus() {
  const invalidate = useInvalidate();
  return useMutation<ActionResult, Error, { id: string; status: StrategyStatus }>({
    mutationFn: ({ id, status }) => changeStrategyStatusAction(id, status).then(unwrap),
    onSuccess: invalidate,
  });
}

export function useDuplicateStrategy() {
  const invalidate = useInvalidate();
  return useMutation<ActionResult<{ id: string }>, Error, string>({
    mutationFn: (id) => duplicateStrategyAction(id).then(unwrap),
    onSuccess: invalidate,
  });
}

/** Link/unlink one real trade to a playbook; both sides are ownership-checked. */
export function useAssignTradeToPlaybook() {
  const invalidate = useInvalidate();
  return useMutation<ActionResult, Error, { tradeId: string; strategyId: string | null }>({
    mutationFn: ({ tradeId, strategyId }) =>
      assignTradeToStrategyAction(tradeId, strategyId).then(unwrap),
    onSuccess: invalidate,
  });
}

export function usePinStrategy() {
  const invalidate = useInvalidate();
  return useMutation<ActionResult, Error, { id: string; pinned: boolean }>({
    mutationFn: ({ id, pinned }) => setStrategyPinnedAction(id, pinned),
    onSuccess: () => invalidate(),
  });
}

export function useDeleteStrategy() {
  const invalidate = useInvalidate();
  return useMutation<ActionResult, Error, string>({
    mutationFn: (id) => deleteStrategyAction(id).then(unwrap),
    onSuccess: invalidate,
  });
}

export function useRestoreVersion() {
  const invalidate = useInvalidate();
  return useMutation<ActionResult, Error, { id: string; version: number }>({
    mutationFn: ({ id, version }) => restoreStrategyVersionAction(id, version),
    onSuccess: () => invalidate(),
  });
}
