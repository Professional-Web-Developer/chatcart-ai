import { NextResponse, connection } from 'next/server';
import { listOrders, stats } from '@/lib/db';
import { fail, handleError, requireOwner, resolveShop } from '@/lib/http';

export async function GET(req: Request) {
  await connection(); // opt out of prerendering: always live
  try {
    const shop = await resolveShop(new URL(req.url).searchParams.get('shop'));
    if (!shop) return fail('We could not find that shop.', 404);
    const denied = await requireOwner(req, shop.slug);
    if (denied) return denied;
    const [orders, s] = await Promise.all([listOrders({ shopSlug: shop.slug }), stats(shop.slug)]);
    return NextResponse.json({ orders, stats: s }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    return handleError(e);
  }
}
