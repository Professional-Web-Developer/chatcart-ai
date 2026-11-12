"use client";

import { useEffect, useState } from "react";

type Health = { paypal: boolean; ai: boolean; aiProvider: string | null; db: string; webhook?: boolean };

export function SetupBanner() {
  const [health, setHealth] = useState<Health | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/health")
      .then((r) => (r.ok ? r.json() : null))
      .then((h) => alive && h && setHealth(h as Health))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  if (!health || (health.paypal && health.ai)) return null;

  const missing: string[] = [];
  if (!health.paypal) missing.push("PayPal credentials (PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET) are not set, so checkout and refunds are unavailable.");
  if (!health.ai) missing.push("No AI provider key is set (GOOGLE_GENERATIVE_AI_API_KEY, GROQ_API_KEY, ANTHROPIC_API_KEY or OPENAI_API_KEY), so the chat agents cannot reply.");

  return (
    <div role="status" className="border-b border-amber-200 bg-amber-50">
      <div className="mx-auto flex max-w-7xl gap-3 px-4 py-3 text-sm text-amber-900 sm:px-6">
        <svg viewBox="0 0 20 20" className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" fill="currentColor" aria-hidden="true">
          <path fillRule="evenodd" d="M8.5 2.9a1.7 1.7 0 0 1 3 0l6 11A1.7 1.7 0 0 1 16 16.5H4a1.7 1.7 0 0 1-1.5-2.6l6-11ZM10 7a.8.8 0 0 0-.8.8v3a.8.8 0 0 0 1.6 0v-3A.8.8 0 0 0 10 7Zm0 6.2a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z" clipRule="evenodd" />
        </svg>
        <div>
          <p className="font-semibold">Setup needed</p>
          <ul className="mt-0.5 list-disc space-y-0.5 pl-4">
            {missing.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
