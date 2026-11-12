import { NextResponse, connection } from 'next/server';
import { listQuotes } from '@/lib/db';
import { fail, handleError, requireOwner, resolveShop } from '@/lib/http';

/** Owner-only list of customer requests for custom items. GET /api/quotes?shop=slug */
export async function GET(req: Request) {
  await connection();
  try {
    const shop = await resolveShop(new URL(req.url).searchParams.get('shop'));
    if (!shop) return fail('We could not find that shop.', 404);
    const denied = await requireOwner(req, shop.slug);
    if (denied) return denied;
    return NextResponse.json({ quotes: await listQuotes(shop.slug) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    return handleError(e);
  }
}
