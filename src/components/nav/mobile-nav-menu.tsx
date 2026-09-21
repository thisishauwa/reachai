"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Menu,
  X,
  Home,
  Users,
  ClipboardList,
  FileText,
  Settings,
  Bell,
  LogOut,
  ChevronRight,
  ShieldCheck,
  Building2,
} from "lucide-react";
import { useSession } from "@/lib/session/session-context";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { WorkflowMode } from "@/lib/supabase/database.types";

interface MobileNavMenuProps {
  className?: string;
}

export function MobileNavMenu({ className }: MobileNavMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const {
    displayName,
    activeFacility,
    workflowMode,
    setWorkflowMode,
  } = useSession();

  // Close drawer when route changes
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  // Prevent background scrolling when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const initials = displayName
    ? displayName
        .split(" ")
        .map((p) => p[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "U";

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  async function switchWorkflow(mode: WorkflowMode) {
    if (mode === "reach") return;
    await setWorkflowMode(mode, true);
  }

  const NAV_ITEMS = [
    { href: "/home", label: "Home", icon: Home },
    { href: "/patients", label: "Patients", icon: Users },
    { href: "/encounters", label: "Encounters", icon: ClipboardList },
    { href: "/referrals", label: "Referrals", icon: FileText },
    { href: "/settings", label: "Settings", icon: Settings },
  ];

  return (
    <>
      {/* Mobile Hamburger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-label="Open navigation menu"
        className={cn(
          "size-10 rounded-full bg-[#f7f7f7] hover:bg-[#eaeaea] active:scale-95 flex items-center justify-center text-[#242b33] cursor-pointer transition-all border-0 shadow-none shrink-0",
          className
        )}
      >
        <Menu className="size-5 text-[#242b33]" />
      </button>

      {/* Drawer Overlay & Content */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex sm:hidden">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />

          {/* Slide-out Menu Panel */}
          <div className="relative w-[85%] max-w-[320px] bg-white h-full flex flex-col justify-between shadow-2xl z-10 animate-in slide-in-from-left duration-250 ease-out">
            {/* Top Section */}
            <div className="flex flex-col overflow-y-auto">
              {/* Header */}
              <div className="flex items-center justify-between p-5 border-b border-[#f0f0f0]">
                <div className="flex items-center gap-2.5">
                  <div className="size-8 rounded-[10px] bg-[#0073F3] text-white font-bold text-sm flex items-center justify-center">
                    E
                  </div>
                  <div>
                    <span className="font-semibold text-base text-[#111643] tracking-tight">
                      ECHO / REACH
                    </span>
                    <p className="text-[11px] text-[#6e8298]">Surveillance System</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  aria-label="Close navigation menu"
                  className="size-8 rounded-full bg-[#f2f3f5] hover:bg-[#e4e8ec] flex items-center justify-center text-[#6e8298] transition-colors cursor-pointer"
                >
                  <X className="size-4" />
                </button>
              </div>

              {/* User Profile Card */}
              <div className="p-5 bg-[#fafafa] border-b border-[#f0f0f0]">
                <div className="flex items-center gap-3">
                  <div className="size-11 rounded-full bg-[#0073F3]/10 text-[#0073F3] font-semibold text-sm flex items-center justify-center shrink-0">
                    {initials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm text-[#242b33] truncate">
                      {displayName || "Clinician"}
                    </p>
                    <div className="flex items-center gap-1.5 text-xs text-[#6e8298] mt-0.5 truncate">
                      <Building2 className="size-3 shrink-0" />
                      <span className="truncate">
                        {activeFacility?.facilityName || "Primary Facility"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Workflow Mode Switcher inside Menu */}
                <div className="mt-3.5 pt-3 border-t border-[#ececec]">
                  <p className="text-[11px] font-medium text-[#8e8e8e] uppercase tracking-wider mb-2">
                    Active Workflow
                  </p>
                  <div className="grid grid-cols-2 gap-1.5 p-1 bg-white rounded-[10px] border border-[#e4e8ec]">
                    <button
                      type="button"
                      onClick={async () => {
                        await switchWorkflow("echo");
                        setIsOpen(false);
                      }}
                      className={cn(
                        "py-1.5 px-2 text-xs font-medium rounded-[7px] transition-all text-center cursor-pointer",
                        workflowMode === "echo"
                          ? "bg-[#B593D1] text-white shadow-sm"
                          : "text-[#6e8298] hover:text-[#242b33]"
                      )}
                    >
                      ECHO
                    </button>
                    <button
                      type="button"
                      disabled
                      aria-disabled="true"
                      title="REACH mode is currently disabled"
                      className="py-1.5 px-2 text-xs font-medium rounded-[7px] transition-all text-center text-[#9aa8b6] opacity-50 cursor-not-allowed select-none"
                    >
                      REACH
                    </button>
                  </div>
                </div>
              </div>

              {/* Navigation Items */}
              <nav className="p-3 flex flex-col gap-1">
                {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
                  const active =
                    pathname === href || (href !== "/home" && pathname.startsWith(href));
                  return (
                    <button
                      key={href}
                      type="button"
                      onClick={() => {
                        setIsOpen(false);
                        router.push(href);
                      }}
                      className={cn(
                        "w-full flex items-center justify-between px-3.5 py-3 rounded-[14px] text-sm font-medium transition-colors text-left cursor-pointer",
                        active
                          ? "bg-[#0073F3]/10 text-[#0073F3]"
                          : "text-[#495766] hover:bg-[#f4f5f7] hover:text-[#242b33]"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <Icon
                          className={cn(
                            "size-5",
                            active ? "text-[#0073F3]" : "text-[#6e8298]"
                          )}
                        />
                        <span>{label}</span>
                      </div>
                      <ChevronRight
                        className={cn(
                          "size-4 opacity-40",
                          active && "text-[#0073F3] opacity-100"
                        )}
                      />
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* Bottom Section: Sign out */}
            <div className="p-4 border-t border-[#f0f0f0] bg-white">
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  handleSignOut();
                }}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-[12px] bg-red-50 hover:bg-red-100 text-[#d44424] text-sm font-medium transition-colors cursor-pointer"
              >
                <LogOut className="size-4" />
                <span>Sign out</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
