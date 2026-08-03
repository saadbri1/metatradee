/**
 * Chatbot translations — English, French, Arabic.
 *
 * LOCAL AND TYPED, NOT A FRAMEWORK. There is no `next-intl` or `i18next` here
 * on purpose: the site is English, and only this one widget is multilingual.
 * Adding a global translation runtime to serve a single component would put a
 * provider, a middleware locale segment and a routing change into every page in
 * exchange for nothing the widget cannot get from a plain object.
 *
 * THE TYPE IS THE COMPLETENESS CHECK. `SUPPORT_CHAT_TRANSLATIONS` is a
 * `Record<SupportChatLocale, SupportChatDictionary>`, so a key added to English
 * and forgotten in Arabic is a compile error, not a string that silently falls
 * back to English at runtime. The same applies to the support categories below:
 * they are keyed by `SupportCategory`, so adding one to the contact schema
 * without translating it will not build.
 *
 * SHARED WITH THE SERVER. The chat endpoint composes its own replies — "no
 * approved answer", the credential warning — from this same file, so a user
 * writing in French is never answered in English by the machinery rather than
 * by the content.
 */
import type { SupportCategory } from '@/features/contact/schemas';
import { SUPPORT_CHAT_LOCALES, type SupportChatLocale } from './types';

/** The four seeded openers. Ids are stable; labels and prompts are translated. */
export const QUICK_ACTION_IDS = ['what_is', 'pricing', 'import', 'human'] as const;
export type QuickActionId = (typeof QUICK_ACTION_IDS)[number];

export interface QuickAction {
  id: QuickActionId;
  /** Button text. */
  label: string;
  /** What is actually sent as the user's turn when the button is pressed. */
  prompt: string;
}

export interface SupportChatDictionary {
  /** Native name of this language, for the selector. Never translated. */
  languageName: string;

  launcher: {
    /** Visible label on wide screens and the accessible name everywhere. */
    label: string;
    open: string;
    close: string;
  };

  assistantName: string;
  /** Honest availability line. It describes what the bot can do, not uptime. */
  availability: string;
  /** States plainly that this is not a person. */
  disclosure: string;

  welcome: string;
  quickActionsLabel: string;
  quickActions: QuickAction[];

  inputLabel: string;
  inputPlaceholder: string;
  send: string;
  /** Shown under the composer, always visible. */
  privacyWarning: string;

  loading: string;
  typing: string;
  offline: string;
  error: string;
  retry: string;

  /** Assistant-authored lines composed by the server, not by a model. */
  assistant: {
    /** No approved answer matched the question. */
    noMatch: string;
    /** The message looked like it contained a credential. */
    secretDetected: string;
    /** Appended when a human would serve the user better. */
    escalationOffer: string;
    /** Requests for trade calls or predictions. */
    adviceRefusal: string;
  };

  escalation: {
    /** Button that opens the form. */
    open: string;
    title: string;
    lede: string;
    back: string;
    includeTranscript: string;
    transcriptNote: string;
    /** Heading above the attached transcript in the email body. */
    transcriptHeading: string;
    /** Note when older turns did not fit. `{count}` is substituted. */
    transcriptTrimmed: string;
    submit: string;
    sending: string;
    /** Only ever shown after the server confirms a real send. */
    success: string;
    /** Sending is unavailable. Followed by the direct address. */
    failure: string;
    fallbackPrefix: string;
  };

  form: {
    name: string;
    email: string;
    subject: string;
    category: string;
    message: string;
    consent: string;
  };

  categories: Record<SupportCategory, string>;

  validation: {
    name: string;
    email: string;
    subject: string;
    message: string;
    consent: string;
    generic: string;
  };

  languageSelector: {
    label: string;
    /** Native names, keyed by locale. A language list is never translated. */
    options: Record<SupportChatLocale, string>;
  };

  messages: {
    /** Accessible name of the transcript region. */
    log: string;
    you: string;
  };
}

const LANGUAGE_NAMES: Record<SupportChatLocale, string> = {
  en: 'English',
  fr: 'Français',
  ar: 'العربية',
};

const en: SupportChatDictionary = {
  languageName: LANGUAGE_NAMES.en,
  launcher: {
    label: 'Ask MetaTradee',
    open: 'Open the MetaTradee Assistant',
    close: 'Close the MetaTradee Assistant',
  },
  assistantName: 'MetaTradee Assistant',
  availability: 'Answers from MetaTradee’s approved product information',
  disclosure: 'Automated assistant — ask for a person at any point.',
  welcome: 'Hi! I’m the MetaTradee Assistant. How can I help you today?',
  quickActionsLabel: 'Common questions',
  quickActions: [
    { id: 'what_is', label: 'What is MetaTradee?', prompt: 'What is MetaTradee?' },
    { id: 'pricing', label: 'Pricing and plans', prompt: 'What do the plans cost?' },
    {
      id: 'import',
      label: 'Import my trades',
      prompt: 'Can I import my trade history from my broker?',
    },
    { id: 'human', label: 'Talk to a person', prompt: 'I would like to talk to a person.' },
  ],
  inputLabel: 'Your message',
  inputPlaceholder: 'Ask about MetaTradee…',
  send: 'Send',
  privacyWarning: 'Do not share passwords or API keys.',
  loading: 'Looking that up…',
  typing: 'MetaTradee Assistant is replying',
  offline: 'You appear to be offline. Your message has not been sent.',
  error: 'Something went wrong on our side. Your message has not been sent.',
  retry: 'Try again',
  assistant: {
    noMatch:
      'I do not have an approved answer for that, and I will not guess. A person from the support team can help.',
    secretDetected:
      'That looked like a password or an API key, so I have not stored or forwarded it. Please never send credentials — MetaTradee support will never ask for them.',
    escalationOffer: 'Would you like me to pass this to the support team?',
    adviceRefusal:
      'MetaTradee does not give trading signals, buy or sell calls, or financial advice. I can explain what the product measures in your own trading data instead.',
  },
  escalation: {
    open: 'Contact support',
    title: 'Send this to MetaTradee Support',
    lede: 'A person will reply by email.',
    back: 'Back to the chat',
    includeTranscript: 'Include this conversation',
    transcriptNote: 'Your messages are attached so you do not have to repeat yourself.',
    transcriptHeading: 'Conversation with the MetaTradee Assistant',
    transcriptTrimmed: '(… {count} earlier messages omitted to fit the length limit)',
    submit: 'Send to support',
    sending: 'Sending…',
    success: 'Thanks — your request is on its way. We have sent a copy to your email address.',
    failure: 'We could not send that from here.',
    fallbackPrefix: 'Please email us directly at',
  },
  form: {
    name: 'Your name',
    email: 'Email address',
    subject: 'Subject',
    category: 'What do you need help with?',
    message: 'How can we help?',
    consent: 'I agree that MetaTradee may use the details above to reply to this request.',
  },
  categories: {
    login_account: 'Login and account',
    trade_import: 'Trade import',
    billing_subscription: 'Billing and subscription',
    technical: 'Technical problem',
    data_issue: 'Data issue',
    security: 'Security concern',
    other: 'Other',
  },
  validation: {
    name: 'Please tell us your name.',
    email: 'Please check this email address.',
    subject: 'Please add a short subject.',
    message: 'Please add a little more detail — it saves a round trip.',
    consent: 'Please confirm before sending.',
    generic: 'Please check the highlighted fields.',
  },
  languageSelector: { label: 'Language', options: LANGUAGE_NAMES },
  messages: { log: 'Conversation with the MetaTradee Assistant', you: 'You' },
};

const fr: SupportChatDictionary = {
  languageName: LANGUAGE_NAMES.fr,
  launcher: {
    label: 'Poser une question',
    open: 'Ouvrir l’assistant MetaTradee',
    close: 'Fermer l’assistant MetaTradee',
  },
  assistantName: 'Assistant MetaTradee',
  availability: 'Réponses issues des informations produit validées de MetaTradee',
  disclosure: 'Assistant automatisé — demandez un conseiller à tout moment.',
  welcome: 'Bonjour ! Je suis l’assistant MetaTradee. Comment puis-je vous aider aujourd’hui ?',
  quickActionsLabel: 'Questions fréquentes',
  quickActions: [
    { id: 'what_is', label: 'Qu’est-ce que MetaTradee ?', prompt: 'Qu’est-ce que MetaTradee ?' },
    { id: 'pricing', label: 'Tarifs et formules', prompt: 'Combien coûtent les formules ?' },
    {
      id: 'import',
      label: 'Importer mes trades',
      prompt: 'Puis-je importer mon historique de trades depuis mon courtier ?',
    },
    {
      id: 'human',
      label: 'Parler à un conseiller',
      prompt: 'Je souhaite parler à un conseiller.',
    },
  ],
  inputLabel: 'Votre message',
  inputPlaceholder: 'Posez une question sur MetaTradee…',
  send: 'Envoyer',
  privacyWarning: 'Ne partagez pas de mots de passe ni de clés API.',
  loading: 'Je cherche…',
  typing: 'L’assistant MetaTradee répond',
  offline: 'Vous semblez hors ligne. Votre message n’a pas été envoyé.',
  error: 'Une erreur est survenue de notre côté. Votre message n’a pas été envoyé.',
  retry: 'Réessayer',
  assistant: {
    noMatch:
      'Je n’ai pas de réponse validée à ce sujet et je ne vais pas deviner. Un conseiller de l’équipe support peut vous aider.',
    secretDetected:
      'Cela ressemblait à un mot de passe ou à une clé API : je ne l’ai ni conservé ni transmis. N’envoyez jamais d’identifiants — le support MetaTradee ne vous les demandera jamais.',
    escalationOffer: 'Souhaitez-vous que je transmette votre demande à l’équipe support ?',
    adviceRefusal:
      'MetaTradee ne donne ni signaux de trading, ni recommandations d’achat ou de vente, ni conseils financiers. Je peux en revanche vous expliquer ce que le produit mesure dans vos propres données.',
  },
  escalation: {
    open: 'Contacter le support',
    title: 'Envoyer au support MetaTradee',
    lede: 'Un conseiller vous répondra par e-mail.',
    back: 'Revenir à la conversation',
    includeTranscript: 'Joindre cette conversation',
    transcriptNote: 'Vos messages sont joints pour éviter de tout réécrire.',
    transcriptHeading: 'Conversation avec l’assistant MetaTradee',
    transcriptTrimmed: '(… {count} messages plus anciens omis pour tenir dans la limite)',
    submit: 'Envoyer au support',
    sending: 'Envoi…',
    success:
      'Merci — votre demande est en route. Nous en avons envoyé une copie à votre adresse e-mail.',
    failure: 'Nous n’avons pas pu envoyer votre demande depuis cette fenêtre.',
    fallbackPrefix: 'Écrivez-nous directement à',
  },
  form: {
    name: 'Votre nom',
    email: 'Adresse e-mail',
    subject: 'Objet',
    category: 'Sur quoi portez votre demande ?',
    message: 'Comment pouvons-nous vous aider ?',
    consent:
      'J’accepte que MetaTradee utilise les informations ci-dessus pour répondre à cette demande.',
  },
  categories: {
    login_account: 'Connexion et compte',
    trade_import: 'Import des trades',
    billing_subscription: 'Facturation et abonnement',
    technical: 'Problème technique',
    data_issue: 'Problème de données',
    security: 'Problème de sécurité',
    other: 'Autre',
  },
  validation: {
    name: 'Merci d’indiquer votre nom.',
    email: 'Merci de vérifier cette adresse e-mail.',
    subject: 'Merci d’ajouter un objet court.',
    message: 'Merci de préciser un peu — cela évite un aller-retour.',
    consent: 'Merci de confirmer avant l’envoi.',
    generic: 'Merci de vérifier les champs signalés.',
  },
  languageSelector: { label: 'Langue', options: LANGUAGE_NAMES },
  messages: { log: 'Conversation avec l’assistant MetaTradee', you: 'Vous' },
};

const ar: SupportChatDictionary = {
  languageName: LANGUAGE_NAMES.ar,
  launcher: {
    label: 'اسأل MetaTradee',
    open: 'فتح مساعد MetaTradee',
    close: 'إغلاق مساعد MetaTradee',
  },
  assistantName: 'مساعد MetaTradee',
  availability: 'إجابات مستندة إلى معلومات المنتج المعتمدة من MetaTradee',
  disclosure: 'مساعد آلي — يمكنك طلب التحدث إلى شخص في أي وقت.',
  welcome: 'مرحباً! أنا مساعد MetaTradee. كيف يمكنني مساعدتك اليوم؟',
  quickActionsLabel: 'أسئلة شائعة',
  quickActions: [
    { id: 'what_is', label: 'ما هو MetaTradee؟', prompt: 'ما هو MetaTradee؟' },
    { id: 'pricing', label: 'الأسعار والخطط', prompt: 'كم تكلفة الخطط؟' },
    {
      id: 'import',
      label: 'استيراد صفقاتي',
      prompt: 'هل يمكنني استيراد سجل صفقاتي من الوسيط؟',
    },
    { id: 'human', label: 'التحدث إلى شخص', prompt: 'أريد التحدث إلى شخص من فريق الدعم.' },
  ],
  inputLabel: 'رسالتك',
  inputPlaceholder: 'اسأل عن MetaTradee…',
  send: 'إرسال',
  privacyWarning: 'لا تشارك كلمات المرور أو مفاتيح API.',
  loading: 'جارٍ البحث…',
  typing: 'مساعد MetaTradee يكتب الرد',
  offline: 'يبدو أنك غير متصل بالإنترنت. لم يتم إرسال رسالتك.',
  error: 'حدث خطأ لدينا. لم يتم إرسال رسالتك.',
  retry: 'إعادة المحاولة',
  assistant: {
    noMatch:
      'لا تتوفر لدي إجابة معتمدة عن هذا السؤال، ولن أخمّن. يمكن لأحد أفراد فريق الدعم مساعدتك.',
    secretDetected:
      'بدا ذلك ككلمة مرور أو مفتاح API، لذلك لم أحتفظ به ولم أُرسله. لا ترسل بيانات الدخول أبداً — فريق دعم MetaTradee لن يطلبها منك مطلقاً.',
    escalationOffer: 'هل تريد أن أُحوّل هذا الطلب إلى فريق الدعم؟',
    adviceRefusal:
      'لا يقدّم MetaTradee إشارات تداول أو توصيات بالشراء أو البيع أو نصائح مالية. يمكنني بدلاً من ذلك أن أشرح ما يقيسه المنتج داخل بيانات تداولك.',
  },
  escalation: {
    open: 'التواصل مع الدعم',
    title: 'إرسال هذا إلى دعم MetaTradee',
    lede: 'سيرد عليك أحد أفراد الفريق عبر البريد الإلكتروني.',
    back: 'العودة إلى المحادثة',
    includeTranscript: 'إرفاق هذه المحادثة',
    transcriptNote: 'تُرفق رسائلك حتى لا تضطر إلى إعادة كتابتها.',
    transcriptHeading: 'محادثة مع مساعد MetaTradee',
    transcriptTrimmed: '(… تم حذف {count} من الرسائل الأقدم لتجاوز حد الطول)',
    submit: 'إرسال إلى الدعم',
    sending: 'جارٍ الإرسال…',
    success: 'شكراً لك — طلبك في طريقه إلينا. وأرسلنا نسخة إلى بريدك الإلكتروني.',
    failure: 'تعذّر إرسال طلبك من هنا.',
    fallbackPrefix: 'راسلنا مباشرة على',
  },
  form: {
    name: 'الاسم',
    email: 'البريد الإلكتروني',
    subject: 'الموضوع',
    category: 'ما الذي تحتاج المساعدة فيه؟',
    message: 'كيف يمكننا مساعدتك؟',
    consent: 'أوافق على أن يستخدم MetaTradee البيانات أعلاه للرد على هذا الطلب.',
  },
  categories: {
    login_account: 'تسجيل الدخول والحساب',
    trade_import: 'استيراد الصفقات',
    billing_subscription: 'الفوترة والاشتراك',
    technical: 'مشكلة تقنية',
    data_issue: 'مشكلة في البيانات',
    security: 'مسألة أمنية',
    other: 'أخرى',
  },
  validation: {
    name: 'يرجى كتابة اسمك.',
    email: 'يرجى التحقق من البريد الإلكتروني.',
    subject: 'يرجى إضافة موضوع قصير.',
    message: 'يرجى إضافة مزيد من التفاصيل — هذا يوفّر وقتاً على الجميع.',
    consent: 'يرجى التأكيد قبل الإرسال.',
    generic: 'يرجى مراجعة الحقول المحددة.',
  },
  languageSelector: { label: 'اللغة', options: LANGUAGE_NAMES },
  messages: { log: 'محادثة مع مساعد MetaTradee', you: 'أنت' },
};

export const SUPPORT_CHAT_TRANSLATIONS: Record<SupportChatLocale, SupportChatDictionary> = {
  en,
  fr,
  ar,
};

export function dictionaryFor(locale: SupportChatLocale): SupportChatDictionary {
  return SUPPORT_CHAT_TRANSLATIONS[locale];
}

/** The selector's options, in a stable order. */
export const LOCALE_OPTIONS: { value: SupportChatLocale; label: string }[] =
  SUPPORT_CHAT_LOCALES.map((value) => ({ value, label: LANGUAGE_NAMES[value] }));
