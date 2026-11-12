import type { MenuItem, OrderLine } from './types';

export const SHOP = {
  name: "Anu's Home Bakery",
  tagline: 'Fresh homemade cakes, cupcakes and bread, baked to order.',
};

export const DEFAULT_SHOP_SLUG = 'anus-home-bakery';

export const MENU: MenuItem[] = [
  { id: 'choc-truffle-cake', name: 'Chocolate Truffle Cake (1 lb)', description: 'Rich dark chocolate sponge with ganache. Serves 6-8.', priceUsd: 32, category: 'Cakes', emoji: '🎂' },
  { id: 'vanilla-bean-cake', name: 'Vanilla Bean Cake (1 lb)', description: 'Light vanilla sponge with whipped cream frosting. Serves 6-8.', priceUsd: 28, category: 'Cakes', emoji: '🍰' },
  { id: 'red-velvet-cake', name: 'Red Velvet Cake (1 lb)', description: 'Classic red velvet with cream cheese frosting. Serves 6-8.', priceUsd: 34.5, category: 'Cakes', emoji: '❤️' },
  { id: 'cupcakes-box-6', name: 'Cupcake Box (6)', description: 'Assorted vanilla and chocolate cupcakes with buttercream.', priceUsd: 18, category: 'Cupcakes', emoji: '🧁' },
  { id: 'lemon-cupcakes-box-6', name: 'Lemon Cupcake Box (6)', description: 'Zesty lemon cupcakes with lemon glaze.', priceUsd: 19.5, category: 'Cupcakes', emoji: '🍋' },
  { id: 'choc-chip-cookies-12', name: 'Chocolate Chip Cookies (dozen)', description: 'Chewy cookies with semi-sweet chocolate chunks.', priceUsd: 15, category: 'Cookies', emoji: '🍪' },
  { id: 'oatmeal-raisin-cookies-12', name: 'Oatmeal Raisin Cookies (dozen)', description: 'Soft oatmeal cookies with plump raisins and cinnamon.', priceUsd: 14, category: 'Cookies', emoji: '🥠' },
  { id: 'sourdough-loaf', name: 'Sourdough Loaf', description: 'Slow-fermented country sourdough with a crisp crust.', priceUsd: 9, category: 'Bread', emoji: '🍞' },
  { id: 'cinnamon-rolls-4', name: 'Cinnamon Rolls (4)', description: 'Gooey cinnamon rolls with cream cheese icing.', priceUsd: 12.75, category: 'Bread', emoji: '🥐' },
  { id: 'banana-bread', name: 'Banana Bread Loaf', description: 'Moist banana bread with toasted walnuts.', priceUsd: 10, category: 'Bread', emoji: '🍌' },
];

const BY_ID = new Map(MENU.map((m) => [m.id, m]));

export function getMenuItem(id: string): MenuItem | undefined {
  return BY_ID.get(id);
}

/** Round to cents using integer maths to avoid float drift. */
export function toCents(amount: number): number {
  return Math.round(amount * 100);
}
export function fromCents(cents: number): number {
  return cents / 100;
}
export function formatUsd(amount: number): string {
  return amount.toFixed(2);
}

export class PricingError extends Error {}

export type CartInput = { itemId: string; qty: number; notes?: string }[];

/** Pure: validates ids and quantities and prices from the menu only. */
export function priceCart(items: CartInput, menu: MenuItem[] = MENU): { lines: OrderLine[]; total: number } {
  if (!Array.isArray(items) || items.length === 0) throw new PricingError('The cart is empty.');
  if (items.length > 20) throw new PricingError('Too many different items in one order.');
  const byId = new Map(menu.map((m) => [m.id, m]));
  const merged = new Map<string, { qty: number; notes: string[] }>();
  for (const it of items) {
    const item = byId.get(String(it?.itemId));
    if (!item) throw new PricingError(`"${it?.itemId}" is not on the menu.`);
    if (!Number.isInteger(it.qty) || it.qty < 1 || it.qty > 50) {
      throw new PricingError(`Quantity for ${item.name} must be a whole number from 1 to 50.`);
    }
    const cur = merged.get(item.id) ?? { qty: 0, notes: [] };
    cur.qty += it.qty;
    if (it.notes?.trim()) cur.notes.push(it.notes.trim());
    merged.set(item.id, cur);
  }
  let totalCents = 0;
  const lines: OrderLine[] = [];
  for (const [id, { qty, notes }] of merged) {
    const item = byId.get(id)!;
    if (qty > 50) throw new PricingError(`Quantity for ${item.name} must be 50 or fewer.`);
    const unitCents = toCents(item.priceUsd);
    const lineCents = unitCents * qty;
    totalCents += lineCents;
    const line: OrderLine = { itemId: id, name: item.name, qty, unitPrice: fromCents(unitCents), lineTotal: fromCents(lineCents) };
    if (notes.length) line.notes = notes.join('; ').slice(0, 200);
    lines.push(line);
  }
  return { lines, total: fromCents(totalCents) };
}
