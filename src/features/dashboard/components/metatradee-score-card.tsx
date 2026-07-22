'use client';

import type { DashboardScore } from '../types';

const AXES = [
  { key: 'winRate', label: 'Win rate' },
  { key: 'profitFactor', label: 'Profit factor' },
  { key: 'payoff', label: 'Payoff' },
  { key: 'consistency', label: 'Consistency' },
] as const;

const CENTER_X = 130;
const CENTER_Y = 92;
const RADIUS_X = 84;
const RADIUS_Y = 66;

/** Axis vertex at a 0–1 distance from the centre: top, right, bottom, left. */
function vertex(index: number, fraction: number): [number, number] {
  const clamped = Math.max(0, Math.min(1, fraction));
  if (index === 0) return [CENTER_X, CENTER_Y - RADIUS_Y * clamped];
  if (index === 1) return [CENTER_X + RADIUS_X * clamped, CENTER_Y];
  if (index === 2) return [CENTER_X, CENTER_Y + RADIUS_Y * clamped];
  return [CENTER_X - RADIUS_X * clamped, CENTER_Y];
}

function polygon(fractions: number[]): string {
  return fractions.map((fraction, index) => vertex(index, fraction).join(',')).join(' ');
}

const LABEL_POSITIONS: Array<{ x: number; y: number; anchor: 'middle' | 'start' | 'end' }> = [
  { x: CENTER_X, y: 16, anchor: 'middle' },
  { x: CENTER_X + RADIUS_X + 6, y: 96, anchor: 'start' },
  { x: CENTER_X, y: 176, anchor: 'middle' },
  { x: CENTER_X - RADIUS_X - 6, y: 96, anchor: 'end' },
];

/**
 * The MetaTradee Score radar. Each axis is a real scored component; the score
 * itself stays unavailable until enough closed trades exist, and no
 * placeholder value is ever shown in its place.
 */
export function MetaTradeeScoreCard({ score }: { score: DashboardScore }) {
  const fractions = AXES.map(({ key }) => {
    const component = score.components[key];
    return component === null ? 0 : component / 100;
  });
  const hasEveryComponent = AXES.every(({ key }) => score.components[key] !== null);

  return (
    <div className="flex h-full flex-col items-center justify-center px-3 py-2">
      <svg
        viewBox="0 0 260 192"
        className="h-[196px] w-full max-w-[300px]"
        role="img"
        aria-label={
          score.value === null
            ? `MetaTradee Score unavailable. It unlocks with ${score.minimumTrades} closed trades.`
            : `MetaTradee Score ${score.value} out of 100, from ${AXES.map(({ key, label }) => `${label} ${score.components[key] === null ? 'unavailable' : Math.round(score.components[key]!)}`).join(', ')}.`
        }
      >
        {/* Reference rings */}
        {[1, 0.66, 0.33].map((scale) => (
          <polygon
            key={scale}
            points={polygon([scale, scale, scale, scale])}
            fill={scale === 1 ? 'hsl(var(--primary) / .04)' : 'none'}
            stroke="hsl(var(--border))"
            strokeWidth="1"
          />
        ))}
        <line
          x1={CENTER_X}
          y1={CENTER_Y - RADIUS_Y}
          x2={CENTER_X}
          y2={CENTER_Y + RADIUS_Y}
          stroke="hsl(var(--border))"
        />
        <line
          x1={CENTER_X - RADIUS_X}
          y1={CENTER_Y}
          x2={CENTER_X + RADIUS_X}
          y2={CENTER_Y}
          stroke="hsl(var(--border))"
        />

        {hasEveryComponent ? (
          <polygon
            points={polygon(fractions)}
            fill="hsl(var(--primary) / .22)"
            stroke="hsl(var(--primary))"
            strokeWidth="1.5"
          />
        ) : null}
        {hasEveryComponent
          ? fractions.map((fraction, index) => {
              const [x, y] = vertex(index, fraction);
              return <circle key={index} cx={x} cy={y} r="3" fill="hsl(var(--primary))" />;
            })
          : null}

        {AXES.map(({ label }, index) => (
          <text
            key={label}
            x={LABEL_POSITIONS[index]!.x}
            y={LABEL_POSITIONS[index]!.y}
            textAnchor={LABEL_POSITIONS[index]!.anchor}
            className="fill-muted-foreground text-[10px]"
          >
            {label}
          </text>
        ))}
      </svg>

      {score.value === null ? (
        <div className="mt-1 text-center">
          <p className="text-xs font-medium text-foreground">
            Score unlocks with {score.minimumTrades} closed trades
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">No placeholder score is shown.</p>
        </div>
      ) : (
        <p className="mt-1 text-sm text-muted-foreground">
          Your MetaTradee Score:{' '}
          <span className="text-lg font-semibold tabular-nums text-primary">{score.value}</span>
        </p>
      )}
    </div>
  );
}
