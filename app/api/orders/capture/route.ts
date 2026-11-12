import { NextResponse } from 'next/server';
import { z } from 'zod';
import { captureByPaypalOrderId } from '@/lib/orders';
import { handleError, readJson } from '@/lib/http';

const body = z.object({ paypalOrderId: z.string().min(5).max(64).regex(/^[A-Za-z0-9_-]+$/) });
const no = (error: string, status: number) => NextResponse.json({ ok: false, error }, { status, headers: { 'Cache-Control': 'no-store' } });

export async function POST(req: Request) {
  try {
    const parsed = body.safeParse(await readJson(req));
    if (!parsed.success) return no('Please send a valid paypalOrderId.', 400);
    const r = await captureByPaypalOrderId(parsed.data.paypalOrderId);
    if (!r.ok) return no(r.error, r.status);
    return NextResponse.json({ ok: true, order: r.order }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    const r = handleError(e);
    const j = await r.json();
    return no(j.error, r.status);
  }
}
