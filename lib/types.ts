export type MenuItem = { id: string; name: string; description: string; priceUsd: number; category: string; emoji: string };
export type OrderLine = { itemId: string; name: string; qty: number; unitPrice: number; lineTotal: number; notes?: string };
export type OrderStatus = 'PENDING_PAYMENT' | 'PAID' | 'REFUNDED' | 'CANCELLED' | 'INVOICED';
export type Order = { id: string; shortCode: string; paypalOrderId: string; captureId?: string; status: OrderStatus;
  customerName: string; lines: OrderLine[]; total: number; currency: 'USD'; pickupDate?: string; notes?: string;
  createdAt: string; paidAt?: string; refundedAt?: string;
  // phase 2
  shopSlug: string; fulfilment: 'NEW' | 'READY'; readyAt?: string;
  kind: 'MENU' | 'CUSTOM'; invoiceId?: string; invoiceUrl?: string; customerEmail?: string };
export type ChatMessage = { role: 'user' | 'assistant'; content: string };
export type Shop = { slug: string; name: string; tagline: string; items: MenuItem[]; createdAt: string };
/** Customer request for something not on the menu; the owner can turn it into a PayPal invoice. */
export type QuoteRequest = { id: string; shopSlug: string; customerName: string; customerEmail?: string; description: string;
  status: 'PENDING' | 'INVOICED'; orderShortCode?: string; createdAt: string };
