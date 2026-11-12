"use client";

import { useState } from "react";
import { PayPalOneTimePaymentButton, usePayPal, INSTANCE_LOADING_STATE } from "@paypal/react-paypal-js/sdk-v6";
import type { OrderX as Order } from "./types";
import { money, shortDate, readError } from "./format";

type Phase = "idle" | "capturing" | "paid";

export function OrderCard({ order, paypalEnabled }: { order: Order; paypalEnabled: boolean }) {
  const [phase, setPhase] = useState<Phase>(order.status === "PAID" ? "paid" : "idle");
  const [message, setMessage] = useState<{ kind: "warn" | "error"; text: string } | null>(null);
  const [ready, setReady] = useState(order.fulfilment === "READY");
  const paid = phase === "paid";
  // Custom orders are paid through a PayPal invoice ("invoice:<id>" is not a checkout order id): never show buttons for them.
  const byInvoice = order.kind === "CUSTOM" || order.status === "INVOICED" || order.paypalOrderId.startsWith("invoice:");
  const closed = order.status === "REFUNDED" || order.status === "CANCELLED";

  return (
    <div className={`cc-rise w-full max-w-md overflow-hidden rounded-2xl border bg-white shadow-md ${paid ? "border-emerald-300" : "border-blue-200"}`}>
      {paid ? (
        <div className="flex items-start gap-3 bg-emerald-50 px-4 py-3.5" role="status">
          <svg viewBox="0 0 20 20" className="mt-0.5 h-6 w-6 shrink-0 text-emerald-600" fill="currentColor" aria-hidden="true">
            <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.7-9.3a1 1 0 0 0-1.4-1.4L9 10.6 7.7 9.3a1 1 0 0 0-1.4 1.4l2 2a1 1 0 0 0 1.4 0l4-4Z" clipRule="evenodd" />
          </svg>
          <div>
            <p className="text-sm font-semibold text-emerald-900">
              Payment received — order confirmed
              {ready && <span className="ml-2 rounded-full bg-violet-100 px-2 py-0.5 text-xs font-semibold text-violet-800">Ready for pickup</span>}
            </p>
            <p className="text-xs text-emerald-800">{ready ? "Ready for pickup! " : ""}Show code <span className="font-mono font-semibold">{order.shortCode}</span> at pickup.</p>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between bg-navy-900 px-4 py-3 text-white">
          <p className="text-sm font-semibold">Your order</p>
          <span className="rounded-md bg-white/15 px-2 py-0.5 font-mono text-xs font-semibold tracking-wide">{order.shortCode}</span>
        </div>
      )}

      <div className="px-4 py-3">
        <ul className="divide-y divide-slate-100 text-sm">
          {order.lines.map((l, i) => (
            <li key={`${l.itemId}-${i}`} className="flex justify-between gap-3 py-2">
              <span className="text-slate-800">
                <span className="font-medium">{l.qty} ×</span> {l.name}
                {l.notes && <span className="block text-xs text-slate-500">{l.notes}</span>}
              </span>
              <span className="shrink-0 tabular-nums text-slate-700">{money(l.lineTotal)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-1 flex items-center justify-between border-t border-slate-200 pt-3">
          <div className="text-xs text-slate-500">
            <p>For {order.customerName}</p>
            {order.pickupDate && <p>Pickup {shortDate(order.pickupDate)}</p>}
          </div>
          <p className="text-lg font-bold tabular-nums text-navy-900">{money(order.total)}</p>
        </div>
      </div>

      {!paid && (
        <div className="border-t border-slate-100 bg-slate-50 px-4 py-4">
          {closed ? (
            <p role="note" className="text-sm text-slate-600">This order was {order.status === "REFUNDED" ? "refunded" : "cancelled"}.</p>
          ) : byInvoice ? (
            <p role="note" className="text-sm text-slate-700">
              This custom order is paid through a PayPal invoice sent by email.
              {order.invoiceUrl && (
                <>
                  {" "}
                  <a href={order.invoiceUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-brand hover:underline">Open the invoice</a>
                </>
              )}
            </p>
          ) : !paypalEnabled ? (
            <p role="note" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Checkout is not available yet: the PayPal client ID (<code className="font-mono text-xs">NEXT_PUBLIC_PAYPAL_CLIENT_ID</code>) is not configured.
            </p>
          ) : (
            <>
              <p className="mb-2 text-xs font-medium text-slate-600">Pay securely to confirm your order</p>
              <div className={phase === "capturing" ? "pointer-events-none opacity-50" : ""}>
                <PayButton
                  order={order}
                  disabled={phase === "capturing"}
                  onStart={() => setMessage(null)}
                  onCapturing={() => setPhase("capturing")}
                  onPaid={(isReady) => {
                    if (isReady) setReady(true);
                    setMessage(null);
                    setPhase("paid");
                  }}
                  onProblem={(kind, text) => {
                    setPhase("idle");
                    setMessage({ kind, text });
                  }}
                />
              </div>
              {phase === "capturing" && <p className="mt-2 text-sm text-slate-600" role="status">Confirming your payment…</p>}
              {message && (
                <p role="alert" className={`mt-3 rounded-lg border px-3 py-2 text-sm ${message.kind === "error" ? "border-red-200 bg-red-50 text-red-900" : "border-amber-200 bg-amber-50 text-amber-900"}`}>
                  {message.text}
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function PayButton({
  order,
  disabled,
  onStart,
  onCapturing,
  onPaid,
  onProblem,
}: {
  order: Order;
  disabled: boolean;
  onStart: () => void;
  onCapturing: () => void;
  onPaid: (ready: boolean) => void;
  onProblem: (kind: "warn" | "error", text: string) => void;
}) {
  const { loadingStatus, error } = usePayPal();

  if (loadingStatus === INSTANCE_LOADING_STATE.REJECTED) {
    return (
      <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
        PayPal could not load{error?.message ? `: ${error.message}` : ""}. Check your connection and the client ID, then refresh the page.
      </p>
    );
  }
  if (loadingStatus === INSTANCE_LOADING_STATE.PENDING) {
    return <div className="h-11 animate-pulse rounded-lg bg-slate-200" aria-label="Loading PayPal" />;
  }

  return (
    <PayPalOneTimePaymentButton
      type="pay"
      disabled={disabled}
      createOrder={async () => {
        onStart();
        return { orderId: order.paypalOrderId };
      }}
      onApprove={async ({ orderId }: { orderId: string }) => {
        onCapturing();
        try {
          const res = await fetch("/api/orders/capture", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ paypalOrderId: orderId || order.paypalOrderId }),
          });
          const data = await res.json().catch(() => null);
          if (!res.ok || !data?.ok) {
            throw new Error(data?.error || (await readError(res, "We couldn't confirm the payment.")));
          }
          onPaid(data.order?.fulfilment === "READY");
        } catch (e) {
          onProblem("error", `${e instanceof Error ? e.message : "We couldn't confirm the payment."} You have not been charged twice — try the button again.`);
        }
      }}
      onCancel={() => onProblem("warn", "Payment cancelled. Your order is still saved — pay whenever you're ready.")}
      onError={() => onProblem("error", "Something went wrong with PayPal. Please try again.")}
    />
  );
}
