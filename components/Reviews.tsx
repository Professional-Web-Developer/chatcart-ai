"use client";

import { useEffect, useState } from "react";
import { shortDate } from "./format";

export type PublicReview = { rating: number; comment: string; customerFirstName: string; createdAt: string };
export type ReviewsData = { stats: { count: number; average: number }; reviews: PublicReview[] };

/** Public reviews of a shop (GET /api/reviews). Failures stay silent: reviews are optional on the storefront. */
export function useReviews(slug?: string, refreshMs = 0): ReviewsData | null {
  const [data, setData] = useState<ReviewsData | null>(null);
  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch(slug ? `/api/reviews?shop=${encodeURIComponent(slug)}` : "/api/reviews", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => { if (alive && d?.stats && Array.isArray(d.reviews)) setData(d as ReviewsData); })
        .catch(() => {});
    void load();
    const id = refreshMs ? setInterval(() => void load(), refreshMs) : undefined;
    return () => { alive = false; if (id) clearInterval(id); };
  }, [slug, refreshMs]);
  return data;
}

export function Stars({ rating, className = "" }: { rating: number; className?: string }) {
  const n = Math.max(0, Math.min(5, Math.round(rating)));
  return (
    <span className={`text-amber-500 ${className}`} role="img" aria-label={`${n} out of 5 stars`}>
      {"★".repeat(n)}<span className="text-slate-300">{"★".repeat(5 - n)}</span>
    </span>
  );
}

export function reviewCountLabel(count: number) {
  return `${count} review${count === 1 ? "" : "s"}`;
}

export function WhatCustomersSay({ reviews }: { reviews: PublicReview[] }) {
  if (reviews.length === 0) return null;
  return (
    <section aria-label="What customers say" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-base font-semibold text-navy-900">What customers say</h2>
      <ul className="mt-3 space-y-3">
        {reviews.slice(0, 3).map((r, i) => (
          <li key={`${r.createdAt}-${i}`} className="rounded-xl border border-slate-100 bg-slate-50/60 p-3 text-sm">
            <Stars rating={r.rating} />
            {r.comment && <p className="mt-1 break-words text-slate-700">{r.comment}</p>}
            <p className="mt-1 text-xs text-slate-500">{r.customerFirstName || "A customer"}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function ReviewsPanel({ data }: { data: ReviewsData | null }) {
  return (
    <section aria-label="Reviews" className="max-w-2xl rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      {!data && <div className="h-16 animate-pulse rounded-lg bg-slate-100" aria-label="Loading reviews" />}
      {data && data.stats.count === 0 && (
        <div className="px-4 py-10 text-center">
          <p className="font-semibold text-navy-900">No reviews yet</p>
          <p className="mx-auto mt-1 max-w-xs text-sm text-slate-500">After a customer collects their order, they can tell the chat assistant their order code and rating. Verified reviews will show up here.</p>
        </div>
      )}
      {data && data.stats.count > 0 && (
        <>
          <div className="flex items-baseline gap-3">
            <p className="text-3xl font-bold tabular-nums tracking-tight text-navy-900">{data.stats.average.toFixed(1)}</p>
            <Stars rating={data.stats.average} className="text-lg" />
            <p className="text-sm text-slate-500">{reviewCountLabel(data.stats.count)}</p>
          </div>
          <ul className="mt-4 divide-y divide-slate-100">
            {data.reviews.map((r, i) => (
              <li key={`${r.createdAt}-${i}`} className="py-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <Stars rating={r.rating} />
                  <span className="text-xs text-slate-500">{shortDate(r.createdAt)}</span>
                </div>
                {r.comment && <p className="mt-1 break-words text-slate-700">{r.comment}</p>}
                <p className="mt-0.5 text-xs text-slate-500">{r.customerFirstName || "A customer"}</p>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
