import type { Order } from "@/lib/types";

/** Phase-2 order shape: tolerant of the backend adding fields (see SPEC phase 2). */
export type OrderX = Omit<Order, "status"> & {
  status: Order["status"] | "INVOICED";
  shopSlug?: string;
  fulfilment?: "NEW" | "READY";
  readyAt?: string;
  kind?: "MENU" | "CUSTOM";
  invoiceId?: string;
  invoiceUrl?: string;
  customerEmail?: string;
};

export const DEMO_SLUG = "anus-home-bakery";
export const DEMO_PIN_HINT = "246810";
