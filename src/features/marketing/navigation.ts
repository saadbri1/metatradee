/**
 * Public marketing navigation — the single source of truth for the header, the
 * mobile drawer, and the standalone public pages.
 *
 * HONESTY CONTRACT: every entry here points at something that genuinely exists.
 * Product items name shipped feature modules under `src/features/*`; solution
 * items describe workflows those modules actually support; resource items
 * resolve to a real public route or an on-page section. There are no
 * placeholder destinations and no "coming soon" links dressed up as live ones.
 */
import {
  Bot,
  BarChart3,
  BookOpen,
  CalendarDays,
  ClipboardList,
  FileText,
  LayoutDashboard,
  LineChart,
  type LucideIcon,
} from 'lucide-react';

export interface NavLeaf {
  label: string;
  description: string;
  href: string;
  icon?: LucideIcon;
}

export interface NavMenu {
  /** Trigger label in the header. */
  label: string;
  /** The page the trigger itself navigates to. */
  href: string;
  items: NavLeaf[];
  /** Two columns for the wide product menu, one for the narrower menus. */
  columns: 1 | 2;
}

/**
 * Products — one entry per shipped surface in the authenticated app.
 * Descriptions state what the module does, never what it might earn you.
 */
export const PRODUCT_ITEMS: NavLeaf[] = [
  {
    label: 'Trading Dashboard',
    description: 'Your KPIs, equity curve and open positions at a glance.',
    href: '/products#dashboard',
    icon: LayoutDashboard,
  },
  {
    label: 'Trading Journal',
    description: 'Log every trade with server-computed P&L, R and R:R.',
    href: '/products#journal',
    icon: BookOpen,
  },
  {
    label: 'Trade Analytics',
    description: 'Win rate, profit factor, expectancy and drawdown from one engine.',
    href: '/products#analytics',
    icon: BarChart3,
  },
  {
    label: 'Chart & Replay',
    description: 'Step through real historical sessions bar by bar.',
    href: '/products#chart',
    icon: LineChart,
  },
  {
    label: 'Playbooks',
    description: 'Versioned strategy rules, measured against your real trades.',
    href: '/products#playbook',
    icon: ClipboardList,
  },
  {
    label: 'AI Coach',
    description: 'Evidence-linked reviews of your own data. Never a trade signal.',
    href: '/products#ai-coach',
    icon: Bot,
  },
  {
    label: 'Calendar',
    description: 'Performance by day, session and hour — timezone correct.',
    href: '/products#calendar',
    icon: CalendarDays,
  },
  {
    label: 'Reports',
    description: 'Composable reports built from figures you can verify.',
    href: '/products#reports',
    icon: FileText,
  },
];

/** Solutions — real segments and workflows the shipped modules serve. */
export const SOLUTION_ITEMS: NavLeaf[] = [
  {
    label: 'Active Traders',
    description: 'A disciplined routine around every trade you take.',
    href: '/solutions#active-traders',
  },
  {
    label: 'Futures Traders',
    description: 'Session-aware analytics and CME contract replay.',
    href: '/solutions#futures-traders',
  },
  {
    label: 'Funded Traders',
    description: 'Track rules and drawdown across evaluation accounts.',
    href: '/solutions#funded-traders',
  },
  {
    label: 'Trading Coaches',
    description: 'Review a student’s numbers instead of their story.',
    href: '/solutions#trading-coaches',
  },
  {
    label: 'Trading Teams',
    description: 'Shared workspaces that keep personal data private.',
    href: '/solutions#trading-teams',
  },
  {
    label: 'Demo & Replay Practice',
    description: 'Rehearse a setup on real data without risking capital.',
    href: '/solutions#replay-practice',
  },
  {
    label: 'Performance Review',
    description: 'A repeatable weekly and monthly review loop.',
    href: '/solutions#performance-review',
  },
  {
    label: 'Strategy Development',
    description: 'Write rules, link trades, and see what actually holds up.',
    href: '/solutions#strategy-development',
  },
];

/** Resources — guides for shipped features plus real support surfaces. */
export const RESOURCE_ITEMS: NavLeaf[] = [
  {
    /*
     * Listed first, and linked from the header rather than only from the
     * footer, because it is the highest-intent public entry point on the site:
     * someone searching for a position-size calculator is a trader with an open
     * question, not a browser. A crawlable header link is also what keeps
     * /tools from being an orphan page.
     */
    label: 'Free Calculators',
    description: 'Position size, gold lot size and risk/reward — no account needed.',
    href: '/tools',
  },
  {
    label: 'Trading Journal Guide',
    description: 'How to log trades so the numbers stay trustworthy.',
    href: '/resources#journal-guide',
  },
  {
    label: 'Replay Guide',
    description: 'Practising with historical sessions, bar by bar.',
    href: '/resources#replay-guide',
  },
  {
    label: 'Analytics Guide',
    description: 'What each metric means and how it is calculated.',
    href: '/resources#analytics-guide',
  },
  {
    label: 'Playbook Guide',
    description: 'Turning a strategy into rules you can measure.',
    href: '/resources#playbook-guide',
  },
  {
    label: 'AI Coach Guide',
    description: 'What the coach can and cannot tell you.',
    href: '/resources#ai-coach-guide',
  },
  {
    label: 'Help Center',
    description: 'Answers to the questions we are asked most.',
    href: '/resources#help-center',
  },
  {
    label: 'Product Updates',
    description: 'What shipped recently, and what is in progress.',
    href: '/resources#product-updates',
  },
  {
    label: 'Security & Privacy',
    description: 'How your trading data is isolated and protected.',
    href: '/resources#security',
  },
  {
    label: 'Contact',
    description: 'Reach the team directly.',
    href: '/resources#contact',
  },
];

/** The three dropdown menus, in header order. */
export const NAV_MENUS: NavMenu[] = [
  { label: 'Products', href: '/products', items: PRODUCT_ITEMS, columns: 2 },
  { label: 'Solutions', href: '/solutions', items: SOLUTION_ITEMS, columns: 2 },
  { label: 'Resources', href: '/resources', items: RESOURCE_ITEMS, columns: 2 },
];

export interface NavFlatLink {
  label: string;
  href: string;
}

/** Header links with no dropdown. */
export const NAV_LINKS: NavFlatLink[] = [
  { label: 'Supported Brokers', href: '/brokers' },
  { label: 'Pricing', href: '/pricing' },
];

/**
 * Header order as rendered, so the mobile drawer and the desktop bar cannot
 * drift apart and tests can assert one list.
 */
export const HEADER_ORDER = [
  'Products',
  'Solutions',
  'Supported Brokers',
  'Pricing',
  'Resources',
] as const;

/** Every public destination the header can reach — used by routing tests. */
export function allNavHrefs(): string[] {
  return [
    ...NAV_MENUS.map((menu) => menu.href),
    ...NAV_MENUS.flatMap((menu) => menu.items.map((item) => item.href)),
    ...NAV_LINKS.map((link) => link.href),
    '/login',
    '/register',
  ];
}

/** The public routes that must exist for the navigation to have no dead ends. */
export const PUBLIC_ROUTES = [
  '/',
  '/products',
  '/solutions',
  '/brokers',
  '/pricing',
  '/resources',
] as const;
