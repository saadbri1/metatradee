import { StatCard } from '@/features/analytics/components/stat-card';
import type { StreakStats } from '../types';

/** Streak KPI tiles (reuses the analytics StatCard grammar). */
export function StreakSummary({ streaks }: { streaks: StreakStats }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <StatCard label="Longest win streak" value={streaks.longestWinStreak} />
      <StatCard label="Longest loss streak" value={streaks.longestLossStreak} />
      <StatCard
        label="Current streak"
        value={
          streaks.currentStreakType === 'none'
            ? '—'
            : `${streaks.currentStreak} ${streaks.currentStreakType}`
        }
      />
      <StatCard
        label="Trading days"
        value={streaks.tradingDays}
        context={`${streaks.inactiveDays} inactive`}
      />
      <StatCard label="Winning days" value={streaks.winningDays} />
      <StatCard label="Losing days" value={streaks.losingDays} />
      <StatCard label="Consecutive days" value={streaks.longestConsecutiveTradingDays} />
      <StatCard label="Best consistency" value={streaks.longestConsistency} />
    </div>
  );
}
