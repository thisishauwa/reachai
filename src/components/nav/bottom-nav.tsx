"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

// Custom icons matching Figma 9021:13355 bottom bar
function HomeDockIcon({ className = "size-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M3 10.5L12 3l9 7.5V20a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1v-4a1 1 0 0 0-1-1h-2a1 1 0 0 0-1 1v4a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-9.5z" />
    </svg>
  );
}

function PatientsDockIcon({ className = "size-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="7" r="3.5" />
      <path d="M6 21v-3.5a4.5 4.5 0 0 1 9 0V21" />
      <path d="M15 14a4 4 0 0 1 3 3.5V21" />
    </svg>
  );
}

function EncountersDockIcon({ className = "size-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <line x1="10" y1="9" x2="8" y2="9" />
    </svg>
  );
}

function ReferralsDockIcon({ className = "size-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect width="20" height="16" x="2" y="4" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
      <path d="M16 19l3-3-3-3" />
    </svg>
  );
}

function SettingsDockIcon({ className = "size-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

const ITEMS = [
  { href: "/home", label: "Home", icon: HomeDockIcon },
  { href: "/patients", label: "Patients", icon: PatientsDockIcon },
  { href: "/encounters", label: "Encounters", icon: EncountersDockIcon },
  { href: "/referrals", label: "Referrals", icon: ReferralsDockIcon },
  { href: "/settings", label: "Settings", icon: SettingsDockIcon },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  // Hide dock on workflow or login page
  if (pathname === "/workflow" || pathname === "/login") {
    return null;
  }

  return (
    <div className="fixed bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 z-30 px-3 pointer-events-none">
      <nav
        aria-label="App Navigation"
        className="pointer-events-auto bg-[#000000] text-white rounded-full px-5 sm:px-7 py-2.5 shadow-2xl border border-white/10 backdrop-blur-md flex items-center gap-5 sm:gap-7 transition-all duration-200"
      >
        {ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-col items-center gap-1 py-1 px-1.5 min-w-[48px] text-[11px] font-normal transition-all duration-150 outline-none rounded-xl",
                active
                  ? "text-white font-medium scale-105"
                  : "text-white/55 hover:text-white/90"
              )}
              aria-current={active ? "page" : undefined}
            >
              <Icon className={cn("size-[20px] transition-transform", active && "stroke-white stroke-2")} />
              <span className="tracking-tight">{label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
