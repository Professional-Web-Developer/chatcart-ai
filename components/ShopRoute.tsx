"use client";

import { use } from "react";
import { Storefront } from "./Storefront";
import { Dashboard } from "./Dashboard";

export function ShopRoute({ params, mode }: { params: Promise<{ slug: string }>; mode: "store" | "dashboard" }) {
  const { slug } = use(params);
  return mode === "store" ? <Storefront key={slug} slug={slug} /> : <Dashboard key={slug} slug={slug} />;
}
