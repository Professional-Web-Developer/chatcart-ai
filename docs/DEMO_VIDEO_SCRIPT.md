# Demo video script (target 2:40, hard limit under 3:00)

Presenter notes: speak slowly, short sentences, simple words. Pause one second between sentences. Use a screen recording with your voice. A small face camera is optional. Words in quotes are the exact lines. Before recording, open the live demo in one window and the dashboard (`/dashboard`, PIN 246810) in a second window. Have a PayPal sandbox buyer account ready and already logged out. Use the real order code shown on screen where the script says CC-xxxx.

| Time | On screen | Say (exact words) |
| --- | --- | --- |
| 0:00 - 0:15 | Title card: "ChatCart AI". Then a photo or simple slide of a chat with a handwritten price list. (Use your own image, no logos.) | "Hello, I am Kavin. Many small sellers, like home bakers and tailors, take orders in chat. They type prices by hand, add up totals, and wait for payment screenshots. It is slow, and it has mistakes." |
| 0:15 - 0:30 | Customer storefront (`/`) showing the shop and menu. | "This is ChatCart AI. It is an AI sales agent for small shops. This is a demo shop, Anu's Home Bakery. Payments here use the PayPal sandbox, so no real money moves." |
| 0:30 - 1:00 | Type in the chat: "Hi! I'm Priya. I'd like a chocolate truffle cake and a box of 6 cupcakes for Saturday, no nuts." Show the agent reply with the summary and total. | "A customer writes in normal language. The agent finds the items on the menu and asks what it needs. Now it shows a summary and the total. The total comes from the server, not from the AI. The AI never sets a price." |
| 1:00 - 1:10 | Type "Yes, please confirm." The PayPal button and the order code appear. | "I confirm. Only now the order is created, with a PayPal order and a short code." |
| 1:10 - 1:30 | Click the PayPal button. Log in with the sandbox buyer. Approve. Show the chat confirmation. | "I pay with PayPal, right inside the chat. This is a sandbox buyer account. The server checks the payment with PayPal, captures it, and marks the order as paid." |
| 1:30 - 1:45 | Switch to the dashboard window. Show the order with status PAID and the stats. | "On the owner dashboard, the order is now PAID, and the stats are updated." |
| 1:45 - 2:05 | In the dashboard assistant type "What's pending today?" then "How much did I make?" Show the answers. | "The owner does not need to click through screens. The owner can just ask. What is pending today? How much did I make? The assistant uses tools to read real data. It does not guess." |
| 2:05 - 2:25 | Type "Refund order CC-xxxx". Show the assistant asking to confirm. Type "Yes, refund it." Show the order change to REFUNDED. | "Now a refund. I ask to refund this order. The assistant first asks me to confirm the order, the customer and the amount. After I say yes, it calls the PayPal refund API. The order is now REFUNDED. The assistant cannot refund without this second message." |
| 2:25 - 2:40 | Show the architecture diagram from the README (Mermaid) or a simple slide. | "How is it built? Next.js and TypeScript, the Vercel AI SDK with tool calling, and PayPal REST APIs: Orders, Payments refunds, and Invoicing. The safety rules are in the server code: server-side prices, confirm before payment, confirm before refund." |
| 2:40 - 2:55 | Show the GitHub repo page with the licence, then the live demo URL on screen. | "It is open source with an MIT licence. You can try the live demo and test it with a PayPal sandbox account. The steps are in the README. Thank you for watching ChatCart AI." |

Word count check: the spoken text is about 330 words, which fits at a slow pace. If you run over 3:00, cut the sentence "The assistant cannot refund without this second message." and shorten the problem intro.

## Recording checklist

- [ ] Resolution 1920x1080 (1080p), landscape.
- [ ] Browser zoom 110-125% so text is readable. Hide bookmarks and personal tabs.
- [ ] Use a clean browser profile. Do not show real emails, real PayPal logins or API secrets. Never show `.env.local`.
- [ ] Do a full dry run first. Make sure the order really goes PAID and the refund works.
- [ ] Use a sandbox buyer account only. Confirm the page shows sandbox.
- [ ] Clear audio, quiet room, no background noise.
- [ ] No copyrighted music. Use no music, or music you own or that is royalty-free with a licence that allows it.
- [ ] No third-party logos or brand material beyond the PayPal buttons that the app itself shows. No other company logos in slides or backgrounds.
- [ ] Length under 3:00 (aim 2:40). Judges may stop watching after 3 minutes.
- [ ] Everything in English, with English captions if possible.
- [ ] Upload to YouTube (or Vimeo/Youku/Facebook Video) as **Public** (not Unlisted or Private, unless the rules allow it).
- [ ] Open the video link in a **private/incognito window** while logged out, and confirm it plays.
- [ ] Add the video URL to Devpost and to the README (`<DEMO_VIDEO_URL>`).
- [ ] Also check the live demo URL and the GitHub repo link in a private window. The repo must be public and show the MIT licence.
