import { NextResponse } from 'next/server';
import { runCustomerAgent } from '@/lib/agent';
import { rateLimit } from '@/lib/auth';
import { clientIp, fail, handleError, messagesBody, readJson, resolveShop } from '@/lib/http';

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const parsed = messagesBody.safeParse(await readJson(req));
    if (!parsed.success) return fail('Please send a list of chat messages.', 400);
    const { messages, shop: slug } = parsed.data;
    if (messages[messages.length - 1].role !== 'user') return fail('The last message must be from the customer.', 400);
    const shop = await resolveShop(slug);
    if (!shop) return fail('We could not find that shop.', 404);
    // Each call costs model tokens and may create a PayPal order: cap it per visitor (best effort, per instance).
    if (!rateLimit(`chat:${clientIp(req)}`, 40, 5 * 60_000)) return fail('You are sending messages very quickly. Please wait a minute and try again.', 429);
    const { reply, order } = await runCustomerAgent(messages, shop);
    return NextResponse.json({ reply, ...(order ? { order } : {}) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    return handleError(e);
  }
}
