"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import QRCode from "qrcode";
import type { OrderX as Order } from "./types";
import type { QuoteRequest } from "@/lib/types";
import { DEMO_PIN_HINT, DEMO_SLUG } from "./types";
import { PinGate, usePin } from "./PinGate";
import Link from "next/link";
import { ChatPanel } from "./ChatPanel";
import { StatusBadge } from "./StatusBadge";
import { money, shortDate, readError } from "./format";
import { Logo } from "./Header";

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

function OrdersPanel({ title, orders, list, loadError }: { title: string; orders: Order[] | null; list: Order[]; loadError: string | null }) {
  return (
        <section aria-label={title} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <h2 className="text-base font-semibold text-navy-900">{title}</h2>
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

          {orders && list.length === 0 && (
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

          {orders && list.length > 0 && (
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
                    {list.map((o) => (
                      <tr key={o.id} className="align-top hover:bg-slate-50/60">
                        <td className="whitespace-nowrap py-3 pl-5 pr-4 font-mono text-xs font-semibold text-navy-900">{o.shortCode}</td>
                        <td className="px-4 py-3 text-slate-800">{o.customerName}</td>
                        <td className="min-w-[11rem] max-w-[16rem] px-4 py-3 text-slate-600">{itemsSummary(o)}</td>
                        <td className="whitespace-nowrap px-4 py-3 font-medium tabular-nums text-slate-900">{money(o.total)}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-slate-600">{shortDate(o.pickupDate)}</td>
                        <td className="px-4 py-3"><StatusBadge order={o} /></td>
                        <td className="py-3 pl-4 pr-5 text-slate-500">{shortDate(o.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <ul className="divide-y divide-slate-100 md:hidden">
                {list.map((o) => (
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


  );
}

function QuotesPanel({ quotes }: { quotes: QuoteRequest[] }) {
  return (
    <section aria-label="Quote requests" className="rounded-2xl border border-blue-200 bg-brand-soft p-5">
      <h2 className="text-base font-semibold text-navy-900">Pending quote requests <span className="ml-1 rounded-full bg-brand px-2 py-0.5 text-xs text-white">{quotes.length}</span></h2>
      <p className="text-sm text-slate-600">Custom requests that aren&apos;t on your menu. Ask your assistant to send an invoice.</p>
      {quotes.length === 0 ? (
        <p className="mt-4 rounded-xl border border-blue-100 bg-white px-4 py-8 text-center text-sm text-slate-500">No pending quote requests right now.</p>
      ) : (
        <ul className="mt-3 grid gap-3 md:grid-cols-2">
            {quotes.map((q) => (
              <li key={q.id} className="rounded-xl border border-blue-100 bg-white p-3.5 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <p className="min-w-0 break-words font-medium text-slate-900">{q.customerName}</p>
                  <span className="shrink-0 text-xs text-slate-500">{shortDate(q.createdAt)}</span>
                </div>
                <p className={`text-xs text-slate-500 ${q.customerEmail ? "break-all" : ""}`}>{q.customerEmail || "No email yet — ask the customer for one before invoicing"}</p>
                <p className="mt-1 break-words text-slate-700">{q.description}</p>
              </li>
            ))}
        </ul>
      )}
    </section>
  );
}

type SectionId = "overview" | "orders" | "quotes" | "assistant" | "share";

const NAV: { id: SectionId; label: string; title: string; icon: ReactNode }[] = [
  { id: "overview", label: "Overview", title: "Overview", icon: <path d="M4 5h7v7H4V5Zm9 0h7v4h-7V5ZM4 14h7v5H4v-5Zm9-3h7v8h-7v-8Z" /> },
  { id: "orders", label: "Orders", title: "Orders", icon: <path d="M6 7h12l-1 12H7L6 7ZM9 7a3 3 0 0 1 6 0" /> },
  { id: "quotes", label: "Quote requests", title: "Quote requests", icon: <path d="M5 5h14v10H9l-4 4V5Zm4 4h6m-6 3h4" /> },
  { id: "assistant", label: "Assistant", title: "Ask your assistant", icon: <path d="M12 3l1.8 4.6L18 9l-4.2 1.4L12 15l-1.8-4.6L6 9l4.2-1.4L12 3ZM18 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8.8-2Z" /> },
  { id: "share", label: "Share shop", title: "Share your shop", icon: <path d="M4 4h6v6H4V4Zm10 0h6v6h-6V4ZM4 14h6v6H4v-6Zm10 0h2v2h-2v-2Zm4 0h2v2h-2v-2Zm-4 4h2v2h-2v-2Zm4 0h2v2h-2v-2Z" /> },
];

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

function shopTitle(slug: string) {
  if (slug === DEMO_SLUG) return "Anu's Home Bakery";
  return slug.split("-").filter(Boolean).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ") || slug;
}

const focusRing = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";

function SidebarContent({ name, storefront, active, quoteCount, onSelect, onLock, onClose }: {
  name: string; storefront: string; active: SectionId; quoteCount: number;
  onSelect: (id: SectionId) => void; onLock: () => void; onClose?: () => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-start gap-3 border-b border-slate-100 px-4 py-4">
        <Logo className="h-9 w-9 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-navy-900" title={name}>{name}</p>
          <p className="text-xs text-slate-500">Owner dashboard</p>
        </div>
        {onClose && (
          <button type="button" onClick={onClose} aria-label="Close menu" className={`-mr-1 rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-navy-900 ${focusRing}`}>
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
          </button>
        )}
      </div>
      <nav aria-label="Dashboard sections" className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-1">
          {NAV.map((n) => {
            const on = n.id === active;
            return (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => onSelect(n.id)}
                  aria-current={on ? "page" : undefined}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors ${focusRing} ${
                    on ? "bg-brand-soft text-brand-dark" : "text-slate-600 hover:bg-slate-100 hover:text-navy-900"
                  }`}
                >
                  <Icon>{n.icon}</Icon>
                  <span className="flex-1">{n.label}</span>
                  {n.id === "quotes" && quoteCount > 0 && <span className="rounded-full bg-brand px-2 py-0.5 text-xs font-semibold text-white">{quoteCount}</span>}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="space-y-1 border-t border-slate-100 px-3 py-3">
        <Link href={storefront} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-navy-900 ${focusRing}`}>
          <Icon><path d="M4 9l1-4h14l1 4M5 9v10h14V9M9 19v-5h6v5" /></Icon>
          View storefront
        </Link>
        <button type="button" onClick={onLock} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-slate-600 hover:bg-red-50 hover:text-red-700 ${focusRing}`}>
          <Icon><path d="M9 4H5v16h4M16 8l4 4-4 4M20 12H9" /></Icon>
          Sign out
        </button>
      </div>
    </div>
  );
}

function SharePanel({ path }: { path: string }) {
  const [origin, setOrigin] = useState("");
  const [qr, setQr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setOrigin(window.location.origin), 0);
    return () => clearTimeout(t);
  }, []);
  const link = `${origin}${path}`;

  useEffect(() => {
    if (!origin) return;
    QRCode.toDataURL(link, { width: 320, margin: 1, color: { dark: "#0b1f3a", light: "#ffffff" } })
      .then(setQr)
      .catch(() => setQr(null));
  }, [origin, link]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }

  return (
    <section aria-label="Share shop" className="max-w-2xl rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="font-semibold text-navy-900">Your shop link</h2>
      <p className="mt-0.5 text-sm text-slate-600">Customers open this link to order and pay in chat.</p>
      <div className="mt-3 flex items-stretch gap-2">
        <input readOnly value={link} aria-label="Shop link" onFocus={(e) => e.currentTarget.select()} className="min-w-0 flex-1 rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 font-mono text-sm text-slate-800" />
        <button type="button" onClick={copy} className="shrink-0 rounded-xl bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-dark">
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <div className="mt-5 flex flex-col items-center gap-3 sm:flex-row sm:gap-5">
        <div className="flex h-40 w-40 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white p-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {qr ? <img src={qr} alt={`QR code for ${link}`} className="h-full w-full" /> : <div className="h-full w-full animate-pulse rounded-lg bg-slate-100" />}
        </div>
        <p className="text-sm text-slate-600">Print this QR code or drop it in your Instagram or WhatsApp bio. Scanning it opens your chat storefront.</p>
      </div>
    </section>
  );
}

function DashboardInner({ slug, pin, onLock }: { slug: string; pin: string; onLock: () => void }) {
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [quotes, setQuotes] = useState<QuoteRequest[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [section, setSection] = useState<SectionId>("overview");
  const [drawer, setDrawer] = useState(false);
  const menuBtn = useRef<HTMLButtonElement>(null);
  const asideRef = useRef<HTMLElement>(null);

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

  const recent = useMemo(() => [...(orders ?? [])].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).slice(0, 5), [orders]);
  // Real shop name from the shop record; the slug-derived title is only a placeholder while it loads.
  const [realName, setRealName] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    fetch(`/api/menu?shop=${encodeURIComponent(slug)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (alive && d?.shop?.name) setRealName(String(d.shop.name)); })
      .catch(() => {});
    return () => { alive = false; };
  }, [slug]);
  const name = realName ?? shopTitle(slug);
  const storefront = slug === DEMO_SLUG ? "/" : `/s/${slug}`;
  const active = NAV.find((n) => n.id === section)!;

  const closeDrawer = useCallback(() => {
    setDrawer(false);
    menuBtn.current?.focus();
  }, []);

  useEffect(() => {
    if (!drawer) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeDrawer();
    };
    const mq = window.matchMedia("(min-width: 1024px)");
    const onMq = () => mq.matches && setDrawer(false);
    document.addEventListener("keydown", onKey);
    mq.addEventListener("change", onMq);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      mq.removeEventListener("change", onMq);
      document.body.style.overflow = prev;
    };
  }, [drawer, closeDrawer]);

  // Keep the sidebar exactly viewport-tall below whatever sits above it (header + optional setup banner),
  // so "View storefront" and "Sign out" stay visible without scrolling.
  useEffect(() => {
    const el = asideRef.current;
    if (!el) return;
    const fit = () => {
      const top = el.parentElement?.getBoundingClientRect().top ?? 60;
      el.style.height = `${Math.max(window.innerHeight - Math.max(top, 60), 320)}px`;
    };
    fit();
    window.addEventListener("scroll", fit, { passive: true });
    window.addEventListener("resize", fit);
    const ro = new ResizeObserver(fit);
    ro.observe(document.body);
    return () => {
      window.removeEventListener("scroll", fit);
      window.removeEventListener("resize", fit);
      ro.disconnect();
    };
  }, []);

  const select = (id: SectionId) => {
    setSection(id);
    if (drawer) closeDrawer();
  };

  return (
    <div className="lg:flex">
      <aside ref={asideRef} className="sticky top-[60px] hidden h-[calc(100dvh-60px)] w-64 shrink-0 border-r border-slate-200 bg-white lg:block">
        <SidebarContent name={name} storefront={storefront} active={section} quoteCount={quotes.length} onSelect={select} onLock={onLock} />
      </aside>

      <div className="sticky top-[60px] z-20 flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-2.5 lg:hidden">
        <button
          ref={menuBtn}
          type="button"
          onClick={() => setDrawer(true)}
          aria-label="Open menu"
          aria-expanded={drawer}
          className={`-ml-1.5 rounded-lg p-2 text-navy-900 hover:bg-slate-100 ${focusRing}`}
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold leading-tight text-navy-900">{name}</p>
          <p className="text-xs leading-tight text-slate-500">Owner dashboard · {active.label}</p>
        </div>
      </div>

      {drawer && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-navy-950/50" onClick={closeDrawer} aria-hidden="true" data-testid="drawer-backdrop" />
          <div role="dialog" aria-modal="true" aria-label="Dashboard menu" className="absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-white shadow-xl">
            <SidebarContent name={name} storefront={storefront} active={section} quoteCount={quotes.length} onSelect={select} onLock={onLock} onClose={closeDrawer} />
          </div>
        </div>
      )}

      <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <div className="mx-auto max-w-6xl">
          <div className="mb-6">
            <h1 className="text-2xl font-bold tracking-tight text-navy-900">{active.title}</h1>
            <p className="text-sm text-slate-600">
              Live orders for {name}. Updates every few seconds.
            </p>
          </div>

          {section === "overview" && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
                <StatCard label="Revenue" value={stats ? money(stats.revenue) : "—"} hint="From paid orders" tone="bg-brand" />
                <StatCard label="Paid" value={stats ? String(stats.paidCount) : "—"} hint="Orders confirmed" tone="bg-emerald-500" />
                <StatCard label="Pending" value={stats ? String(stats.pendingCount) : "—"} hint={invoiced > 0 ? `Awaiting payment · plus ${invoiced} invoiced` : "Awaiting payment"} tone="bg-amber-500" />
                <StatCard label="Refunded" value={stats ? String(stats.refundedCount) : "—"} hint="Money returned" tone="bg-slate-400" />
              </div>
              <OrdersPanel title="Recent orders" orders={orders} list={recent} loadError={loadError} />
              {tableOrders.length > recent.length && (
                <button type="button" onClick={() => select("orders")} className={`rounded-lg text-sm font-medium text-brand hover:underline ${focusRing}`}>View all {tableOrders.length} orders</button>
              )}
            </div>
          )}

          {section === "orders" && <OrdersPanel title="Orders" orders={orders} list={tableOrders} loadError={loadError} />}

          {section === "quotes" && <QuotesPanel quotes={quotes} />}

          {section === "share" && <SharePanel path={storefront} />}

          <div hidden={section !== "assistant"}>
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
              className="h-[calc(100dvh-16rem)] min-h-[28rem] max-w-3xl"
              onResponse={onResponse as (d: { reply: string }) => unknown}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
