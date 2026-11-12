import type { OrderLine } from './types';
import { formatUsd, toCents, fromCents } from './menu';

export class PayPalConfigError extends Error {}
export class PayPalError extends Error {
  status: number;
  /** PayPal's machine-readable issue code (details[0].issue), when present. */
  issue?: string;
  constructor(message: string, status: number, issue?: string) {
    super(message);
    this.status = status;
    this.issue = issue;
  }
}

const base = () => (process.env.PAYPAL_API_BASE || 'https://api-m.sandbox.paypal.com').replace(/\/$/, '');

export function paypalConfigured(): boolean {
  return Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET);
}

const g = globalThis as unknown as { __ppToken?: { token: string; exp: number } };

async function getAccessToken(): Promise<string> {
  const id = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_CLIENT_SECRET;
  if (!id || !secret) {
    throw new PayPalConfigError('PayPal is not set up yet. Add PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET (sandbox) to the environment.');
  }
  if (g.__ppToken && g.__ppToken.exp > Date.now() + 30_000) return g.__ppToken.token;
  const res = await fetch(`${base()}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + Buffer.from(`${id}:${secret}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
    cache: 'no-store',
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.error('[paypal] token request failed', res.status, body.slice(0, 500));
    throw new PayPalError('Could not sign in to PayPal. Please check the PayPal credentials.', res.status);
  }
  const data = (await res.json()) as { access_token: string; expires_in: number };
  g.__ppToken = { token: data.access_token, exp: Date.now() + data.expires_in * 1000 };
  return data.access_token;
}

async function ppFetch<T>(path: string, init: { method?: string; body?: unknown; rawBody?: string; requestId?: string } = {}): Promise<T> {
  const token = await getAccessToken();
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
  };
  if (init.requestId) headers['PayPal-Request-Id'] = init.requestId;
  const res = await fetch(`${base()}${path}`, {
    method: init.method ?? 'GET',
    headers,
    body: init.rawBody !== undefined ? init.rawBody : init.body === undefined ? undefined : JSON.stringify(init.body),
    cache: 'no-store',
  });
  const text = await res.text();
  let json: unknown = undefined;
  try { json = text ? JSON.parse(text) : undefined; } catch { /* non-JSON */ }
  if (!res.ok) {
    const j = (json ?? {}) as { name?: string; message?: string; debug_id?: string; details?: { issue?: string; description?: string }[] };
    console.error('[paypal] error', res.status, path, 'debug_id=' + j.debug_id, j.name, j.message, JSON.stringify(j.details ?? []));
    const issue = j.details?.[0]?.issue;
    let msg = 'PayPal could not process this request. Please try again.';
    if (issue === 'ORDER_ALREADY_CAPTURED') msg = 'This order has already been captured.';
    else if (issue === 'CAPTURE_FULLY_REFUNDED') msg = 'This payment has already been fully refunded.';
    else if (res.status === 404) msg = 'PayPal could not find that order.';
    else if (res.status === 401) msg = 'PayPal rejected the credentials.';
    throw new PayPalError(msg, res.status, issue);
  }
  return json as T;
}

export type PayPalOrder = {
  id: string;
  status: string;
  purchase_units?: {
    custom_id?: string;
    amount?: { currency_code: string; value: string };
    payments?: { captures?: { id: string; status: string; amount?: { currency_code: string; value: string } }[] };
  }[];
};

export async function createOrder(args: { orderId: string; shopName: string; lines: OrderLine[]; total: number }): Promise<PayPalOrder> {
  const itemCents = args.lines.reduce((s, l) => s + toCents(l.unitPrice) * l.qty, 0);
  if (itemCents !== toCents(args.total)) throw new Error('Order total does not match its line items.');
  const value = formatUsd(fromCents(itemCents));
  return ppFetch<PayPalOrder>('/v2/checkout/orders', {
    method: 'POST',
    requestId: `cc-create-${args.orderId}`,
    body: {
      intent: 'CAPTURE',
      purchase_units: [
        {
          custom_id: args.orderId,
          reference_id: args.orderId,
          description: `Order from ${args.shopName}`.slice(0, 127),
          amount: {
            currency_code: 'USD',
            value,
            breakdown: { item_total: { currency_code: 'USD', value } },
          },
          items: args.lines.map((l) => ({
            name: l.name.slice(0, 127),
            quantity: String(l.qty),
            unit_amount: { currency_code: 'USD', value: formatUsd(l.unitPrice) },
            sku: l.itemId.slice(0, 127),
            category: 'PHYSICAL_GOODS',
          })),
        },
      ],
      payment_source: {
        paypal: { experience_context: { shipping_preference: 'NO_SHIPPING', user_action: 'PAY_NOW', brand_name: args.shopName.slice(0, 127) } },
      },
    },
  });
}

export const getOrder = (paypalOrderId: string) => ppFetch<PayPalOrder>(`/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}`);

export const captureOrder = (paypalOrderId: string) =>
  ppFetch<PayPalOrder>(`/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}/capture`, {
    method: 'POST',
    requestId: `cc-capture-${paypalOrderId}`,
    body: {},
  });

export const refundCapture = (captureId: string, note?: string) =>
  ppFetch<{ id: string; status: string }>(`/v2/payments/captures/${encodeURIComponent(captureId)}/refund`, {
    method: 'POST',
    requestId: `cc-refund-${captureId}`,
    body: note ? { note_to_payer: note.slice(0, 255) } : {},
  });

// ---------------- Invoicing v2 ----------------
type Link = { href: string; rel?: string; method?: string };
export type PayPalInvoice = {
  id?: string;
  status?: string;
  detail?: { metadata?: { recipient_view_url?: string; invoicer_view_url?: string } };
  links?: Link[];
};

export function invoiceIdFromHref(href: string): string {
  return href.split('?')[0].replace(/\/+$/, '').split('/').pop() || '';
}

/** Create draft -> send -> read the payer-facing URL. Returns invoice id and recipient view URL. */
export async function createAndSendInvoice(args: {
  shopName: string; customerName: string; customerEmail: string; description: string; amountCents: number; orderCode: string;
}): Promise<{ invoiceId: string; url: string }> {
  const value = formatUsd(fromCents(args.amountCents));
  const [given, ...rest] = args.customerName.trim().split(/\s+/);
  const draft = await ppFetch<Link & { id?: string }>('/v2/invoicing/invoices', {
    method: 'POST',
    body: {
      detail: {
        currency_code: 'USD',
        reference: args.orderCode,
        note: `Custom order from ${args.shopName}`.slice(0, 4000),
        payment_term: { term_type: 'DUE_ON_RECEIPT' },
      },
      invoicer: { business_name: args.shopName.slice(0, 300) },
      primary_recipients: [{
        billing_info: { name: { given_name: given.slice(0, 140), ...(rest.length ? { surname: rest.join(' ').slice(0, 140) } : {}) }, email_address: args.customerEmail },
      }],
      items: [{ name: args.description.slice(0, 200), quantity: '1', unit_amount: { currency_code: 'USD', value } }],
    },
  });
  const invoiceId = draft.id || (draft.href ? invoiceIdFromHref(draft.href) : '');
  if (!invoiceId) {
    console.error('[paypal] invoice draft response had no id', JSON.stringify(draft).slice(0, 300));
    throw new PayPalError('PayPal created the invoice but did not return its id.', 502);
  }
  const sent = await ppFetch<Link & { links?: Link[] }>(`/v2/invoicing/invoices/${encodeURIComponent(invoiceId)}/send`, {
    method: 'POST',
    body: { send_to_recipient: true, send_to_invoicer: false },
  });
  let url = '';
  try {
    const inv = await ppFetch<PayPalInvoice>(`/v2/invoicing/invoices/${encodeURIComponent(invoiceId)}`);
    url = inv.detail?.metadata?.recipient_view_url || inv.links?.find((l) => l.rel === 'payer-view')?.href || '';
  } catch (e) {
    console.error('[paypal] could not read invoice after send', e);
  }
  if (!url && sent.href && /\/invoice\/p\//.test(sent.href)) url = sent.href;
  if (!url) url = sent.links?.find((l) => l.rel === 'payer-view')?.href || '';
  return { invoiceId, url };
}

// ---------------- Webhook verification ----------------
export const webhookConfigured = () => Boolean(process.env.PAYPAL_WEBHOOK_ID);

/**
 * Builds the verify-webhook-signature request body. PayPal signs the exact bytes it sent, so the event
 * is spliced in as the RAW request text; parsing and re-stringifying it can change the bytes (number
 * formatting, escapes) and make a genuine event fail verification.
 */
export function buildVerifyBody(headers: Headers, rawEvent: string, webhookId: string): string {
  const h = (n: string) => headers.get(n) ?? '';
  const meta = JSON.stringify({
    auth_algo: h('paypal-auth-algo'), cert_url: h('paypal-cert-url'), transmission_id: h('paypal-transmission-id'),
    transmission_sig: h('paypal-transmission-sig'), transmission_time: h('paypal-transmission-time'),
    webhook_id: webhookId,
  });
  return `${meta.slice(0, -1)},"webhook_event":${rawEvent}}`;
}

const TRANSMISSION_HEADERS = ['paypal-auth-algo', 'paypal-cert-url', 'paypal-transmission-id', 'paypal-transmission-sig', 'paypal-transmission-time'];

/** rawEvent must be the unmodified request body and must already be known to be valid JSON. */
export async function verifyWebhookSignature(headers: Headers, rawEvent: string): Promise<boolean> {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  if (!webhookId) return false;
  if (TRANSMISSION_HEADERS.some((n) => !headers.get(n))) return false;
  const out = await ppFetch<{ verification_status?: string }>('/v1/notifications/verify-webhook-signature', {
    method: 'POST',
    rawBody: buildVerifyBody(headers, rawEvent, webhookId),
  });
  return out.verification_status === 'SUCCESS';
}
