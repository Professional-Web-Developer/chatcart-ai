"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function Logo({ className = "h-8 w-8 sm:h-9 sm:w-9" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <rect width="64" height="64" rx="16" fill="#2563eb" />
      <path d="M14 18h6l5 20h20l4-14H23" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="28" cy="47" r="3.5" fill="#fff" />
      <circle cx="43" cy="47" r="3.5" fill="#fff" />
      <path d="M31 29h10" stroke="#bfdbfe" strokeWidth="3.5" strokeLinecap="round" />
    </svg>
  );
}

const links: { href: string; label: string; short?: string }[] = [
  { href: "/", label: "Storefront", short: "Shop" },
  { href: "/dashboard", label: "Owner dashboard", short: "Dashboard" },
  { href: "/new", label: "Create a shop", short: "Create" },
];

export function Header() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-30 bg-navy-900 text-white shadow-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 px-3 py-3 sm:gap-3 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg">
          <Logo />
          <span className="text-base font-semibold tracking-tight sm:text-lg">
            ChatCart <span className="text-blue-300">AI</span>
          </span>
        </Link>
        <nav aria-label="Main" className="flex items-center gap-0.5 whitespace-nowrap rounded-full bg-white/10 p-1 sm:gap-1">
          {links.map((l) => {
            const active = l.href === "/" ? pathname === "/" || pathname.startsWith("/s/") : pathname.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={active ? "page" : undefined}
                className={`rounded-full px-2.5 py-1.5 text-[13px] font-medium transition-colors sm:px-4 sm:text-sm ${
                  active ? "bg-white text-navy-900" : "text-blue-100 hover:bg-white/10 hover:text-white"
                }`}
              >
                {l.short ? (<><span className="sm:hidden">{l.short}</span><span className="hidden sm:inline">{l.label}</span></>) : l.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
