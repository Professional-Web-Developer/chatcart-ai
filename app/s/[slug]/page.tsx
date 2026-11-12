import { Suspense } from "react";
import { ShopRoute } from "@/components/ShopRoute";

export default function ShopPage({ params }: PageProps<"/s/[slug]">) {
  return (
    <Suspense fallback={<div className="mx-auto max-w-7xl p-8 text-slate-500">Loading shop…</div>}>
      <ShopRoute params={params} mode="store" />
    </Suspense>
  );
}
