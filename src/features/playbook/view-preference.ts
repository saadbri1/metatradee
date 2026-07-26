/**
 * Remembered List/Grid choice for the Playbook workspace.
 *
 * The URL is the source of truth while the user is on the page (shareable,
 * back/forward safe). This preference only seeds the FIRST render when the URL
 * says nothing, so returning to /playbook from another route restores the view
 * the user last chose. Same local-preference pattern as the chart session.
 *
 * Storage is best-effort: private browsing and disabled storage must not break
 * the page, so every access is guarded and falls back to the default.
 */
import type { PlaybookView } from './filters';

export const PLAYBOOK_VIEW_STORAGE_KEY = 'metatradee-playbook-view';
export const DEFAULT_PLAYBOOK_VIEW: PlaybookView = 'list';

function isPlaybookView(value: unknown): value is PlaybookView {
  return value === 'list' || value === 'grid';
}

export function readViewPreference(storage?: Pick<Storage, 'getItem'>): PlaybookView {
  const store = storage ?? safeStorage();
  if (!store) return DEFAULT_PLAYBOOK_VIEW;
  try {
    const raw = store.getItem(PLAYBOOK_VIEW_STORAGE_KEY);
    return isPlaybookView(raw) ? raw : DEFAULT_PLAYBOOK_VIEW;
  } catch {
    return DEFAULT_PLAYBOOK_VIEW;
  }
}

export function saveViewPreference(view: PlaybookView, storage?: Pick<Storage, 'setItem'>): void {
  const store = storage ?? safeStorage();
  if (!store) return;
  try {
    store.setItem(PLAYBOOK_VIEW_STORAGE_KEY, view);
  } catch {
    // Storage unavailable (private mode, quota). The view still works for the
    // current session via URL state; only the memory across routes is lost.
  }
}

function safeStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}
