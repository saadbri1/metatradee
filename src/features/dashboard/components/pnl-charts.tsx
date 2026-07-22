'use client';

import type { DailyPnlPoint } from '../types';
import { cn } from '@/lib/utils';

function money(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

function chartGeometry(values: number[], width = 640, height = 250) {
  const pad = { left: 46, right: 18, top: 22, bottom: 34 };
  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values);
  const span = max - min || 1;
  const x = (index: number) =>
    pad.left + (index / Math.max(1, values.length - 1)) * (width - pad.left - pad.right);
  const y = (value: number) => pad.top + ((max - value) / span) * (height - pad.top - pad.bottom);
  return { width, height, pad, min, max, x, y, zeroY: y(0) };
}

export function CumulativePnlChart({
  points,
  heightClassName,
}: {
  points: DailyPnlPoint[];
  heightClassName?: string;
}) {
  if (points.length === 0) return <ChartEmpty heightClassName={heightClassName} />;
  const values = points.map((point) => point.cumulative);
  const g = chartGeometry(values);
  const line = points.map((point, index) => `${g.x(index)},${g.y(point.cumulative)}`).join(' ');
  const area = `${g.x(0)},${g.zeroY} ${line} ${g.x(points.length - 1)},${g.zeroY}`;
  const zeroStop = Math.max(0, Math.min(100, (g.zeroY / g.height) * 100));
  return (
    <div className={cn('h-[255px] w-full', heightClassName)}>
      <svg
        viewBox={`0 0 ${g.width} ${g.height}`}
        className="h-full w-full overflow-visible focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        role="img"
        tabIndex={0}
        aria-label={`Daily cumulative realized profit and loss. ${points
          .map((point) => `${point.dateKey}: ${money(point.cumulative)}`)
          .join('; ')}`}
      >
        <defs>
          <linearGradient id="cumulative-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--profit))" stopOpacity=".34" />
            <stop offset={`${zeroStop}%`} stopColor="hsl(var(--profit))" stopOpacity=".1" />
            <stop offset={`${zeroStop}%`} stopColor="hsl(var(--loss))" stopOpacity=".1" />
            <stop offset="100%" stopColor="hsl(var(--loss))" stopOpacity=".34" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((ratio) => (
          <line
            key={ratio}
            x1={g.pad.left}
            x2={g.width - g.pad.right}
            y1={g.pad.top + ratio * (g.height - g.pad.top - g.pad.bottom)}
            y2={g.pad.top + ratio * (g.height - g.pad.top - g.pad.bottom)}
            stroke="hsl(var(--border))"
            strokeDasharray="4 5"
          />
        ))}
        <line
          x1={g.pad.left}
          x2={g.width - g.pad.right}
          y1={g.zeroY}
          y2={g.zeroY}
          stroke="hsl(var(--muted-foreground))"
          strokeDasharray="3 4"
          opacity=".7"
        />
        <polygon points={area} fill="url(#cumulative-fill)" className="motion-chart-reveal" />
        <polyline
          points={line}
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth="2"
          strokeLinejoin="round"
          className="motion-chart-reveal"
        />
        {points.map((point, index) => (
          <circle
            key={point.dateKey}
            cx={g.x(index)}
            cy={g.y(point.cumulative)}
            r="7"
            fill="transparent"
            tabIndex={0}
            role="img"
            aria-label={`${point.dateKey}: ${money(point.cumulative)}`}
          >
            <title>
              {point.dateKey}: {money(point.cumulative)}
            </title>
          </circle>
        ))}
        <text
          x={g.pad.left - 8}
          y={g.pad.top + 5}
          textAnchor="end"
          className="fill-muted-foreground text-[11px]"
        >
          {money(g.max)}
        </text>
        <text
          x={g.pad.left - 8}
          y={g.zeroY + 4}
          textAnchor="end"
          className="fill-muted-foreground text-[11px]"
        >
          $0
        </text>
        <text
          x={g.pad.left - 8}
          y={g.height - g.pad.bottom}
          textAnchor="end"
          className="fill-muted-foreground text-[11px]"
        >
          {money(g.min)}
        </text>
        <text x={g.pad.left} y={g.height - 8} className="fill-muted-foreground text-[11px]">
          {points[0]?.dateKey}
        </text>
        <text
          x={g.width - g.pad.right}
          y={g.height - 8}
          textAnchor="end"
          className="fill-muted-foreground text-[11px]"
        >
          {points.at(-1)?.dateKey}
        </text>
      </svg>
    </div>
  );
}

export function DailyPnlBarChart({
  points,
  heightClassName,
}: {
  points: DailyPnlPoint[];
  heightClassName?: string;
}) {
  if (points.length === 0) return <ChartEmpty heightClassName={heightClassName} />;
  const values = points.map((point) => point.netPnl);
  const g = chartGeometry(values);
  const plotWidth = g.width - g.pad.left - g.pad.right;
  const step = plotWidth / points.length;
  const barWidth = Math.max(4, Math.min(18, step * 0.62));
  return (
    <div className={cn('h-[255px] w-full', heightClassName)}>
      <svg
        viewBox={`0 0 ${g.width} ${g.height}`}
        className="h-full w-full overflow-visible focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        role="img"
        tabIndex={0}
        aria-label={`Realized net profit and loss by trading day. ${points
          .map((point) => `${point.dateKey}: ${money(point.netPnl)}, ${point.tradeCount} trades`)
          .join('; ')}`}
      >
        {[0.25, 0.5, 0.75].map((ratio) => (
          <line
            key={ratio}
            x1={g.pad.left}
            x2={g.width - g.pad.right}
            y1={g.pad.top + ratio * (g.height - g.pad.top - g.pad.bottom)}
            y2={g.pad.top + ratio * (g.height - g.pad.top - g.pad.bottom)}
            stroke="hsl(var(--border))"
            strokeDasharray="4 5"
          />
        ))}
        <line
          x1={g.pad.left}
          x2={g.width - g.pad.right}
          y1={g.zeroY}
          y2={g.zeroY}
          stroke="hsl(var(--muted-foreground))"
          opacity=".7"
        />
        {points.map((point, index) => {
          const y = g.y(point.netPnl);
          const top = Math.min(y, g.zeroY);
          const height = Math.max(2, Math.abs(g.zeroY - y));
          return (
            <rect
              key={point.dateKey}
              x={g.pad.left + index * step + (step - barWidth) / 2}
              y={top}
              width={barWidth}
              height={height}
              rx="2"
              fill={point.netPnl >= 0 ? 'hsl(var(--profit))' : 'hsl(var(--loss))'}
              className="motion-chart-reveal"
              tabIndex={0}
              role="img"
              aria-label={`${point.dateKey}: ${money(point.netPnl)}, ${point.tradeCount} trades`}
            >
              <title>
                {point.dateKey}: {money(point.netPnl)} · {point.tradeCount} trades
              </title>
            </rect>
          );
        })}
        <text
          x={g.pad.left - 8}
          y={g.pad.top + 5}
          textAnchor="end"
          className="fill-muted-foreground text-[11px]"
        >
          {money(g.max)}
        </text>
        <text
          x={g.pad.left - 8}
          y={g.zeroY + 4}
          textAnchor="end"
          className="fill-muted-foreground text-[11px]"
        >
          $0
        </text>
        <text
          x={g.pad.left - 8}
          y={g.height - g.pad.bottom}
          textAnchor="end"
          className="fill-muted-foreground text-[11px]"
        >
          {money(g.min)}
        </text>
        <text x={g.pad.left} y={g.height - 8} className="fill-muted-foreground text-[11px]">
          {points[0]?.dateKey}
        </text>
        <text
          x={g.width - g.pad.right}
          y={g.height - 8}
          textAnchor="end"
          className="fill-muted-foreground text-[11px]"
        >
          {points.at(-1)?.dateKey}
        </text>
      </svg>
    </div>
  );
}

function ChartEmpty({ heightClassName }: { heightClassName?: string }) {
  return (
    <div
      className={cn(
        'relative h-[255px] w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        heightClassName,
      )}
      role="img"
      tabIndex={0}
      aria-label="No closed trades match these filters"
    >
      <svg viewBox="0 0 640 250" className="h-full w-full" aria-hidden>
        {[54, 104, 154, 204].map((y) => (
          <line
            key={y}
            x1="46"
            x2="622"
            y1={y}
            y2={y}
            stroke="hsl(var(--border))"
            strokeDasharray="4 5"
          />
        ))}
        <line
          x1="46"
          x2="622"
          y1="129"
          y2="129"
          stroke="hsl(var(--muted-foreground))"
          strokeDasharray="3 4"
          opacity=".55"
        />
        <text x="38" y="58" textAnchor="end" className="fill-muted-foreground text-[11px]">
          —
        </text>
        <text x="38" y="133" textAnchor="end" className="fill-muted-foreground text-[11px]">
          $0
        </text>
        <text x="46" y="240" className="fill-muted-foreground text-[10px]">
          No trading days
        </text>
      </svg>
      <p className="absolute inset-x-12 top-1/2 -translate-y-1/2 text-center text-xs text-muted-foreground">
        No closed trades match these filters
      </p>
    </div>
  );
}
