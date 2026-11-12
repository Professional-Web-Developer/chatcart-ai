import type { ChatMessage } from './types';

/**
 * Server-side confirmation guard for money-moving owner actions (refund, invoice).
 *
 * The model's `confirmed: true` flag is never trusted on its own: text written by customers (order notes,
 * quote descriptions, names) reaches the owner model through tool results and could try to steer it.
 * An action is allowed only when BOTH hold, judged purely from the conversation the owner's browser sent:
 *  1. the message right before the owner's latest one is an assistant message that named the exact
 *     thing being confirmed (order code / invoice amount and email), i.e. the owner actually saw it; and
 *  2. the owner's latest message is a clear yes (and not a no).
 */
const YES = /\b(yes|yep|yeah|yup|confirm|confirmed|confirming|go ahead|do it|proceed|ok|okay|sure|approve|approved|please do|send it|refund it)\b/i;
const NO = /\b(no|nope|don't|dont|do not|cancel|stop|wait|hold on|not yet|never mind|nevermind)\b/i;

export function isAffirmative(text: string): boolean {
  const t = text.trim();
  return t.length > 0 && t.length <= 200 && YES.test(t) && !NO.test(t);
}

/** Every money amount / number written in a text, in integer cents. */
export function amountsInText(text: string): number[] {
  const out: number[] = [];
  for (const m of text.matchAll(/\d[\d,]*(?:\.\d+)?/g)) {
    const n = Number(m[0].replace(/,/g, ''));
    if (Number.isFinite(n)) out.push(Math.round(n * 100));
  }
  return out;
}

export type Need = { text?: string[]; amountCents?: number };

export function confirmationProblem(messages: ChatMessage[], need: Need): string | null {
  const last = messages[messages.length - 1];
  const prev = messages[messages.length - 2];
  if (!last || last.role !== 'user' || !prev || prev.role !== 'assistant') {
    return 'state the exact details to the owner and ask them to confirm in a follow-up message first.';
  }
  const shown = prev.content.toLowerCase();
  for (const t of need.text ?? []) {
    if (!t.trim() || !shown.includes(t.trim().toLowerCase())) {
      return `your previous message did not show "${t}" to the owner. State the exact details and ask them to confirm.`;
    }
  }
  if (need.amountCents !== undefined && !amountsInText(prev.content).includes(need.amountCents)) {
    return 'your previous message did not show this exact amount to the owner. State the exact amount and ask them to confirm.';
  }
  if (!isAffirmative(last.content)) return "the owner's latest message is not a clear yes. Ask them to confirm.";
  return null;
}
