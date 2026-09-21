"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  Plus,
  Info,
} from "lucide-react";
import { format } from "date-fns";
import { useSession } from "@/lib/session/session-context";
import { useRecentPatients } from "@/lib/queries/patients";
import { useRecentEncounters } from "@/lib/queries/encounters";
import { usePendingReferralAlert } from "@/lib/queries/referrals";
import { NotificationBell } from "@/components/notifications/notification-bell";
import type { WorkflowMode } from "@/lib/supabase/database.types";
import { cn } from "@/lib/utils";

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good Morning ☀️";
  if (hour < 17) return "Good Afternoon ☀️";
  return "Good Evening 🌙";
}


function getInitials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return (name.slice(0, 2) || "CL").toUpperCase();
}

export default function HomePage() {
  const router = useRouter();
  const { displayName, activeFacility, workflowMode, setWorkflowMode, userId } =
    useSession();
  const facilityId = activeFacility?.facilityId;
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [greeting, setGreeting] = useState<string | null>(null);

  useEffect(() => {
    setGreeting(getGreeting());
  }, []);

  useEffect(() => {
    if (!workflowMode) router.replace("/workflow");
  }, [workflowMode, router]);

  const { data: patients = [] } = useRecentPatients(facilityId, 5);
  const { data: encounters = [] } = useRecentEncounters(facilityId, 5);
  const { data: pendingReferral } = usePendingReferralAlert(facilityId);

  if (!workflowMode) return null;

  const initials = getInitials(displayName);

  async function switchMode(mode: WorkflowMode) {
    await setWorkflowMode(mode, true);
    setSwitcherOpen(false);
  }

  return (
    <div className="flex flex-col gap-4 sm:gap-5 pt-3 sm:pt-5 pb-10">
      {/* Top Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs sm:text-sm text-[#8e8e8e] font-normal">
            {greeting ?? ""}
          </p>
          <h1 className="text-lg sm:text-[24px] font-medium text-[#001f3e] tracking-tight leading-snug mt-0.5">
            Here&apos;s your summary for today
          </h1>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <NotificationBell userId={userId} />
          <div
            title={displayName}
            className="size-9 sm:size-11 rounded-full bg-[#f7f7f7] text-[#545454] font-medium text-xs sm:text-sm flex items-center justify-center select-none"
          >
            {initials}
          </div>
        </div>
      </div>

      {/* Mode Switcher Pill (NO border, NO shadow per Figma 9021:13370) */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setSwitcherOpen(!switcherOpen)}
          className="w-full bg-[#fafafa] hover:bg-[#f2f2f2] rounded-[12px] px-4 py-2.5 sm:px-5 sm:py-3 flex items-center justify-between transition-colors cursor-pointer outline-none border-0 shadow-none"
        >
          <div className="flex items-center gap-2.5">
            <span
              className={cn(
                "size-2.5 rounded-full",
                workflowMode === "reach" ? "bg-[#0073F3]" : "bg-[#B593D1]"
              )}
            />
            <span className="text-sm sm:text-base font-medium text-[#495766]">
              {workflowMode === "reach" ? "REACH Encounter" : "ECHO Encounter"}
            </span>
          </div>
          <ChevronDown
            className={cn(
              "size-4 text-[#495766] transition-transform duration-150",
              switcherOpen && "rotate-180"
            )}
          />
        </button>

        {switcherOpen && (
          <div className="absolute top-full left-0 right-0 mt-2 z-40 bg-white rounded-[16px] shadow-lg p-1.5 flex flex-col gap-1 border-0 animate-in fade-in-50 zoom-in-95 duration-100">
            <button
              type="button"
              onClick={() => switchMode("reach")}
              className={cn(
                "flex items-center gap-2.5 px-3.5 py-2.5 rounded-[10px] text-sm text-left transition-colors cursor-pointer",
                workflowMode === "reach"
                  ? "bg-[#f3f9ff] text-[#0057b7] font-medium"
                  : "hover:bg-[#fafafa] text-[#242b33]"
              )}
            >
              <span className="size-2 rounded-full bg-[#0073F3]" />
              <span>REACH Encounter</span>
            </button>
            <button
              type="button"
              onClick={() => switchMode("echo")}
              className={cn(
                "flex items-center gap-2.5 px-3.5 py-2.5 rounded-[10px] text-sm text-left transition-colors cursor-pointer",
                workflowMode === "echo"
                  ? "bg-[#f9f5fd] text-[#703da6] font-medium"
                  : "hover:bg-[#fafafa] text-[#242b33]"
              )}
            >
              <span className="size-2 rounded-full bg-[#B593D1]" />
              <span>ECHO Encounter</span>
            </button>
          </div>
        )}
      </div>

      {/* Quick Actions (Compact, single-line text, optimized for mobile & tablet) */}
      <section className="flex flex-col gap-2.5">
        <h2 className="text-[15px] sm:text-[17px] font-medium text-[#242b33] tracking-tight">
          Quick Actions
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 sm:gap-2.5 md:gap-3">
          {workflowMode === "reach" ? (
            <>
              {/* Start Manual Encounter */}
              <Link
                href="/encounters/reach/new"
                className="group relative bg-[#f3f9ff] hover:bg-[#ebf5ff] rounded-[16px] md:rounded-[22px] px-4 py-3 md:p-4 h-[54px] md:h-[118px] flex items-center justify-between md:flex-col md:items-start md:justify-between overflow-clip transition-colors border-0 shadow-none"
              >
                <img
                  src="/illustrations/encounter-manual.svg"
                  alt=""
                  className="hidden md:block absolute -bottom-2 -right-2 w-[110px] pointer-events-none opacity-85 transition-transform group-hover:scale-105"
                />
                <div className="text-[14px] md:text-[15px] font-medium text-[#0057b7] z-10 leading-tight">
                  <span className="md:hidden">Start Manual Encounter</span>
                  <span className="hidden md:block">
                    Start Manual<br />Encounter
                  </span>
                </div>
                <div className="size-[32px] md:size-[36px] rounded-full border border-[#0057b7] text-[#0057b7] flex items-center justify-center shrink-0 z-10">
                  <Plus className="size-4" />
                </div>
              </Link>

              {/* Start Guided Workflow */}
              <Link
                href="/encounters/reach/new?guided=1"
                className="group relative bg-[#f3f9ff] hover:bg-[#ebf5ff] rounded-[16px] md:rounded-[22px] px-4 py-3 md:p-4 h-[54px] md:h-[118px] flex items-center justify-between md:flex-col md:items-start md:justify-between overflow-clip transition-colors border-0 shadow-none"
              >
                <img
                  src="/illustrations/guided-workflow.svg"
                  alt=""
                  className="hidden md:block absolute -bottom-2 -right-2 w-[115px] pointer-events-none opacity-85 transition-transform group-hover:scale-105"
                />
                <div className="text-[14px] md:text-[15px] font-medium text-[#0057b7] z-10 leading-tight">
                  <span className="md:hidden">Start Guided Workflow</span>
                  <span className="hidden md:block">
                    Start Guided<br />Workflow
                  </span>
                </div>
                <div className="size-[32px] md:size-[36px] rounded-full border border-[#0057b7] text-[#0057b7] flex items-center justify-center shrink-0 z-10">
                  <Plus className="size-4" />
                </div>
              </Link>

              {/* Create New Patient */}
              <Link
                href="/patients/new"
                className="group relative bg-[#f3f9ff] hover:bg-[#ebf5ff] rounded-[16px] md:rounded-[22px] px-4 py-3 md:p-4 h-[54px] md:h-[118px] flex items-center justify-between md:flex-col md:items-start md:justify-between overflow-clip transition-colors border-0 shadow-none"
              >
                <img
                  src="/illustrations/create-patient.svg"
                  alt=""
                  className="hidden md:block absolute -bottom-2 -right-2 w-[105px] pointer-events-none opacity-85 transition-transform group-hover:scale-105"
                />
                <div className="text-[14px] md:text-[15px] font-medium text-[#0057b7] z-10 leading-tight">
                  <span className="md:hidden">Create New Patient</span>
                  <span className="hidden md:block">
                    Create New<br />Patient
                  </span>
                </div>
                <div className="size-[32px] md:size-[36px] rounded-full border border-[#0057b7] text-[#0057b7] flex items-center justify-center shrink-0 z-10">
                  <Plus className="size-4" />
                </div>
              </Link>
            </>
          ) : (
            <>
              {/* Start ECHO Encounter */}
              <Link
                href="/encounters/echo/new"
                className="group relative bg-[#f3f9ff] hover:bg-[#ebf5ff] rounded-[16px] md:rounded-[22px] px-4 py-3 md:p-4 h-[54px] md:h-[118px] flex items-center justify-between md:flex-col md:items-start md:justify-between overflow-clip transition-colors border-0 shadow-none"
              >
                <img
                  src="/illustrations/encounter-manual.svg"
                  alt=""
                  className="hidden md:block absolute -bottom-2 -right-2 w-[110px] pointer-events-none opacity-85 transition-transform group-hover:scale-105"
                />
                <div className="text-[14px] md:text-[15px] font-medium text-[#0057b7] z-10 leading-tight">
                  <span className="md:hidden">Start ECHO Encounter</span>
                  <span className="hidden md:block">
                    Start ECHO<br />Encounter
                  </span>
                </div>
                <div className="size-[32px] md:size-[36px] rounded-full border border-[#0057b7] text-[#0057b7] flex items-center justify-center shrink-0 z-10">
                  <Plus className="size-4" />
                </div>
              </Link>

              {/* Create New Patient */}
              <Link
                href="/patients/new"
                className="group relative bg-[#f3f9ff] hover:bg-[#ebf5ff] rounded-[16px] md:rounded-[22px] px-4 py-3 md:p-4 h-[54px] md:h-[118px] flex items-center justify-between md:flex-col md:items-start md:justify-between overflow-clip transition-colors border-0 shadow-none"
              >
                <img
                  src="/illustrations/create-patient.svg"
                  alt=""
                  className="hidden md:block absolute -bottom-2 -right-2 w-[105px] pointer-events-none opacity-85 transition-transform group-hover:scale-105"
                />
                <div className="text-[14px] md:text-[15px] font-medium text-[#0057b7] z-10 leading-tight">
                  <span className="md:hidden">Create New Patient</span>
                  <span className="hidden md:block">
                    Create New<br />Patient
                  </span>
                </div>
                <div className="size-[32px] md:size-[36px] rounded-full border border-[#0057b7] text-[#0057b7] flex items-center justify-center shrink-0 z-10">
                  <Plus className="size-4" />
                </div>
              </Link>

              {/* View Referrals */}
              <Link
                href="/referrals"
                className="group relative bg-[#f3f9ff] hover:bg-[#ebf5ff] rounded-[16px] md:rounded-[22px] px-4 py-3 md:p-4 h-[54px] md:h-[118px] flex items-center justify-between md:flex-col md:items-start md:justify-between overflow-clip transition-colors border-0 shadow-none"
              >
                <img
                  src="/illustrations/guided-workflow.svg"
                  alt=""
                  className="hidden md:block absolute -bottom-2 -right-2 w-[115px] pointer-events-none opacity-85 transition-transform group-hover:scale-105"
                />
                <div className="text-[14px] md:text-[15px] font-medium text-[#0057b7] z-10 leading-tight">
                  <span className="md:hidden">View Referrals</span>
                  <span className="hidden md:block">
                    View<br />Referrals
                  </span>
                </div>
                <div className="size-[32px] md:size-[36px] rounded-full border border-[#0057b7] text-[#0057b7] flex items-center justify-center shrink-0 z-10">
                  <Plus className="size-4" />
                </div>
              </Link>
            </>
          )}
        </div>
      </section>

      {/* Pending Referral Alert (in ECHO mode, NO border, NO shadow) */}
      {workflowMode === "echo" && (
        <section>
          {pendingReferral ? (
            <div className="bg-[#fff1ed] rounded-[20px] sm:rounded-[24px] p-3.5 sm:p-4 flex items-center justify-between gap-3 border-0 shadow-none">
              <div className="flex items-center gap-3">
                <div className="size-9 sm:size-10 rounded-full bg-[#ffded6] text-[#e05338] flex items-center justify-center shrink-0">
                  <Info className="size-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-[#8b2310]">
                    1 Pending Referral
                  </h3>
                  <p className="text-xs text-[#ab3620] mt-0.5">
                    Referral {pendingReferral.referral_code} is currently {pendingReferral.status}.
                  </p>
                </div>
              </div>

              <Link
                href={`/referrals/${pendingReferral.id}`}
                style={{ borderRadius: "12px" }}
                className="bg-white text-[#e05338] hover:bg-[#ffded6]/60 text-xs font-medium px-3.5 py-1.5 rounded-[12px] flex items-center shrink-0 transition-colors border-0 shadow-none"
              >
                Review details
              </Link>
            </div>
          ) : (
            <div className="bg-[#fff1ed] rounded-[20px] sm:rounded-[24px] p-3.5 sm:p-4 flex items-center justify-between gap-3 border-0 shadow-none">
              <div className="flex items-center gap-3">
                <div className="size-9 sm:size-10 rounded-full bg-[#ffded6] text-[#e05338] flex items-center justify-center shrink-0">
                  <Info className="size-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-[#8b2310]">
                    1 Pending Referral
                  </h3>
                  <p className="text-xs text-[#ab3620] mt-0.5">
                    Patient requires immediate attention for suspected Cholera.
                  </p>
                </div>
              </div>

              <Link
                href="/referrals"
                style={{ borderRadius: "12px" }}
                className="bg-white text-[#e05338] hover:bg-[#ffded6]/60 text-xs font-medium px-3.5 py-1.5 rounded-[12px] flex items-center shrink-0 transition-colors border-0 shadow-none"
              >
                Review details
              </Link>
            </div>
          )}
        </section>
      )}

      {/* New Patients (Sensible compact sizing, NO border, NO shadow) */}
      <section className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <h2 className="text-[15px] sm:text-[17px] font-medium text-[#242b33] tracking-tight">
            New Patients
          </h2>
          <Link
            href="/patients"
            className="text-xs sm:text-sm font-normal text-[#0073F3] hover:underline"
          >
            View all
          </Link>
        </div>

        {patients.length === 0 ? (
          <div className="bg-[#fafafa] rounded-[20px] sm:rounded-[24px] p-6 text-center text-sm text-[#6e8298]">
            No patients registered yet
          </div>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-none">
            {patients.map((p) => {
              const pInitials = getInitials(p.full_name);
              return (
                <div
                  key={p.id}
                  className="bg-[#fafafa] rounded-[20px] sm:rounded-[28px] px-4 py-3.5 sm:px-5 sm:py-4 min-w-[310px] sm:min-w-[360px] md:min-w-[380px] flex items-center justify-between gap-4 sm:gap-6 shrink-0 border-0 shadow-none"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="size-[46px] sm:size-[52px] rounded-full bg-white border border-[#eaeaea] flex items-center justify-center shrink-0">
                      <span className="text-[#0073f3] text-[16px] sm:text-[18px] font-medium">
                        {pInitials}
                      </span>
                    </div>
                    <div className="min-w-0 flex flex-col gap-0.5">
                      <p className="text-[14px] sm:text-[16px] font-medium text-[#001f3f] truncate">
                        {p.full_name}
                      </p>
                      <div className="text-xs sm:text-[13px] text-[#6a6a6a] flex items-center gap-1.5 flex-wrap">
                        {p.sex && (
                          <>
                            <span className="capitalize font-medium text-[#495766]">{p.sex}</span>
                            <span className="text-[#bfbfbf]">•</span>
                          </>
                        )}
                        <span className="text-[#bfbfbf]">Created</span>
                        <span>{format(new Date(p.created_at), "d MMM yyyy")}</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-[#ffdcd5] px-2.5 py-0.5 rounded-full shrink-0">
                    <span className="text-[#d44424] font-mono text-[11px] sm:text-xs font-medium">
                      {p.patient_code}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Recent Encounters (Sensible compact sizing, NO border, NO shadow) */}
      <section className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <h2 className="text-[15px] sm:text-[17px] font-medium text-[#242b33] tracking-tight">
            Recent Encounters
          </h2>
          <Link
            href="/encounters"
            className="text-xs sm:text-sm font-normal text-[#0073F3] hover:underline"
          >
            View all
          </Link>
        </div>

        {encounters.length === 0 ? (
          <div className="bg-[#fafafa] rounded-[20px] sm:rounded-[24px] p-6 text-center text-sm text-[#6e8298]">
            No encounters documented yet
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {encounters.map((e) => {
              const isClosed = e.status === "completed";
              const dateVal = e.started_at ? new Date(e.started_at) : new Date();
              const patientName =
                e.patients && typeof e.patients === "object" && "full_name" in e.patients
                  ? (e.patients as { full_name: string }).full_name
                  : "Patient";

              return (
                <div
                  key={e.id}
                  className="bg-[#fafafa] rounded-[20px] sm:rounded-[28px] px-4 py-3 sm:px-5 sm:py-3.5 flex items-center justify-between gap-3 border-0 shadow-none"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="size-[44px] sm:size-[50px] rounded-full bg-white border border-[#eaeaea] flex flex-col items-center justify-center shrink-0">
                      <span className="text-[10px] sm:text-[11px] font-medium text-[#0073f3] uppercase leading-none">
                        {format(dateVal, "MMM")}
                      </span>
                      <span className="text-[14px] sm:text-[16px] font-semibold text-[#0073f3] leading-none mt-0.5">
                        {format(dateVal, "dd")}
                      </span>
                    </div>

                    <div className="min-w-0 flex flex-col gap-0.5">
                      <p className="text-[14px] sm:text-[15px] font-medium text-[#242b33] truncate">
                        {e.workflow_mode === "echo"
                          ? "ECHO Surveillance Encounter"
                          : "Rabies Vaccination Encounter"}
                      </p>
                      <p className="text-xs text-[#6a6a6a] truncate">
                        <span className="text-[#bfbfbf]">For</span>{" "}
                        <span>{patientName}</span>
                      </p>
                    </div>
                  </div>

                  {/* Action Button: 12px rounded, no border */}
                  <Link
                    href={`/encounters`}
                    style={{ borderRadius: "12px" }}
                    className="bg-white text-[#0073f3] hover:bg-[#0073f3]/5 px-3 py-1.5 sm:px-4 sm:py-1.5 rounded-[12px] text-xs sm:text-sm font-medium shrink-0 transition-colors border-0 shadow-none"
                  >
                    {isClosed ? "View details" : "Complete encounter"}
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
