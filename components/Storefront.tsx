"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { PayPalProvider } from "@paypal/react-paypal-js/sdk-v6";
import type { Order } from "@/lib/types";
import { ChatPanel } from "./ChatPanel";
import { MenuList, type MenuState } from "./MenuList";
import { OrderCard } from "./OrderCard";
import Link from "next/link";
import { readError } from "./format";
import type { OrderX } from "./types";

const CLIENT_ID = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;

// Starter prompts are built from the shop's own menu, so a tailor never sees cake examples.
const GENERIC_STARTERS = ["What do you offer?", "What do you recommend?", "Can I get something custom made?"];

function startersFor(items: { name: string }[]): string[] {
  const first = items[0]?.name;
  const second = items[1]?.name;
  if (!first) return GENERIC_STARTERS;
  return [
    `I'd like 2 x ${first} for Saturday`,
    second ? `How much is ${second}?` : "What do you offer?",
    "Can I get something custom made?",
  ];
}

function BakeryIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 20h16M6 20v-6a6 6 0 0 1 12 0v6M12 4v2M9 14h6" />
    </svg>
  );
}

function PayPalWrap({ children }: { children: ReactNode }) {
  if (!CLIENT_ID) return <>{children}</>;
  return (
    <PayPalProvider clientId={CLIENT_ID} environment="sandbox" components={["paypal-payments"]} pageType="checkout">
      {children}
    </PayPalProvider>
  );
}

export function Storefront({ slug }: { slug?: string }) {
  const [shop, setShop] = useState<{ name: string; tagline: string }>(slug ? { name: "", tagline: "" } : { name: "Anu's Home Bakery", tagline: "Fresh, small-batch bakes — order right here in chat." });
  const [menu, setMenu] = useState<MenuState>({ status: "loading" });
  const [notFound, setNotFound] = useState(false);
  const chatBody = useMemo(() => (slug ? { shop: slug } : undefined), [slug]);
  const starters = useMemo(() => startersFor(menu.status === "ready" ? menu.items : []), [menu]);

  const fetchMenu = useCallback(() => {
    fetch(slug ? `/api/menu?shop=${encodeURIComponent(slug)}` : "/api/menu")
      .then(async (r) => {
        if (r.status === 404) {
          await r.text().catch(() => ""); // drain the body so the request completes
          setNotFound(true);
          throw new Error("");
        }
        if (!r.ok) throw new Error(await readError(r, ""));
        return r.json();
      })
      .then((d) => {
        if (d.shop) setShop(d.shop);
        setMenu({ status: "ready", items: d.items ?? [] });
      })
      .catch((e: Error) => setMenu({ status: "error", message: e.message || "" }));
  }, [slug]);

  useEffect(() => {
    fetchMenu();
  }, [fetchMenu]);

  const loadMenu = useCallback(() => {
    setMenu({ status: "loading" });
    fetchMenu();
  }, [fetchMenu]);

  const onResponse = useCallback((data: { reply: string; order?: Order }) => data.order, []);

  if (notFound) return <ShopNotFound />;

  return (
    <PayPalWrap>
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:py-8">
        <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:items-start">
          <div className="order-2 space-y-5 lg:order-1">
            <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-navy-900 to-navy-700 p-6 text-white shadow-sm sm:p-7">
              <p className="text-xs font-semibold uppercase tracking-widest text-blue-200">Now taking orders</p>
              <h1 className="mt-2 break-words text-2xl font-bold tracking-tight sm:text-3xl">{shop.name}</h1>
              <p className="mt-1.5 max-w-md text-blue-100">{shop.tagline}</p>
              <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs text-blue-100">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" aria-hidden="true" />
                Powered by ChatCart AI
              </p>
              {!slug && (
                <p className="mt-3 text-sm"><Link href="/new" className="font-semibold text-blue-200 underline-offset-4 hover:underline">Sell something too? Create your own shop →</Link></p>
              )}
            </div>
            <MenuList menu={menu} onRetry={loadMenu} />
            {!slug && (
              <Link href="/new" className="block rounded-2xl border border-blue-200 bg-brand-soft p-5 transition hover:border-brand">
                <p className="font-semibold text-navy-900">Create your own shop in a minute</p>
                <p className="mt-1 text-sm text-slate-600">Paste your menu, get a shareable link and an AI sales agent that takes payment.</p>
                <span className="mt-2 inline-block text-sm font-semibold text-brand">Get started →</span>
              </Link>
            )}
          </div>

          <div className="order-1 lg:sticky lg:top-20 lg:order-2">
            <ChatPanel
              endpoint="/api/chat"
              title={`Chat with ${shop.name || "us"}`}
              subtitle="Our AI assistant takes your order — you confirm and pay"
              avatar={<BakeryIcon />}
              greeting={`Hi! Welcome to ${shop.name || "our shop"}. Tell me what you'd like and when you need it, and I'll put your order together.`}
              starters={starters}
              placeholder="Type your order…"
              body={chatBody}
              className="h-[34rem] lg:h-[calc(100vh-7.5rem)] lg:max-h-[46rem] lg:min-h-[32rem]"
              onResponse={onResponse as (d: { reply: string }) => unknown}
              renderExtra={(extra) => <OrderCard order={extra as OrderX} paypalEnabled={Boolean(CLIENT_ID)} />}
            />
          </div>
        </div>
      </main>
    </PayPalWrap>
  );
}

function ShopNotFound() {
  return (
    <main className="mx-auto max-w-lg px-4 py-20 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-soft text-2xl" aria-hidden="true">🔎</div>
      <h1 className="mt-4 text-2xl font-bold text-navy-900">We couldn&apos;t find that shop</h1>
      <p className="mt-2 text-slate-600">The link may be mistyped, or the shop may no longer exist. Ask the seller for their shop link.</p>
      <div className="mt-6 flex justify-center gap-3">
        <Link href="/new" className="rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark">Create your own shop</Link>
        <Link href="/" className="rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-navy-900 hover:bg-slate-50">See the demo shop</Link>
      </div>
    </main>
  );
}
