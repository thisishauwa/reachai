"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { format, isToday } from "date-fns";
import { createClient } from "@/lib/supabase/client";
import { useSession } from "@/lib/session/session-context";
import { useSyncStatus } from "@/lib/offline/use-sync-status";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// Exact SVG icons matching Figma designs 0:2422, 0:2734, 0:2812, 0:2655

function HospitalIcon({ className = "size-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={className}>
      <path d="M2 22H22" strokeWidth="1.5" strokeMiterlimit="10" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M17 2H7C4 2 3 3.79 3 6V22H21V6C21 3.79 20 2 17 2Z" strokeWidth="1.5" strokeMiterlimit="10" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14.06 15H9.93C9.42 15 8.99 15.42 8.99 15.94V22H14.99V15.94C15 15.42 14.58 15 14.06 15Z" strokeWidth="1.5" strokeMiterlimit="10" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 6V11" strokeWidth="1.5" strokeMiterlimit="10" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9.5 8.5H14.5" strokeWidth="1.5" strokeMiterlimit="10" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PersonalCardIcon({ className = "size-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={className}>
      <path d="M17 21H7C3 21 2 20 2 16V8C2 4 3 3 7 3H17C21 3 22 4 22 8V16C22 20 21 21 17 21Z" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14 8H19" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M15 12H19" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M17 16H19" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8.5 11.29C9.5 11.29 10.31 10.48 10.31 9.48C10.31 8.48 9.5 7.67 8.5 7.67C7.5 7.67 6.69 8.48 6.69 9.48C6.69 10.48 7.5 11.29 8.5 11.29Z" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 16.33C11.86 14.88 10.71 13.74 9.26 13.61C8.76 13.56 8.25 13.56 7.74 13.61C6.29 13.75 5.14 14.88 5 16.33" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TickCircleIcon({ className = "size-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={className}>
      <path d="M12 22C17.5 22 22 17.5 22 12C22 6.5 17.5 2 12 2C6.5 2 2 6.5 2 12C2 17.5 6.5 22 12 22Z" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7.75 12L10.58 14.83L16.25 9.17" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CloudCrossIcon({ className = "size-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={className}>
      <path d="M16.61 20C17.95 20.01 19.24 19.51 20.23 18.61C23.5 15.75 21.75 10.01 17.44 9.47C15.9 0.13 2.43 3.67 5.62 12.56" strokeWidth="1.5" strokeMiterlimit="10" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7.28 12.97C6.75 12.7 6.16 12.56 5.57 12.57C0.91 12.9 0.92 19.68 5.57 20.01" strokeWidth="1.5" strokeMiterlimit="10" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M15.82 9.89C16.34 9.63 16.9 9.49 17.48 9.48" strokeWidth="1.5" strokeMiterlimit="10" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12.39 18.59L9.56 21.41" stroke="#121619" strokeWidth="1.5" strokeMiterlimit="10" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12.39 21.41L9.56 18.59" stroke="#121619" strokeWidth="1.5" strokeMiterlimit="10" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function RefreshSyncIcon({ className = "size-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={className}>
      <path d="M22 12C22 17.52 17.52 22 12 22C6.48 22 3.11 16.44 3.11 16.44M3.11 21.44V16.44H7.63M2 12C2 6.48 6.44 2 12 2C18.67 2 22 7.56 22 7.56M17.56 7.56H22V2.56" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function DangerIcon({ className = "size-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={className}>
      <path d="M12 9V14" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 21.41H5.94C2.47 21.41 1.02 18.93 2.7 15.9L5.82 10.28L8.76 5C10.54 1.79 13.46 1.79 15.24 5L18.18 10.29L21.3 15.91C22.98 18.94 21.52 21.42 18.06 21.42H12V21.41Z" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M11.9945 17H12.0035" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function RetryCircleIcon({ className = "size-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" className={className}>
      <path d="M18.333 10c0 4.602-3.731 8.333-8.333 8.333S1.667 14.602 1.667 10 5.398 1.667 10 1.667c2.3 0 4.382.933 5.892 2.441M18.333 3.333V7.5h-4.166" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function LogoutIcon({ className = "size-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={className}>
      <path d="M8.9 7.56C9.21 3.96 11.06 2.49 15.11 2.49H15.24C19.71 2.49 21.5 4.28 21.5 8.75V15.27C21.5 19.74 19.71 21.53 15.24 21.53H15.11C11.09 21.53 9.24 20.08 8.91 16.54" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M15 12H3.62" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5.85 8.65L2.5 12L5.85 15.35" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ArrowRightIcon({ className = "size-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={className}>
      <path d="M8.91 19.92L15.43 13.4C16.2 12.63 16.2 11.37 15.43 10.6L8.91 4.08" strokeWidth="1.5" strokeMiterlimit="10" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export default function SettingsPage() {
  const router = useRouter();
  const { displayName, staffId, activeFacility } = useSession();
  const { status, lastSuccessfulSyncAt, pendingCount, retry } = useSyncStatus();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const formattedSyncTime = useMemo(() => {
    if (!lastSuccessfulSyncAt) {
      return "Today, 09:15 AM";
    }
    const d = new Date(lastSuccessfulSyncAt);
    if (isToday(d)) {
      return `Today, ${format(d, "hh:mm a")}`;
    }
    return format(d, "MMM d, hh:mm a");
  }, [lastSuccessfulSyncAt]);

  async function doLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
  }

  function handleLogoutClick() {
    if (pendingCount > 0) {
      setConfirmOpen(true);
    } else {
      void doLogout();
    }
  }

  const roleDisplay = useMemo(() => {
    if (!activeFacility?.role) return "Senior Clinician";
    return activeFacility.role
      .split("_")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  }, [activeFacility?.role]);

  const clinicianName = displayName || "Dr. Hauwa Suleiman";
  const facilityName = activeFacility?.facilityName || "Lagos General Hospital";
  const displayStaffId = staffId || "HS-98234";

  return (
    <div className="flex flex-col gap-6 pt-4 sm:pt-6">
      {/* Top Header */}
      <div className="pt-2">
        <h1 className="text-[24px] sm:text-[28px] font-normal text-[#001f3e] tracking-[-0.3px] leading-[30px]">
          Settings
        </h1>
      </div>

      <div className="flex flex-col gap-[32px] w-full">
        {/* Profile Section */}
        <div className="flex flex-col gap-[7px] w-full">
          <h2 className="text-[18px] font-normal text-[#495766] leading-[26px]">
            Profile
          </h2>

          <div className="bg-[#fafafa] rounded-[28px] p-[20px] flex flex-col gap-[12px] w-full">
            {/* Row 1: Doctor Info */}
            <div className="flex items-center gap-[20px]">
              <div className="size-[56px] rounded-full bg-white border border-[#f2f3f5] flex items-center justify-center shrink-0">
                <span className="text-[#0073f3] text-[18px] font-normal leading-[26px]">
                  {getInitials(clinicianName)}
                </span>
              </div>
              <div className="flex flex-col gap-[2px] min-w-0">
                <p className="text-[#242b33] text-[18px] font-medium leading-[26px] truncate">
                  {clinicianName}
                </p>
                <p className="text-[#6e8298] text-[14px] font-normal leading-[20px] truncate">
                  {roleDisplay}
                </p>
              </div>
            </div>

            {/* Divider */}
            <div className="w-full h-px bg-[#f2f3f5]" />

            {/* Row 2: Assigned Facility */}
            <div className="flex items-center gap-[20px]">
              <div className="size-[56px] rounded-full bg-white border border-[#f2f3f5] flex items-center justify-center shrink-0 text-[#6e8298]">
                <HospitalIcon className="size-[24px]" />
              </div>
              <div className="flex flex-col gap-[2px] min-w-0">
                <p className="text-[#242b33] text-[18px] font-medium leading-[26px] truncate">
                  {facilityName}
                </p>
                <p className="text-[#6e8298] text-[14px] font-normal leading-[20px]">
                  Assigned Facility
                </p>
              </div>
            </div>

            {/* Divider */}
            <div className="w-full h-px bg-[#f2f3f5]" />

            {/* Row 3: Staff ID */}
            <div className="flex items-center gap-[20px]">
              <div className="size-[56px] rounded-full bg-white border border-[#f2f3f5] flex items-center justify-center shrink-0 text-[#6e8298]">
                <PersonalCardIcon className="size-[24px]" />
              </div>
              <div className="flex flex-col gap-[2px] min-w-0">
                <p className="text-[#242b33] text-[18px] font-medium leading-[26px] truncate">
                  {displayStaffId}
                </p>
                <p className="text-[#6e8298] text-[14px] font-normal leading-[20px]">
                  Staff ID
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Data Sync Section */}
        <div className="flex flex-col gap-[7px] w-full">
          <h2 className="text-[18px] font-normal text-[#495766] leading-[26px]">
            Data Sync
          </h2>

          {/* State A: Online & fully synced (Figma 0:2422) */}
          {status === "synced" && (
            <div className="bg-[#f1fdf3] rounded-[28px] p-[20px] flex flex-col items-start justify-center w-full transition-all">
              <div className="flex items-start gap-[20px] w-full">
                <div className="size-[56px] rounded-[12px] bg-[#d3f6d8] flex items-center justify-center shrink-0 text-[#09951c]">
                  <TickCircleIcon className="size-[24px]" />
                </div>
                <div className="flex flex-col gap-[16px] min-w-0">
                  <div className="flex flex-col gap-[2px]">
                    <p className="text-[#077d17] text-[18px] font-medium leading-[26px]">
                      Online &amp; fully synced
                    </p>
                    <p className="text-[#0bad21] text-[16px] font-normal leading-[24px]">
                      Your records are safely backed up to the server
                    </p>
                  </div>
                  <div className="flex items-center gap-[8px]">
                    <div className="size-[6px] rounded-full bg-[#09951c] shrink-0" />
                    <p className="text-[#6e8298] text-[14px] font-normal leading-[20px]">
                      Last successful sync: {formattedSyncTime}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* State B: Working offline (Figma 0:2734) */}
          {status === "offline" && (
            <div className="bg-[#fafafa] rounded-[28px] p-[20px] flex flex-col items-start justify-center w-full transition-all">
              <div className="flex items-start gap-[20px] w-full">
                <div className="size-[56px] rounded-[12px] bg-[#f2f3f5] flex items-center justify-center shrink-0 text-[#495766]">
                  <CloudCrossIcon className="size-[24px]" />
                </div>
                <div className="flex flex-col gap-[16px] min-w-0">
                  <div className="flex flex-col gap-[2px]">
                    <p className="text-[#242b33] text-[18px] font-medium leading-[26px]">
                      Working offline
                    </p>
                    <p className="text-[#6e8298] text-[16px] font-normal leading-[24px]">
                      Changes are saved locally and will sync when connection is restored
                    </p>
                  </div>
                  <div className="flex items-center gap-[8px]">
                    <div className="size-[6px] rounded-full bg-[#a1aebc] shrink-0" />
                    <p className="text-[#6e8298] text-[14px] font-normal leading-[20px]">
                      Last successful sync: {formattedSyncTime}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* State C: Syncing data... (Figma 0:2812) */}
          {status === "syncing" && (
            <div className="bg-[#f0f7ff] rounded-[28px] p-[20px] flex flex-col items-start justify-center w-full transition-all">
              <div className="flex items-start gap-[20px] w-full">
                <div className="size-[56px] rounded-[12px] bg-[#e1effe] flex items-center justify-center shrink-0 text-[#0073f3]">
                  <RefreshSyncIcon className="size-[24px] animate-spin" />
                </div>
                <div className="flex flex-col gap-[2px] min-w-0">
                  <p className="text-[#004da2] text-[18px] font-medium leading-[26px]">
                    Syncing data...
                  </p>
                  <p className="text-[#2b8af5] text-[16px] font-normal leading-[24px]">
                    Changes are saved locally and will sync when connection is restored
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* State D: Sync failed (Figma 0:2655) */}
          {status === "failed" && (
            <div className="bg-[#fff5f2] rounded-[28px] p-[20px] flex flex-col items-start justify-center w-full transition-all">
              <div className="flex items-start gap-[20px] w-full">
                <div className="size-[56px] rounded-[12px] bg-[#fdded7] flex items-center justify-center shrink-0 text-[#802916]">
                  <DangerIcon className="size-[24px]" />
                </div>
                <div className="flex flex-col gap-[16px] min-w-0">
                  <div className="flex flex-col gap-[2px]">
                    <p className="text-[#551b0e] text-[18px] font-medium leading-[26px]">
                      Sync failed
                    </p>
                    <p className="text-[#aa361d] text-[16px] font-normal leading-[24px]">
                      Could not connect to the server. Your data is safe, locally.
                    </p>
                  </div>
                  <div className="flex items-center gap-[8px]">
                    <div className="size-[6px] rounded-full bg-[#802916] shrink-0" />
                    <p className="text-[#6e8298] text-[14px] font-normal leading-[20px]">
                      Last successful sync: {formattedSyncTime}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={retry}
                    className="bg-white border border-[#d44424] rounded-[12px] px-[12px] py-[8px] flex items-center gap-[4px] cursor-pointer hover:bg-orange-50 active:scale-95 transition-all text-[#d44424] w-fit"
                  >
                    <RetryCircleIcon className="size-[20px]" />
                    <span className="text-[14px] font-medium leading-[20px]">
                      Retry sync
                    </span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Log out Section */}
        <button
          type="button"
          onClick={handleLogoutClick}
          className="bg-[#fafafa] rounded-[28px] p-[20px] flex items-center justify-between w-full text-left cursor-pointer hover:bg-[#f2f3f5] active:scale-[0.99] transition-all"
        >
          <div className="flex items-center gap-[20px]">
            <div className="size-[56px] rounded-[12px] bg-[#ffe4de] flex items-center justify-center shrink-0 text-[#d44424]">
              <LogoutIcon className="size-[24px]" />
            </div>
            <span className="text-[#242b33] text-[18px] font-medium leading-[26px]">
              Log out
            </span>
          </div>
          <ArrowRightIcon className="size-[24px] text-[#a1aebc]" />
        </button>
      </div>

      {/* Confirmation Dialog for Unsynced Changes */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className="rounded-[20px]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[#121619] text-lg">You have unsynced changes</AlertDialogTitle>
            <AlertDialogDescription className="text-[#6e8298]">
              {pendingCount} change{pendingCount === 1 ? "" : "s"} have not synced yet. They will
              stay saved on this device and sync automatically when you sign back in on it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="rounded-[12px] border-none bg-neutral-100 hover:bg-neutral-200">
              Stay signed in
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={doLogout}
              className="rounded-[12px] bg-[#d44424] hover:bg-[#b8371a] text-white"
            >
              Log out anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
