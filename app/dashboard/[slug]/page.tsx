import { Suspense } from "react";
import { ShopRoute } from "@/components/ShopRoute";

export default function ShopDashboardPage({ params }: PageProps<"/dashboard/[slug]">) {
  return (
    <Suspense fallback={<div className="mx-auto max-w-7xl p-8 text-slate-500">Loading…</div>}>
      <ShopRoute params={params} mode="dashboard" />
    </Suspense>
  );
}
