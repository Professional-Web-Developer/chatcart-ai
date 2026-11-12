import { NextResponse } from 'next/server';
import { z } from 'zod';
import { checkOwnerPin, fail, handleError, lockedResponse, readJson, resolveShop, slugParam } from '@/lib/http';

const body = z.object({ shop: slugParam.optional(), pin: z.string().max(20) });

export async function POST(req: Request) {
  try {
    const parsed = body.safeParse(await readJson(req));
    if (!parsed.success) return fail('Please send a shop and a PIN.', 400);
    const shop = await resolveShop(parsed.data.shop);
    if (!shop) return fail('We could not find that shop.', 404);
    const r = await checkOwnerPin(req, shop.slug, parsed.data.pin.trim());
    if (r === 'locked') return lockedResponse();
    return NextResponse.json({ ok: r === 'ok' }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    return handleError(e);
  }
}
