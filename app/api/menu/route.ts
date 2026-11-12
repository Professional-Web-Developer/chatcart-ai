import { NextResponse, connection } from 'next/server';
import { reviewStats } from '@/lib/db';
import { fail, handleError, resolveShop } from '@/lib/http';

export async function GET(req: Request) {
  await connection();
  try {
    const shop = await resolveShop(new URL(req.url).searchParams.get('shop'));
    if (!shop) return fail('We could not find that shop.', 404);
    const rating = await reviewStats(shop.slug).catch(() => ({ count: 0, average: 0 })); // additive: never let ratings break the menu
    return NextResponse.json({ shop: { slug: shop.slug, name: shop.name, tagline: shop.tagline }, items: shop.items, rating });
  } catch (e) {
    return handleError(e);
  }
}
