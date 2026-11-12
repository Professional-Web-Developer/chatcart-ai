import { Suspense } from "react";
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { SetupBanner } from "@/components/SetupBanner";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "ChatCart AI — your AI sales agent",
  description:
    "ChatCart AI turns chat orders into paid orders. Customers talk to an AI sales agent, pay securely with PayPal, and owners manage everything from one dashboard.",
};

export const viewport: Viewport = {
  themeColor: "#0b1f3a",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <Suspense fallback={<div className="h-[60px] bg-navy-900" />}>
          <Header />
        </Suspense>
        <SetupBanner />
        <div className="flex-1">{children}</div>
        <Footer />
      </body>
    </html>
  );
}
