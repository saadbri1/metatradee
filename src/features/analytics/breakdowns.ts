/**
 * Performance breakdowns — ONE calculation engine (computeKpis) over many
 * groupings. A dimension maps each trade to a key; every partition is scored by
 * the exact same KPI function, so no breakdown ever duplicates trade math.
 */
import { computeKpis } from './kpis';
import type { AnalyticsTrade, BreakdownDimension, BreakdownRow } from './types';

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function keyFor(trade: AnalyticsTrade, dim: BreakdownDimension): string | null {
  const t = trade.closed_at ? new Date(trade.closed_at) : null;
  const valid = t && !Number.isNaN(t.getTime()) ? t : null;
  switch (dim) {
    case 'broker':
      return trade.broker_id ?? '—';
    case 'account':
      return trade.trading_account_id ?? '—';
    case 'strategy':
      return trade.strategy_id ?? '—';
    case 'market':
      return trade.market ?? '—';
    case 'asset':
      return trade.asset_type ?? '—';
    case 'symbol':
      return trade.symbol;
    case 'session':
      return trade.session ?? '—';
    case 'direction':
      return trade.direction;
    case 'source':
      return trade.source;
    case 'dayOfWeek':
      return valid ? DOW[valid.getUTCDay()]! : null;
    case 'hourOfDay':
      return valid ? String(valid.getUTCHours()).padStart(2, '0') : null;
    case 'month':
      return valid ? valid.toISOString().slice(0, 7) : null;
    case 'quarter':
      return valid ? `${valid.getUTCFullYear()}-Q${Math.floor(valid.getUTCMonth() / 3) + 1}` : null;
    case 'year':
      return valid ? String(valid.getUTCFullYear()) : null;
    default:
      return null;
  }
}

/** Group trades by a dimension and score each group with the KPI engine. */
export function computeBreakdown(
  trades: AnalyticsTrade[],
  dim: BreakdownDimension,
): BreakdownRow[] {
  const groups = new Map<string, AnalyticsTrade[]>();
  for (const t of trades) {
    const key = keyFor(t, dim);
    if (key === null) continue;
    const arr = groups.get(key);
    if (arr) arr.push(t);
    else groups.set(key, [t]);
  }

  return [...groups.entries()]
    .map(([key, group]) => ({ key, label: key, kpis: computeKpis(group) }))
    .sort((a, b) => b.kpis.netProfit - a.kpis.netProfit);
}
