"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { OrderX as Order } from "./types";
import type { QuoteRequest } from "@/lib/types";
import { DEMO_PIN_HINT } from "./types";
import { PinGate, usePin } from "./PinGate";
import Link from "next/link";
import { ChatPanel } from "./ChatPanel";
import { StatusBadge } from "./StatusBadge";
import { money, shortDate, readError } from "./format";

type Stats = { paidCount: number; pendingCount: number; refundedCount: number; revenue: number; invoicedCount?: number };

const STARTERS = ["What's pending today?", "How much did I make?", "Refund order CC-…", "Mark CC-… as ready", "Send an invoice for the custom request"];

function itemsSummary(o: Order) {
  return o.lines.map((l) => `${l.qty}× ${l.name}`).join(", ");
}

function StatCard({ label, value, hint, tone }: { label: string; value: string; hint: string; tone: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-center gap-2">
        <span className={`h-2.5 w-2.5 rounded-full ${tone}`} aria-hidden="true" />
        <p className="text-sm font-medium text-slate-600">{label}</p>
      </div>
      <p className="mt-2 text-2xl font-bold tabular-nums tracking-tight text-navy-900 sm:text-3xl">{value}</p>
      <p className="mt-0.5 text-xs text-slate-500">{hint}</p>
    </div>
  );
}

export function Dashboard({ slug, demo = false }: { slug: string; demo?: boolean }) {
  const { pin, setPin, ready } = usePin(slug);
  if (!ready) return <div className="mx-auto max-w-7xl p-8 text-slate-500">Loading…</div>;
  if (!pin) return <PinGate slug={slug} hint={demo ? `Demo shop PIN: ${DEMO_PIN_HINT}` : undefined} onUnlock={setPin} />;
  return <DashboardInner slug={slug} pin={pin} onLock={() => setPin(null)} />;
}

function DashboardInner({ slug, pin, onLock }: { slug: string; pin: string; onLock: () => void }) {
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [quotes, setQuotes] = useState<QuoteRequest[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const init: RequestInit = { cache: "no-store", headers: { "x-owner-pin": pin } };
      const q = encodeURIComponent(slug);
      const [res, qres] = await Promise.all([fetch(`/api/orders?shop=${q}`, init), fetch(`/api/quotes?shop=${q}`, init)]);
      if (res.status === 401 || qres.status === 401) return onLock();
      if (!res.ok) throw new Error(await readError(res, "Couldn't load orders."));
      const d = await res.json();
      setOrders(d.orders ?? []);
      setStats(d.stats ?? null);
      // Quote requests are their own resource (GET /api/quotes), not orders.
      if (qres.ok) {
        const qd = await qres.json();
        setQuotes(((qd.quotes ?? []) as QuoteRequest[]).filter((x) => x.status === "PENDING"));
      }
      setLoadError(null);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Couldn't load orders.");
    }
  }, [slug, pin, onLock]);

  useEffect(() => {
    const first = setTimeout(() => void refresh(), 0);
    const id = setInterval(() => void refresh(), 4000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [refresh]);

  const chatBody = useMemo(() => ({ shop: slug }), [slug]);
  const chatHeaders = useMemo(() => ({ "x-owner-pin": pin }), [pin]);
  const tableOrders = orders ?? [];
  const invoiced = stats?.invoicedCount ?? 0;

  const onResponse = useCallback(
    (data: { reply: string; changed?: boolean }) => {
      if (data.changed) void refresh();
      return undefined;
    },
    [refresh],
  );

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-navy-900">Owner dashboard</h1>
        <p className="text-sm text-slate-600">
          Live orders{slug !== "anus-home-bakery" ? <> for <span className="font-mono text-xs">{slug}</span></> : " for Anu's Home Bakery"}. Updates every few seconds.{" "}
          <Link href={slug === "anus-home-bakery" ? "/" : `/s/${slug}`} className="font-medium text-brand hover:underline">View storefront</Link>
          {" · "}
          <button type="button" onClick={onLock} className="font-medium text-brand hover:underline">Lock</button>
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Revenue" value={stats ? money(stats.revenue) : "—"} hint="From paid orders" tone="bg-brand" />
        <StatCard label="Paid" value={stats ? String(stats.paidCount) : "—"} hint="Orders confirmed" tone="bg-emerald-500" />
        <StatCard label="Pending" value={stats ? String(stats.pendingCount) : "—"} hint={invoiced > 0 ? `Awaiting payment · plus ${invoiced} invoiced` : "Awaiting payment"} tone="bg-amber-500" />
        <StatCard label="Refunded" value={stats ? String(stats.refundedCount) : "—"} hint="Money returned" tone="bg-slate-400" />
      </div>

      {quotes.length > 0 && (
        <section aria-label="Quote requests" className="mt-6 rounded-2xl border border-blue-200 bg-brand-soft p-5">
          <h2 className="text-base font-semibold text-navy-900">Quote requests <span className="ml-1 rounded-full bg-brand px-2 py-0.5 text-xs text-white">{quotes.length}</span></h2>
          <p className="text-sm text-slate-600">Custom requests that aren&apos;t on your menu. Ask your assistant to send an invoice.</p>
          <ul className="mt-3 grid gap-3 md:grid-cols-2">
            {quotes.map((q) => (
              <li key={q.id} className="rounded-xl border border-blue-100 bg-white p-3.5 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <p className="min-w-0 break-words font-medium text-slate-900">{q.customerName}</p>
                  <span className="shrink-0 text-xs text-slate-500">{shortDate(q.createdAt)}</span>
                </div>
                <p className="break-all text-xs text-slate-500">{q.customerEmail || "No email yet — ask the customer for one before invoicing"}</p>
                <p className="mt-1 break-words text-slate-700">{q.description}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-[minmax(0,7fr)_minmax(0,4fr)] xl:items-start">
        <section aria-label="Orders" className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <h2 className="text-base font-semibold text-navy-900">Orders</h2>
            <span className="flex items-center gap-1.5 text-xs text-slate-500">
              <span className="relative flex h-2 w-2" aria-hidden="true">
                <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 ${loadError ? "bg-red-400" : "bg-emerald-400"}`} />
                <span className={`relative inline-flex h-2 w-2 rounded-full ${loadError ? "bg-red-500" : "bg-emerald-500"}`} />
              </span>
              {loadError ? "Offline — retrying" : "Live"}
            </span>
          </div>

          {loadError && !orders && <p role="alert" className="px-5 py-8 text-sm text-red-800">{loadError}</p>}
          {!orders && !loadError && (
            <div className="space-y-2 p-5" aria-label="Loading orders">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-12 animate-pulse rounded-lg bg-slate-100" />
              ))}
            </div>
          )}

          {orders && tableOrders.length === 0 && (
            <div className="px-6 py-14 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-soft text-brand">
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M6 7h12l-1 12H7L6 7ZM9 7a3 3 0 0 1 6 0" />
                </svg>
              </div>
              <p className="mt-3 font-semibold text-navy-900">No orders yet</p>
              <p className="mx-auto mt-1 max-w-xs text-sm text-slate-500">
                When a customer orders through the storefront chat, it will appear here in real time.
              </p>
            </div>
          )}

          {orders && tableOrders.length > 0 && (
            <>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      {["Code", "Customer", "Items", "Total", "Pickup", "Status", "Placed"].map((h) => (
                        <th key={h} scope="col" className="whitespace-nowrap px-4 py-2.5 font-semibold first:pl-5 last:pr-5">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {tableOrders.map((o) => (
                      <tr key={o.id} className="align-top hover:bg-slate-50/60">
                        <td className="whitespace-nowrap py-3 pl-5 pr-4 font-mono text-xs font-semibold text-navy-900">{o.shortCode}</td>
                        <td className="px-4 py-3 text-slate-800">{o.customerName}</td>
                        <td className="max-w-[16rem] px-4 py-3 text-slate-600">{itemsSummary(o)}</td>
                        <td className="whitespace-nowrap px-4 py-3 font-medium tabular-nums text-slate-900">{money(o.total)}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-slate-600">{shortDate(o.pickupDate)}</td>
                        <td className="px-4 py-3"><StatusBadge order={o} /></td>
                        <td className="whitespace-nowrap py-3 pl-4 pr-5 text-slate-500">{shortDate(o.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <ul className="divide-y divide-slate-100 md:hidden">
                {tableOrders.map((o) => (
                  <li key={o.id} className="space-y-1.5 px-4 py-3.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-semibold text-navy-900">{o.shortCode}</span>
                      <StatusBadge order={o} />
                    </div>
                    <p className="text-sm font-medium text-slate-900">{o.customerName} · {money(o.total)}</p>
                    <p className="text-sm text-slate-600">{itemsSummary(o)}</p>
                    <p className="text-xs text-slate-500">Pickup {shortDate(o.pickupDate)} · Placed {shortDate(o.createdAt)}</p>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        <ChatPanel
          endpoint="/api/owner-chat"
          body={chatBody}
          headers={chatHeaders}
          onHttpError={(st) => st === 401 && onLock()}
          title="Ask your assistant"
          subtitle="Orders, sales, ready for pickup, invoices and refunds"
          avatar={
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 3l1.8 4.6L18 9l-4.2 1.4L12 15l-1.8-4.6L6 9l4.2-1.4L12 3ZM18 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8.8-2Z" />
            </svg>
          }
          greeting="Hi! I can look up orders and sales, mark orders ready, send a PayPal invoice for a custom request, and refund an order once you confirm. What do you need?"
          starters={STARTERS}
          placeholder="Ask about your orders…"
          className="h-[32rem] xl:sticky xl:top-20"
          onResponse={onResponse as (d: { reply: string }) => unknown}
        />
      </div>
    </main>
  );
}
