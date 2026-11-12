import type { Metadata } from "next";
import { Dashboard } from "@/components/Dashboard";
import { DEMO_SLUG } from "@/components/types";

export const metadata: Metadata = { title: "Owner dashboard — ChatCart AI" };

export default function DashboardPage() {
  return <Dashboard slug={DEMO_SLUG} demo />;
}
