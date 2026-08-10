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
import { PLANS, COMING_SOON } from '@/features/billing/plans';
import { formatPrice } from '@/features/billing/pricing';
import { ADAPTERS, IMPORT_LIMITS, maxFileSizeLabel } from '@/features/import/adapters';

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
  /**
   * Product screenshot for the visual half of the row, served from
   * /public/images/features. OPTIONAL by design: a section without one falls
   * back to the abstract motif rather than rendering an empty frame, so a
   * section can exist before its screenshot does without breaking the page.
   */
  image?: { src: string; alt: string; width: number; height: number };
}

/** Alternating deep-dive sections. Order defines page flow. */
export const PRODUCT_SECTIONS: ProductSection[] = [
  {
    id: 'journal',
    eyebrow: 'Journal',
    title: 'A journal that does the math for you',
    body: 'Log entries, exits, fees and context. Gross and net PnL and the planned reward-to-risk ratio are computed on the server from one definition — so the number in your journal is the number everywhere else.',
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
    image: {
      src: '/images/features/discipline-score.png',
      alt: 'MetaTradee psychology screen: a Discipline Score of 82 out of 100 above Focus, Confidence, Stress and Habit Streak cards, with goals progress and habits tracked below.',
      width: 1448,
      height: 1086,
    },
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
    image: {
      src: '/images/features/playbooks.png',
      alt: 'MetaTradee playbooks screen: three versioned strategies with entry checklists and adherence rings, beside a side-by-side comparison of entry, risk, trade-management and exit adherence.',
      width: 1448,
      height: 1086,
    },
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
    image: {
      src: '/images/features/performance-calendar.png',
      alt: 'MetaTradee performance calendar: a month of daily profit and loss colour-coded green and red, with best day, best session, best hour, current streak and a 30-day consistency gauge.',
      width: 1448,
      height: 1086,
    },
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
    /*
     * NO IMAGE, DELIBERATELY. `/images/features/broker-import.png` was a
     * mock-up, not a capture: it advertised `.zip`, `.xlsx` and a 2 GB cap
     * against a real `.csv`/`.json`/`.txt` at 20 MB, and its own alt text
     * described invented result counters. `image` is optional here precisely so
     * a section can ship without one rather than with a misleading one.
     */
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
    image: {
      src: '/images/features/workspaces.png',
      alt: 'MetaTradee team workspace with members, roles and shared content',
      width: 1331,
      height: 711,
    },
  },
];

/** Numbered workflow narrative (walk the user through the loop). */
export interface WorkflowStep {
  n: string;
  title: string;
  body: string;
}
export const HOW_IT_WORKS: WorkflowStep[] = [
  {
    n: '01',
    title: 'Import or log',
    body: 'Bring history from MetaTrader 4/5, cTrader and CSV, or log trades by hand. Everything is normalized and de-duplicated on the way in.',
  },
  {
    n: '02',
    title: 'Compute once',
    body: 'A single server-side engine turns raw fills into PnL, R, RR and every derived metric — so one definition powers every screen.',
  },
  {
    n: '03',
    title: 'Review with evidence',
    body: 'Analytics, calendar and an AI coach that only cites your real trades — plus honest psychology and discipline tracking.',
  },
  {
    n: '04',
    title: 'Refine your edge',
    body: 'Version your playbooks, measure adherence at trade time, and share verified reports with a team — never your private notes.',
  },
];

/** Import formats we actually support (capability names, not brand logos). */
export const SUPPORTED_FORMATS: string[] = [
  'MetaTrader 4',
  'MetaTrader 5',
  'cTrader',
  'CSV',
  'Excel',
  'Manual entry',
];

/** Curated modules for the sticky scroll-linked showcase. */
export interface ShowcaseItem {
  id: string;
  label: string;
  title: string;
  body: string;
  accent: 'primary' | 'profit';
}
export const SHOWCASE: ShowcaseItem[] = [
  {
    id: 'journal',
    label: 'Journal',
    title: 'Log a trade, get the math for free',
    body: 'Entries, exits, fees and context in — exact-numeric PnL, R and RR out. No spreadsheet, no floating-point drift.',
    accent: 'primary',
  },
  {
    id: 'analytics',
    label: 'Analytics',
    title: 'Every metric reconciles',
    body: 'Win rate, profit factor, expectancy, equity curve and drawdown — all from the one engine behind your journal.',
    accent: 'profit',
  },
  {
    id: 'ai-coach',
    label: 'AI Coach',
    title: 'Feedback that cites your data',
    body: 'Constructive, evidence-linked reviews grounded in your real trades. Never a signal, never an invented number.',
    accent: 'primary',
  },
  {
    id: 'reports',
    label: 'Reports',
    title: 'Share proof, not your account',
    body: 'Compose reports from verified metrics and share by revocable link — only the data you choose to expose.',
    accent: 'profit',
  },
];

export interface Faq {
  q: string;
  a: string;
}

/** The plan on which statement import first appears. Found, not asserted. */
const IMPORT_PLAN = Object.values(PLANS).find((plan) => plan.features.brokerImport) ?? PLANS.trader;

/** Platform labels straight from the importer registry, excluding the fallback. */
const PLATFORM_LABELS = ADAPTERS.filter((a) => a.id !== 'generic')
  .map((a) => a.label)
  .join(', ');

/**
 * The homepage FAQ — and, through `faqPageLd()`, the `FAQPage` structured data.
 *
 * THIS IS THE MOST-QUOTED TEXT ON THE SITE. It is the FAQ on the most-crawled
 * page, it is emitted as structured data, and answer engines lift these strings
 * close to verbatim. So each answer is written to survive being quoted with no
 * surrounding context: it names the product, it states the limit or the plan
 * alongside the capability, and it answers the literal question asked rather
 * than an easier adjacent one.
 *
 * THE PREVIOUS "Can I import from my broker?" ENTRY WAS WRONG TWICE. It
 * answered "Yes. You can import history from MT4/MT5, cTrader and other
 * formats" — which reads as a broker connection (there is none; see `/brokers`)
 * and omits that import is a paid capability (`Free` has `brokerImport: false`,
 * so on Free you log manually). Both halves are now stated explicitly, and the
 * question itself is split into the two distinct things people actually ask:
 * whether it syncs, and what it accepts.
 *
 * NUMBERS AND PLAN NAMES ARE DERIVED from `PLANS`, `ADAPTERS` and `COMING_SOON`
 * rather than typed in, so a price change or a new adapter cannot leave a false
 * answer behind in the structured data.
 */
export const FAQS: Faq[] = [
  {
    q: 'What is MetaTradee?',
    a: `MetaTradee is a web-based trading journal and performance-analytics application for retail traders. You import your trade history as a statement file, or log trades manually, and MetaTradee computes gross and net P&L, the planned reward-to-risk ratio, win rate, profit factor, expectancy and drawdown from that history. It is a record-keeping and review tool: it does not place trades, and it does not connect to a live account.`,
  },
  {
    q: 'Does MetaTradee support MetaTrader 5 (MT5) and MetaTrader 4 (MT4)?',
    a: `Yes, by statement import. MetaTradee has dedicated importers that recognise the column names used by ${PLATFORM_LABELS}. For MT5 and MT4 you export the history report from the terminal, save it as CSV, and upload it — MetaTradee maps the columns, shows a preview before anything is written, and de-duplicates on re-import.`,
  },
  {
    q: 'Does MetaTradee automatically sync with my broker?',
    a: `No. MetaTradee has no broker API connection and never asks for your trading credentials or account password. Importing is a file you export yourself and upload. Automatic broker synchronisation is planned but not built, and it is listed as not yet supported rather than advertised as available.`,
  },
  {
    q: 'What import formats does MetaTradee accept?',
    a: `CSV and JSON statement files, up to ${maxFileSizeLabel()} — a ${IMPORT_LIMITS.extensions.join(', ')} extension. XLSX and HTML statements are refused, so a MetaTrader report saved as a spreadsheet or web page has to be re-saved as CSV first. Any platform without a dedicated importer still works through the generic mapper, where you match your columns once and MetaTradee remembers the mapping.`,
  },
  {
    q: 'Is MetaTradee free?',
    a: `There is a free plan and it does not expire: ${PLANS.free.limits.maxTrades} trades on ${PLANS.free.limits.maxAccounts} trading account, no credit card, with trades logged manually. Statement import and the AI coach start on the ${IMPORT_PLAN.name} plan; the paid plans are ${formatPrice(PLANS.trader.priceMonthly)}, ${formatPrice(PLANS.pro.priceMonthly)} and ${formatPrice(PLANS.funded.priceMonthly)} per month. Paid access is bought 30 or 365 days at a time and never renews automatically.`,
  },
  {
    q: 'Does MetaTradee support backtesting?',
    a: `No. Neither ${COMING_SOON.manualBacktesting.toLowerCase()} nor ${COMING_SOON.automatedBacktesting.toLowerCase()} is available on any plan, and neither is included in any price. What does ship is trade replay: stepping bar by bar through a real recorded session at one-minute resolution with future candles hidden, so you can practise reading a session you have already traded.`,
  },
  {
    q: 'How is MetaTradee different from a spreadsheet trading journal?',
    a: `A spreadsheet stores whatever you type into it, and every derived figure is a formula you maintain yourself. MetaTradee computes P&L and the planned reward-to-risk ratio on the server from one calculation engine using exact-numeric money, so the journal, the analytics and the reports cannot disagree with each other or drift through floating-point error. It also de-duplicates re-imported trades, versions your playbook rules, and links each AI observation back to the specific trades behind it.`,
  },
  {
    q: 'Does MetaTradee give trading signals or financial advice?',
    a: 'No. MetaTradee never tells you what to buy or sell and does not provide financial advice. The AI coach only reviews your own past trades and always links to the evidence behind each observation.',
  },
  {
    q: 'Where do the numbers come from?',
    a: 'From your own trades. Every derived figure — gross and net P&L, planned reward-to-risk, win rate, profit factor, expectancy and drawdown — is computed server-side from a single calculation engine, so the numbers reconcile across the journal, analytics and reports.',
  },
  {
    q: 'Is my data private?',
    a: 'Yes. Your data is scoped to you with row-level security. Psychology and personal notes are private by construction and are never exposed to workspace admins without your explicit opt-in.',
  },
];
