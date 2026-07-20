/**
 * Navigation registry (pure). Single source of truth for the sidebar, mobile
 * tab bar, breadcrumbs, and the command palette's Navigate category. Adding a
 * feature = adding an entry here; the shell needs no other change.
 */
import {
  LayoutDashboard,
  BookOpen,
  BarChart3,
  Calendar,
  ClipboardList,
  Target,
  FileText,
  Bot,
  Settings,
  CreditCard,
  HelpCircle,
  type LucideIcon,
  CandlestickChart,
} from 'lucide-react';

export interface NavItem {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
}

/** Primary L1 rail — status-first ordering. */
export const NAV_ITEMS: readonly NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { id: 'journal', label: 'Journal', href: '/journal', icon: BookOpen },
  { id: 'analytics', label: 'Analytics', href: '/analytics', icon: BarChart3 },
  { id: 'chart', label: 'Chart', href: '/chart', icon: CandlestickChart },
  { id: 'calendar', label: 'Calendar', href: '/calendar', icon: Calendar },
  { id: 'playbook', label: 'Playbook', href: '/playbook', icon: ClipboardList },
  { id: 'goals', label: 'Goals', href: '/goals', icon: Target },
  { id: 'reports', label: 'Reports', href: '/reports', icon: FileText },
  { id: 'ai-coach', label: 'AI Coach', href: '/ai-coach', icon: Bot },
] as const;

/** Secondary/utility items (bottom of the rail). Settings reuses 9.4's route. */
export const SECONDARY_NAV_ITEMS: readonly NavItem[] = [
  { id: 'settings', label: 'Settings', href: '/settings/profile', icon: Settings },
  { id: 'billing', label: 'Billing', href: '/billing', icon: CreditCard },
  { id: 'help', label: 'Help', href: '/help', icon: HelpCircle },
] as const;

export const ALL_NAV_ITEMS: readonly NavItem[] = [...NAV_ITEMS, ...SECONDARY_NAV_ITEMS];

/** Compact subset for the mobile bottom tab bar. */
export const MOBILE_NAV_ITEMS: readonly NavItem[] = [
  NAV_ITEMS[0]!,
  NAV_ITEMS[1]!,
  NAV_ITEMS[2]!,
  NAV_ITEMS[3]!,
];

/** First path segment of an href, e.g. '/settings/profile' → '/settings'. */
function baseSegment(href: string): string {
  const seg = href.split('/')[1] ?? '';
  return `/${seg}`;
}

/** Whether a nav item is active for the current pathname (prefix by base segment). */
export function isNavItemActive(pathname: string, href: string): boolean {
  const base = baseSegment(href);
  return pathname === base || pathname.startsWith(`${base}/`);
}

/** Human label for the active section (workspace title / breadcrumb root). */
export function activeNavLabel(pathname: string): string {
  const match = ALL_NAV_ITEMS.find((item) => isNavItemActive(pathname, item.href));
  return match?.label ?? 'MetaTradee';
}
