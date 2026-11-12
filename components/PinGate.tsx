"use client";

import { useCallback, useEffect, useState } from "react";
import { readError } from "./format";

const key = (slug: string) => `chatcart:pin:${slug}`;

export function usePin(slug: string) {
  const [pin, setPinState] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = sessionStorage.getItem(key(slug));
    } catch {}
    const t = setTimeout(() => {
      setPinState(saved);
      setReady(true);
    }, 0);
    return () => clearTimeout(t);
  }, [slug]);

  const setPin = useCallback(
    (p: string | null) => {
      setPinState(p);
      try {
        if (p) sessionStorage.setItem(key(slug), p);
        else sessionStorage.removeItem(key(slug));
      } catch {}
    },
    [slug],
  );

  return { pin, setPin, ready };
}

export function PinGate({ slug, hint, onUnlock }: { slug: string; hint?: string; onUnlock: (pin: string) => void }) {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/owner/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shop: slug, pin: value.trim() }),
      });
      if (res.status === 429) throw new Error(await readError(res, "Too many attempts. Please wait a moment and try again."));
      const data = res.ok ? await res.json().catch(() => null) : null;
      if (data?.ok) onUnlock(value.trim());
      else if (res.ok || res.status === 401) setError("That PIN isn't right. Check it and try again.");
      else throw new Error(await readError(res, "Couldn't check the PIN."));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't check the PIN.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex max-w-md flex-col px-4 py-12 sm:py-20">
      <form onSubmit={submit} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-soft text-brand">
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="5" y="11" width="14" height="9" rx="2" />
            <path d="M8 11V8a4 4 0 0 1 8 0v3" />
          </svg>
        </div>
        <h1 className="mt-4 text-xl font-bold text-navy-900">Owner dashboard</h1>
        <p className="mt-1 text-sm text-slate-600">Enter the 6-digit owner PIN for <span className="font-mono text-xs">{slug}</span> to see orders and your assistant.</p>
        <label htmlFor="pin" className="mt-5 block text-sm font-medium text-slate-700">Owner PIN</label>
        <input
          id="pin"
          inputMode="numeric"
          autoComplete="off"
          maxLength={12}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="mt-1.5 w-full rounded-xl border border-slate-300 px-4 py-3 text-center font-mono text-xl tracking-[0.4em] focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
          placeholder="••••••"
        />
        {error && <p role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">{error}</p>}
        <button type="submit" disabled={busy || value.trim().length < 4} className="mt-4 w-full rounded-xl bg-brand py-3 font-semibold text-white transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:bg-slate-300">
          {busy ? "Checking…" : "Unlock dashboard"}
        </button>
        {hint && <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-center text-sm text-slate-600">{hint}</p>}
      </form>
    </main>
  );
}
