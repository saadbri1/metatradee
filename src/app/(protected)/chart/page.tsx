import type { Metadata } from 'next';
import { ChartWorkspace } from '@/features/chart/components/chart-workspace';

export const metadata: Metadata = { title: 'Chart' };

/**
 * Chart workspace route. Thin by convention: it arranges only, and does not
 * style or fetch (docs/PROJECT_STRUCTURE.md rule 3).
 *
 * NO SERIES IS RESOLVED HERE. Candles come from the authenticated
 * `GET /api/market-data/candles` route on user request, so the provider key
 * stays server-side and nothing is fetched — or billed — until asked for.
 * Development fixtures are deliberately NOT imported: this path renders real
 * provider data or an explicit failure state, never synthetic prices.
 */
export default function ChartPage() {
  return <ChartWorkspace />;
}
