"use client";

import { useEffect, useState } from "react";
import { X, Calendar, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * ZeroReportModal — daily reminder pop-up (AC8 & AC9)
 *
 * Appears once per day when the PPMV hasn't logged any status.
 * Options:
 *   1. "I saw patients"     → dismisses modal, opens encounter flow
 *   2. "No cases seen today" → records explicit zero report
 *   3. "No report submitted" → records manual no-report
 *
 * Dismissing (×) without choosing an option does NOT record anything.
 * If the PPMV never responds before end-of-day, the system auto-records
 * "No report submitted (auto-recorded)" — see useZeroReport hook.
 */

export type ZeroReportStatus =
  | "no_cases"        // explicit zero report (green)
  | "no_report"       // explicit no-report by PPMV
  | "no_report_auto"; // system-recorded (auto-recorded)

export interface ZeroReportModalProps {
  open: boolean;
  onClose: () => void;
  onSawPatients: () => void;
  onNoCases: () => void;
  onNoReport: () => void;
}

export function ZeroReportModal({
  open,
  onClose,
  onSawPatients,
  onNoCases,
  onNoReport,
}: ZeroReportModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-label="Daily reporting reminder"
    >
      <div className="w-full max-w-[440px] bg-white rounded-[24px] p-6 sm:p-8 flex flex-col gap-5 shadow-2xl animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-2">
              <div className="size-8 rounded-full bg-[#f9f3ff] text-[#9175a7] flex items-center justify-center">
                <Calendar className="size-4" />
              </div>
              <h2 className="text-lg font-semibold text-[#121619]">
                Daily Report Reminder
              </h2>
            </div>
            <p className="text-sm text-[#6e8298] mt-1">
              Did you see any patients today?
            </p>
            <p className="text-xs text-[#6e8298] italic">
              Shin ka gan wasu marasa lafiya a yau?
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Dismiss reminder (does not record a status)"
            className="size-8 rounded-full flex items-center justify-center hover:bg-gray-100 text-[#a1aebc] hover:text-[#242b33] transition-colors shrink-0"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="h-px bg-[#f2f3f5]" />

        {/* Options */}
        <div className="flex flex-col gap-2.5">
          {/* Option 1: I saw patients */}
          <button
            type="button"
            id="zero-report-saw-patients"
            onClick={onSawPatients}
            className="w-full h-14 rounded-[14px] bg-[#0073f3] hover:bg-[#0060cb] text-white font-medium text-sm sm:text-base flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            I saw patients today
            <span className="text-xs text-blue-200 ml-1">— Na ga marasa lafiya</span>
          </button>

          {/* Option 2: No cases */}
          <button
            type="button"
            id="zero-report-no-cases"
            onClick={onNoCases}
            className="w-full h-14 rounded-[14px] border-2 border-[#22c55e] bg-[#f0fdf4] hover:bg-[#dcfce7] text-[#166534] font-medium text-sm sm:text-base flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            No cases seen today
            <span className="text-xs text-green-600 ml-1">— Babu marasa lafiya</span>
          </button>


        </div>

        <p className="text-xs text-[#a1aebc] text-center">
          Dismissing this reminder does not record any status. It will reappear the next time you open the app today.
        </p>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// ZeroReportStatusBadge — visual distinction between the three states (AC10)
// ────────────────────────────────────────────────────────────────────────────

export function ZeroReportStatusBadge({
  status,
  date,
}: {
  status: ZeroReportStatus;
  date?: string;
}) {
  if (status === "no_cases") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-[#dcfce7] text-[#166534]">
        <span className="size-1.5 rounded-full bg-[#22c55e]" />
        No cases seen
        {date && <span className="text-green-600 opacity-75">· {date}</span>}
      </span>
    );
  }

  if (status === "no_report") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-[#f1f5f9] text-[#475569]">
        <span className="size-1.5 rounded-full bg-[#94a3b8]" />
        No report submitted
        {date && <span className="text-slate-400 opacity-75">· {date}</span>}
      </span>
    );
  }

  // no_report_auto
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-[#fff1ed] text-[#d4583b]">
      <span className="size-1.5 rounded-full bg-[#e05338]" />
      No report submitted
      <span className="bg-[#ffe0d6] text-[#d4583b] rounded-full px-1.5 py-0 text-[10px] font-semibold">
        auto-recorded
      </span>
      {date && <span className="text-orange-400 opacity-75">· {date}</span>}
    </span>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// FollowUpFlagBadge — shown after 7 consecutive no-report days (AC10)
// ────────────────────────────────────────────────────────────────────────────

export function FollowUpFlagBadge({
  consecutiveDays,
}: {
  consecutiveDays: number;
}) {
  if (consecutiveDays < 7) return null;

  return (
    <div className="flex items-center gap-2 bg-[#fff8dc] border border-[#f59e0b] rounded-[10px] px-3.5 py-2.5">
      <AlertTriangle className="size-4 text-[#d97706] shrink-0" />
      <div className="flex flex-col gap-0">
        <span className="text-xs font-semibold text-[#92400e]">
          Follow-up required
        </span>
        <span className="text-[11px] text-[#b45309]">
          {consecutiveDays} consecutive days without a report. Project team has been flagged.
        </span>
      </div>
    </div>
  );
}
