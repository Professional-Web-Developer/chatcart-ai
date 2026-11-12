import { NextResponse, connection } from 'next/server';
import { fail, handleError, resolveShop } from '@/lib/http';

export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  await connection();
  try {
    const { slug } = await ctx.params;
    const shop = await resolveShop(slug);
    if (!shop) return fail('We could not find that shop.', 404);
    return NextResponse.json({ shop });
  } catch (e) {
    return handleError(e);
  }
}
