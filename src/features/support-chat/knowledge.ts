/**
 * APPROVED PRODUCT KNOWLEDGE — the only thing the chatbot is allowed to state
 * as fact.
 *
 * WHY A KNOWLEDGE BASE AND NOT A PROMPT. A support bot that answers from a
 * model's own memory will, eventually and confidently, invent a price, a broker
 * or a feature. Every claim below maps to something that actually exists in
 * this repository: prices are READ FROM `PLANS` rather than typed out, the
 * unshipped capabilities are read from `COMING_SOON`, and the remaining copy
 * restates the same claims the public pages already make. When nothing here
 * matches, the answer is "I do not know" plus a route to a human — never a
 * guess.
 *
 * MATCHING IS DETERMINISTIC AND CROSS-LINGUAL. Keywords are declared in all
 * three languages and matched against ALL of them, so a visitor typing English
 * into the Arabic interface still reaches the right topic; the ANSWER is then
 * returned in the language they selected.
 *
 * NO MODEL IS REQUIRED for any of this. A model, when one is configured, may
 * only rephrase what is here — see `server/answer.ts`.
 */
import { COMING_SOON, PLANS } from '@/features/billing/plans';
import { TIER_ORDER, formatPrice, priceFor } from '@/features/billing/pricing';
import { ADAPTERS } from '@/features/import/adapters';
import type { SupportCategory } from '@/features/contact/schemas';
import type { SupportChatLocale } from './types';

/** Per-locale text, so every topic is complete in all three by construction. */
type Localized = Record<SupportChatLocale, string>;
type LocalizedList = Record<SupportChatLocale, string[]>;

export interface KnowledgeTopic {
  id: string;
  /** Lowercased, accent-stripped match terms. Matched across every locale. */
  keywords: LocalizedList;
  answer: Localized;
  /**
   * True when a correct answer still needs a person — account access, money,
   * and anything security-shaped. The bot answers AND offers escalation.
   */
  escalate?: boolean;
  /**
   * Which support category this topic belongs to, used to PRESELECT the
   * escalation form. Someone escalating a billing dispute should not have to
   * restate that it is a billing dispute in a dropdown.
   */
  category?: SupportCategory;
  /**
   * True when the answer ALREADY offers to fetch a person, so the generic
   * offer is not appended on top of it. Without this, asking for a human got
   * "I can pass this to the support team" immediately followed by "Would you
   * like me to pass this to the support team?".
   */
  offerHandled?: boolean;
  /** A real public route, for "read more". Never a placeholder. */
  href?: string;
}

/* ------------------------------------------------------------------ *
 * Prices are DERIVED. `plans.ts` is the single source of truth for
 * money in this codebase, and a chatbot quoting a stale figure is a
 * support ticket at best and a complaint at worst.
 * ------------------------------------------------------------------ */

const PRICE_UNITS: Record<
  SupportChatLocale,
  { per: (m: string, a: string) => string; free: string }
> = {
  en: { per: (m, a) => `${m} per month or ${a} per year`, free: 'free' },
  fr: { per: (m, a) => `${m} par mois ou ${a} par an`, free: 'gratuit' },
  ar: { per: (m, a) => `${m} شهرياً أو ${a} سنوياً`, free: 'مجاناً' },
};

/**
 * One line per tier: "<name> — <monthly> per month or <annual> per year",
 * joined with "·". Free tiers collapse to just the word for free.
 *
 * NO EXAMPLE FIGURES IN THIS COMMENT, deliberately. `pricing.test.ts` scans
 * `src/**` for literal configured prices, and it is right to: a worked example
 * here would go stale the moment a price changed, which is the exact drift the
 * derivation below exists to prevent.
 */
function planPriceLines(locale: SupportChatLocale): string {
  const units = PRICE_UNITS[locale];
  return TIER_ORDER.map((tier) => {
    const plan = PLANS[tier];
    const { monthly, annual, currency } = priceFor(tier);
    if (monthly === 0 && annual === 0) return `${plan.name} — ${units.free}`;
    return `${plan.name} — ${units.per(formatPrice(monthly, currency), formatPrice(annual, currency))}`;
  }).join(' · ');
}

/** Trial length, read from the plans rather than asserted. */
const TRIAL_DAYS = PLANS.pro.trialDays;

/*
 * Import facts are DERIVED from the import engine, not described from memory.
 *
 * This matters more than it looks. `adapters.ts` declares `formats: ['csv',
 * 'json']` for every platform — there is no HTML statement parser in this
 * repository. A chatbot that said "export your statement and upload it" would
 * send people round a loop with an HTML file the product cannot read, which is
 * exactly the support ticket it was meant to prevent.
 */
const IMPORT_PLATFORMS = ADAPTERS.filter((a) => a.id !== 'generic')
  .map((a) => a.label)
  .join(', ');
const IMPORT_FORMATS = [...new Set(ADAPTERS.flatMap((a) => a.formats))]
  .map((f) => f.toUpperCase())
  .join(' / ');

/** The capabilities that do not exist yet, named exactly as `plans.ts` names them. */
const COMING_SOON_LIST = Object.values(COMING_SOON).join(', ');

export const KNOWLEDGE_TOPICS: KnowledgeTopic[] = [
  {
    id: 'what_is',
    href: '/products',
    keywords: {
      en: ['what is metatradee', 'what does metatradee', 'about metatradee', 'what do you do'],
      fr: ['qu est ce que metatradee', 'c est quoi metatradee', 'a quoi sert metatradee'],
      ar: ['ما هو metatradee', 'ماذا يفعل metatradee', 'عن metatradee', 'ما هي المنصة'],
    },
    answer: {
      en: 'MetaTradee is an AI trading journal and performance-analytics platform. You log or import your trades, and it turns them into verified analytics, discipline tracking and evidence-based AI reviews of your own history.',
      fr: 'MetaTradee est un journal de trading et une plateforme d’analyse de performance assistée par IA. Vous saisissez ou importez vos trades, et la plateforme les transforme en statistiques vérifiées, en suivi de discipline et en revues IA fondées sur votre propre historique.',
      ar: 'MetaTradee هو دفتر تداول ومنصة لتحليل الأداء مدعومة بالذكاء الاصطناعي. تُسجّل صفقاتك أو تستوردها، فتتحول إلى تحليلات موثّقة ومتابعة للانضباط ومراجعات مبنية على سجلك أنت.',
    },
  },
  {
    id: 'getting_started',
    href: '/products',
    keywords: {
      en: ['get started', 'sign up', 'create an account', 'how do i start', 'first steps'],
      fr: ['commencer', 'creer un compte', 's inscrire', 'demarrer', 'premiers pas'],
      ar: ['البدء', 'كيف ابدا', 'انشاء حساب', 'التسجيل', 'اول خطوة'],
    },
    answer: {
      en: 'Create an account, add a trading account, then either log trades by hand or import your broker history. Analytics, the calendar and the discipline score fill in from the trades you add — nothing is simulated.',
      fr: 'Créez un compte, ajoutez un compte de trading, puis saisissez vos trades à la main ou importez l’historique de votre courtier. Les statistiques, le calendrier et le score de discipline se remplissent à partir des trades ajoutés — rien n’est simulé.',
      ar: 'أنشئ حساباً، ثم أضف حساب تداول، ثم سجّل صفقاتك يدوياً أو استورد سجلك من الوسيط. تُبنى التحليلات والتقويم ودرجة الانضباط من الصفقات التي تضيفها — لا شيء مُحاكى.',
    },
  },
  {
    id: 'pricing',
    href: '/pricing',
    keywords: {
      en: ['price', 'pricing', 'cost', 'how much', 'plan', 'plans', 'subscription', 'upgrade'],
      fr: ['prix', 'tarif', 'tarifs', 'combien', 'formule', 'formules', 'abonnement', 'cout'],
      ar: ['السعر', 'الاسعار', 'التكلفة', 'كم تكلفة', 'الخطط', 'الخطة', 'الاشتراك', 'الترقية'],
    },
    answer: {
      en: `There are four plans: ${planPriceLines('en')}. Prices are shown in full before you commit, and the same numbers appear on the pricing page.`,
      fr: `Il existe quatre formules : ${planPriceLines('fr')}. Les prix sont affichés intégralement avant tout engagement, et ce sont les mêmes chiffres que sur la page tarifs.`,
      ar: `هناك أربع خطط: ${planPriceLines('ar')}. تُعرض الأسعار كاملة قبل أي التزام، وهي نفس الأرقام الموجودة في صفحة الأسعار.`,
    },
  },
  {
    id: 'trial_and_free',
    href: '/pricing',
    keywords: {
      en: ['free plan', 'free trial', 'trial', 'credit card', 'try it', 'without paying'],
      fr: ['gratuit', 'essai', 'periode d essai', 'carte bancaire', 'carte de credit', 'essayer'],
      ar: ['مجاني', 'الخطة المجانية', 'تجربة', 'فترة تجريبية', 'بطاقة ائتمان', 'تجربة مجانية'],
    },
    answer: {
      en: `The Free plan needs no credit card, and the paid plans include a ${TRIAL_DAYS}-day trial. A trial is deliberately not the whole plan: report sharing is withheld and every limit stays finite, so it can never run up unbounded cost.`,
      fr: `La formule gratuite ne demande aucune carte bancaire, et les formules payantes incluent un essai de ${TRIAL_DAYS} jours. L’essai n’est volontairement pas la formule complète : le partage de rapports en est exclu et toutes les limites restent finies.`,
      ar: `الخطة المجانية لا تتطلب بطاقة ائتمان، والخطط المدفوعة تشمل تجربة مدتها ${TRIAL_DAYS} يوماً. الفترة التجريبية ليست الخطة الكاملة عن قصد: مشاركة التقارير غير متاحة فيها وتبقى جميع الحدود محدودة.`,
    },
  },
  {
    id: 'no_advice',
    keywords: {
      en: [
        'financial advice',
        'signals',
        'should i buy',
        'should i sell',
        'trading tips',
        'predict',
        'guarantee',
        'guaranteed',
        'make me money',
        'profitable',
        'best trade',
      ],
      fr: [
        'conseil financier',
        'signaux',
        'dois je acheter',
        'dois je vendre',
        'prediction',
        'garantie',
        'garantir',
        'rentable',
        'gagner de l argent',
      ],
      ar: [
        'نصيحة مالية',
        'اشارات',
        'توصيات',
        'هل اشتري',
        'هل ابيع',
        'توقع السعر',
        'ضمان',
        'ارباح مضمونة',
        'مربح',
      ],
    },
    answer: {
      en: 'MetaTradee never tells you what to buy or sell and does not provide financial advice or price predictions. The AI coach reviews your own past trades and links to the evidence behind every observation.',
      fr: 'MetaTradee ne vous dit jamais quoi acheter ou vendre et ne fournit ni conseil financier ni prédiction de cours. Le coach IA analyse vos trades passés et renvoie aux données qui justifient chaque observation.',
      ar: 'لا يخبرك MetaTradee أبداً بما تشتريه أو تبيعه، ولا يقدّم نصائح مالية أو توقعات للأسعار. يراجع المدرّب الذكي صفقاتك السابقة ويربط كل ملاحظة بالدليل الذي تستند إليه.',
    },
  },
  {
    id: 'broker_import',
    href: '/brokers',
    category: 'trade_import',
    keywords: {
      en: [
        'import',
        'broker',
        'mt4',
        'mt5',
        'metatrader',
        'ctrader',
        'dxtrade',
        'tradelocker',
        'csv',
        'json',
        'history',
        'duplicate',
        'which platforms',
      ],
      fr: [
        'importer',
        'import',
        'courtier',
        'mt4',
        'mt5',
        'metatrader',
        'ctrader',
        'csv',
        'json',
        'historique',
      ],
      ar: ['استيراد', 'الوسيط', 'وسيط', 'ميتاتريدر', 'سجل الصفقات', 'csv', 'json', 'ملف', 'تكرار'],
    },
    answer: {
      en: `Statements import as ${IMPORT_FORMATS} files, with ready-made column mappings for ${IMPORT_PLATFORMS} and a generic mapping for anything else. Imported trades are normalized and de-duplicated by content hash, so re-importing the same file will not double-count anything.`,
      fr: `Les relevés s’importent en fichiers ${IMPORT_FORMATS}, avec des correspondances de colonnes prêtes pour ${IMPORT_PLATFORMS} et une correspondance générique pour le reste. Les trades importés sont normalisés et dédupliqués par empreinte de contenu : réimporter le même fichier ne comptera rien deux fois.`,
      ar: `تُستورد الكشوف بصيغة ${IMPORT_FORMATS}، مع تخطيطات أعمدة جاهزة لمنصات ${IMPORT_PLATFORMS} وتخطيط عام لغيرها. تُوحَّد الصفقات المستوردة وتُزال تكراراتها عبر بصمة المحتوى، فإعادة استيراد الملف نفسه لن تُحتسب مرتين.`,
    },
  },
  {
    /*
     * The first troubleshooting step, and the single most common cause: people
     * export the HTML statement MetaTrader offers by default, and the engine
     * only parses CSV/JSON. Answering the format question first saves the round
     * trip that would otherwise take a person to discover.
     */
    id: 'import_troubleshooting',
    href: '/brokers',
    escalate: true,
    category: 'trade_import',
    keywords: {
      en: [
        'cannot import',
        'can t import',
        'import failed',
        'import fails',
        'import not working',
        'import error',
        'html file',
        'html statement',
        'xlsx',
        'excel file',
        'pdf statement',
        'wrong format',
        'file not accepted',
        'no trades imported',
        'missing trades',
      ],
      fr: [
        'import echoue',
        'importation echoue',
        'impossible d importer',
        'fichier html',
        'releve html',
        'fichier excel',
        'mauvais format',
        'aucun trade importe',
        'trades manquants',
      ],
      ar: [
        'فشل الاستيراد',
        'لا يمكنني الاستيراد',
        'ملف html',
        'كشف html',
        'ملف اكسل',
        'صيغة خاطئة',
        'لم تستورد الصفقات',
        'صفقات مفقودة',
      ],
    },
    answer: {
      en: `First check the file format: the importer reads ${IMPORT_FORMATS} only. MetaTrader offers an HTML statement by default, and that will not parse — re-export the same history as CSV and try again. If the file is already ${IMPORT_FORMATS} and still fails, a person should look at it.`,
      fr: `Vérifiez d’abord le format : l’importateur ne lit que ${IMPORT_FORMATS}. MetaTrader propose un relevé HTML par défaut, qui ne peut pas être analysé — réexportez le même historique en CSV et réessayez. Si le fichier est déjà en ${IMPORT_FORMATS} et échoue quand même, un conseiller doit l’examiner.`,
      ar: `تحقق أولاً من صيغة الملف: يقرأ المستورد ${IMPORT_FORMATS} فقط. يقدّم MetaTrader كشفاً بصيغة HTML افتراضياً، وهي صيغة لا يمكن تحليلها — أعد تصدير السجل نفسه بصيغة CSV وحاول مجدداً. وإذا كان الملف بصيغة ${IMPORT_FORMATS} وما زال يفشل، فيجب أن يفحصه أحد أفراد الفريق.`,
    },
  },
  {
    id: 'privacy_security',
    keywords: {
      en: [
        'privacy',
        'my data',
        'secure',
        'security',
        'who can see',
        'gdpr',
        'row level',
        'another user',
        'someone else',
        'other traders data',
        'other people',
      ],
      fr: [
        'confidentialite',
        'mes donnees',
        'securite',
        'qui peut voir',
        'rgpd',
        'protection',
        'un autre utilisateur',
        'quelqu un d autre',
      ],
      ar: [
        'الخصوصية',
        'بياناتي',
        'الامان',
        'من يمكنه رؤية',
        'حماية البيانات',
        'مستخدم اخر',
        'شخص اخر',
      ],
    },
    answer: {
      en: 'Your data is scoped to you with row-level security in the database, so no one — including me — can read another account’s trades. Psychology entries and personal notes are private by construction and are never exposed to workspace admins without your explicit opt-in.',
      fr: 'Vos données vous sont strictement rattachées par la sécurité au niveau des lignes dans la base. Les entrées de psychologie et les notes personnelles sont privées par conception et ne sont jamais visibles par les administrateurs d’espace de travail sans votre accord explicite.',
      ar: 'بياناتك مقصورة عليك عبر أمان على مستوى الصفوف في قاعدة البيانات. سجلات علم النفس والملاحظات الشخصية خاصة بحكم التصميم، ولا تظهر لمشرفي مساحة العمل إطلاقاً دون موافقتك الصريحة.',
    },
  },
  {
    id: 'ai_coach',
    href: '/products#ai-coach',
    keywords: {
      en: ['ai coach', 'coach', 'ai review', 'insights', 'does the ai'],
      fr: ['coach ia', 'coach', 'revue ia', 'analyse ia', 'intelligence artificielle'],
      ar: ['المدرب', 'الذكاء الاصطناعي', 'مراجعة الذكاء', 'تحليل ذكي'],
    },
    answer: {
      en: 'The AI coach reviews your logged trades and cites the specific trades behind each observation, so you can check its reasoning. It never issues buy or sell calls, and its output passes a safety filter before you see it.',
      fr: 'Le coach IA analyse vos trades enregistrés et cite les trades précis qui fondent chaque observation, pour que vous puissiez vérifier son raisonnement. Il ne donne jamais de recommandation d’achat ou de vente, et sa sortie passe un filtre de sécurité avant de vous être présentée.',
      ar: 'يراجع المدرّب الذكي صفقاتك المسجّلة ويستشهد بالصفقات المحددة وراء كل ملاحظة، لتتمكن من التحقق من استنتاجه. ولا يصدر أبداً توصيات بالشراء أو البيع، وتمر مخرجاته على مرشّح أمان قبل عرضها عليك.',
    },
  },
  {
    id: 'analytics',
    href: '/products#analytics',
    keywords: {
      en: [
        'analytics',
        'win rate',
        'profit factor',
        'expectancy',
        'drawdown',
        'equity curve',
        'statistics',
      ],
      fr: [
        'statistiques',
        'analytique',
        'taux de reussite',
        'facteur de profit',
        'esperance',
        'drawdown',
        'courbe',
      ],
      ar: [
        'التحليلات',
        'نسبة الربح',
        'معامل الربح',
        'التوقع',
        'التراجع',
        'منحنى الاسهم',
        'احصائيات',
      ],
    },
    answer: {
      en: 'Win rate, profit factor, expectancy, average R, drawdown and the equity curve all come from one server-side calculation engine, the same one behind your journal — so the figures reconcile across every screen.',
      fr: 'Le taux de réussite, le facteur de profit, l’espérance, le R moyen, le drawdown et la courbe de capital proviennent tous d’un même moteur de calcul côté serveur, celui du journal — les chiffres concordent donc d’un écran à l’autre.',
      ar: 'تأتي نسبة الصفقات الرابحة ومعامل الربح والتوقع ومتوسط R والتراجع ومنحنى رأس المال جميعها من محرك حساب واحد على الخادم، وهو المحرك نفسه خلف دفترك — لذا تتطابق الأرقام في كل شاشة.',
    },
  },
  {
    id: 'journal',
    href: '/products#journal',
    keywords: {
      en: ['journal', 'log a trade', 'add trade', 'pnl', 'r multiple', 'notes', 'screenshot'],
      fr: [
        'journal',
        'saisir un trade',
        'ajouter un trade',
        'pnl',
        'multiple r',
        'notes',
        'capture',
      ],
      ar: ['الدفتر', 'تسجيل صفقة', 'اضافة صفقة', 'الارباح', 'مضاعف r', 'ملاحظات', 'لقطة شاشة'],
    },
    answer: {
      en: 'The journal records entries, exits, fees and context, and computes PnL, R multiple and risk-reward on the server using exact-numeric money. You can attach screenshots, tags and notes to every trade.',
      fr: 'Le journal enregistre les entrées, les sorties, les frais et le contexte, et calcule le PnL, le multiple R et le ratio risque-rendement côté serveur avec des montants exacts. Vous pouvez joindre des captures, des tags et des notes à chaque trade.',
      ar: 'يسجّل الدفتر نقاط الدخول والخروج والرسوم والسياق، ويحسب الربح والخسارة ومضاعف R ونسبة المخاطرة إلى العائد على الخادم بأرقام دقيقة. ويمكنك إرفاق لقطات شاشة ووسوم وملاحظات بكل صفقة.',
    },
  },
  {
    /*
     * SPLIT FROM REPLAY DELIBERATELY. Replay is shipped and backtesting is not
     * (`COMING_SOON`), and the two are easy to confuse — a merged answer made
     * it harder to state, in one sentence, which of the three exists.
     */
    id: 'playbook',
    href: '/products',
    keywords: {
      en: ['playbook', 'playbooks', 'strategy', 'strategies', 'rules', 'adherence', 'checklist'],
      fr: ['playbook', 'strategie', 'strategies', 'regles', 'discipline de regles', 'checklist'],
      ar: ['الاستراتيجية', 'الاستراتيجيات', 'القواعد', 'قائمة التحقق', 'دفتر الاستراتيجيات'],
    },
    answer: {
      en: 'Playbooks are versioned and become immutable once a trade has used them, so history cannot be rewritten. Adherence to their rules is measured at the time of the trade, and per-playbook performance is reported from those results. Playbooks are on the paid plans.',
      fr: 'Les playbooks sont versionnés et deviennent immuables dès qu’un trade les a utilisés : l’historique ne peut pas être réécrit. Le respect de leurs règles est mesuré au moment du trade, et la performance par playbook en découle. Les playbooks font partie des formules payantes.',
      ar: 'دفاتر الاستراتيجيات مُصدَّرة بإصدارات وتصبح ثابتة بمجرد استخدامها في صفقة، فلا يمكن إعادة كتابة السجل. ويُقاس الالتزام بقواعدها لحظة تنفيذ الصفقة، ومنه يُحتسب أداء كل دفتر. وهي متاحة ضمن الخطط المدفوعة.',
    },
  },
  {
    id: 'replay',
    href: '/products',
    keywords: {
      en: ['replay', 'bar by bar', 'replay a session', 'historical session', 'step through'],
      fr: ['replay', 'rejouer', 'barre par barre', 'seance historique', 'revoir une seance'],
      ar: ['اعادة التشغيل', 'شمعة بشمعة', 'جلسة تاريخية', 'مراجعة الجلسة'],
    },
    answer: {
      en: 'Trade replay is shipped and available on the paid plans. It steps through real historical sessions bar by bar so you can review how a setup actually developed. It replays recorded history — it is not a backtester and does not simulate hypothetical strategies.',
      fr: 'Le replay est disponible et inclus dans les formules payantes. Il parcourt des séances historiques réelles barre par barre pour revoir comment un setup s’est réellement déroulé. Il rejoue un historique enregistré : ce n’est pas un backtester et il ne simule pas de stratégies hypothétiques.',
      ar: 'إعادة تشغيل الصفقات متاحة فعلياً ضمن الخطط المدفوعة، وتستعرض جلسات تاريخية حقيقية شمعة بشمعة لمراجعة كيفية تطوّر الإعداد. وهي تعيد تشغيل سجل مسجَّل، وليست أداة اختبار تاريخي ولا تحاكي استراتيجيات افتراضية.',
    },
  },
  {
    id: 'calendar',
    href: '/products',
    keywords: {
      en: ['calendar', 'performance calendar', 'by day', 'by session', 'by hour', 'streak'],
      fr: ['calendrier', 'par jour', 'par seance', 'par heure', 'serie'],
      ar: ['التقويم', 'حسب اليوم', 'حسب الجلسة', 'حسب الساعة', 'سلسلة'],
    },
    answer: {
      en: 'The performance calendar breaks your results down by day, trading session and hour, and it is timezone-correct and DST-aware. Streaks are computed from the same trade data as everything else rather than tracked separately.',
      fr: 'Le calendrier de performance décompose vos résultats par jour, par séance et par heure, en tenant compte du fuseau horaire et des changements d’heure. Les séries sont calculées à partir des mêmes données de trades que le reste, et non suivies séparément.',
      ar: 'يفصّل تقويم الأداء نتائجك حسب اليوم وجلسة التداول والساعة، مع مراعاة المنطقة الزمنية والتوقيت الصيفي. وتُحتسب السلاسل من بيانات الصفقات نفسها المستخدمة في بقية التطبيق، لا بتتبّع منفصل.',
    },
  },
  {
    id: 'psychology',
    href: '/products',
    keywords: {
      en: ['psychology', 'emotions', 'discipline', 'discipline score', 'habits', 'mindset'],
      fr: ['psychologie', 'emotions', 'discipline', 'score de discipline', 'habitudes', 'mental'],
      ar: ['علم النفس', 'المشاعر', 'الانضباط', 'درجة الانضباط', 'العادات'],
    },
    answer: {
      en: 'Psychology tracking records the emotions and habits around each trade and turns them into a transparent discipline score that rewards process rather than profit. Those entries are private by construction and are never shown to workspace admins without your explicit opt-in.',
      fr: 'Le suivi psychologique enregistre les émotions et les habitudes autour de chaque trade et les traduit en un score de discipline transparent qui récompense le processus plutôt que le gain. Ces entrées sont privées par conception et ne sont jamais visibles par les administrateurs d’espace de travail sans votre accord explicite.',
      ar: 'تسجّل متابعة الجانب النفسي المشاعر والعادات المحيطة بكل صفقة وتحوّلها إلى درجة انضباط شفافة تكافئ الالتزام بالمنهج لا الربح. وهذه السجلات خاصة بحكم التصميم ولا تُعرض على مشرفي مساحة العمل دون موافقتك الصريحة.',
    },
  },
  {
    id: 'workspaces',
    href: '/products',
    keywords: {
      en: ['workspace', 'workspaces', 'team', 'invite', 'collaborate', 'mentor', 'members'],
      fr: ['espace de travail', 'equipe', 'inviter', 'collaborer', 'mentor', 'membres'],
      ar: ['مساحة العمل', 'فريق', 'دعوة', 'تعاون', 'اعضاء'],
    },
    answer: {
      en: 'Workspaces let you collaborate by reference — members see what you share, not your whole account. Personal psychology data is never exposed to workspace admins by default, and roles decide what each member can reach.',
      fr: 'Les espaces de travail permettent de collaborer par référence : les membres voient ce que vous partagez, pas l’intégralité de votre compte. Les données psychologiques personnelles ne sont jamais exposées aux administrateurs par défaut, et les rôles déterminent ce que chaque membre peut atteindre.',
      ar: 'تتيح مساحات العمل التعاون بالإحالة: يرى الأعضاء ما تشاركه أنت، لا حسابك بالكامل. ولا تُكشف بيانات الجانب النفسي الشخصية لمشرفي مساحة العمل افتراضياً، وتحدد الأدوار ما يمكن لكل عضو الوصول إليه.',
    },
  },
  {
    id: 'reports',
    href: '/products#reports',
    keywords: {
      en: ['report', 'reports', 'export', 'share a report', 'pdf'],
      fr: ['rapport', 'rapports', 'exporter', 'partager un rapport', 'pdf'],
      ar: ['تقرير', 'التقارير', 'تصدير', 'مشاركة تقرير'],
    },
    answer: {
      en: 'Reports are composed from the same verified figures as the rest of the app, and you control what each one contains. Export is on the paid plans; shareable links are a Pro-level feature and are withheld during a trial.',
      fr: 'Les rapports sont composés à partir des mêmes chiffres vérifiés que le reste de l’application, et vous décidez de leur contenu. L’export est inclus dans les formules payantes ; les liens partageables relèvent du niveau Pro et sont exclus pendant l’essai.',
      ar: 'تُبنى التقارير من الأرقام الموثّقة نفسها المستخدمة في بقية التطبيق، وأنت من يحدد محتوى كل تقرير. التصدير متاح في الخطط المدفوعة، أما روابط المشاركة فهي ضمن مستوى Pro وغير متاحة خلال الفترة التجريبية.',
    },
  },
  {
    id: 'coming_soon',
    keywords: {
      en: [
        'backtest',
        'backtesting',
        'prop firm',
        'prop-firm',
        'funded challenge rules',
        'roadmap',
      ],
      fr: ['backtest', 'backtesting', 'prop firm', 'regles prop firm', 'feuille de route'],
      ar: ['اختبار تاريخي', 'باك تست', 'شركات التمويل', 'قواعد التحدي', 'خارطة الطريق'],
    },
    answer: {
      en: `These are not built yet and are not sold as part of any plan: ${COMING_SOON_LIST}. I would rather tell you that than let you subscribe expecting them.`,
      fr: `Ces fonctionnalités n’existent pas encore et ne sont vendues dans aucune formule : ${COMING_SOON_LIST}. Je préfère vous le dire plutôt que vous laisser souscrire en les attendant.`,
      ar: `هذه الميزات غير مُنجزة بعد ولا تُباع ضمن أي خطة: ${COMING_SOON_LIST}. أُفضّل إخبارك بذلك على أن تشترك وأنت تتوقعها.`,
    },
  },
  {
    id: 'account_access',
    escalate: true,
    category: 'login_account',
    keywords: {
      en: [
        'cannot log in',
        'can t log in',
        'locked out',
        'reset my password',
        'forgot password',
        'verify my email',
      ],
      fr: [
        'je ne peux pas me connecter',
        'connexion impossible',
        'mot de passe oublie',
        'reinitialiser mot de passe',
        'verifier mon email',
      ],
      ar: [
        'لا استطيع تسجيل الدخول',
        'نسيت كلمة المرور',
        'اعادة تعيين كلمة المرور',
        'حسابي مقفل',
        'تاكيد البريد',
      ],
    },
    answer: {
      en: 'Start with the "Forgot password" link on the sign-in page, which emails a reset link to the address on the account. If that does not arrive or the account is locked, a person needs to look at it — and never send your password here.',
      fr: 'Commencez par le lien « Mot de passe oublié » sur la page de connexion : un lien de réinitialisation est envoyé à l’adresse du compte. Si vous ne le recevez pas ou si le compte est bloqué, un conseiller doit intervenir — et n’envoyez jamais votre mot de passe ici.',
      ar: 'ابدأ برابط «نسيت كلمة المرور» في صفحة تسجيل الدخول، حيث يُرسَل رابط إعادة التعيين إلى بريد الحساب. إذا لم يصلك أو كان الحساب مقفلاً، فسيحتاج الأمر إلى شخص من الفريق — ولا ترسل كلمة مرورك هنا أبداً.',
    },
  },
  {
    id: 'billing_issue',
    escalate: true,
    category: 'billing_subscription',
    href: '/pricing',
    keywords: {
      en: [
        'refund',
        'charged twice',
        'cancel my subscription',
        'invoice',
        'payment failed',
        'billing problem',
      ],
      fr: [
        'remboursement',
        'debite deux fois',
        'annuler mon abonnement',
        'facture',
        'paiement refuse',
        'probleme de facturation',
      ],
      ar: ['استرداد', 'خصم مرتين', 'الغاء الاشتراك', 'فاتورة', 'فشل الدفع', 'مشكلة في الفوترة'],
    },
    answer: {
      en: 'Anything touching a charge — a refund, a duplicate payment, a cancellation — is handled by a person, not by me. Send the date of the payment and the email on the account, and never a card number.',
      fr: 'Tout ce qui touche à un paiement — remboursement, double débit, annulation — est traité par un conseiller, pas par moi. Indiquez la date du paiement et l’e-mail du compte, jamais un numéro de carte.',
      ar: 'كل ما يتعلق بعملية دفع — استرداد أو خصم مكرر أو إلغاء — يتولاه شخص من الفريق وليس أنا. أرسل تاريخ الدفع والبريد الإلكتروني المرتبط بالحساب، ولا ترسل رقم البطاقة أبداً.',
    },
  },
  {
    id: 'security_concern',
    escalate: true,
    category: 'security',
    keywords: {
      en: [
        'hacked',
        'unauthorized access',
        'suspicious login',
        'report a vulnerability',
        'phishing',
        'compromised',
      ],
      fr: [
        'pirate',
        'acces non autorise',
        'connexion suspecte',
        'signaler une faille',
        'hameconnage',
        'compromis',
      ],
      ar: ['اختراق', 'دخول غير مصرح', 'تسجيل دخول مشبوه', 'ثغرة امنية', 'تصيد', 'حساب مخترق'],
    },
    answer: {
      en: 'Please raise this with the support team right away rather than with me. Do not paste credentials, tokens or recovery codes into this chat — MetaTradee support will never ask for them.',
      fr: 'Signalez-le immédiatement à l’équipe support plutôt qu’à moi. Ne collez ni identifiants, ni jetons, ni codes de récupération dans cette fenêtre — le support MetaTradee ne vous les demandera jamais.',
      ar: 'يرجى إبلاغ فريق الدعم بهذا فوراً بدلاً من مناقشته معي. ولا تلصق بيانات دخول أو رموزاً أو أكواد استرداد في هذه المحادثة — فريق دعم MetaTradee لن يطلبها منك مطلقاً.',
    },
  },
  {
    id: 'human_support',
    escalate: true,
    offerHandled: true,
    href: '/support',
    keywords: {
      en: [
        'talk to a person',
        'human',
        'real person',
        'contact support',
        'speak to someone',
        'agent',
      ],
      fr: [
        'parler a un conseiller',
        'un humain',
        'une vraie personne',
        'contacter le support',
        'quelqu un',
      ],
      ar: ['التحدث الى شخص', 'موظف', 'انسان حقيقي', 'التواصل مع الدعم', 'خدمة العملاء'],
    },
    answer: {
      en: 'Of course — I can pass this to the support team, and a person will reply by email.',
      fr: 'Bien sûr — je peux transmettre votre demande à l’équipe support, et un conseiller vous répondra par e-mail.',
      ar: 'بالطبع — يمكنني تحويل طلبك إلى فريق الدعم، وسيرد عليك أحد أفراده عبر البريد الإلكتروني.',
    },
  },
];

/* ------------------------------------------------------------------ *
 * Matching
 * ------------------------------------------------------------------ */

/**
 * Fold a message into a comparable form.
 *
 * Latin text loses its accents so "coûtent" matches "coutent". Arabic loses
 * its diacritics and has its alef/ya/ta-marbuta variants unified, because a
 * visitor types "استيراد" or "الاستيراد" or "إستيراد" interchangeably and all
 * three must reach the same topic. Punctuation becomes whitespace using a
 * Unicode-aware class — `\W` would delete every Arabic character.
 */
export function normalizeForMatch(input: string): string {
  return (
    input
      .normalize('NFD')
      // Latin combining marks left behind by NFD.
      .replace(/[\u0300-\u036F]/g, '')
      .toLowerCase()
      // Arabic tashkeel, superscript alef, and tatweel padding.
      .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
      // Alef variants -> bare alef.
      .replace(/[\u0622\u0623\u0625\u0671]/g, '\u0627')
      // Alef maqsura -> ya, ta marbuta -> ha.
      .replace(/\u0649/g, '\u064A')
      .replace(/\u0629/g, '\u0647')
      // Unicode-aware: `\W` would delete every Arabic character.
      .replace(/[^\p{L}\p{N}]+/gu, ' ')
      .trim()
  );
}

export interface TopicMatch {
  topic: KnowledgeTopic;
  /** Length of the matched keywords. Longer phrases beat single words. */
  score: number;
}

/**
 * Shortest keyword that may select a topic on its own.
 *
 * THIS WAS A BUG WORTH THE COMMENT. The threshold used to be 4, which silently
 * disqualified `mt4`, `mt5` and `csv` — three of the most specific terms a
 * MetaTradee visitor can type. They were declared as keywords, they looked
 * correct in review, and they could never match. Three characters is the floor
 * because those product tokens are three characters; below that a match is
 * coincidence rather than intent.
 */
const MIN_KEYWORD_LENGTH = 3;

/**
 * Best-matching approved topic, or null.
 *
 * Scoring is by matched keyword LENGTH, not count: "what is metatradee" beating
 * a stray "plan" is the behaviour that matters, and counting hits would let a
 * message that happens to contain three short words outrank an exact phrase.
 */
export function findTopic(message: string): TopicMatch | null {
  const haystack = ` ${normalizeForMatch(message)} `;
  let best: TopicMatch | null = null;

  for (const topic of KNOWLEDGE_TOPICS) {
    let score = 0;
    for (const keywords of Object.values(topic.keywords)) {
      for (const keyword of keywords) {
        const needle = normalizeForMatch(keyword);
        if (needle.length < MIN_KEYWORD_LENGTH) continue;
        /*
         * The second form allows a match that starts mid-word but ends on a
         * boundary. That is deliberate and it is for Arabic, where the article
         * and prepositions attach to the noun — "الاستيراد" has to reach the
         * same topic as "استيراد".
         */
        if (haystack.includes(` ${needle} `) || haystack.includes(`${needle} `)) {
          score = Math.max(score, needle.length);
        }
      }
    }
    if (score > 0 && (!best || score > best.score)) best = { topic, score };
  }

  return best;
}

/** The approved answer for a topic in one language. */
export function answerFor(topic: KnowledgeTopic, locale: SupportChatLocale): string {
  return topic.answer[locale];
}

/**
 * Every approved passage, for the grounding check in `server/answer.ts`. A
 * model rephrasing an answer may only use what is in here.
 */
export function passagesFor(locale: SupportChatLocale): string[] {
  return KNOWLEDGE_TOPICS.map((t) => t.answer[locale]);
}
