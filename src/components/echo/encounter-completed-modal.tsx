"use client";

import { BarChart3, CheckCircle2, MapPin } from "lucide-react";
import { useRouter } from "next/navigation";
import type { ReferralOutcome } from "@/components/echo/step-referral";
import { resultCategoryLabels } from "@/lib/reference/referral-guidance";
import type { TriageSeverity } from "@/lib/supabase/database.types";

interface EncounterCompletedModalProps {
  patientName?: string;
  isAnonymous?: boolean;
  category?: string | null;
  severity?: TriageSeverity | null;
  recommendation?: string | null;
  referralOutcome?: ReferralOutcome | "not_required" | null;
  referralReason?: string | null;
  referralDestination?: string | null;
  onReturnHome?: () => void;
}

const OUTCOME_LABELS: Record<ReferralOutcome | "not_required", string> = {
  referred: "Yes, referred",
  refused: "Yes, but the patient refused",
  not_referred: "No — recommendation declined",
  not_required: "No referral required",
};

function severityLabel(severity?: TriageSeverity | null): string {
  if (severity === "emergency") return "Acute";
  if (severity === "urgent") return "Urgent";
  return "Routine";
}

export function EncounterCompletedModal({
  patientName = "Patient",
  isAnonymous = false,
  category,
  severity,
  recommendation,
  referralOutcome,
  referralReason,
  referralDestination,
  onReturnHome,
}: EncounterCompletedModalProps) {
  const router = useRouter();
  const categories = resultCategoryLabels(category || "No specific category identified");
  const outcomeLabel = referralOutcome ? OUTCOME_LABELS[referralOutcome] : "Recorded";

  const handleReturnHome = () => {
    if (onReturnHome) onReturnHome();
    else router.push("/home");
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 p-4 backdrop-blur-[2px]">
      <div role="dialog" aria-modal="true" aria-labelledby="record-saved-title" className="mx-auto my-6 w-full max-w-[560px] rounded-[24px] bg-white p-5 shadow-2xl sm:my-10 sm:p-8">
        <div className="flex items-start gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[#eaf7ed] text-[#287a39]"><CheckCircle2 className="size-6" /></div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[#287a39]">Step 6 complete</p>
            <h2 id="record-saved-title" className="mt-1 text-2xl font-semibold text-[#001f3e]">Record saved</h2>
            <p className="mt-1 text-sm text-[#6e8298]">An ajiye bayanan.</p>
          </div>
        </div>

        <p className="mt-5 text-sm leading-relaxed text-[#5f7081]">
          The {isAnonymous ? "anonymous encounter" : `encounter for ${patientName}`} is complete. The recommendation and what happened next are stored together.
        </p>

        <dl className="mt-5 divide-y divide-[#edf0f2] rounded-[18px] border border-[#e4e8ec] px-4 sm:px-5">
          <div className="grid gap-1 py-4 sm:grid-cols-[140px_1fr] sm:gap-4"><dt className="text-sm text-[#6e8298]">Category</dt><dd className="font-medium text-[#242b33]"><ol className="space-y-1">{categories.map((label, index) => <li key={label}>{categories.length > 1 ? `${index + 1}. ` : ""}{label}</li>)}</ol></dd></div>
          <div className="grid gap-1 py-4 sm:grid-cols-[140px_1fr] sm:gap-4"><dt className="text-sm text-[#6e8298]">Severity</dt><dd className="font-medium text-[#242b33]">{severityLabel(severity)}</dd></div>
          <div className="grid gap-1 py-4 sm:grid-cols-[140px_1fr] sm:gap-4"><dt className="text-sm text-[#6e8298]">Recommendation</dt><dd className="font-medium text-[#242b33]">{recommendation || "Routine advice recorded."}</dd></div>
          <div className="grid gap-1 py-4 sm:grid-cols-[140px_1fr] sm:gap-4"><dt className="text-sm text-[#6e8298]">Outcome</dt><dd className="font-medium text-[#242b33]">{outcomeLabel}</dd></div>
          {referralDestination && <div className="grid gap-1 py-4 sm:grid-cols-[140px_1fr] sm:gap-4"><dt className="text-sm text-[#6e8298]">Referred to</dt><dd className="flex gap-2 font-medium text-[#242b33]"><MapPin className="mt-0.5 size-4 shrink-0 text-[#0073f3]" />{referralDestination}</dd></div>}
          {referralReason && <div className="grid gap-1 py-4 sm:grid-cols-[140px_1fr] sm:gap-4"><dt className="text-sm text-[#6e8298]">Reason</dt><dd className="font-medium text-[#242b33]">{referralReason}</dd></div>}
        </dl>

        <div className="mt-5 flex gap-3 rounded-[16px] bg-[#f2f3f5] p-4 text-sm text-[#596b7c]"><BarChart3 className="mt-0.5 size-5 shrink-0 text-[#356b9e]" /><p><strong className="text-[#354554]">Counted for surveillance.</strong> This visit contributes to the outlet totals, including referrals, refusals and declined recommendations.<span className="mt-1 block text-xs">[Hausa translation pending]</span></p></div>

        <button type="button" onClick={handleReturnHome} className="mt-6 min-h-12 w-full rounded-[12px] bg-[#0073f3] px-5 font-semibold text-white hover:bg-[#0060cb]">Return home</button>
      </div>
    </div>
  );
}
