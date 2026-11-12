import type { Metadata } from "next";
import { NewShop } from "@/components/NewShop";

export const metadata: Metadata = { title: "Create your shop — ChatCart AI" };

export default function NewPage() {
  return <NewShop />;
}
