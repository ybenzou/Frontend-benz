"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3, BriefcaseBusiness, CircleUserRound,
  Command, LayoutDashboard, Search, SlidersHorizontal, Star,
} from "lucide-react";
import { SimulatedTape } from "@/components/simulated-tape";

const nav = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/watchlist", label: "Watchlist", icon: Star },
  { href: "/research/AAPL", label: "Research", icon: BarChart3 },
  { href: "/screener", label: "Screener", icon: SlidersHorizontal },
  { href: "/portfolio", label: "Portfolio", icon: BriefcaseBusiness },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[72px] flex-col border-r border-[var(--line-subtle)] bg-[var(--surface)] md:flex">
        <div className="flex h-12 items-center justify-center border-b border-[var(--line-subtle)]">
          <span className="grid size-8 place-items-center rounded-[5px] border border-[var(--accent-dim)] bg-[var(--surface-raised)] text-[.6875rem] font-bold tracking-[.12em] text-[var(--accent)]">MD</span>
        </div>
        <nav className="flex flex-1 flex-col items-center gap-1 py-3" aria-label="Primary navigation">
          {nav.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href.split("/").slice(0, 2).join("/"));
            return <Link key={href} href={href} title={label} aria-label={label} aria-current={active ? "page" : undefined} className={`relative grid size-11 place-items-center rounded-[5px] transition-colors ${active ? "bg-[var(--accent-dim)] text-[var(--accent)]" : "text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)]"}`}>
              {active && <span className="absolute -left-[14px] h-5 w-0.5 bg-[var(--accent)]" />}
              <Icon size={18} strokeWidth={1.7} />
            </Link>;
          })}
        </nav>
        <div className="px-2 pb-3 text-center text-[.625rem] font-semibold tracking-[.14em] text-[var(--muted)]">R.26</div>
      </aside>
      <div className="md:pl-[72px]">
        <header className="sticky top-0 z-20 border-b border-[var(--line-subtle)] bg-[color:var(--ink)]/96">
          <div className="fluid-bar h-12 gap-4 px-3 sm:px-5">
            <div className="hidden items-baseline gap-2 md:flex">
              <strong className="text-sm font-semibold tracking-[-.02em]">MarketDesk</strong>
              <span className="eyebrow">Research terminal</span>
            </div>
            <div title="Global search is unavailable in this demo" className="fluid-bar fluid-bar__fill h-8 gap-2 rounded-[5px] border border-[var(--line)] bg-[var(--surface)] px-3 text-[var(--muted)] opacity-70">
            <Search size={14} /><input disabled aria-label="Global search unavailable in demo" className="min-w-0 flex-1 cursor-not-allowed bg-transparent text-xs placeholder:text-[var(--muted)]" placeholder="Search securities, filings, or metrics — unavailable" />
            <span className="hide-mobile flex items-center gap-1 text-[.6875rem]"><Command size={12} /> K</span>
          </div>
            <div title="Demonstration market state from July 21, 2026" className="hide-mobile flex items-center gap-2 text-[.6875rem]"><span className="size-1.5 rounded-full bg-[var(--warning)]" /><span className="text-[var(--muted)]">SIMULATED SESSION</span></div>
            <button disabled title="User menu is unavailable in this demo" aria-label="User menu unavailable in demo"><CircleUserRound size={22} className="text-[var(--muted)]" /></button>
          </div>
          <SimulatedTape />
        </header>
        <main className="p-3 sm:p-5">
          {children}
        </main>
        <nav className="fixed inset-x-0 bottom-0 z-30 flex h-14 items-center justify-around border-t border-[var(--line)] bg-[var(--surface)] md:hidden" aria-label="Mobile navigation">
          {nav.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href.split("/").slice(0, 2).join("/"));
            return <Link key={href} href={href} aria-label={label} title={label} aria-current={active ? "page" : undefined} className={`p-3 ${active ? "text-[var(--accent)]" : "text-[var(--muted)]"}`}><Icon size={19} /></Link>;
          })}
        </nav>
      </div>
    </div>
  );
}
