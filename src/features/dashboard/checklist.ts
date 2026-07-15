/**
 * Setup checklist (Phase 10.0). Every item's `done` is derived from REAL
 * repository state (counts + profile), never hardcoded. Pure + tested.
 */
export interface ChecklistState {
  profileComplete: boolean;
  onboardingComplete: boolean;
  accountCount: number;
  strategyCount: number;
  tradeCount: number;
}

export interface ChecklistItem {
  id: string;
  label: string;
  done: boolean;
  /** Destination; null when that module isn't reachable yet (safe, no broken link). */
  href: string | null;
}

export function buildChecklist(state: ChecklistState): ChecklistItem[] {
  return [
    {
      id: 'profile',
      label: 'Complete your profile',
      done: state.profileComplete,
      href: '/settings/profile',
    },
    {
      id: 'onboarding',
      label: 'Finish onboarding',
      done: state.onboardingComplete,
      href: '/onboarding',
    },
    {
      id: 'account',
      label: 'Add a trading account',
      done: state.accountCount > 0,
      href: '/settings/trading',
    },
    {
      id: 'strategy',
      label: 'Add your first strategy',
      done: state.strategyCount > 0,
      href: '/playbook',
    },
    { id: 'import', label: 'Log or import trades', done: state.tradeCount > 0, href: '/journal' },
    {
      id: 'review',
      label: 'Review your dashboard',
      done: state.tradeCount > 0,
      href: '/dashboard',
    },
  ];
}

/** Progress as a 0–100 integer (for the progress indicator). */
export function checklistProgress(items: ChecklistItem[]): number {
  if (items.length === 0) return 0;
  return Math.round((items.filter((i) => i.done).length / items.length) * 100);
}
