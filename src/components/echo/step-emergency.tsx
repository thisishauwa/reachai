"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Phone, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { emergencyVariantForSign, type LookCheckAnswer } from "@/lib/reference/look-check";

interface StepEmergencyProps {
  primarySignCode: string;
  caregiverReported: boolean;
  onComplete: (questionSetId: string, answers: Record<string, unknown>) => void;
  onPrevious?: () => void;
}

const YES_NO_OPTIONS: { value: LookCheckAnswer; label: string; ha: string }[] = [
  { value: "yes", label: "Yes", ha: "I" },
  { value: "no", label: "No", ha: "A'a" },
];
const UNKNOWN_OPTION: { value: LookCheckAnswer; label: string; ha: string } = { value: "unknown", label: "Don't know", ha: "Ban sani ba" };

export function StepEmergency({ primarySignCode, caregiverReported, onComplete, onPrevious }: StepEmergencyProps) {
  const variant = useMemo(() => emergencyVariantForSign(primarySignCode), [primarySignCode]);
  const [answers, setAnswers] = useState<Record<string, LookCheckAnswer>>({});
  const hasStarted = Object.keys(answers).length > 0;
  const allAnswered = variant.questions.every((question) => answers[question.code]);

  const handleContinue = () => {
    if (!allAnswered) return;
    onComplete(`look_check_${variant.id}`, {
      ...answers,
      LOOK_CHECK_ACUTE: "yes",
      LOOK_CHECK_PRIMARY_SIGN: primarySignCode,
      CAREGIVER_REPORTED: caregiverReported,
    });
  };

  return (
    <div className="w-full flex flex-col gap-5 pb-28">
      <section className="rounded-[20px] border border-[#f2c8bd] bg-[#fff5f2] p-5 sm:p-8 flex gap-4" role="alert">
        <div className="size-11 rounded-full bg-[#d44424] text-white flex items-center justify-center shrink-0"><AlertTriangle className="size-6" /></div>
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-[#b5351c]">Acute</p>
          <h2 className="text-xl sm:text-2xl font-semibold text-[#5b1c10] mt-1">Refer now — do not delay</h2>
          <p className="text-sm sm:text-base text-[#7a3426] mt-2">
            {caregiverReported ? "Tell the caregiver to bring the patient to the clinic immediately." : "Keep the patient with you while transport is arranged."}
          </p>
          <p className="text-xs text-[#7a3426] mt-1">A kai shi asibiti yanzu — kada a yi jinkiri.</p>
        </div>
      </section>

      <section className="rounded-[18px] border border-[#e9a832] bg-[#fff6df] p-5 sm:p-6 flex gap-4">
        <ShieldAlert className="size-6 text-[#9a6500] shrink-0 mt-0.5" />
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-[#8a5b00]">Protect yourself now</p>
          <p className="text-sm sm:text-base font-medium text-[#553b08] mt-1">{variant.ipc}</p>
          <p className="text-xs text-[#72551c] mt-1">{variant.ipc_ha}</p>
        </div>
      </section>

      <section className="rounded-[18px] border border-[#dfe5eb] bg-white p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-[#6e8298]">Referral code</p>
          <p className="font-mono text-2xl font-bold tracking-[0.18em] text-[#001f3e] mt-1">BK-TRN</p>
          <p className="text-xs text-[#6e8298] mt-1">Give this code to the clinic · Ba wa asibitin wannan lambar</p>
        </div>
        <a href="tel:+2348000000000" className="min-h-11 rounded-[12px] bg-[#0073f3] px-5 text-white font-medium inline-flex items-center justify-center gap-2">
          <Phone className="size-4" /> Call the clinic
        </a>
      </section>

      <section className="rounded-[20px] bg-[#f9f9f9] p-5 sm:p-8 flex flex-col gap-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-[#0590f9]">While transport is arranged</p>
          <h3 className="text-lg sm:text-xl font-semibold text-[#001f3e] mt-1">{variant.title}: classifying questions</h3>
          <p className="text-sm text-[#6e8298] mt-1">These questions support the referral. They do not diagnose the patient.</p>
        </div>
        {variant.questions.map((question) => {
          const missing = hasStarted && !answers[question.code];
          const options = caregiverReported || question.allowUnknown ? [...YES_NO_OPTIONS, UNKNOWN_OPTION] : YES_NO_OPTIONS;
          return (
            <fieldset key={question.code} className={cn("rounded-[16px] bg-white border p-4 sm:p-5 flex flex-col gap-3", missing ? "border-[#d44424]" : "border-[#e4e8ec]") }>
              <legend className="sr-only">{question.prompt_en}</legend>
              <div className="flex items-start gap-2">
                <span className="mt-0.5 rounded-full bg-[#eef5fc] px-2 py-0.5 text-[10px] font-semibold text-[#4c6f91] shrink-0">{question.code}</span>
                <p className="text-sm sm:text-base font-medium text-[#242b33]">{question.prompt_en}</p>
              </div>
              <p className="text-xs text-[#6e8298]">{question.prompt_ha}</p>
              <div className={cn("grid gap-2", options.length === 2 ? "grid-cols-2" : "grid-cols-3")}>
                {options.map((option) => {
                  const selected = answers[question.code] === option.value;
                  return (
                    <button key={option.value} type="button" onClick={() => setAnswers((current) => ({ ...current, [question.code]: option.value }))} className={cn("min-h-11 rounded-[12px] border px-2 py-2 text-xs sm:text-sm font-medium flex flex-col items-center justify-center", selected ? "bg-[#0073f3] border-[#0073f3] text-white" : "bg-white border-[#d8e0e7] text-[#242b33]") }>
                      {option.label}<span className="text-[10px] opacity-75">{option.ha}</span>
                    </button>
                  );
                })}
              </div>
              {missing && <p className="text-xs font-medium text-[#d44424]">Answer this question to continue.</p>}
            </fieldset>
          );
        })}
      </section>

      <div className="encounter-action-bar">
        {onPrevious ? <button type="button" onClick={onPrevious} className="min-h-11 rounded-[12px] border border-[#e4e8ec] bg-white px-5 text-sm font-medium">Previous</button> : <span />}
        <button type="button" onClick={handleContinue} disabled={!allAnswered} className="min-h-11 rounded-[12px] bg-[#0073f3] px-6 sm:px-8 text-sm sm:text-base font-medium text-white shadow-sm disabled:opacity-50">
          Continue to details &amp; consent
        </button>
      </div>
    </div>
  );
}
