import { NextResponse } from 'next/server';
import { runOwnerAgent } from '@/lib/agent';
import { fail, handleError, messagesBody, readJson, requireOwner, resolveShop } from '@/lib/http';

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const parsed = messagesBody.safeParse(await readJson(req));
    if (!parsed.success) return fail('Please send a list of chat messages.', 400);
    const { messages, shop: slug } = parsed.data;
    const shop = await resolveShop(slug);
    if (!shop) return fail('We could not find that shop.', 404);
    const denied = await requireOwner(req, shop.slug);
    if (denied) return denied;
    if (messages[messages.length - 1].role !== 'user') return fail('The last message must be from the owner.', 400);
    const out = await runOwnerAgent(messages, shop);
    return NextResponse.json(out, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    return handleError(e);
  }
}
