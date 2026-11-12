# Devpost submission text (ready to paste)

Replace the video placeholder before submitting.

## Project name

ChatCart AI

## Tagline (179 characters; limit 200)

Customers order by chat, an AI agent confirms the cart with server-side prices, and they pay with PayPal in the chat. Owners check sales, invoice custom orders and refund by chat.

## About the project (paste as Markdown)

## Inspiration

Many home bakers, tailors and snack makers in my region sell through WhatsApp and Instagram chats. Every order is a manual conversation: someone asks what is available, the seller types a price, adds up the total by hand, shares payment details and waits for a screenshot. Mistakes in totals and unverified payments are normal, and refunds are awkward. I wanted to see if an AI agent could take over that conversation while PayPal handles the money safely.

## What it does

ChatCart AI is a sales agent for small chat-based sellers. The demo shop is "Anu's Home Bakery".

**Customer side:** the customer writes in plain language. The agent matches the request to the menu, asks follow-up questions, shows a cart summary and waits for an explicit yes. Then the server creates a PayPal order and PayPal buttons appear inside the chat. After the customer pays, the server verifies and captures the payment and the order becomes PAID. The customer can also ask for the status of an order. If they want something that is not on the menu, the agent records a custom request and never invents a price.

**Owner side:** a dashboard (protected by a 6-digit PIN) shows live orders and stats. The owner talks to an assistant: "what's pending today?", "how much did I make?", "mark CC-1234 as ready". The assistant can refund a paid order through the PayPal refund API, and can send a PayPal invoice for a custom request. Both actions only happen after the owner confirms in a separate message.

**Create your own shop:** a seller pastes a messy price list and the AI turns it into a menu, with a storefront link, a dashboard and a PIN.

## How we built it

- Next.js 16 (App Router), React 19, TypeScript and Tailwind CSS 4.
- Vercel AI SDK v7. The customer agent has four tools (`get_menu`, `create_order`, `get_order_status`, `request_custom_quote`). The owner agent has six (`list_orders`, `sales_summary`, `list_quote_requests`, `mark_ready`, `refund_order`, `create_custom_invoice`). The model provider is chosen from whichever key is set: Gemini, Groq, Claude or OpenAI (the live demo runs on Groq).
- PayPal REST APIs in the sandbox: OAuth, Orders v2 (create, get, capture), Payments v2 (refund), Invoicing v2 (create, send), and webhook signature verification. The buyer pays with the PayPal JS SDK buttons inside the chat.
- Neon Postgres for storage, deployed on Vercel, with an in-memory fallback so the project runs with no setup.

The main design rule is that the AI never touches money directly. The model can only pass item ids and quantities. The server computes prices in integer cents from the menu, creates the PayPal order, and before capture it re-reads the order from PayPal to check that the id, currency and amount match what it stored. Refunds and invoices need a `confirmed` flag, and the server also checks that an earlier assistant message exists, so the model cannot ask and confirm in the same turn.

## Challenges we ran into

- **Keeping the model away from prices.** It is easy for a language model to say a wrong total. I removed price from the tool inputs completely and made the server the only source of totals.
- **Confirmation that is more than a prompt.** A prompt rule like "ask first" can be ignored, so I added server-side checks for refunds and invoices.
- **Making payment state trustworthy.** The browser telling the server "I paid" is not enough. The capture route verifies the order with PayPal first and is idempotent, so a double click or a retry does not break anything.
- **Messy real-world menus.** Sellers paste prices in many formats. The AI extraction output is treated as untrusted and cleaned and limited by code.
- **Building it all in one hackathon window** with APIs and SDK versions newer than most documentation.

## Accomplishments that we're proud of

- A complete loop that works end to end: chat, confirm, PayPal payment, PAID on the dashboard, refund by chat.
- Safety rules enforced in code, not only in the prompt.
- Real use of more than one PayPal API: Orders, Payments refunds, Invoicing and webhooks.
- The app builds and starts with no configuration and shows a clear setup notice instead of crashing.
- Any seller can create their own shop from a pasted price list.

## What we learned

- Agent tools should be designed so that the dangerous mistake is impossible, not just discouraged.
- PayPal's idempotency headers and server-side order verification make an agent-driven checkout much easier to trust.
- Plain-language chat is a good interface for owners too, not only for customers.

## What's next

- WhatsApp and Instagram channels, where these sellers already work.
- Real owner accounts instead of a PIN.
- Inventory and daily capacity limits, partial refunds, more currencies and delivery options.
- Automated tests for the agent safety rules.
- Going live with PayPal after account review.

## Built With (tags)

paypal, paypal-orders-api, paypal-payments-api, paypal-invoicing-api, paypal-webhooks, nextjs, react, typescript, tailwindcss, vercel-ai-sdk, google-gemini, anthropic-claude, openai, zod, postgresql, node.js

(Keep only the tags you actually used in your deployed build; remove unused AI providers.)

## Links

- Try it out: https://chatcart-ai-alpha.vercel.app
- GitHub repository: `<REPO_URL — to be added>` (public, MIT licence)
- Video demo: `<DEMO_VIDEO_URL — to be added>`

## Testing instructions for judges (paste into "Testing instructions" field)

No sign-up is needed. All payments use the PayPal sandbox, so no real money moves.

1. Open the live demo: https://chatcart-ai-alpha.vercel.app.
2. In the customer chat type: `Hi! I'm Priya. I'd like a chocolate truffle cake and a box of 6 cupcakes for Saturday, no nuts.`
3. When the agent shows the summary and total, reply `Yes, please confirm`.
4. Click the PayPal button and log in with a PayPal **sandbox personal (buyer) account**. If you do not have one, create it at developer.paypal.com under Testing Tools > Sandbox Accounts. Approve the payment.
5. Open https://chatcart-ai-alpha.vercel.app/dashboard, enter owner PIN `246810`. The order shows as PAID.
6. In the dashboard assistant type `What's pending today?`, then `Refund order CC-xxxx` (use your order code) and confirm when asked. The order becomes REFUNDED.
7. Optional: `/new` creates your own shop from a pasted price list.

To run it locally, follow the Quick start in the README: `npm install`, copy `.env.example` to `.env.local`, add PayPal sandbox credentials and one AI key, then `npm run dev`. The app also starts with no keys and shows what is missing.
