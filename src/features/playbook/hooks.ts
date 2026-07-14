'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createStrategyAction,
  updateStrategyAction,
  changeStrategyStatusAction,
  setStrategyPinnedAction,
  deleteStrategyAction,
  restoreStrategyVersionAction,
  getStrategyPerformanceAction,
} from './server/actions';
import type { StrategyCreateInput, StrategyUpdateInput } from './schemas';
import type { ActionResult, StrategyStatus } from './types';

/** Cached strategy performance; shares 'analytics' key so trade changes invalidate it. */
export function useStrategyPerformance(strategyId: string) {
  return useQuery({
    queryKey: ['analytics', 'strategy-performance', strategyId],
    queryFn: () => getStrategyPerformanceAction(strategyId),
    staleTime: 60_000,
  });
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ['strategies'] });
    qc.invalidateQueries({ queryKey: ['analytics'] });
  };
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
    mutationFn: ({ id, status }) => changeStrategyStatusAction(id, status),
    onSuccess: (r) => r.ok && invalidate(),
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
    mutationFn: (id) => deleteStrategyAction(id),
    onSuccess: () => invalidate(),
  });
}

export function useRestoreVersion() {
  const invalidate = useInvalidate();
  return useMutation<ActionResult, Error, { id: string; version: number }>({
    mutationFn: ({ id, version }) => restoreStrategyVersionAction(id, version),
    onSuccess: () => invalidate(),
  });
}
