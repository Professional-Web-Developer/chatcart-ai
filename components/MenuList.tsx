"use client";

import { useState } from "react";
import type { MenuItem } from "@/lib/types";
import { money } from "./format";

export type MenuState = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; items: MenuItem[] };

export function MenuList({ menu, onRetry }: { menu: MenuState; onRetry: () => void }) {
  const [open, setOpen] = useState(false);

  return (
    <section aria-label="Menu" className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between rounded-2xl px-5 py-4 text-left lg:cursor-default"
      >
        <span className="text-base font-semibold text-navy-900">Menu</span>
        <span className="flex items-center gap-1 text-sm font-medium text-brand lg:hidden">
          {open ? "Hide" : "Show"}
          <svg viewBox="0 0 20 20" className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} fill="currentColor" aria-hidden="true">
            <path d="M5.3 7.3a1 1 0 0 1 1.4 0L10 10.6l3.3-3.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 0-1.4Z" />
          </svg>
        </span>
      </button>

      <div className={`${open ? "block" : "hidden"} border-t border-slate-100 px-5 pb-5 lg:block`}>
        {menu.status === "loading" && (
          <div className="space-y-3 pt-4" aria-label="Loading menu">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-14 animate-pulse rounded-xl bg-slate-100" />
            ))}
          </div>
        )}
        {menu.status === "error" && (
          <div className="pt-4 text-sm text-slate-600">
            <p>We couldn&apos;t load the menu. {menu.message}</p>
            <button type="button" onClick={onRetry} className="mt-2 font-semibold text-brand hover:underline">
              Try again
            </button>
          </div>
        )}
        {menu.status === "ready" && <Groups items={menu.items} />}
      </div>
    </section>
  );
}

function Groups({ items }: { items: MenuItem[] }) {
  const groups = new Map<string, MenuItem[]>();
  for (const it of items) groups.set(it.category, [...(groups.get(it.category) ?? []), it]);
  if (!items.length) return <p className="pt-4 text-sm text-slate-500">The menu is empty right now.</p>;
  return (
    <div className="space-y-5 pt-4">
      {[...groups.entries()].map(([cat, list]) => (
        <div key={cat}>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">{cat}</h3>
          <ul className="space-y-2">
            {list.map((it) => (
              <li key={it.id} className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-white text-2xl shadow-sm" aria-hidden="true">
                  {it.emoji}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-900">{it.name}</p>
                  <p className="text-xs leading-snug text-slate-500">{it.description}</p>
                </div>
                <p className="shrink-0 text-sm font-semibold tabular-nums text-navy-900">{money(it.priceUsd)}</p>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
