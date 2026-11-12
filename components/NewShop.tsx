"use client";

import { useState } from "react";
import { ShopCreated, type CreatedShop } from "./ShopCreated";
import { readError } from "./format";

const EXAMPLES = [
  {
    name: "Meena's Tailoring",
    menu: `MEENA TAILORING - rates (usd, approx)
blouse stitching 18, with lining 24
salwar suit stitch - 35 (plain) / 48 if heavy embroidery
saree fall + pico  6
lehenga stitching.... 95
alterations: hem/length $5, waist take-in $8, zip replace 7
kurta men 22
school uniform set - 28
rush order (3 days) +10 extra
no returns on custom fit pls`,
  },
  {
    name: "Ravi's Snack Box",
    menu: `RAVI SNACKS (home made, order 1 day before)
Murukku 250g - 4.5
Mixture 250 g...4
Banana chips 200g $3.75
Ribbon pakoda 250g: 4.25
sweet: Mysore pak 6 pcs - 7, Laddu box of 8 = 9.5
Gift hamper (assorted, 1kg) 22 dollars
Festival combo 2 sweets + 2 savouries -> 18
pls no cash on delivery`,
  },
];

export function NewShop() {
  const [name, setName] = useState("");
  const [raw, setRaw] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CreatedShop | null>(null);
  const [exampleIdx, setExampleIdx] = useState(0);

  if (result) return <ShopCreated result={result} />;

  function fillExample() {
    const ex = EXAMPLES[exampleIdx % EXAMPLES.length];
    setName(ex.name);
    setRaw(ex.menu);
    setExampleIdx((i) => i + 1);
    setError(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/shops/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), rawMenu: raw.trim() }),
      });
      if (!res.ok) throw new Error(await readError(res, "We couldn't read that menu."));
      const data = (await res.json()) as CreatedShop;
      if (!data?.shop || !data.ownerPin) throw new Error("The server sent back an unexpected response. Please try again.");
      setResult(data);
      window.scrollTo({ top: 0 });
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : "Couldn't reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  const canSubmit = name.trim().length > 1 && raw.trim().length > 5 && !busy;

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <p className="text-xs font-semibold uppercase tracking-widest text-brand">For home sellers</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-navy-900 sm:text-4xl">Create your shop in a minute</h1>
      <p className="mt-2 max-w-xl text-slate-600">Paste your menu or price list exactly as you have it — WhatsApp notes, a photo caption, anything. Our AI turns it into a shop with a chat sales agent that takes PayPal payments.</p>

      <form onSubmit={submit} className="mt-8 space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <div>
          <label htmlFor="shop-name" className="block text-sm font-semibold text-slate-800">Shop name</label>
          <input id="shop-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} disabled={busy} placeholder="e.g. Meena's Tailoring" className="mt-1.5 w-full rounded-xl border border-slate-300 px-4 py-3 text-base focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30 disabled:bg-slate-100" />
        </div>
        <div>
          <div className="flex items-center justify-between gap-3">
            <label htmlFor="raw-menu" className="block text-sm font-semibold text-slate-800">Your menu or price list</label>
            <button type="button" onClick={fillExample} disabled={busy} className="rounded-lg px-2 py-1 text-sm font-semibold text-brand hover:bg-brand-soft disabled:opacity-50">Try an example</button>
          </div>
          <textarea id="raw-menu" value={raw} onChange={(e) => setRaw(e.target.value)} disabled={busy} rows={12} maxLength={8000} placeholder={"Paste it messy — e.g.\nchocolate cake 1lb - 30\ncupcakes box of 6.... $15\n..."} className="mt-1.5 w-full resize-y rounded-xl border border-slate-300 px-4 py-3 font-mono text-sm leading-relaxed focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30 disabled:bg-slate-100" />
          <p className="mt-1 text-xs text-slate-500">Prices are read in US dollars. Up to 40 items.</p>
        </div>

        {error && (
          <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
            <p className="font-semibold">We couldn&apos;t create your shop</p>
            <p className="mt-0.5">{error}</p>
          </div>
        )}

        <button type="submit" disabled={!canSubmit} className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-3.5 text-base font-semibold text-white transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:bg-slate-300">
          {busy ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" />
              Reading your menu… this takes a few seconds
            </>
          ) : (
            "Create my shop"
          )}
        </button>
      </form>
    </main>
  );
}
