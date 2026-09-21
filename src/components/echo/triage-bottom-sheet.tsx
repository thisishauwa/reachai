"use client";

import { ArrowRight, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TriageSeverity } from "@/lib/supabase/database.types";

interface TriageBottomSheetProps {
  severity: TriageSeverity;
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
      {/* Top Header Row */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-xl sm:text-2xl font-semibold text-[#242b33]">
            {conditionLabel || (isEmergency ? "Suspected Cholera" : isUrgent ? "Severe Malaria" : "Uncomplicated Malaria")}
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
            <X className="size-5" />
          </button>
        )}
      </div>

      {/* Main Guidance Text */}
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
        {guidanceText ||
          (isEmergency
            ? "Immediate isolation required. Begin oral rehydration therapy immediately. Refer to nearest secondary health facility."
            : isUrgent
            ? "Administer pre-referral artesunate suppository or IM artesunate. Refer immediately."
            : "Treat with Artemisinin-based Combination Therapy (ACT) for 3 days. Advise on bed net usage.")}
      </p>

      {/* IPC Guidance Container (Figma 0:3050 for Emergency) */}
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

      {/* Bottom Action Button */}
      <div className="pt-2">
        {!isRoutine ? (
          <button
            type="button"
            onClick={onConfirmReferral}
            className={cn(
              "inline-flex items-center gap-2 px-6 py-3.5 rounded-[12px] text-sm sm:text-base font-medium transition-colors cursor-pointer border",
              isEmergency
                ? "border-[#d4583b] text-[#d4583b] hover:bg-[#fff5f2]"
                : "border-[#d97706] text-[#b45309] hover:bg-[#fffbeb]"
            )}
          >
            <span>Confirm referral</span>
            <ArrowRight className="size-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={onCompleteRoutine || onConfirmReferral}
            className="rounded-[12px] bg-[#0073f3] hover:bg-[#0060cb] text-white px-8 py-3.5 text-sm sm:text-base font-medium transition-colors cursor-pointer"
          >
            Complete assessment
          </button>
        )}
      </div>
    </div>
  );
}
