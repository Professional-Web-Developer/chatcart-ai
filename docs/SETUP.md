# Setup guide

This guide starts from zero. You need about 20 minutes. Everything here is free. Back to the [README](../README.md).

The app builds and starts with no variables at all. It shows a "Setup needed" banner until PayPal and an AI key are set. Menu names on the PayPal, Groq, Neon and Vercel websites can change, so the labels below may differ slightly.

You will need:

- Node.js 20 or newer and npm.
- A PayPal developer account (free).
- One AI key (Groq is recommended because it has a free tier).
- Optional: a Neon Postgres database, and a Vercel account for deployment.

## 1. PayPal developer account and sandbox app

1. Go to <https://developer.paypal.com> and log in. A normal PayPal login works.
2. Open **Apps & Credentials** and switch the toggle to **Sandbox**.
3. Click **Create App**. Name it (for example `chatcart-ai`) and choose the type **Merchant**.
4. Copy the **Client ID** and the **Secret** from the app page.

You will use them as:

- `PAYPAL_CLIENT_ID` and `NEXT_PUBLIC_PAYPAL_CLIENT_ID`: the Client ID (the same value in both).
- `PAYPAL_CLIENT_SECRET`: the Secret. Keep it private.

Important: the sandbox app belongs to a sandbox **business** account. Its country matters. Read the next section before you test.

## 2. Sandbox accounts and the country rule

PayPal does not support payments between two Indian accounts, and the sandbox follows the same rule. A default Indian sandbox buyer cannot pay a default Indian sandbox seller. In the PayPal window you will see "Things don't appear to be working at the moment".

What to do:

1. In the developer dashboard open **Testing Tools** and **Sandbox Accounts**.
2. Click **Create account**. Choose **Personal** and set the country to **United States**. This is your test buyer.
3. Click the three dots on the account and choose **View/Edit account** to see its email and password. Use these in the PayPal window. Never use your real PayPal login.
4. If payment still fails, create a **Business** sandbox account in the **United States**. Then create the app (step 1) while using that account, and use that app's Client ID and Secret.

The exact dashboard labels may differ slightly from the ones written here.

## 3. Get a free AI key

The app uses the first key it finds, in this order: `GOOGLE_GENERATIVE_AI_API_KEY`, `GROQ_API_KEY`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`. Set only one.

**Recommended: Groq (free tier).**

1. Create an account at <https://console.groq.com>.
2. Open **API Keys** and create a key.
3. Set `GROQ_API_KEY` to that key. The default model is `openai/gpt-oss-120b`. The live demo uses this setup.

Other supported providers:

| Provider | Variable | Default model |
| --- | --- | --- |
| Google Gemini | `GOOGLE_GENERATIVE_AI_API_KEY` | `gemini-flash-latest` |
| Groq | `GROQ_API_KEY` | `openai/gpt-oss-120b` |
| Anthropic Claude | `ANTHROPIC_API_KEY` | `claude-haiku-5-5` |
| OpenAI | `OPENAI_API_KEY` | `gpt-5.4-mini` |

To use another model of the same provider, set `AI_MODEL` to its model id. Free tiers have rate limits, so the chat can be slow or refuse for a short time when it is busy.

## 4. Optional: Neon database

Without a database the app keeps orders, shops and quote requests in memory. They are lost on restart, and on Vercel they are not shared between server instances. Use a database for any real test.

1. Create a free project at <https://neon.tech>.
2. Copy the connection string (it starts with `postgres://` or `postgresql://`).
3. Set it as `DATABASE_URL`.

The tables (`orders`, `shops`, `quotes`) are created automatically on first use. You do not run any migration.

## 5. Optional: register the webhook

The main payment flow works without webhooks. A webhook keeps status in sync when something happens outside the app, for example an invoice paid by the customer in PayPal.

1. Deploy the app first (see step 7), because PayPal needs a public URL.
2. In the PayPal developer dashboard open your sandbox app and find **Webhooks** (or **Add Webhook**).
3. Set the URL to `https://<your-domain>/api/webhooks/paypal`.
4. Select these three event types:
   - `PAYMENT.CAPTURE.COMPLETED`
   - `PAYMENT.CAPTURE.REFUNDED`
   - `INVOICING.INVOICE.PAID`
5. Save. Copy the **Webhook ID**.
6. Set `PAYPAL_WEBHOOK_ID` to it and redeploy.

Without `PAYPAL_WEBHOOK_ID`, `/api/webhooks/paypal` answers 503 and ignores every call.

## 6. Run locally

```bash
git clone https://github.com/Professional-Web-Developer/chatcart-ai.git
cd chatcart-ai
npm install
cp .env.example .env.local
```

Edit `.env.local` and fill in the values from steps 1 to 5. Then:

```bash
npm run dev
```

Open <http://localhost:3000>. Restart `npm run dev` after you change `.env.local`. For a production build use `npm run build && npm start`. To run the unit tests use `npm test`.

`NEXT_PUBLIC_PAYPAL_CLIENT_ID` is embedded when the app is built. If you change it, build again.

## 7. Deploy on Vercel

1. Push the repository to your own GitHub account.
2. In Vercel choose **Add New**, then **Project**, and import the repository. The framework is detected as Next.js.
3. Before the first deploy, open **Settings**, then **Environment Variables**, and add:

| Variable | Value |
| --- | --- |
| `PAYPAL_CLIENT_ID` | Sandbox Client ID |
| `NEXT_PUBLIC_PAYPAL_CLIENT_ID` | The same Client ID |
| `PAYPAL_CLIENT_SECRET` | Sandbox Secret |
| `GROQ_API_KEY` (or another AI key) | Your AI key |
| `DATABASE_URL` | Neon connection string |
| `OWNER_PIN` | Optional. PIN of the demo shop. Default is `246810`, which is public, so change it for your own deployment |
| `PAYPAL_WEBHOOK_ID` | Optional. After step 5 |

4. Deploy. If you add or change a variable later, redeploy so it takes effect (always for `NEXT_PUBLIC_PAYPAL_CLIENT_ID`).
5. Keep `PAYPAL_API_BASE` unset (or at `https://api-m.sandbox.paypal.com`). The browser PayPal button is also fixed to the sandbox in the code.

## 8. Verification checklist

- [ ] `https://<your-domain>/api/health` shows `"paypal": true`, `"ai": true`, the right `aiProvider`, and `"db": "postgres"` if you set `DATABASE_URL`. `"webhook": true` shows only if you set `PAYPAL_WEBHOOK_ID`.
- [ ] No "Setup needed" banner on the home page.
- [ ] The menu loads and the chat answers.
- [ ] An order through the chat shows an order code and a PayPal button.
- [ ] A payment with a **United States** sandbox buyer account completes, and the card says "Payment received".
- [ ] `/dashboard` accepts the owner PIN and the order shows as **Paid**.
- [ ] In the Assistant, `Refund order CC-xxxx` asks for confirmation, and after a yes the order shows **Refunded**.
- [ ] `/new` creates a shop and shows a PIN once.
- [ ] Optional: after a real sandbox payment, the PayPal webhook delivery log shows a 200 answer from your route.
