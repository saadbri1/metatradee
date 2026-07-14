/**
 * Workspace/profile/onboarding config — pure constants (no runtime deps beyond
 * Intl). Enum tuples mirror the DB CHECK constraints; option lists drive the UI.
 */

export interface Option<T extends string = string> {
  value: T;
  label: string;
}

// --- Trading profile enums (mirror trading_profiles CHECK constraints) ------
export const EXPERIENCE_LEVELS = ['beginner', 'intermediate', 'advanced', 'professional'] as const;
export type ExperienceLevel = (typeof EXPERIENCE_LEVELS)[number];

export const TRADING_STYLES = [
  'scalping',
  'day_trading',
  'swing_trading',
  'position_trading',
  'investing',
] as const;
export type TradingStyle = (typeof TRADING_STYLES)[number];

export const MARKETS = ['forex', 'stocks', 'futures', 'crypto', 'options', 'commodities'] as const;
export type Market = (typeof MARKETS)[number];

export const ACCOUNT_SIZE_BANDS = [
  'under_1k',
  '1k_10k',
  '10k_50k',
  '50k_250k',
  '250k_plus',
] as const;
export type AccountSizeBand = (typeof ACCOUNT_SIZE_BANDS)[number];

export const TRADING_SESSIONS = ['asian', 'london', 'new_york'] as const;
export type TradingSession = (typeof TRADING_SESSIONS)[number];

export const TRADING_GOALS = [
  'consistency',
  'grow_account',
  'get_funded',
  'go_full_time',
  'reduce_mistakes',
  'risk_management',
] as const;
export type TradingGoal = (typeof TRADING_GOALS)[number];

export const RISK_PROFILES = ['conservative', 'moderate', 'aggressive'] as const;
export type RiskProfile = (typeof RISK_PROFILES)[number];

// --- Preferences enums ------------------------------------------------------
export const TIME_FORMATS = ['12h', '24h'] as const;
export type TimeFormat = (typeof TIME_FORMATS)[number];

export const DATE_FORMATS = ['YYYY-MM-DD', 'MM/DD/YYYY', 'DD/MM/YYYY'] as const;
export type DateFormat = (typeof DATE_FORMATS)[number];

export const RISK_UNITS = ['R', 'percent', 'currency'] as const;
export type RiskUnit = (typeof RISK_UNITS)[number];

export const THEMES = ['light', 'dark', 'system'] as const;
export const DENSITIES = ['comfortable', 'compact', 'terminal'] as const;

/** Human labels for enum values (used to build <Select> options). */
export const LABELS: Record<string, string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
  professional: 'Professional',
  scalping: 'Scalping',
  day_trading: 'Day trading',
  swing_trading: 'Swing trading',
  position_trading: 'Position trading',
  investing: 'Investing',
  forex: 'Forex',
  stocks: 'Stocks',
  futures: 'Futures',
  crypto: 'Crypto',
  options: 'Options',
  commodities: 'Commodities',
  under_1k: 'Under $1k',
  '1k_10k': '$1k – $10k',
  '10k_50k': '$10k – $50k',
  '50k_250k': '$50k – $250k',
  '250k_plus': '$250k+',
  asian: 'Asian',
  london: 'London',
  new_york: 'New York',
  consistency: 'Consistency',
  grow_account: 'Grow my account',
  get_funded: 'Get funded',
  go_full_time: 'Go full-time',
  reduce_mistakes: 'Reduce mistakes',
  risk_management: 'Better risk management',
  conservative: 'Conservative',
  moderate: 'Moderate',
  aggressive: 'Aggressive',
  R: 'R multiple',
  percent: 'Percent (%)',
  currency: 'Currency ($)',
  '12h': '12-hour',
  '24h': '24-hour',
};

export function toOptions<T extends string>(values: readonly T[]): Option<T>[] {
  return values.map((value) => ({ value, label: LABELS[value] ?? value }));
}

// --- Canonical lists --------------------------------------------------------
/** IANA timezones from the runtime (Node 20 / modern browsers), with a fallback. */
export function getTimezones(): string[] {
  const intl = Intl as typeof Intl & {
    supportedValuesOf?: (key: string) => string[];
  };
  try {
    if (typeof intl.supportedValuesOf === 'function') {
      return intl.supportedValuesOf('timeZone');
    }
  } catch {
    // fall through
  }
  return ['UTC', 'America/New_York', 'Europe/London', 'Asia/Tokyo'];
}

export const LANGUAGES: Option[] = [
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Español' },
  { value: 'fr', label: 'Français' },
  { value: 'de', label: 'Deutsch' },
  { value: 'pt', label: 'Português' },
  { value: 'it', label: 'Italiano' },
  { value: 'nl', label: 'Nederlands' },
  { value: 'ja', label: '日本語' },
  { value: 'zh', label: '中文' },
  { value: 'ar', label: 'العربية' },
];

export const CURRENCIES = [
  'USD',
  'EUR',
  'GBP',
  'JPY',
  'AUD',
  'CAD',
  'CHF',
  'CNY',
  'INR',
  'BRL',
] as const;

/** Common markets. Not exhaustive — extend as needed (documented). */
export const COUNTRIES: Option[] = [
  { value: 'US', label: 'United States' },
  { value: 'GB', label: 'United Kingdom' },
  { value: 'CA', label: 'Canada' },
  { value: 'AU', label: 'Australia' },
  { value: 'DE', label: 'Germany' },
  { value: 'FR', label: 'France' },
  { value: 'ES', label: 'Spain' },
  { value: 'IT', label: 'Italy' },
  { value: 'NL', label: 'Netherlands' },
  { value: 'PT', label: 'Portugal' },
  { value: 'BR', label: 'Brazil' },
  { value: 'MX', label: 'Mexico' },
  { value: 'IN', label: 'India' },
  { value: 'SG', label: 'Singapore' },
  { value: 'AE', label: 'United Arab Emirates' },
  { value: 'ZA', label: 'South Africa' },
  { value: 'JP', label: 'Japan' },
  { value: 'CN', label: 'China' },
  { value: 'NG', label: 'Nigeria' },
  { value: 'PH', label: 'Philippines' },
];

/**
 * Reserved usernames — blocked at registration/change. Lowercase; the checker
 * compares case-insensitively. Covers routes, roles, and abuse-prone handles.
 */
export const RESERVED_USERNAMES: ReadonlySet<string> = new Set([
  'admin',
  'administrator',
  'root',
  'superuser',
  'support',
  'help',
  'billing',
  'settings',
  'onboarding',
  'account',
  'api',
  'auth',
  'login',
  'logout',
  'register',
  'signup',
  'signin',
  'metatradee',
  'moderator',
  'staff',
  'system',
  'null',
  'undefined',
  'me',
  'you',
  'dashboard',
]);
