"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import type { ChatMessage } from "@/lib/types";
import { readError } from "./format";

export class HttpError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export type UIMessage = ChatMessage & { id: string; extra?: unknown };

type ReplyData = { reply: string; [k: string]: unknown };

type Props = {
  endpoint: string;
  title: string;
  subtitle: string;
  avatar: ReactNode;
  greeting: string;
  starters: string[];
  placeholder: string;
  className?: string;
  /** Extra JSON fields merged into the request body (e.g. { shop }). */
  body?: Record<string, unknown>;
  headers?: Record<string, string>;
  onHttpError?: (status: number) => void;
  /** Called with the full response JSON; return value is attached to the assistant message as `extra`. */
  onResponse?: (data: ReplyData) => unknown;
  renderExtra?: (extra: unknown, msg: UIMessage) => ReactNode;
};

let counter = 0;
const nid = () => `m${Date.now().toString(36)}${counter++}`;

function RichText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith("**") && p.endsWith("**") && p.length > 4 ? (
          <strong key={i} className="font-semibold">
            {p.slice(2, -2)}
          </strong>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}

export function ChatPanel({ endpoint, title, subtitle, avatar, greeting, starters, placeholder, className = "", body, headers, onHttpError, onResponse, renderExtra }: Props) {
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, pending, error]);

  const request = useCallback(
    async (history: UIMessage[]) => {
      setPending(true);
      setError(null);
      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...headers },
          body: JSON.stringify({ ...body, messages: history.map(({ role, content }) => ({ role, content })) }),
        });
        if (!res.ok) {
          onHttpError?.(res.status);
          throw new HttpError(await readError(res, "Something went wrong on our side."), res.status);
        }
        const data = (await res.json()) as ReplyData;
        const extra = onResponse?.(data);
        setMessages((m) => [...m, { id: nid(), role: "assistant", content: String(data.reply ?? ""), extra }]);
      } catch (e) {
        setError(e instanceof Error && e.message ? e.message : "Couldn't reach the assistant.");
      } finally {
        setPending(false);
        inputRef.current?.focus();
      }
    },
    [endpoint, onResponse, body, headers, onHttpError],
  );

  const send = useCallback(
    (text: string) => {
      const content = text.trim();
      if (!content || pending) return;
      const next = [...messages, { id: nid(), role: "user" as const, content }];
      setMessages(next);
      setInput("");
      void request(next);
    },
    [messages, pending, request],
  );

  const empty = messages.length === 0;

  return (
    <section aria-label={title} className={`flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm ${className}`}>
      <div className="flex items-center gap-3 border-b border-slate-100 bg-white px-4 py-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-soft text-brand">{avatar}</div>
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold text-navy-900">{title}</h2>
          <p className="truncate text-xs text-slate-500">{subtitle}</p>
        </div>
      </div>

      <div ref={scroller} className="flex-1 space-y-4 overflow-y-auto bg-slate-50/60 px-4 py-5" aria-live="polite">
        <Bubble role="assistant">{greeting}</Bubble>

        {messages.map((m) => (
          <div key={m.id} className="space-y-3">
            <Bubble role={m.role}>
              <RichText text={m.content} />
            </Bubble>
            {m.extra != null && renderExtra ? renderExtra(m.extra, m) : null}
          </div>
        ))}

        {pending && (
          <div className="cc-rise flex" aria-label="Assistant is typing">
            <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-md border border-slate-200 bg-white px-4 py-3.5 shadow-sm">
              <span className="cc-dot h-2 w-2 rounded-full bg-slate-400" />
              <span className="cc-dot h-2 w-2 rounded-full bg-slate-400" />
              <span className="cc-dot h-2 w-2 rounded-full bg-slate-400" />
            </div>
          </div>
        )}

        {error && !pending && (
          <div role="alert" className="cc-rise max-w-[88%] rounded-2xl rounded-bl-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
            <p className="font-medium">That message didn&apos;t go through.</p>
            <p className="mt-0.5 text-red-800/90">{error}</p>
            <button
              type="button"
              onClick={() => void request(messages)}
              className="mt-2 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
            >
              Try again
            </button>
          </div>
        )}

        {empty && !pending && (
          <div className="flex flex-wrap gap-2 pt-1">
            {starters.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => send(s)}
                className="rounded-full border border-blue-200 bg-white px-3.5 py-2 text-left text-sm text-navy-800 shadow-sm transition hover:border-brand hover:bg-brand-soft"
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="flex items-end gap-2 border-t border-slate-100 bg-white p-3"
      >
        <label htmlFor={`in-${endpoint}`} className="sr-only">
          Message
        </label>
        <textarea
          id={`in-${endpoint}`}
          ref={inputRef}
          rows={1}
          value={input}
          disabled={pending}
          placeholder={placeholder}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              send(input);
            }
          }}
          className="max-h-32 min-h-11 flex-1 resize-none rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-[15px] text-slate-900 placeholder:text-slate-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30 disabled:bg-slate-100 disabled:text-slate-500"
        />
        <button
          type="submit"
          disabled={pending || !input.trim()}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand text-white transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:bg-slate-300"
          aria-label="Send message"
        >
          <svg viewBox="0 0 20 20" className="h-5 w-5" fill="currentColor" aria-hidden="true">
            <path d="M3.1 2.6a.8.8 0 0 1 .9-.1l13 7a.8.8 0 0 1 0 1.4l-13 7a.8.8 0 0 1-1.1-1L5.2 11H11a1 1 0 1 0 0-2H5.2L2.9 3.5a.8.8 0 0 1 .2-.9Z" />
          </svg>
        </button>
      </form>
    </section>
  );
}

function Bubble({ role, children }: { role: "user" | "assistant"; children: ReactNode }) {
  const user = role === "user";
  return (
    <div className={`cc-rise flex ${user ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[88%] whitespace-pre-wrap break-words rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed shadow-sm ${
          user ? "rounded-br-md bg-brand text-white" : "rounded-bl-md border border-slate-200 bg-white text-slate-800"
        }`}
      >
        {children}
      </div>
    </div>
  );
}
