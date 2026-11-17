"use client";

import { ArrowRight, CheckCircle2, ShieldAlert, Stethoscope } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TriageSeverity } from "@/lib/supabase/database.types";
import { careGuidanceFor, ROUTINE_RETURN_SIGNS } from "@/lib/reference/referral-guidance";

interface TriageBottomSheetProps {
  severity: TriageSeverity;
  conditionCode?: string;
  conditionLabel: string;
  guidanceText: string;
  ipcGuidance?: string | null;
  referralRequired: boolean;
  onConfirmReferral: () => void;
  onClose?: () => void;
  onCompleteRoutine?: () => void;
}

export function TriageBottomSheet({ severity, conditionCode = "UNCLASSIFIED", conditionLabel, guidanceText, ipcGuidance, referralRequired, onConfirmReferral, onClose, onCompleteRoutine }: TriageBottomSheetProps) {
  const isEmergency = severity === "emergency";
  const isUrgent = severity === "urgent";
  const guidance = careGuidanceFor(conditionCode, severity);
  const hasMatch = conditionLabel && conditionLabel !== "Clinical Assessment" && conditionLabel !== "No specific category identified";
  const displayCategory = hasMatch ? conditionLabel : "Signs that need a clinic check";

  if (!referralRequired) {
    return (
      <div className="w-full rounded-[24px] bg-white p-5 pb-28 sm:p-8 sm:pb-28 flex flex-col gap-6">
        <div className="rounded-[18px] bg-[#eef8f0] border border-[#cce8d2] p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-[#287a39]">Step 6 of 6</p>
          <h2 className="text-xl sm:text-2xl font-semibold text-[#173d20] mt-1">Routine - no referral needed</h2>
          <p className="text-sm text-[#41694a] mt-2">No danger signs and no priority disease pattern matched.</p>
        </div>
        <section className="rounded-[18px] border border-[#e4e8ec] p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#6e8298]">What was recorded</p>
          <h3 className="text-lg font-semibold text-[#242b33] mt-2">{conditionLabel || "Routine illness"}</h3>
          <p className="text-sm text-[#5f7081] mt-2 leading-relaxed">{guidanceText}</p>
        </section>
        <section className="rounded-[18px] border border-[#d9e8f7] bg-[#f6faff] p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#356b9e]">You may give</p>
          <ul className="mt-3 space-y-2 text-sm text-[#2f4f6d]">
            <li className="flex gap-2"><CheckCircle2 className="size-4 mt-0.5 shrink-0" />Paracetamol for fever, using the correct dose for the age band.</li>
            <li className="flex gap-2"><CheckCircle2 className="size-4 mt-0.5 shrink-0" />Advise fluids, normal feeding and rest.</li>
          </ul>
        </section>
        <section className="rounded-[18px] border border-[#f0d7b1] bg-[#fffaf1] p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#93641a]">Tell the patient to come back or go to a clinic if</p>
          <ul className="mt-3 space-y-2 text-sm text-[#674a1c]">
            {ROUTINE_RETURN_SIGNS.map((sign) => <li key={sign} className="flex gap-2"><span aria-hidden>•</span><span>{sign}</span></li>)}
          </ul>
        </section>
        <p className="rounded-[14px] bg-[#f2f3f5] px-4 py-3 text-sm text-[#596b7c]">This visit is still counted. It helps the dashboard distinguish a disease surge from a busier shop.</p>
        <div className="encounter-action-bar"><button type="button" id="complete-routine-btn" onClick={onCompleteRoutine || onConfirmReferral} className="w-full rounded-[12px] bg-[#0073f3] px-8 py-3.5 text-sm sm:text-base font-medium text-white">Save and finish</button></div>
      </div>
    );
  }

  return (
    <div className="w-full rounded-[24px] bg-white p-5 pb-28 sm:p-8 sm:pb-28 flex flex-col gap-6">
      <div className={cn("rounded-[18px] border p-5", isEmergency ? "border-[#f2c8bd] bg-[#fff5f2]" : isUrgent ? "border-[#f0d7b1] bg-[#fffaf1]" : "border-[#d9e8f7] bg-[#f6faff]") }>
        <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-wider opacity-70">Step 6 of 6 - Result</p><h2 className="text-xl sm:text-2xl font-semibold mt-1">{guidance.severityLabel}</h2><p className="text-sm mt-2 opacity-80">{guidance.severityReason}</p></div>{onClose && <button type="button" onClick={onClose} aria-label="Close" className="size-8 rounded-full hover:bg-black/5">×</button>}</div>
      </div>
      <section className="rounded-[18px] border border-[#e4e8ec] p-5">
        <div className="flex items-center gap-2"><Stethoscope className="size-4 text-[#5f7081]" /><p className="text-xs font-semibold uppercase tracking-wider text-[#6e8298]">What this looks like</p></div>
        <h3 className="text-lg sm:text-xl font-semibold text-[#242b33] mt-3">{displayCategory}</h3>
        <p className="text-sm text-[#5f7081] mt-2">{guidanceText}</p>
        <div className="mt-4 rounded-[12px] bg-[#fff8f6] border border-[#ffd5c8] px-4 py-3 flex gap-2"><ShieldAlert className="size-4 text-[#d4583b] shrink-0 mt-0.5" /><p className="text-sm text-[#a03823]"><strong>This is not a diagnosis.</strong> A qualified health worker must confirm it.<span className="block text-xs mt-1">Wannan ba ganewar asali ba ne. Ma&apos;aikacin lafiya ne zai tabbatar.</span></p></div>
      </section>
      <section className="rounded-[18px] border border-[#d9e8f7] bg-[#f6faff] p-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-[#356b9e]">Do now</p>
        <div className="grid sm:grid-cols-2 gap-5 mt-4">
          <div><h4 className="font-semibold text-[#244b70]">Before transport - you may give</h4><ul className="mt-2 space-y-2 text-sm text-[#365b7d]">{guidance.give.map((item) => <li key={item} className="flex gap-2"><span>•</span><span>{item}</span></li>)}</ul></div>
          <div><h4 className="font-semibold text-[#9b3c2a]">Do not give</h4><ul className="mt-2 space-y-2 text-sm text-[#7d4337]">{guidance.doNotGive.map((item) => <li key={item} className="flex gap-2"><span>•</span><span>{item}</span></li>)}</ul></div>
        </div>
      </section>
      <section className="rounded-[18px] border border-[#ead8b9] bg-[#fffbf3] p-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-[#8a5b00]">Protect yourself and others</p>
        <ul className="mt-3 space-y-2 text-sm text-[#694e1d]">{(ipcGuidance ? [ipcGuidance] : guidance.ipc).map((item) => <li key={item} className="flex gap-2"><ShieldAlert className="size-4 mt-0.5 shrink-0" /><span>{item}</span></li>)}</ul>
        {guidance.surveillanceNotice && <p className="mt-3 rounded-[10px] bg-[#fff1ed] px-3 py-2 text-sm font-semibold text-[#a03823]">{guidance.surveillanceNotice}</p>}
      </section>
      <section className="rounded-[18px] border border-[#e4e8ec] p-5"><p className="text-xs font-semibold uppercase tracking-wider text-[#6e8298]">Referral</p><h3 className="text-lg font-semibold text-[#242b33] mt-2">{isEmergency ? "Refer now" : conditionCode.includes("TB") ? "Refer for testing" : "Refer today"}</h3><p className="text-sm text-[#5f7081] mt-2">{guidance.plainReason}</p></section>
      <div className="encounter-action-bar"><button type="button" id="confirm-referral-btn" onClick={onConfirmReferral} className={cn("w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-[12px] text-sm sm:text-base font-medium text-white", isEmergency ? "bg-[#d44424]" : "bg-[#0073f3]") }>Continue to referral <ArrowRight className="size-4" /></button></div>
    </div>
  );
}
