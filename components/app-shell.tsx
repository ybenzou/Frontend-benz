"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3, BriefcaseBusiness, ChevronsLeft, CircleUserRound,
  Command, LayoutDashboard, Search, SlidersHorizontal, Star,
} from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useState } from "react";

const nav = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/watchlist", label: "Watchlist", icon: Star },
  { href: "/research/AAPL", label: "Research", icon: BarChart3 },
  { href: "/screener", label: "Screener", icon: SlidersHorizontal },
  { href: "/portfolio", label: "Portfolio", icon: BriefcaseBusiness },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const reduceMotion = useReducedMotion();
  return (
    <div className="min-h-screen">
      <aside className={`fixed inset-y-0 left-0 z-30 hidden border-r border-[#26303c] bg-[#0d1117] transition-[width] duration-200 md:flex md:flex-col ${collapsed ? "w-16" : "w-52"}`}>
        <div className="flex h-14 items-center gap-2 border-b border-[#26303c] px-4">
          <span className="grid size-7 place-items-center bg-[#4e8cff] text-xs font-black text-white">MD</span>
          {!collapsed && <span className="font-semibold tracking-tight">MarketDesk</span>}
        </div>
        <nav className="flex-1 space-y-1 p-2">
          {nav.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href.split("/").slice(0, 2).join("/"));
            return <Link key={href} href={href} title={label} aria-current={active ? "page" : undefined} className={`flex h-10 items-center gap-3 border-l-2 px-3 text-sm transition-colors ${active ? "border-[#4e8cff] bg-[#172131] text-white" : "border-transparent text-[#8b98a9] hover:bg-[#141b24] hover:text-white"}`}>
              <Icon size={17} /> {!collapsed && label}
            </Link>;
          })}
        </nav>
        <button onClick={() => setCollapsed((value) => !value)} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} aria-expanded={!collapsed} className="flex h-12 items-center gap-3 border-t border-[#26303c] px-5 text-[#8b98a9] hover:text-white">
          <ChevronsLeft size={17} className={`transition-transform duration-200 ${collapsed ? "rotate-180" : ""}`} /> {!collapsed && "Collapse"}
        </button>
      </aside>
      <div className={`transition-[padding] duration-200 ${collapsed ? "md:pl-16" : "md:pl-52"}`}>
        <header className="sticky top-0 z-20 flex h-14 items-center gap-4 border-b border-[#26303c] bg-[#0a0d12]/95 px-4">
          <div title="Global search is unavailable in this demo" className="flex h-9 max-w-xl flex-1 items-center gap-2 border border-[#26303c] bg-[#10151d] px-3 text-[#667384] opacity-60">
            <Search size={15} /><input disabled aria-label="Global search unavailable in demo" className="min-w-0 flex-1 cursor-not-allowed bg-transparent text-sm placeholder:text-[#667384]" placeholder="Search unavailable in demo" />
            <span className="hide-mobile flex items-center gap-1 text-[11px]"><Command size={12} /> K</span>
          </div>
          <div title="Demonstration market state from July 21, 2026" className="hide-mobile flex items-center gap-2 text-xs"><span className="size-2 rounded-full bg-[#d5a64a]" /><span className="text-[#8b98a9]">Mock US Market</span><strong className="text-[#d5a64a]">OPEN</strong></div>
          <button disabled title="User menu is unavailable in this demo" aria-label="User menu unavailable in demo"><CircleUserRound size={24} className="text-[#667384]" /></button>
        </header>
        <motion.main
          key={pathname}
          initial={reduceMotion ? false : { opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.18, ease: "easeOut" }}
          className="p-3 sm:p-5"
        >
          {children}
        </motion.main>
        <nav className="fixed inset-x-0 bottom-0 z-30 flex h-14 items-center justify-around border-t border-[#26303c] bg-[#0d1117] md:hidden">
          {nav.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href.split("/").slice(0, 2).join("/"));
            return <Link key={href} href={href} aria-label={label} aria-current={active ? "page" : undefined} className={`p-3 ${active ? "text-[#76a7ff]" : "text-[#8b98a9]"}`}><Icon size={19} /></Link>;
          })}
        </nav>
      </div>
    </div>
  );
}
