import { NextResponse } from 'next/server';
import * as db from '@/lib/db';
import { verifyWebhookSignature, webhookConfigured } from '@/lib/paypal';
import { fail, handleError } from '@/lib/http';

type Ev = { id?: string; event_type?: string; resource?: Record<string, any> }; // eslint-disable-line @typescript-eslint/no-explicit-any

/** PayPal webhook receiver. Signature verified via PayPal; every handler is idempotent (state-guarded updates). */
export async function POST(req: Request) {
  try {
    if (!webhookConfigured()) return fail('Webhooks are not configured (set PAYPAL_WEBHOOK_ID).', 503);
    const text = await req.text();
    let event: Ev;
    try { event = JSON.parse(text); } catch { return fail('Invalid webhook body.', 400); }
    if (!event || typeof event !== 'object' || Array.isArray(event)) return fail('Invalid webhook body.', 400);
    if (!(await verifyWebhookSignature(req.headers, text))) return fail('Webhook signature could not be verified.', 401);

    const r = event.resource ?? {};
    switch (event.event_type) {
      case 'PAYMENT.CAPTURE.COMPLETED': {
        const ppOrderId: string | undefined = r.supplementary_data?.related_ids?.order_id;
        const order = (ppOrderId && (await db.getByPaypalOrderId(ppOrderId))) || (r.custom_id ? await db.getById(String(r.custom_id)) : null);
        // Only accept a capture for the exact amount we priced (integer cents, USD).
        const amountOk = !!order && r.amount?.currency_code === 'USD' && Math.round(Number(r.amount?.value) * 100) === Math.round(order.total * 100);
        if (order && !amountOk) console.error('[webhook] capture amount mismatch for', order.shortCode);
        if (order && amountOk && order.status === 'PENDING_PAYMENT' && r.id) await db.markPaid(order.id, String(r.id));
        break;
      }
      case 'PAYMENT.CAPTURE.REFUNDED': {
        const up = (r.links as { rel?: string; href?: string }[] | undefined)?.find((l) => l.rel === 'up')?.href;
        const captureId = up?.split('/').pop();
        const order = captureId ? await db.getByCaptureId(captureId) : null;
        if (order && order.status === 'PAID') await db.markRefunded(order.id);
        break;
      }
      case 'INVOICING.INVOICE.PAID': {
        const invoiceId: string | undefined = r.invoice?.id ?? r.id;
        const order = invoiceId ? await db.getByInvoiceId(invoiceId) : null;
        if (order && order.status === 'INVOICED') {
          const pid: string | undefined = r.invoice?.payments?.transactions?.[0]?.payment_id;
          await db.markPaid(order.id, pid);
        }
        break;
      }
      default:
        break; // acknowledge events we do not handle
    }
    return NextResponse.json({ received: true });
  } catch (e) {
    return handleError(e);
  }
}
