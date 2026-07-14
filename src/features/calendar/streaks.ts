/**
 * Streak analytics over TRADING days (days with ≥1 trade), sorted ascending.
 * Definitions (documented; adjust to FRS):
 *   win/loss streak      = consecutive winning/losing trading days (gaps ignored)
 *   consecutiveTrading   = consecutive CALENDAR-adjacent trading days
 *   longestConsistency   = consecutive calendar-adjacent WINNING days
 *   inactiveDays         = calendar days in span with no trades
 * Edge cases (empty / single / all-win / all-loss / gaps) return coherent zeros.
 */
import { dayDiff } from './time';
import type { CalendarDay, StreakStats } from './types';

export function computeStreaks(days: CalendarDay[]): StreakStats {
  const sorted = [...days].sort((a, b) => (a.dateKey < b.dateKey ? -1 : 1));

  const winningDays = sorted.filter((d) => d.classification === 'win').length;
  const losingDays = sorted.filter((d) => d.classification === 'loss').length;
  const breakEvenDays = sorted.filter((d) => d.classification === 'break_even').length;

  let longestWin = 0;
  let longestLoss = 0;
  let curWin = 0;
  let curLoss = 0;
  let longestAdjTrading = sorted.length > 0 ? 1 : 0;
  let curAdjTrading = sorted.length > 0 ? 1 : 0;
  let longestConsistency = 0;
  let curConsistency = 0;

  sorted.forEach((d, i) => {
    // classification streaks (gaps ignored)
    if (d.classification === 'win') {
      curWin += 1;
      curLoss = 0;
    } else if (d.classification === 'loss') {
      curLoss += 1;
      curWin = 0;
    } else {
      curWin = 0;
      curLoss = 0;
    }
    longestWin = Math.max(longestWin, curWin);
    longestLoss = Math.max(longestLoss, curLoss);

    // calendar-adjacency streaks
    const prev = sorted[i - 1];
    const adjacent = prev ? dayDiff(prev.dateKey, d.dateKey) === 1 : false;
    if (i > 0) curAdjTrading = adjacent ? curAdjTrading + 1 : 1;
    longestAdjTrading = Math.max(longestAdjTrading, curAdjTrading);

    if (
      d.classification === 'win' &&
      (i === 0 || (adjacent && sorted[i - 1]!.classification === 'win'))
    ) {
      curConsistency = i === 0 ? 1 : adjacent ? curConsistency + 1 : 1;
    } else if (d.classification === 'win') {
      curConsistency = 1;
    } else {
      curConsistency = 0;
    }
    longestConsistency = Math.max(longestConsistency, curConsistency);
  });

  const last = sorted[sorted.length - 1];
  let currentStreak = 0;
  let currentStreakType: 'win' | 'loss' | 'none' = 'none';
  if (last && last.classification === 'win') currentStreakType = 'win';
  else if (last && last.classification === 'loss') currentStreakType = 'loss';
  if (currentStreakType !== 'none') {
    for (let i = sorted.length - 1; i >= 0; i--) {
      if (sorted[i]!.classification === (currentStreakType === 'win' ? 'win' : 'loss'))
        currentStreak += 1;
      else break;
    }
  }

  const inactiveDays =
    sorted.length > 0
      ? Math.max(0, dayDiff(sorted[0]!.dateKey, last!.dateKey) + 1 - sorted.length)
      : 0;

  return {
    winningDays,
    losingDays,
    breakEvenDays,
    tradingDays: sorted.length,
    inactiveDays,
    longestWinStreak: longestWin,
    longestLossStreak: longestLoss,
    currentStreak,
    currentStreakType,
    longestConsecutiveTradingDays: longestAdjTrading,
    longestConsistency,
  };
}
