import type { Order } from './types';

export const MAX_COMMENT = 500;
export const MAX_FIRST_NAME = 20;

// Control characters (C0, DEL, C1). Line breaks and tabs become spaces; everything else is dropped.
const WHITESPACE_CTRL = /[\t\n\r\v\f]/g;
const CTRL = /[\u0000-\u001f\u007f-\u009f]/g;

/** Pure: why this order cannot be reviewed, or null when it can. `existing` is whether a review for it already exists. */
export function reviewProblem(order: Pick<Order, 'shopSlug' | 'status' | 'shortCode'> | null | undefined, shopSlug: string, existing: boolean): string | null {
  if (!order || order.shopSlug !== shopSlug) return 'No order found with that code.';
  if (order.status !== 'PAID') return 'Only paid orders can be reviewed';
  if (existing) return 'This order already has a review';
  return null;
}

export function ratingProblem(rating: unknown): string | null {
  return typeof rating === 'number' && Number.isInteger(rating) && rating >= 1 && rating <= 5 ? null : 'The rating must be a whole number from 1 to 5';
}

/** Trim, drop control characters, cut to 500 characters (by code point, so no broken emoji). */
export function cleanComment(text: unknown): string {
  if (typeof text !== 'string') return '';
  const t = text.replace(WHITESPACE_CTRL, ' ').replace(CTRL, '').trim();
  return Array.from(t).slice(0, MAX_COMMENT).join('').trim();
}

/** First word of the customer's name, max 20 characters. Never the full name. */
export function reviewerFirstName(customerName: unknown): string {
  if (typeof customerName !== 'string') return '';
  const first = customerName.replace(WHITESPACE_CTRL, ' ').replace(CTRL, '').trim().split(/\s+/)[0] ?? '';
  return Array.from(first).slice(0, MAX_FIRST_NAME).join('');
}

/** Pure: collected can only be set on PAID orders. Returns a plain reason when refused. */
export function collectProblem(order: Pick<Order, 'status' | 'shortCode'>): string | null {
  return order.status === 'PAID' ? null : `Order ${order.shortCode} is ${order.status}; only paid orders can be marked collected.`;
}

/** Pure: average rating rounded to 1 decimal, 0 when there are none. */
export function averageRating(ratings: number[]): number {
  if (!ratings.length) return 0;
  return Math.round((ratings.reduce((s, r) => s + r, 0) / ratings.length) * 10) / 10;
}
