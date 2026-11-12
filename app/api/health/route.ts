import { NextResponse, connection } from 'next/server';
import { paypalConfigured, webhookConfigured } from '@/lib/paypal';
import { detectProvider } from '@/lib/ai';
import { dbKind } from '@/lib/db';

export async function GET() {
  await connection();
  const provider = detectProvider();
  return NextResponse.json({ paypal: paypalConfigured(), ai: provider !== null, aiProvider: provider, db: dbKind(), webhook: webhookConfigured() });
}
