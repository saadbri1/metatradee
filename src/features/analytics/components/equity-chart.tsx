'use client';

import { useId } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { EquityPoint } from '../types';

const MAX_POINTS = 600; // downsample dense series for render performance
const W = 800;
const H = 240;

function downsample<T>(arr: T[], max: number): T[] {
  if (arr.length <= max) return arr;
  const step = Math.ceil(arr.length / max);
  const out: T[] = [];
  for (let i = 0; i < arr.length; i += step) out.push(arr[i]!);
  const last = arr[arr.length - 1];
  if (last && out[out.length - 1] !== last) out.push(last);
  return out;
}

/**
 * Equity curve (cumulative realized net P&L). Token-driven SVG (no hardcoded
 * colors), downsampled for large series. Accessible: role=img + summary label,
 * and a keyboard-reachable data-table alternative (per a11y spec). P&L is never
 * color-only — the value is spelled in the summary + table.
 */
export function EquityChart({ points }: { points: EquityPoint[] }) {
  const gradId = useId();

  if (points.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Equity curve</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="py-10 text-center text-sm text-muted-foreground">
            No closed trades in this range.
          </p>
        </CardContent>
      </Card>
    );
  }

  const sampled = downsample(points, MAX_POINTS);
  const equities = sampled.map((p) => p.equity);
  const min = Math.min(0, ...equities);
  const max = Math.max(0, ...equities);
  const range = max - min || 1;
  const x = (i: number) => (i / Math.max(1, sampled.length - 1)) * W;
  const y = (v: number) => H - ((v - min) / range) * H;

  const line = sampled.map((p, i) => `${x(i).toFixed(1)},${y(p.equity).toFixed(1)}`).join(' ');
  const area = `0,${H} ${line} ${W},${H}`;
  const last = points[points.length - 1]!;
  const summary = `Equity curve over ${points.length} trades. Final net P&L ${last.equity}. Lowest point ${min}.`;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Equity curve</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-56 w-full text-primary"
          role="img"
          aria-label={summary}
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id={gradId} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="currentColor" stopOpacity="0.25" />
              <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
            </linearGradient>
          </defs>
          {/* zero baseline */}
          <line
            x1="0"
            x2={W}
            y1={y(0)}
            y2={y(0)}
            className="text-border"
            stroke="currentColor"
            strokeDasharray="4 4"
          />
          <polygon points={area} fill={`url(#${gradId})`} />
          <polyline
            points={line}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
          />
        </svg>

        <details className="text-sm">
          <summary className="cursor-pointer text-muted-foreground">Show data table</summary>
          <div className="mt-2 max-h-64 overflow-auto">
            <table className="w-full text-left text-xs">
              <caption className="sr-only">{summary}</caption>
              <thead>
                <tr className="text-muted-foreground">
                  <th scope="col" className="py-1">
                    #
                  </th>
                  <th scope="col">Closed</th>
                  <th scope="col" className="text-right">
                    Equity
                  </th>
                  <th scope="col" className="text-right">
                    Drawdown
                  </th>
                </tr>
              </thead>
              <tbody>
                {downsample(points, 100).map((p) => (
                  <tr key={p.index} className="border-t border-border">
                    <td className="py-1">{p.index + 1}</td>
                    <td>{p.closed_at ? new Date(p.closed_at).toLocaleDateString() : '—'}</td>
                    <td className="tabular text-right">{p.equity}</td>
                    <td className="tabular text-right">{p.drawdown}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </CardContent>
    </Card>
  );
}
