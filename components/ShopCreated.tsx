"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import QRCode from "qrcode";
import { money } from "./format";
import type { MenuItem } from "@/lib/types";

export type CreatedShop = { shop: { slug: string; name: string; tagline: string; items: MenuItem[] }; ownerPin: string };

export function ShopCreated({ result }: { result: CreatedShop }) {
  const { shop, ownerPin } = result;
  const [origin, setOrigin] = useState("");
  const [qr, setQr] = useState<string | null>(null);
  const [copied, setCopied] = useState<"link" | "pin" | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setOrigin(window.location.origin), 0);
    return () => clearTimeout(t);
  }, []);
  const link = `${origin}/s/${shop.slug}`;

  useEffect(() => {
    if (!origin) return;
    QRCode.toDataURL(link, { width: 320, margin: 1, color: { dark: "#0b1f3a", light: "#ffffff" } })
      .then(setQr)
      .catch(() => setQr(null));
  }, [origin, link]);

  async function copy(text: string, what: "link" | "pin") {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      setTimeout(() => setCopied(null), 2000);
    } catch {}
  }

  const groups = new Map<string, MenuItem[]>();
  for (const it of shop.items) groups.set(it.category, [...(groups.get(it.category) ?? []), it]);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700" aria-hidden="true">✓</span>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-navy-900">{shop.name} is live</h1>
          <p className="text-slate-600">We turned your menu into {shop.items.length} sellable item{shop.items.length === 1 ? "" : "s"}. Share the link and customers can order and pay in chat.</p>
        </div>
      </div>

      <div className="mb-6 rounded-2xl border-2 border-amber-300 bg-amber-50 p-5" role="alert">
        <p className="font-semibold text-amber-900">Save your owner PIN now — it is shown only once.</p>
        <p className="mt-0.5 text-sm text-amber-900/80">You need it to open your dashboard. We store only a hash, so we can&apos;t show it again.</p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <span className="rounded-xl border border-amber-300 bg-white px-5 py-2.5 font-mono text-2xl font-bold tracking-[0.35em] text-navy-900">{ownerPin}</span>
          <button type="button" onClick={() => copy(ownerPin, "pin")} className="rounded-xl border border-amber-400 bg-white px-4 py-2.5 text-sm font-semibold text-amber-900 hover:bg-amber-100">
            {copied === "pin" ? "Copied" : "Copy PIN"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        <div className="space-y-6">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="font-semibold text-navy-900">Your shop link</h2>
            <div className="mt-3 flex items-stretch gap-2">
              <input readOnly value={link} aria-label="Shop link" onFocus={(e) => e.currentTarget.select()} className="min-w-0 flex-1 rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 font-mono text-sm text-slate-800" />
              <button type="button" onClick={() => copy(link, "link")} className="shrink-0 rounded-xl bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-dark">
                {copied === "link" ? "Copied" : "Copy"}
              </button>
            </div>
            <div className="mt-5 flex flex-col items-center gap-2 sm:flex-row sm:gap-5">
              <div className="flex h-40 w-40 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {qr ? <img src={qr} alt={`QR code for ${link}`} className="h-full w-full" /> : <div className="h-full w-full animate-pulse rounded-lg bg-slate-100" />}
              </div>
              <p className="text-sm text-slate-600">Print this QR code or drop it in your Instagram or WhatsApp bio. Scanning it opens your chat storefront.</p>
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link href={`/s/${shop.slug}`} className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-navy-900 hover:bg-slate-50">Open storefront</Link>
              <Link href={`/dashboard/${shop.slug}`} className="rounded-xl bg-navy-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-navy-800">Go to your dashboard</Link>
            </div>
          </section>
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" aria-label="Menu preview">
          <h2 className="font-semibold text-navy-900">Your structured menu</h2>
          <div className="mt-3 space-y-5">
            {[...groups.entries()].map(([cat, list]) => (
              <div key={cat}>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">{cat}</h3>
                <ul className="space-y-2">
                  {list.map((it) => (
                    <li key={it.id} className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-xl shadow-sm" aria-hidden="true">{it.emoji}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-slate-900">{it.name}</p>
                        {it.description && <p className="text-xs text-slate-500">{it.description}</p>}
                      </div>
                      <p className="shrink-0 text-sm font-semibold tabular-nums text-navy-900">{money(it.priceUsd)}</p>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
