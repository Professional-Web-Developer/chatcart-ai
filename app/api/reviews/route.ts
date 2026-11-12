import { NextResponse, connection } from 'next/server';
import { listReviews, reviewStats } from '@/lib/db';
import { fail, handleError, resolveShop } from '@/lib/http';

/** Public: rating summary and the latest 5 reviews. No order codes or full names. GET /api/reviews?shop=slug */
export async function GET(req: Request) {
  await connection();
  try {
    const shop = await resolveShop(new URL(req.url).searchParams.get('shop'));
    if (!shop) return fail('We could not find that shop.', 404);
    const [stats, reviews] = await Promise.all([reviewStats(shop.slug), listReviews(shop.slug, 5)]);
    return NextResponse.json(
      { stats, reviews: reviews.map((r) => ({ rating: r.rating, comment: r.comment, customerFirstName: r.customerFirstName, createdAt: r.createdAt })) },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (e) {
    return handleError(e);
  }
}
