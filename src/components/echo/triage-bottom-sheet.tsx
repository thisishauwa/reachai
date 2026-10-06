"use client";

import { ArrowRight, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TriageSeverity } from "@/lib/supabase/database.types";

/**
 * AC6 — Final screen:
 *  - Shows the Suspected Disease Category derived from selected symptoms.
 *  - Shows the mandatory disclaimer: "This is not a diagnosis."
 *  - Shows no syndrome match message when category is not identified.
 *
 * AC7 — Confirm Referral generates a unique referral code displayed on screen.
 */

interface TriageBottomSheetProps {
  severity: TriageSeverity;
  /** The suspected disease category returned by the backend algorithm */
  conditionLabel: string;
  guidanceText: string;
  ipcGuidance?: string | null;
  onConfirmReferral: () => void;
  onClose?: () => void;
  onCompleteRoutine?: () => void;
}

export function TriageBottomSheet({
  severity,
  conditionLabel,
  guidanceText,
  ipcGuidance,
  onConfirmReferral,
  onClose,
  onCompleteRoutine,
}: TriageBottomSheetProps) {
  const isEmergency = severity === "emergency";
  const isUrgent = severity === "urgent";
  const isRoutine = severity === "routine" || severity === "none";

  // AC6 — No syndrome match edge case
  const hasMatch =
    conditionLabel &&
    conditionLabel !== "Clinical Assessment" &&
    conditionLabel !== "No specific category identified";

  const displayCategory =
    hasMatch ? conditionLabel : "No specific category identified";

  return (
    <div
      className={cn(
        "w-full rounded-[24px] p-6 sm:p-8 flex flex-col gap-6",
        isEmergency
          ? "bg-[#fff8f6]"
          : isUrgent
          ? "bg-[#fffdf7]"
          : "bg-white"
      )}
    >
      {/* Eyebrow label */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-[#6e8298]">
          Suspected Disease Category
        </span>
        {/* AC6 — Mandatory disclaimer */}
        <span className="bg-[#fff1ed] text-[#d4583b] text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0">
          <ShieldAlert className="size-3" />
          This is not a diagnosis.
        </span>
      </div>

      {/* Top Header Row */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-xl sm:text-2xl font-semibold text-[#242b33]">
            {displayCategory}
          </h2>
          <span
            className={cn(
              "px-3 py-1 rounded-full text-xs sm:text-sm font-medium",
              isEmergency
                ? "bg-[#ffece5] text-[#d4583b]"
                : isUrgent
                ? "bg-[#fef3c7] text-[#b45309]"
                : "bg-[#f1f5f9] text-[#475569]"
            )}
          >
            {isEmergency ? "Emergency" : isUrgent ? "Urgent" : "Routine"}
          </span>
        </div>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="size-8 rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors shrink-0 text-[#a1aebc] hover:text-[#242b33]"
          >
            ×
          </button>
        )}
      </div>

      {/* Main Guidance Text */}
      {guidanceText && (
        <p
          className={cn(
            "text-base sm:text-lg leading-relaxed",
            isEmergency
              ? "text-[#a03823]"
              : isUrgent
              ? "text-[#92400e]"
              : "text-[#334155]"
          )}
        >
          {guidanceText}
        </p>
      )}

      {/* No match guidance */}
      {!hasMatch && (
        <p className="text-sm text-[#6e8298] leading-relaxed bg-[#f2f3f5] rounded-[12px] px-4 py-3">
          The selected symptoms did not match a specific IDSR category. You can
          still generate a referral for clinical review.
        </p>
      )}

      {/* IPC Guidance Container (for Emergency) */}
      {isEmergency && ipcGuidance && (
        <div className="bg-[#fff5f2] rounded-[16px] p-5 flex flex-col gap-1.5">
          <span className="font-semibold text-sm sm:text-base text-[#242b33]">
            IPC Guidance
          </span>
          <p className="text-xs sm:text-sm text-[#6e8298] leading-relaxed">
            {ipcGuidance}
          </p>
        </div>
      )}

      {/* Disclaimer block (prominent) */}
      <div className="bg-[#fff8f6] border border-[#ffd5c8] rounded-[12px] px-4 py-3 flex items-center gap-2">
        <ShieldAlert className="size-4 text-[#d4583b] shrink-0" />
        <p className="text-sm text-[#a03823] font-medium leading-snug">
          This is not a diagnosis. Confirm the suspected category with a qualified health worker.
          <br />
          <span className="text-xs font-normal text-[#c75b40]">
            Wannan ba ganewar asali ba ne. Tabbatar da rukunin da ake zargi tare da ma&apos;aikacin lafiya mai cancanta.
          </span>
        </p>
      </div>

      {/* Bottom Action Button */}
      <div className="pt-2">
        {!isRoutine ? (
          <button
            type="button"
            id="confirm-referral-btn"
            onClick={onConfirmReferral}
            className={cn(
              "w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-[12px] text-sm sm:text-base font-medium transition-colors cursor-pointer",
              isEmergency
                ? "bg-[#e05338] hover:bg-[#c9432a] text-white"
                : "bg-[#f59e0b] hover:bg-[#d97706] text-white"
            )}
          >
            <span>Confirm Referral</span>
            <ArrowRight className="size-4" />
          </button>
        ) : (
          <button
            type="button"
            id="complete-routine-btn"
            onClick={onCompleteRoutine || onConfirmReferral}
            className="w-full rounded-[12px] bg-[#0073f3] hover:bg-[#0060cb] text-white px-8 py-3.5 text-sm sm:text-base font-medium transition-colors cursor-pointer shadow-sm"
          >
            Complete assessment
          </button>
        )}
      </div>
    </div>
  );
}
