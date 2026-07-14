'use client';

/**
 * TanStack Query hooks for the journal. The list uses `useInfiniteQuery` with
 * KEYSET cursors (pageParam = opaque cursor token). Mutations invalidate the
 * list so the UI stays consistent; optimistic flag toggles keep interactions
 * snappy with rollback on error.
 */
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchTradesPageAction,
  createTradeAction,
  updateTradeAction,
  duplicateTradeAction,
  softDeleteTradeAction,
  restoreTradeAction,
  archiveTradeAction,
  setTradeFlagAction,
  bulkDeleteTradesAction,
  bulkArchiveTradesAction,
  bulkRestoreTradesAction,
  type CreateTradeActionResult,
} from './server/actions';
import type { TradeFilters, TradeSort } from './filters';
import type { TradeCreateInput, TradeUpdateInput } from './schemas';
import type { ActionResult } from './types';

export const TRADE_QUERY_KEY = ['trades'] as const;

export function useTradesInfinite(filters: TradeFilters, sort: TradeSort) {
  return useInfiniteQuery({
    queryKey: [...TRADE_QUERY_KEY, filters, sort],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => fetchTradesPageAction({ filters, sort, cursor: pageParam }),
    getNextPageParam: (last) => last.nextCursor,
  });
}

function useInvalidateTrades() {
  const qc = useQueryClient();
  // Trades changing must also invalidate analytics (9.8), which reads trades.
  return () => {
    qc.invalidateQueries({ queryKey: TRADE_QUERY_KEY });
    qc.invalidateQueries({ queryKey: ['analytics'] });
  };
}

export function useCreateTrade() {
  const invalidate = useInvalidateTrades();
  return useMutation<CreateTradeActionResult, Error, { input: TradeCreateInput; force?: boolean }>({
    mutationFn: ({ input, force }) => createTradeAction(input, { force }),
    onSuccess: (res) => {
      if (res.ok) invalidate();
    },
  });
}

export function useUpdateTrade() {
  const invalidate = useInvalidateTrades();
  return useMutation<ActionResult, Error, { id: string; input: TradeUpdateInput }>({
    mutationFn: ({ id, input }) => updateTradeAction(id, input),
    onSuccess: (res) => {
      if (res.ok) invalidate();
    },
  });
}

export function useDuplicateTrade() {
  const invalidate = useInvalidateTrades();
  return useMutation<CreateTradeActionResult, Error, string>({
    mutationFn: (id) => duplicateTradeAction(id),
    onSuccess: (res) => {
      if (res.ok) invalidate();
    },
  });
}

export function useDeleteTrade() {
  const invalidate = useInvalidateTrades();
  return useMutation<ActionResult, Error, string>({
    mutationFn: (id) => softDeleteTradeAction(id),
    onSuccess: () => invalidate(),
  });
}

export function useRestoreTrade() {
  const invalidate = useInvalidateTrades();
  return useMutation<ActionResult, Error, string>({
    mutationFn: (id) => restoreTradeAction(id),
    onSuccess: () => invalidate(),
  });
}

export function useArchiveTrade() {
  const invalidate = useInvalidateTrades();
  return useMutation<ActionResult, Error, { id: string; archived: boolean }>({
    mutationFn: ({ id, archived }) => archiveTradeAction(id, archived),
    onSuccess: () => invalidate(),
  });
}

export function useSetTradeFlag() {
  const invalidate = useInvalidateTrades();
  return useMutation<
    ActionResult,
    Error,
    { id: string; flag: 'is_favorite' | 'is_pinned'; value: boolean }
  >({
    mutationFn: ({ id, flag, value }) => setTradeFlagAction(id, flag, value),
    onSuccess: () => invalidate(),
  });
}

export function useBulkTradeAction() {
  const invalidate = useInvalidateTrades();
  return useMutation<
    ActionResult<{ affected: number }>,
    Error,
    { op: 'delete' | 'archive' | 'restore'; ids: string[] }
  >({
    mutationFn: ({ op, ids }) => {
      const payload = { ids };
      if (op === 'delete') return bulkDeleteTradesAction(payload);
      if (op === 'archive') return bulkArchiveTradesAction(payload);
      return bulkRestoreTradesAction(payload);
    },
    onSuccess: () => invalidate(),
  });
}
