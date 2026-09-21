"use client";

import { usePathname } from "next/navigation";
import { Header } from "@/components/nav/header";
import { BottomNav } from "@/components/nav/bottom-nav";
import { cn } from "@/lib/utils";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isWorkflow = pathname === "/workflow";
  const hasCustomFigmaHeader = Boolean(
    pathname === "/home" ||
    pathname?.startsWith("/referrals") ||
    pathname?.startsWith("/patients") ||
    pathname?.startsWith("/encounters") ||
    pathname?.startsWith("/settings")
  );

  if (isWorkflow) {
    return (
      <div className="flex-1 flex flex-col min-h-screen bg-[#f8fafc] dark:bg-background items-center justify-center p-4 sm:p-6">
        {children}
      </div>
    );
  }

  const isFullScreenForm =
    pathname.startsWith("/encounters/echo/new") ||
    pathname.startsWith("/encounters/reach/new") ||
    pathname === "/patients/new";

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-background">
      {!hasCustomFigmaHeader && <Header />}
      <main
        className={cn(
          "mx-auto flex w-full flex-1 flex-col px-4 sm:px-6",
          pathname === "/patients/new" ? "max-w-4xl" : "max-w-2xl",
          isFullScreenForm ? "pb-12" : "pb-28"
        )}
      >
        {children}
      </main>
      {!isFullScreenForm && <BottomNav />}
    </div>
  );
}
