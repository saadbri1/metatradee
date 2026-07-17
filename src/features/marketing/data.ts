/**
 * Marketing content (public site). Copy is deliberately honest: it describes
 * real product capabilities only — no profit promises, no guaranteed-returns
 * language, no invented statistics, no testimonials or third-party logos. Every
 * claim maps to a shipped feature module in `src/features/*`.
 */
import {
  BookOpen,
  BarChart3,
  Bot,
  HeartPulse,
  ClipboardList,
  CalendarDays,
  FileText,
  DownloadCloud,
  Users,
  type LucideIcon,
} from 'lucide-react';

export interface EcosystemItem {
  icon: LucideIcon;
  title: string;
  blurb: string;
}

/** The product ecosystem grid — one card per shipped surface. */
export const ECOSYSTEM: EcosystemItem[] = [
  {
    icon: BookOpen,
    title: 'Journal',
    blurb: 'Every trade, with server-computed PnL, R and RR — exact-numeric, never estimated.',
  },
  {
    icon: BarChart3,
    title: 'Analytics',
    blurb: 'Win rate, profit factor, expectancy, equity curve and drawdown from one engine.',
  },
  {
    icon: Bot,
    title: 'AI Coach',
    blurb: 'Evidence-linked reviews grounded in your own data. Never a buy or sell call.',
  },
  {
    icon: HeartPulse,
    title: 'Psychology',
    blurb: 'Emotions, habits and a transparent discipline score that rewards process.',
  },
  {
    icon: ClipboardList,
    title: 'Strategies',
    blurb: 'Immutable, versioned playbooks with adherence measured at trade time.',
  },
  {
    icon: CalendarDays,
    title: 'Calendar',
    blurb: 'Day, session and hour performance — timezone-correct and DST-aware.',
  },
  {
    icon: FileText,
    title: 'Reports',
    blurb: 'Composable, shareable reports built from verified numbers you control.',
  },
  {
    icon: DownloadCloud,
    title: 'Broker Import',
    blurb: 'Bring history from MT4/MT5, cTrader and more — de-duplicated on import.',
  },
  {
    icon: Users,
    title: 'Workspaces',
    blurb: 'Collaborate by reference; personal psychology data is never exposed by default.',
  },
];

export interface ProductSection {
  id: string;
  eyebrow: string;
  title: string;
  body: string;
  points: string[];
  icon: LucideIcon;
}

/** Alternating deep-dive sections. Order defines page flow. */
export const PRODUCT_SECTIONS: ProductSection[] = [
  {
    id: 'journal',
    eyebrow: 'Journal',
    title: 'A journal that does the math for you',
    body: 'Log entries, exits, fees and context. PnL, R multiple and risk-reward are computed on the server from one definition — so the number in your journal is the number everywhere else.',
    points: [
      'Exact-numeric money (no floating-point drift)',
      'Screenshots, tags and notes per trade',
      'Content-hash de-duplication on every write',
    ],
    icon: BookOpen,
  },
  {
    id: 'analytics',
    eyebrow: 'Analytics',
    title: 'Performance you can actually trust',
    body: 'Win rate, profit factor, expectancy, average R, drawdown and the equity curve all derive from the same calculation engine that powers your journal. Every figure reconciles.',
    points: [
      'One engine behind every screen',
      'Filter by symbol, session, strategy or tag',
      'Tabular figures, honest streaks',
    ],
    icon: BarChart3,
  },
  {
    id: 'ai-coach',
    eyebrow: 'AI Coach',
    title: 'A coach that only cites your data',
    body: 'Constructive, evidence-linked reviews that reference your actual trades and metrics. It never invents figures and never tells you what to buy or sell.',
    points: [
      'Grounded in your verified numbers',
      'No trade signals, ever',
      'Every insight links to its evidence',
    ],
    icon: Bot,
  },
  {
    id: 'psychology',
    eyebrow: 'Psychology',
    title: 'Discipline, measured honestly',
    body: 'Track emotions and habits alongside your results, with a transparent discipline score that rewards following your process — not trading more. Private by design.',
    points: [
      'Transparent, process-based scoring',
      'Emotion and habit tracking',
      'Never shared without your explicit opt-in',
    ],
    icon: HeartPulse,
  },
  {
    id: 'strategy',
    eyebrow: 'Strategies',
    title: 'Playbooks that hold you accountable',
    body: 'Document rules and checklists, version them immutably, and measure adherence against the exact strategy that was in force when each trade was taken.',
    points: [
      'Immutable, versioned playbooks',
      'Adherence scored at trade time',
      'Compare strategies side by side',
    ],
    icon: ClipboardList,
  },
  {
    id: 'calendar',
    eyebrow: 'Calendar',
    title: 'See when you perform',
    body: 'A performance calendar across days, sessions and hours — timezone-correct and DST-aware — so you can find your real edge windows instead of guessing.',
    points: [
      'Day, session and hour breakdowns',
      'Timezone- and DST-correct',
      'Honest streaks and consistency',
    ],
    icon: CalendarDays,
  },
  {
    id: 'reports',
    eyebrow: 'Reports',
    title: 'Reports built from verified numbers',
    body: 'Compose reports from your metrics and share them by secure link. What you share is a projection you control — never your raw account or private notes.',
    points: [
      'Composable report blocks',
      'Shareable, revocable links',
      'Only the data you choose to expose',
    ],
    icon: FileText,
  },
  {
    id: 'import',
    eyebrow: 'Broker Import',
    title: 'Bring your whole history in',
    body: 'Import from MT4/MT5, cTrader and more. Trades are normalized and de-duplicated on import using the same content-hash rule as everything else — no double counting.',
    points: [
      'Multiple broker formats',
      'De-duplicated on import',
      'Derived fields recomputed server-side',
    ],
    icon: DownloadCloud,
  },
  {
    id: 'workspace',
    eyebrow: 'Workspaces',
    title: 'Collaborate without oversharing',
    body: 'Share strategies and reports with a team by reference, with role-based access. Personal psychology data is excluded by construction and never exposed to admins by default.',
    points: [
      'Role-based team access',
      'Share by reference, not by copy',
      'Personal data private by construction',
    ],
    icon: Users,
  },
];

export interface Faq {
  q: string;
  a: string;
}

export const FAQS: Faq[] = [
  {
    q: 'What is MetaTradee?',
    a: 'An AI trading journal and performance-analytics platform. You log or import your trades and MetaTradee turns them into verified analytics, honest discipline tracking and evidence-based AI reviews.',
  },
  {
    q: 'Does MetaTradee give trading signals or financial advice?',
    a: 'No. MetaTradee never tells you what to buy or sell and does not provide financial advice. The AI coach only reviews your own past trades and always links to the evidence behind each observation.',
  },
  {
    q: 'Where do the numbers come from?',
    a: 'From your own trades. Every derived figure — PnL, R, RR, win rate, expectancy — is computed server-side from a single calculation engine, so the numbers reconcile across the journal, analytics and reports.',
  },
  {
    q: 'Can I import from my broker?',
    a: 'Yes. You can import history from MT4/MT5, cTrader and other formats. Imported trades are normalized and de-duplicated so nothing is double-counted.',
  },
  {
    q: 'Is my data private?',
    a: 'Yes. Your data is scoped to you with row-level security. Psychology and personal notes are private by construction and are never exposed to workspace admins without your explicit opt-in.',
  },
  {
    q: 'Do I need a credit card to start?',
    a: 'No. The Free plan lets you start without a credit card. You can upgrade later, and pricing is shown transparently before you commit.',
  },
];
