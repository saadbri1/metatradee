'use client';

/**
 * TanStack Query hooks for the journal. The list uses `useInfiniteQuery` with
 * KEYSET cursors (pageParam = opaque cursor token). Mutations invalidate the
 * list so the UI stays consistent; optimistic flag toggles keep interactions
 * snappy with rollback on error.
 */
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchTradesPageAction,
  fetchTradeSummaryAction,
  createTradeAction,
  updateTradeAction,
  duplicateTradeAction,
  softDeleteTradeAction,
  restoreTradeAction,
  archiveTradeAction,
  setTradeFlagAction,
  setTradeReviewedAction,
  bulkDeleteTradesAction,
  bulkArchiveTradesAction,
  bulkRestoreTradesAction,
  bulkSetReviewedAction,
  type CreateTradeActionResult,
} from './server/actions';
import type { TradeFilters, TradeSort } from './filters';
import type { TradeCreateInput, TradeUpdateInput } from './schemas';
import type { ActionResult, TradePage } from './types';

export const TRADE_QUERY_KEY = ['trades'] as const;
export const TRADE_SUMMARY_KEY = ['trade-summary'] as const;

export function useTradesInfinite(filters: TradeFilters, sort: TradeSort, pageSize = 50) {
  return useInfiniteQuery({
    queryKey: [...TRADE_QUERY_KEY, filters, sort, pageSize],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) =>
      fetchTradesPageAction({ filters, sort, cursor: pageParam, limit: pageSize }),
    getNextPageParam: (last) => last.nextCursor,
  });
}

/** Filtered KPI summary for the Journal header row (server-computed). */
export function useJournalSummary(filters: TradeFilters) {
  return useQuery({
    queryKey: [...TRADE_SUMMARY_KEY, filters],
    queryFn: () => fetchTradeSummaryAction({ filters }),
    staleTime: 30_000,
  });
}

/**
 * Toggle a trade's reviewed state with an optimistic cache update. Any failure
 * (including the column not yet existing) rolls the row back and the caller
 * surfaces the error — never a silent no-op.
 */
export function useSetReviewed(filters: TradeFilters, sort: TradeSort, pageSize = 50) {
  const qc = useQueryClient();
  const key = [...TRADE_QUERY_KEY, filters, sort, pageSize];
  return useMutation<ActionResult, Error, { id: string; value: boolean }>({
    // Throw on a failed result so onError rolls the optimistic row back and the
    // caller sees the real message — a failed write is never a silent success.
    mutationFn: async ({ id, value }) => {
      const res = await setTradeReviewedAction(id, value);
      if (!res.ok) throw new Error(res.error);
      return res;
    },
    onMutate: async ({ id, value }) => {
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData(key);
      qc.setQueryData(key, (data: { pages: TradePage[]; pageParams: unknown[] } | undefined) => {
        if (!data) return data;
        return {
          ...data,
          pages: data.pages.map((page) => ({
            ...page,
            items: page.items.map((t) => (t.id === id ? { ...t, reviewed: value } : t)),
          })),
        };
      });
      return { previous };
    },
    onError: (_e, _v, context) => {
      const ctx = context as { previous?: unknown } | undefined;
      if (ctx?.previous !== undefined) qc.setQueryData(key, ctx.previous);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: TRADE_QUERY_KEY });
      qc.invalidateQueries({ queryKey: TRADE_SUMMARY_KEY });
    },
  });
}

export function useBulkReviewed() {
  const qc = useQueryClient();
  return useMutation<
    ActionResult<{ affected: number }>,
    Error,
    { ids: string[]; reviewed: boolean }
  >({
    mutationFn: ({ ids, reviewed }) => bulkSetReviewedAction({ ids }, reviewed),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: TRADE_QUERY_KEY });
      qc.invalidateQueries({ queryKey: TRADE_SUMMARY_KEY });
    },
  });
}

function useInvalidateTrades() {
  const qc = useQueryClient();
  // Trades changing must also invalidate analytics (9.8), which reads trades.
  return () => {
    qc.invalidateQueries({ queryKey: TRADE_QUERY_KEY });
    qc.invalidateQueries({ queryKey: TRADE_SUMMARY_KEY });
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
