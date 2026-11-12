import type { OrderX } from "./types";

const styles: Record<string, { label: string; cls: string }> = {
  PAID: { label: "Paid", cls: "bg-emerald-50 text-emerald-800 ring-emerald-200" },
  PENDING_PAYMENT: { label: "Pending payment", cls: "bg-amber-50 text-amber-800 ring-amber-200" },
  INVOICED: { label: "Invoiced", cls: "bg-blue-50 text-blue-800 ring-blue-200" },
  REFUNDED: { label: "Refunded", cls: "bg-slate-100 text-slate-700 ring-slate-300" },
  CANCELLED: { label: "Cancelled", cls: "bg-red-50 text-red-800 ring-red-200" },
};

const base = "inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset";

export function StatusBadge({ order }: { order: Pick<OrderX, "status" | "fulfilment" | "invoiceUrl"> }) {
  const s = styles[order.status] ?? { label: order.status, cls: "bg-slate-100 text-slate-700 ring-slate-300" };
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <span className={`${base} ${s.cls}`}>{s.label}</span>
      {order.fulfilment === "READY" && <span className={`${base} bg-violet-50 text-violet-800 ring-violet-200`}>Ready</span>}
      {order.invoiceUrl && (
        <a href={order.invoiceUrl} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-brand underline-offset-2 hover:underline">
          Invoice link
        </a>
      )}
    </span>
  );
}
