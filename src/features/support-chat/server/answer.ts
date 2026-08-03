/**
 * The answer engine — SERVER ONLY.
 *
 * THE MODEL IS AN OPTIONAL REPHRASER, NEVER THE SOURCE OF TRUTH. The pipeline
 * is: redact → match an approved topic → answer from that topic. A model is
 * consulted only when one is configured, only with the matched passage in
 * front of it, and only as a rewrite of that passage — and its output is
 * discarded unless it survives the grounding check below. With no provider
 * configured (the state this repository is in today) the chatbot answers
 * entirely deterministically and is none the worse for it.
 *
 * THE THREE THINGS THAT MUST BE IMPOSSIBLE:
 *
 *   1. Answering a product question with something not in `knowledge.ts`.
 *      `isGrounded` rejects any rewrite that introduces a number or a link the
 *      approved passage did not contain — the exact shape a hallucinated price
 *      or a fabricated broker takes.
 *
 *   2. Giving trading advice. `enforceSafety` — the same guardrail the AI Coach
 *      uses — runs on every model rewrite, and any violation drops the rewrite
 *      rather than scrubbing it into something half-true.
 *
 *   3. Forwarding a credential. `redactSecrets` runs BEFORE the text reaches a
 *      model or a log, so a pasted API key never leaves this process.
 */
import 'server-only';
import { enforceSafety } from '@/features/ai-coach/safety';
import { getProviderForTask, isMockActive, resolveConfig } from '@/features/ai-coach/providers';
import { findTopic } from '../knowledge';
import { redactSecrets } from '../redaction';
import { dictionaryFor } from '../translations';
import type { ChatReply, SupportChatLocale } from '../types';

export interface AnswerInput {
  locale: SupportChatLocale;
  messages: { role: 'user' | 'assistant'; content: string }[];
}

/** How the model is told which language to answer in. */
const LANGUAGE_NAME: Record<SupportChatLocale, string> = {
  en: 'English',
  fr: 'French',
  ar: 'Arabic',
};

/** A support answer is short. This also bounds the cost of a rewrite. */
const MAX_OUTPUT_TOKENS = 320;
const MODEL_TIMEOUT_MS = 8_000;

/**
 * Every number in the rewrite must already appear in the approved passage or
 * in the visitor's own question.
 *
 * This is the cheapest check that catches the failure that actually matters. A
 * model asked to rephrase "Trader — $19 per month" and answering "$19.99" or
 * "$29" has invented a price, and no amount of prompt wording reliably prevents
 * it. Links are treated the same way: a URL the passage did not contain is a
 * fabricated one.
 */
export function isGrounded(candidate: string, source: string, question: string): boolean {
  if (candidate.trim().length === 0) return false;
  // A rewrite that grows without bound is no longer a rewrite.
  if (candidate.length > source.length * 2 + 200) return false;

  const allowed = `${source} ${question}`;
  const allowedNumbers = new Set(allowed.match(/\d+/g) ?? []);
  for (const number of candidate.match(/\d+/g) ?? []) {
    if (!allowedNumbers.has(number)) return false;
  }

  for (const url of candidate.match(/https?:\/\/\S+/gi) ?? []) {
    if (!allowed.includes(url)) return false;
  }

  return true;
}

const SYSTEM_PROMPT_HEAD = [
  'You are the MetaTradee Assistant, a support assistant for the MetaTradee trading-journal product.',
  'You will be given ONE approved passage and a visitor question.',
  'Rewrite the passage as a direct, friendly answer to that question.',
  '',
  'RULES, in order of importance:',
  '1. Use ONLY facts contained in the approved passage. Never add a price, a number, a date, a broker name, a feature or a link that is not in it.',
  '2. If the passage does not answer the question, say plainly that you do not have that information.',
  '3. Never give trading advice, buy or sell calls, price predictions, or any promise about returns.',
  '4. Never ask for a password, an API key, a token or a card number.',
  '5. Two or three sentences. No preamble, no markdown, no bullet points.',
].join('\n');

function systemPrompt(locale: SupportChatLocale): string {
  return `${SYSTEM_PROMPT_HEAD}\n6. Answer in ${LANGUAGE_NAME[locale]}, and in that language only.`;
}

/**
 * Ask the configured model to rephrase one approved passage.
 *
 * Returns null on ANY doubt — no provider, a transport failure, a timeout, a
 * safety violation, or a failed grounding check. The caller then serves the
 * approved passage verbatim, so a model problem degrades the tone of the answer
 * and never its accuracy.
 */
async function rephrase(
  passage: string,
  question: string,
  locale: SupportChatLocale,
): Promise<string | null> {
  if (isMockActive(resolveConfig())) return null;

  try {
    // Cheap tier: a support rewrite is high-volume and low-complexity, which is
    // exactly the split the router's task classes already encode.
    const provider = getProviderForTask('trade_review');
    const result = await provider.generate({
      system: systemPrompt(locale),
      messages: [
        {
          role: 'user',
          content: `APPROVED PASSAGE:\n${passage}\n\nVISITOR QUESTION:\n${question}`,
        },
      ],
      maxTokens: MAX_OUTPUT_TOKENS,
      temperature: 0.2,
      timeoutMs: MODEL_TIMEOUT_MS,
    });

    const safety = enforceSafety(result.text.trim());
    if (!safety.safe) return null;
    if (!isGrounded(safety.text, passage, question)) return null;
    return safety.text;
  } catch {
    /*
     * Swallowed on purpose and NOT logged with its message: the adapter's error
     * text can carry request content. The consequence is invisible to the user
     * — they get the approved answer instead of a rewritten one.
     */
    return null;
  }
}

/** The last thing the visitor said. Assistant turns are context, not questions. */
function lastUserMessage(messages: AnswerInput['messages']): string | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    if (message?.role === 'user' && message.content.trim().length > 0) return message.content;
  }
  return null;
}

export async function composeAnswer(input: AnswerInput): Promise<ChatReply> {
  const t = dictionaryFor(input.locale);
  const raw = lastUserMessage(input.messages);

  if (!raw) {
    return {
      reply: t.assistant.noMatch,
      source: 'no_match',
      topicId: null,
      suggestEscalation: true,
      href: null,
    };
  }

  /*
   * REDACT FIRST. Everything after this line works on the cleaned text, so a
   * pasted key cannot reach the matcher, the model, or a log line.
   */
  const { text: question, found: hadSecret } = redactSecrets(raw);

  if (hadSecret) {
    return {
      reply: `${t.assistant.secretDetected}\n\n${t.assistant.escalationOffer}`,
      source: 'guardrail',
      topicId: null,
      suggestEscalation: true,
      href: null,
    };
  }

  const match = findTopic(question);

  if (!match) {
    return {
      reply: `${t.assistant.noMatch}\n\n${t.assistant.escalationOffer}`,
      source: 'no_match',
      topicId: null,
      suggestEscalation: true,
      href: null,
    };
  }

  const approved = match.topic.answer[input.locale];
  const rewritten = await rephrase(approved, question, input.locale);
  const suggestEscalation = match.topic.escalate === true;
  const body = rewritten ?? approved;

  return {
    reply: suggestEscalation ? `${body}\n\n${t.assistant.escalationOffer}` : body,
    source: rewritten ? 'grounded_model' : 'knowledge',
    topicId: match.topic.id,
    suggestEscalation,
    href: match.topic.href ?? null,
  };
}
