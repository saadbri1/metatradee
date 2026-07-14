/**
 * Wellbeing-first distress detection (07_UX_RULES). When patterns suggest
 * distress — escalating losses, rapid revenge-logging, sustained high stress —
 * we DE-ESCALATE with a calm, supportive message and (in the UI) offer a pause,
 * rather than gamifying the behavior. Copy is never shaming. Pure + tested.
 */
export type DistressSignal = 'escalating_losses' | 'rapid_logging' | 'high_stress';

export interface WellbeingSignal {
  distressed: boolean;
  signal?: DistressSignal;
  message: string;
}

const CALM = 'You’re showing up and logging consistently — that’s the work. Keep it steady.';

/** ≥3 consecutive losses with growing magnitude. */
function escalatingLosses(recentNets: number[]): boolean {
  const losses = recentNets.filter((n) => n < 0);
  if (losses.length < 3) return false;
  const last3 = losses.slice(-3).map((n) => Math.abs(n));
  return last3[0]! < last3[1]! && last3[1]! < last3[2]!;
}

/** ≥3 entries within 15 minutes (revenge-logging pattern). */
function rapidLogging(times: string[]): boolean {
  const ts = times
    .map((t) => Date.parse(t))
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => a - b);
  if (ts.length < 3) return false;
  for (let i = 2; i < ts.length; i++) {
    if (ts[i]! - ts[i - 2]! <= 15 * 60 * 1000) return true;
  }
  return false;
}

export function detectDistress(input: {
  recentNets?: number[];
  recentEntryTimes?: string[];
  recentStress?: number[];
}): WellbeingSignal {
  if (escalatingLosses(input.recentNets ?? [])) {
    return {
      distressed: true,
      signal: 'escalating_losses',
      message:
        'A few tougher trades in a row. It’s okay to step away — consider taking a break before the next one.',
    };
  }
  if (rapidLogging(input.recentEntryTimes ?? [])) {
    return {
      distressed: true,
      signal: 'rapid_logging',
      message:
        'You’re logging very quickly. Take a breath — there’s no rush. A short pause often helps.',
    };
  }
  const stress = input.recentStress ?? [];
  if (stress.length > 0 && stress.reduce((a, b) => a + b, 0) / stress.length >= 75) {
    return {
      distressed: true,
      signal: 'high_stress',
      message: 'Stress has been running high. Be kind to yourself — rest counts too.',
    };
  }
  return { distressed: false, message: CALM };
}
