# HTTP API

All routes are Next.js route handlers under `app/api`. Back to the [README](../README.md). Architecture is in [TECHNICAL.md](TECHNICAL.md).

## Conventions

- Bodies and responses are JSON. Most responses send `Cache-Control: no-store`.
- Errors from most routes look like `{ "error": "Plain English message" }`. The capture route uses `{ "ok": false, "error": "..." }`.
- **Owner auth.** Owner routes need the header `x-owner-pin: <6-digit PIN>`. The shop is chosen with `?shop=<slug>` (query) or `shop` (body). When the shop is missing, the demo shop `anus-home-bakery` is used.
  - Missing header: `401 Owner PIN required.`
  - Wrong PIN: `401 Wrong owner PIN.`
  - Too many wrong PINs: `429 Too many wrong PIN attempts. Please wait a few minutes and try again.` (8 wrong tries per 5 minutes per shop and caller, and 40 per 5 minutes per shop).
- **Shop slug** format: lowercase letters, digits and `-`, 1 to 60 characters.
- **Common errors** (from `lib/http.ts`):
  - `404` `We could not find that shop.`
  - `503` AI or PayPal is not configured (message says which variable to add).
  - `502` PayPal could not process the request. `404` if PayPal could not find the order.
  - `500` `Something went wrong on our side. Please try again in a moment.`
- Rate limits are kept in memory, per server instance.

## Summary

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/api/health` | none | Which parts are configured |
| GET | `/api/menu` | none | Shop name, tagline and menu |
| GET | `/api/shops/<slug>` | none | Public shop info |
| POST | `/api/chat` | none | Customer agent |
| POST | `/api/orders/capture` | none | Verify and capture a PayPal payment |
| POST | `/api/owner/verify` | none (checks a PIN) | Check an owner PIN |
| GET | `/api/orders` | owner PIN | Orders and stats |
| GET | `/api/quotes` | owner PIN | Custom quote requests |
| POST | `/api/owner-chat` | owner PIN | Owner agent |
| POST | `/api/shops/import` | none (rate limited) | Create a shop from a price list |
| POST | `/api/webhooks/paypal` | PayPal signature | PayPal webhook receiver |

---

## GET /api/health

No auth. Response `200`:

```json
{ "paypal": true, "ai": true, "aiProvider": "groq", "db": "postgres", "webhook": false }
```

- `paypal`: both `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET` are set.
- `ai`: an AI key is set. `aiProvider` is `google`, `groq`, `anthropic`, `openai` or `null`.
- `db`: `postgres` or `memory`.
- `webhook`: `PAYPAL_WEBHOOK_ID` is set.

No secrets are returned.

## GET /api/menu?shop=\<slug\>

No auth. `shop` is optional (default: demo shop).

`200`:

```json
{
  "shop": { "slug": "anus-home-bakery", "name": "Anu's Home Bakery", "tagline": "..." },
  "items": [
    { "id": "choc-truffle-cake", "name": "...", "description": "...", "priceUsd": 32, "category": "Cakes", "emoji": "🎂" }
  ]
}
```

Errors: `404` unknown shop.

## GET /api/shops/\<slug\>

No auth. `200`: `{ "shop": { "slug", "name", "tagline", "items": [...], "createdAt" } }`. Errors: `404`.

## POST /api/chat

Customer agent. No auth. Limit: 40 requests per 5 minutes per IP address.

Request:

```json
{ "messages": [{ "role": "user", "content": "2 chocolate cakes for Saturday" }], "shop": "anus-home-bakery" }
```

- `messages`: 1 to 60 items. `role` is `user` or `assistant`. `content` is up to 4,000 characters. The last message must be from `user`. The agent uses the last 30.
- `shop`: optional slug.

Response `200`: `{ "reply": "text", "order": { ... } }`. `order` is present only when the agent created an order in this turn. It is the full order object (see the data model in [TECHNICAL.md](TECHNICAL.md#data-model)), including `shortCode`, `paypalOrderId`, `lines`, `total` and `status: "PENDING_PAYMENT"`.

Errors:

| Code | Meaning |
| --- | --- |
| 400 | `Please send a list of chat messages.` or `The last message must be from the customer.` |
| 404 | Unknown shop |
| 429 | `You are sending messages very quickly. Please wait a minute and try again.` |
| 503 | No AI key, or PayPal not configured |
| 502 / 500 | PayPal or server error |

## POST /api/orders/capture

Called by the browser after the buyer approves in the PayPal button. No auth. The server verifies the order with PayPal before it captures.

Request: `{ "paypalOrderId": "5O190127TN364715T" }`. The id is 5 to 64 characters: letters, digits, `_`, `-`.

Response `200`: `{ "ok": true, "order": { ... } }`. The call is idempotent: an order already `PAID` or `REFUNDED` is returned as is.

Errors (all `{ "ok": false, "error": "..." }`):

| Code | Meaning |
| --- | --- |
| 400 | `Please send a valid paypalOrderId.` |
| 404 | `We could not find an order for that PayPal payment.` |
| 409 | The order cannot be paid with the button (not `PENDING_PAYMENT`, or a custom/invoice order); PayPal's order does not match ours (id, currency or amount); the payment is not approved yet; or the captured amount differs |
| 402 | PayPal has not completed the payment |
| 503 / 502 / 500 | PayPal not configured, PayPal error, server error |

## POST /api/owner/verify

Checks a PIN. Counts wrong tries like the other owner routes.

Request: `{ "shop": "anus-home-bakery", "pin": "246810" }` (`shop` optional, `pin` up to 20 characters).

Response `200`: `{ "ok": true }` for a correct PIN, or `{ "ok": false }` for a wrong one (the status is still 200).

Errors: `400` `Please send a shop and a PIN.`; `404` unknown shop; `429` locked.

## GET /api/orders?shop=\<slug\>

Owner auth. Response `200`:

```json
{
  "orders": [ { "id": "...", "shortCode": "CC-1234", "status": "PAID", "lines": [], "total": 50, "...": "..." } ],
  "stats": { "paidCount": 1, "pendingCount": 0, "refundedCount": 0, "invoicedCount": 0, "revenue": 50 }
}
```

Orders are newest first, at most 500 with Postgres. `revenue` counts only `PAID` orders, in US dollars. Errors: `401`, `404`, `429`.

## GET /api/quotes?shop=\<slug\>

Owner auth. Response `200`: `{ "quotes": [ { "id", "shopSlug", "customerName", "customerEmail?", "description", "status": "PENDING" | "INVOICED", "orderShortCode?", "createdAt" } ] }`. Newest first, at most 200 with Postgres. Errors: `401`, `404`, `429`.

## POST /api/owner-chat

Owner agent. Owner auth.

Request: same shape as `/api/chat` (`messages`, optional `shop`). The last message must be from `user`.

Response `200`: `{ "reply": "text", "changed": true }`. `changed` is `true` when a tool changed data (mark ready, refund, invoice), so the dashboard refreshes.

Errors: `400` (bad body, or last message not from the owner), `401`, `404`, `429`, `503`, `502`, `500`.

Refunds and invoices are done by the agent only when the conversation passes the confirmation checks (see [TECHNICAL.md](TECHNICAL.md#security-model)). A refused action is reported in the reply text, not as an HTTP error.

## POST /api/shops/import

Creates a shop from a pasted price list. No auth. Limit: 5 per hour per IP address. Global cap: 200 shops.

Request:

```json
{ "name": "Meena's Tailoring", "rawMenu": "blouse stitching 18\nkurta men 22" }
```

- `name`: 2 to 60 characters after control characters are removed.
- `rawMenu`: 5 to 8,000 characters.

Response `201`:

```json
{
  "shop": { "slug": "meenas-tailoring", "name": "...", "tagline": "...", "items": [], "createdAt": "..." },
  "ownerPin": "123456",
  "skipped": ["Item priced in another currency"]
}
```

- `ownerPin` is shown only in this response. Only its hash is stored.
- `skipped` is present only when some items were dropped because their price was not in US dollars.

Errors:

| Code | Meaning |
| --- | --- |
| 400 | `Please give your shop a name and paste your menu (up to 8,000 characters).` |
| 422 | The model output could not be read; every price was in another currency (`Prices must be in US dollars...`); or no item with a price was found |
| 429 | `You are creating shops too quickly. Please try again later.` |
| 503 | No AI key, or the shop cap is reached |

## POST /api/webhooks/paypal

PayPal calls this route. It is not for browsers.

- If `PAYPAL_WEBHOOK_ID` is not set: `503 Webhooks are not configured (set PAYPAL_WEBHOOK_ID).`
- The body must be JSON (`400 Invalid webhook body.` otherwise). The raw body and the `paypal-*` headers are sent to PayPal's verify-webhook-signature API. If verification fails: `401 Webhook signature could not be verified.`
- On success: `200 { "received": true }`. Events handled:
  - `PAYMENT.CAPTURE.COMPLETED`: marks a `PENDING_PAYMENT` order `PAID` if the USD amount equals our total.
  - `PAYMENT.CAPTURE.REFUNDED`: marks a `PAID` order `REFUNDED` (found by capture id).
  - `INVOICING.INVOICE.PAID`: marks an `INVOICED` order `PAID`.
  - Other event types are acknowledged and ignored.
