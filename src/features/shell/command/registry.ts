/**
 * Command palette registry (pure). Typed categories so future phases plug in
 * WITHOUT modifying the palette:
 *   - navigate: functional now (jumps to real routes)
 *   - search:   typed extension point — no backend this phase
 *   - action:   typed extension point — no quick-actions this phase
 *
 * A future phase registers a `CommandSource` for 'search' or 'action'; the
 * palette renders whatever sources return. Nothing here fabricates feature logic.
 */
import type { LucideIcon } from 'lucide-react';
import { ALL_NAV_ITEMS } from '../nav';

export type CommandCategory = 'navigate' | 'search' | 'action';

export interface Command {
  id: string;
  label: string;
  category: CommandCategory;
  href?: string;
  keywords?: string[];
  icon?: LucideIcon;
  /** For 'action' commands a future phase supplies a handler. */
  perform?: () => void | Promise<void>;
}

/**
 * A pluggable source of commands for a category. Future phases implement this
 * (e.g. a Search source hitting the journal index) and register it.
 */
export interface CommandSource {
  category: CommandCategory;
  getCommands: (query: string) => Command[] | Promise<Command[]>;
}

/** Navigate commands, derived from the nav registry. Functional this phase. */
export function navigateCommands(): Command[] {
  return ALL_NAV_ITEMS.map((item) => ({
    id: `navigate:${item.id}`,
    label: item.label,
    category: 'navigate',
    href: item.href,
    icon: item.icon,
    keywords: [item.id, item.label.toLowerCase()],
  }));
}

/**
 * Registered non-navigate sources. Empty this phase — the array is the seam.
 * `registerCommandSource` lets a later phase add Search/Action providers.
 */
const sources: CommandSource[] = [];

export function registerCommandSource(source: CommandSource): void {
  sources.push(source);
}

export function getCommandSources(): readonly CommandSource[] {
  return sources;
}
